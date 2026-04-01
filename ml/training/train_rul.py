import sys
import os
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import pandas as pd
import numpy as np
import sqlalchemy
from models.rul import RULPredictor
from models.features import engineer_features

engine = sqlalchemy.create_engine(
    'mysql+pymysql://mlapp:Saraswati%402112@localhost/industrial_ml')

# Load all data for all assets
df = pd.read_sql("""
    SELECT sr.tag_id, sr.value, sr.recorded_at
    FROM sensor_readings sr
    JOIN sensor_tags st ON sr.tag_id = st.id
    ORDER BY sr.recorded_at ASC
    LIMIT 100000
""", engine)

print(f"Loaded {len(df):,} readings")
features = engineer_features(df)
print(f"Feature matrix: {features.shape}")

rul_labels = pd.Series(
    np.linspace(30, 0, len(features)),
    index=features.index)

predictor = RULPredictor()
predictor.train(features, rul_labels)
print("RUL model saved!")
