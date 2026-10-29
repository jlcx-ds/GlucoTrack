import { GoogleGenAI } from "@google/genai";

const apiKey = import.meta.env.VITE_GEMINI_API_KEY || "";
const ai = new GoogleGenAI({ apiKey });

// Helper function to call your local XGBoost model
export async function getGlucosePrediction(featureArray) {
  try {
    const response = await fetch("http://localhost:8000/predict", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ features: featureArray }),
    });
    return await response.json();
  } catch (error) {
    console.error("FastAPI Model Error:", error);
    return null;
  }
}

// Main AI chat function combining ML prediction with LLM context
export async function askGlucoTrackAI(userPrompt, chatHistory = [], numericFeatures = null) {
  try {
    let augmentedPrompt = userPrompt;

    // If numerical features are provided, get a prediction from XGBoost first
    if (numericFeatures) {
      const mlResult = await getGlucosePrediction(numericFeatures);
      if (mlResult) {
        augmentedPrompt = `[SYSTEM ML DATA: Predicted Glucose = ${mlResult.predicted_glucose} mg/dL, Status = ${mlResult.status}]\nUser Question: ${userPrompt}`;
      }
    }

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: [
        ...(Array.isArray(chatHistory) ? chatHistory : []),
        { role: "user", parts: [{ text: augmentedPrompt }] }
      ]
    });

    return response.text;
  } catch (err) {
    console.error("AI Service Error:", err);
    throw err;
  }
}