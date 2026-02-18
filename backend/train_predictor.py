import pandas as pd
import numpy as np
from sklearn.linear_model import LinearRegression
import joblib
import os
import json

# Load historical data
df = pd.read_csv("../data/driver_performance_2021_2025.csv")

# Feature Engineering: Calculate momentum and consistency for each driver
drivers = df['Driver'].unique()
predictor_data = []

for driver in drivers:
    driver_df = df[df['Driver'] == driver].sort_values('Year')
    
    # Needs at least 2 years for trend
    if len(driver_df) < 2:
        continue
        
    points = driver_df['Points'].values
    years = driver_df['Year'].values
    
    # Linear trend of points
    model = LinearRegression().fit(years.reshape(-1, 1), points)
    trend = model.coef_[0]
    
    # Predict 2026 points based on trend
    pred_2026 = model.predict([[2026]])[0]
    
    # Clip prediction to realistic min/max
    pred_2026 = max(0, min(600, pred_2026))
    
    # Recent form (last 2 years weight)
    recent_points = driver_df['Points'].iloc[-1]
    
    # Tech Index momentum (team strength trajectory)
    tech_trend = np.polyfit(years, driver_df['TechIndex'].values, 1)[0]
    pred_tech_2026 = max(0.7, min(1.0, driver_df['TechIndex'].iloc[-1] + tech_trend))

    predictor_data.append({
        "Driver": driver,
        "CurrentTeam": driver_df['Team'].iloc[-1],
        "PredictedPoints": float(pred_2026),
        "HistoricalPoints": points.tolist(),
        "Years": years.tolist(),
        "WinProbability": 0.0, # Will calculate below
        "TechIndex": float(pred_tech_2026)
    })

# Calculate Relative Win Probability
total_pred_points = sum(d['PredictedPoints'] for d in predictor_data)
for d in predictor_data:
    d['WinProbability'] = round((d['PredictedPoints'] / total_pred_points) * 100, 1)

# Sort by win probability
predictor_data = sorted(predictor_data, key=lambda x: x['WinProbability'], reverse=True)

# Save the predictor results for backend to serve
os.makedirs("../models", exist_ok=True)
with open("../models/predictor_results.json", "w") as f:
    json.dump({"predictions": predictor_data, "last_update": 2025}, f, indent=4)

print("2026 Predictor model results generated and saved to ../models/predictor_results.json")
