import numpy as np, pandas as pd, joblib, os
from sklearn.ensemble import IsolationForest
from sklearn.preprocessing import StandardScaler

class AnomalyDetector:
    def __init__(self, contamination=0.05):
        self.model  = IsolationForest(n_estimators=200,
            contamination=contamination, random_state=42, n_jobs=-1)
        self.scaler = StandardScaler()
        self.is_trained = False

    def train(self, features: pd.DataFrame):
        X = self.scaler.fit_transform(features.values)
        self.model.fit(X)
        self.is_trained = True
        self._save()
        print(f"Trained on {len(features)} samples")

    def predict(self, features: pd.DataFrame) -> dict:
        if not self.is_trained: self._load()
        X      = self.scaler.transform(features.values)
        flags  = self.model.predict(X)
        scores = self.model.score_samples(X)
        rng    = scores.max() - scores.min()
        health = np.clip(
            (scores - scores.min()) / (rng if rng > 0 else 1) * 100, 0, 100)
        level = ("normal"   if health[-1] >= 60 else
                 "warning"  if health[-1] >= 30 else "critical")
        return {"anomaly_flags": flags.tolist(),
                "health_scores": health.tolist(),
                "current_health": float(health[-1]),
                "alert_level": level}

    def _save(self):
        os.makedirs("saved_models", exist_ok=True)
        joblib.dump(self.model,  "saved_models/anomaly.pkl")
        joblib.dump(self.scaler, "saved_models/anomaly_scaler.pkl")

    def _load(self):
        self.model  = joblib.load("saved_models/anomaly.pkl")
        self.scaler = joblib.load("saved_models/anomaly_scaler.pkl")
        self.is_trained = True