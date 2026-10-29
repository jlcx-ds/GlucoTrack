from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional

app = FastAPI(title="GlucoTrack Prediction API")

# Enable CORS so your React frontend running on port 5173 can talk to Python
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Allows all origins for development
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Request schema for pre-meal prediction
class PreMealPredictionRequest(BaseModel):
    net_carbs: float
    premeal_glucose: float
    protein: Optional[float] = 0.0
    fat: Optional[float] = 0.0

# Response schema
class PredictionResponse(BaseModel):
    predicted_postmeal_glucose: float
    estimated_spike: float
    unit: str = "mmol/L"

@app.get("/")
def read_root():
    return {"status": "ok", "message": "GlucoTrack Python API is running"}

@app.post("/api/predict", response_model=PredictionResponse)
def predict_glucose(data: PreMealPredictionRequest):
    try:
        # Clinical estimation baseline: 10g net carbs typically raises blood glucose by ~0.8 to 1.0 mmol/L depending on sensitivity
        carb_impact = (data.net_carbs / 10.0) * 0.9
        
        # Protein and fat delay absorption slightly but contribute to late spikes
        protein_impact = (data.protein / 10.0) * 0.1
        
        total_estimated_spike = carb_impact + protein_impact
        predicted_reading = round(data.premeal_glucose + total_estimated_spike, 1)

        return PredictionResponse(
            predicted_postmeal_glucose=predicted_reading,
            estimated_spike=round(total_estimated_spike, 1),
            unit="mmol/L"
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="127.0.0.1", port=8000, reload=True)