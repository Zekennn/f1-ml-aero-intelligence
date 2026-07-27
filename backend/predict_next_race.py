import joblib
import pandas as pd
import numpy as np

try:
    model = joblib.load("../models/real_2026_model.pkl")
    scaler_X = joblib.load("../models/scaler_X.pkl")
    scaler_y = joblib.load("../models/scaler_y.pkl")
except FileNotFoundError:
    print("Models not found. Please train the real model first.")
    exit()

print("--- 2026 Race Prediction Engine ---")

# Let's predict for a hypothetical next race
# Assume top speeds of 320 km/h to 340 km/h, wing angle 10-15
test_speed_kmh = 330.0
test_speed_ms = test_speed_kmh / 3.6
wing_angle = 12.0
drs_active = 1.0

input_df = pd.DataFrame([{
    'top_speed_ms': test_speed_ms,
    'wing_angle': wing_angle,
    'drs_active': drs_active
}])

# Scale input
X_scaled = scaler_X.transform(input_df)

# Predict
y_pred_scaled = model.predict(X_scaled)

# Inverse scale to get actual values
y_pred = scaler_y.inverse_transform(y_pred_scaled)

lap_time = y_pred[0][0]
drag = y_pred[0][1]
downforce = y_pred[0][2]

# Format lap time as M:SS.mmm
minutes = int(lap_time // 60)
seconds = lap_time % 60

print(f"Input: {test_speed_kmh} km/h Top Speed, {wing_angle} Wing Angle, DRS {'ON' if drs_active else 'OFF'}")
print(f"Predicted Lap Time: {minutes}:{seconds:06.3f}")
print(f"Predicted Aero Drag: {drag:.2f} N")
print(f"Predicted Aero Downforce: {downforce:.2f} N")
