// src/services/predictionService.js

/**
 * Trains/calculates personalized glucose predictions based on historical logs and diabetic insights.
 * @param {number} netCarbs - The net carbs for the current meal.
 * @param {number} currentGlucose - The current blood glucose reading in mmol/L.
 * @param {Array} historicalLogs - Past user logs.
 * @returns {Promise<{ predicted_postmeal_glucose: number, confidence: string }>}
 */
export async function getGlucosePrediction(netCarbs, currentGlucose, historicalLogs = []) {
  // 1. Analyze historical responsiveness (Carb impact factor)
  let avgCarbImpact = 0.5; // default mmol/L rise per 10g carbs
  
  if (historicalLogs && historicalLogs.length > 0) {
    const postMealLogs = historicalLogs.filter(l => l.readingType === "Post-Meal" && l.netCarbs > 0);
    if (postMealLogs.length >= 3) {
      // Calculate average rise per gram of carb from past data
      const totalCarb = postMealLogs.reduce((sum, l) => sum + l.netCarbs, 0);
      const avgGlucoseVal = postMealLogs.reduce((sum, l) => sum + l.glucose, 0) / postMealLogs.length;
      if (totalCarb > 0) {
        avgCarbImpact = Math.max(0.05, (avgGlucoseVal / totalCarb) * 0.8);
      }
    }
  }

  // 2. Predict peak post-meal glucose using current reading + carb load * historical impact factor
  const predictedRise = netCarbs * avgCarbImpact;
  const rawPrediction = currentGlucose + predictedRise;

  // 3. Round to 1 decimal place
  const predicted_postmeal_glucose = Math.round(rawPrediction * 10) / 10;

  return {
    predicted_postmeal_glucose,
    confidence: historicalLogs.length > 5 ? "High (Trained on history)" : "Moderate (Baseline estimate)"
  };
}