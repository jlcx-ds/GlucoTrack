from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import pickle
import numpy as np

app = FastAPI()

# Enable CORS so your React frontend can talk to your FastAPI backend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Allows all origins for development
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Load your successfully trained XGBoost model on startup
try:
    with open("glucotrack_xgb.pkl", "rb") as f:
        model = pickle.load(f)
    print("XGBoost model loaded successfully!")
except Exception as e:
    model = None
    print(f"Warning: Model could not be loaded. Error: {e}")

@app.post("/predict")
def predict_glucose(data: dict):
    if model is None:
        return {"error": "Model not loaded on backend."}
    
    # Extract current and historical parameters from the incoming JSON payload
    net_carbs = data.get("net_carbs", 0.0)
    starting_glucose = data.get("starting_glucose", 5.0)
    prev_glucose = data.get("prev_glucose", starting_glucose)  # Fallback to starting glucose if missing
    prev_carbs = data.get("prev_carbs", 0.0)
    
    # Format features in the exact same 4-feature order used during training:
    # ['Net Carbs (g)', 'Starting_Glucose', 'Prev_Glucose', 'Prev_Carbs']
    features = np.array([[net_carbs, starting_glucose, prev_glucose, prev_carbs]])
    
    predicted_glucose = model.predict(features)[0]
    
    return {
        "predicted_glucose": round(float(predicted_glucose), 2),
        "status": "Target Range" if predicted_glucose < 8.0 else "High Spike Expected"
    }