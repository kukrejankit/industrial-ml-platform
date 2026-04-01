import numpy as np, pandas as pd, joblib, os, shap
import xgboost as xgb
from sklearn.model_selection import train_test_split
from sklearn.metrics import mean_absolute_error

class RULPredictor:
    def __init__(self):
        self.model     = xgb.XGBRegressor(n_estimators=300,
            max_depth=6, learning_rate=0.05, random_state=42, n_jobs=-1)
        self.explainer = None
        self.is_trained = False
        self.feature_names = []

    def train(self, X: pd.DataFrame, y: pd.Series):
        self.feature_names = X.columns.tolist()
        X_tr, X_val, y_tr, y_val = train_test_split(
            X, y, test_size=0.2, random_state=42)
        self.model.fit(X_tr, y_tr,
            eval_set=[(X_val, y_val)], verbose=50)
        self.explainer = shap.TreeExplainer(self.model)
        mae = mean_absolute_error(y_val, self.model.predict(X_val))
        print(f"RUL MAE: {mae:.1f} days")
        self.is_trained = True
        self._save()

    def predict(self, X: pd.DataFrame) -> dict:
        if not self.is_trained: self._load()
        rul = np.maximum(self.model.predict(X), 0)
        sv  = self.explainer.shap_values(X.iloc[[-1]])
        imp = dict(zip(self.feature_names, np.abs(sv[0]).tolist()))
        top = sorted(imp.items(), key=lambda x: x[1], reverse=True)[:5]
        return {
            "rul_days":    int(rul[-1]),
            "confidence":  float(min(0.95,
                1 - np.std(rul[-10:]) / max(np.mean(rul[-10:]), 1))),
            "top_factors": [{"feature":k,"importance":round(v,4)}
                            for k,v in top]
        }

    def _save(self):
        os.makedirs("saved_models", exist_ok=True)
        joblib.dump(self.model,     "saved_models/rul.pkl")
        joblib.dump(self.explainer, "saved_models/rul_explainer.pkl")

    def _load(self):
        self.model     = joblib.load("saved_models/rul.pkl")
        self.explainer = joblib.load("saved_models/rul_explainer.pkl")
        self.feature_names = self.model.feature_names_in_.tolist()
        self.is_trained = True