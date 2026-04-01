import numpy as np, requests, time
from datetime import datetime, timedelta

API = "http://localhost:5208/api/readings"

# Define tags for all 4 assets
# Format: asset_id -> {tag_id: config}
# You need to check your actual tag IDs from the database
# Asset 1 tags: 1-6, Asset 2 tags: 7-12, Asset 3: 13-18, Asset 4: 19-24

ASSETS = {
    1: {
        1: {"name":"inlet_pressure",  "base":1.2,  "noise":0.05},
        2: {"name":"outlet_pressure", "base":5.5,  "noise":0.10},
        3: {"name":"flow_rate",       "base":32.0, "noise":1.50},
        4: {"name":"motor_temp",      "base":55.0, "noise":2.00},
        5: {"name":"vibration",       "base":1.8,  "noise":0.20},
        6: {"name":"power_kw",        "base":18.0, "noise":0.50},
    },
    2: {
        7: {"name":"inlet_pressure",  "base":1.1,  "noise":0.05},
        8: {"name":"outlet_pressure", "base":5.3,  "noise":0.10},
        9: {"name":"flow_rate",       "base":30.0, "noise":1.50},
        10:{"name":"motor_temp",      "base":58.0, "noise":2.00},
        11:{"name":"vibration",       "base":2.1,  "noise":0.20},
        12:{"name":"power_kw",        "base":19.0, "noise":0.50},
    },
    3: {
        13:{"name":"inlet_pressure",  "base":1.3,  "noise":0.05},
        14:{"name":"outlet_pressure", "base":5.8,  "noise":0.10},
        15:{"name":"flow_rate",       "base":34.0, "noise":1.50},
        16:{"name":"motor_temp",      "base":52.0, "noise":2.00},
        17:{"name":"vibration",       "base":1.5,  "noise":0.20},
        18:{"name":"power_kw",        "base":42.0, "noise":1.00},
    },
    4: {
        19:{"name":"inlet_pressure",  "base":1.0,  "noise":0.05},
        20:{"name":"outlet_pressure", "base":5.0,  "noise":0.10},
        21:{"name":"flow_rate",       "base":28.0, "noise":1.50},
        22:{"name":"motor_temp",      "base":60.0, "noise":2.00},
        23:{"name":"vibration",       "base":2.5,  "noise":0.30},
        24:{"name":"power_kw",        "base":9.0,  "noise":0.30},
    },
}

def normal(tag, t):
    drift = tag["base"] * 0.03 * np.sin(2*np.pi*t/(24*3600))
    return tag["base"] + drift + np.random.normal(0, tag["noise"])

def degraded(tag, t, d):
    v = normal(tag, t)
    n = tag["name"]
    if n == "vibration":       return v + d * v * 3.0
    if n == "motor_temp":      return v + d * 25.0
    if n == "flow_rate":       return v * (1 - d * 0.30)
    if n == "power_kw":        return v * (1 + d * 0.20)
    if n == "outlet_pressure": return v * (1 - d * 0.15)
    return v

def stream_live():
    print("Streaming live data for all 4 assets every 3s...")
    print("Ctrl+C to stop")
    t = 0
    while True:
        batch = []
        for asset_id, tags in ASSETS.items():
            for tag_id, tag in tags.items():
                batch.append({
                    "tagId":      tag_id,
                    "value":      round(normal(tag, t), 4),
                    "recordedAt": datetime.utcnow().isoformat()
                })
        if t==0:
            tag_ids_sent = [str(r["tagId"]) for r in batch]
            print(f"Tag IDs: {', '.join(tag_ids_sent)}")
        try:
            r = requests.post(API, json=batch, timeout=3)
            print(f"t={t}s | {len(batch)} readings | {r.status_code}")
        except Exception as e:
            print(f"Error: {e}")
        t += 3
        time.sleep(3)

def upload_history():
    print("Generating 30 days for all 4 assets...")
    readings  = []
    days      = 30
    interval  = 60
    steps     = days * 24 * 3600 // interval
    fail_start = int(steps - 5 * 24 * 3600 / interval)
    t0        = datetime.utcnow() - timedelta(days=days)

    for i in range(steps):
        ts = (t0 + timedelta(seconds=i*interval)).isoformat()
        d  = (max(0,(i-fail_start)/(steps-fail_start))*0.9
              if i > fail_start else 0.0)
        for asset_id, tags in ASSETS.items():
            for tag_id, tag in tags.items():
                readings.append({
                    "tagId":      tag_id,
                    "value":      round(degraded(tag,i*interval,d), 4),
                    "recordedAt": ts
                })

    print(f"{len(readings):,} readings generated. Uploading...")
    for i in range(0, len(readings), 1000):
        r = requests.post(API, json=readings[i:i+1000], timeout=10)
        print(f"Batch {i//1000+1}: {r.status_code}")
        time.sleep(0.1)
    print("Done!")

if __name__ == "__main__":
    import sys
    stream_live() if len(sys.argv) > 1 and sys.argv[1] == "stream" \
    else upload_history()
