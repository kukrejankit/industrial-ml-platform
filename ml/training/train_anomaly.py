import sys
import os
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import pandas as pd
import sqlalchemy
from models.anomaly import AnomalyDetector
from models.features import engineer_features

engine = sqlalchemy.create_engine(
    'mysql+pymysql://mlapp:Saraswati%402112@localhost/industrial_ml')

# Load data for ALL assets not just asset 1
df = pd.read_sql("""
    SELECT sr.tag_id, sr.value, sr.recorded_at
    FROM sensor_readings sr
    JOIN sensor_tags st ON sr.tag_id = st.id
    WHERE sr.recorded_at < NOW() - INTERVAL 5 DAY
    ORDER BY sr.recorded_at ASC
    LIMIT 100000
""", engine)

print(f"Loaded {len(df):,} readings from all assets")
features = engineer_features(df)
print(f"Feature matrix: {features.shape}")

detector = AnomalyDetector(contamination=0.05)
detector.train(features)
print("Anomaly model saved!")
