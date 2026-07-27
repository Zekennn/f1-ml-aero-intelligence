import pandas as pd
from sklearn.model_selection import train_test_split
from sklearn.neural_network import MLPRegressor
from sklearn.metrics import mean_squared_error, r2_score
from sklearn.preprocessing import StandardScaler
import joblib

df = pd.read_csv("../data/real_2026_data.csv")

if df.empty:
    print("Error: No real 2026 data found to train on.")
    exit()

# Features
X = df[['top_speed_ms', 'wing_angle', 'drs_active']]
# Targets: Lap Time, Drag, Downforce
y = df[['lap_time', 'estimated_drag_N', 'estimated_downforce_N']]

# We should scale features because lap times and forces have vastly different magnitudes
scaler_X = StandardScaler()
scaler_y = StandardScaler()

X_scaled = scaler_X.fit_transform(X)
y_scaled = scaler_y.fit_transform(y)

X_train, X_test, y_train, y_test = train_test_split(X_scaled, y_scaled, test_size=0.2, random_state=42)

model = MLPRegressor(
    hidden_layer_sizes=(128, 64),
    max_iter=5000,
    random_state=42
)

model.fit(X_train, y_train)

y_pred = model.predict(X_test)

mse = mean_squared_error(y_test, y_pred)
r2 = r2_score(y_test, y_pred)

print("Real 2026 Data Model Training Complete")
print(f"MSE (scaled): {mse}")
print(f"R2 Score: {r2}")

joblib.dump(model, "../models/real_2026_model.pkl")
joblib.dump(scaler_X, "../models/scaler_X.pkl")
joblib.dump(scaler_y, "../models/scaler_y.pkl")

print("Model and scalers saved to ../models/")
