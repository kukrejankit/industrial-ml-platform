from fastapi import FastAPI
from pydantic import BaseModel
from typing import List, Optional
import pandas as pd
from models.anomaly import AnomalyDetector
from models.rul import RULPredictor
from models.features import engineer_features
import uvicorn

app = FastAPI(title="Industrial ML Service")
anomaly = AnomalyDetector()
rul     = RULPredictor()

# Try to load existing models on startup

@app.on_event("startup")

async def load_models():

    try:

        anomaly._load()

        print("Anomaly model loaded successfully")

    except Exception as e:

        print(f"Anomaly model not found: {e}")

    try:

        rul._load()

        print("RUL model loaded successfully")

    except Exception as e:

        print(f"RUL model not found: {e}")

class Reading(BaseModel):
    tagId: int; value: float; recordedAt: Optional[str] = None

class Batch(BaseModel):
    assetId: int; readings: List[Reading]

@app.get("/health")
def health():
    return {"status":"ok",
            "anomaly_trained": anomaly.is_trained,
            "rul_trained":     rul.is_trained}

@app.post("/predict/anomaly")
def predict_anomaly(batch: Batch):
    try:
        print(f"Received {len(batch.readings)} readings for asset {batch.assetId}")

        df = pd.DataFrame([{
            "tag_id":      r.tagId,
            "value":       r.value,
            "recorded_at": r.recordedAt
        } for r in batch.readings])

        print(f"DataFrame shape: {df.shape}")

        features = engineer_features(df)

        print(f"Features shape: {features.shape}")

        # Lower minimum to 2 instead of checking empty
        if len(features) < 2:
            print("Still insufficient - returning default")
            return {
                "current_health": 75.0,
                "alert_level":    "normal",
                "asset_id":       batch.assetId,
                "message":        "insufficient data"
            }

        result = anomaly.predict(features)
        result["asset_id"] = batch.assetId
        print(f"Prediction result: {result}")
        return result

    except Exception as e:
        print(f"Error: {e}")
        import traceback
        traceback.print_exc()
        return {
            "current_health": 75.0,
            "alert_level":    "normal",
            "asset_id":       batch.assetId,
            "error":          str(e)
        }

@app.post("/predict/rul")
def predict_rul(batch: Batch):
    df = pd.DataFrame([{"tag_id":r.tagId,"value":r.value,
                        "recorded_at":r.recordedAt}
                       for r in batch.readings])
    result = rul.predict(engineer_features(df))
    result["asset_id"] = batch.assetId
    return result

@app.post("/train/anomaly")
def train_anomaly(batch: Batch):
    df = pd.DataFrame([{"tag_id":r.tagId,"value":r.value,
                        "recorded_at":r.recordedAt}
                       for r in batch.readings])
    anomaly.train(engineer_features(df))
    return {"status":"trained"}

if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=8001, reload=True)