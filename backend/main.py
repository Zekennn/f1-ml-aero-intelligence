from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
from fastapi.responses import HTMLResponse, FileResponse
import joblib
import numpy as np
import os

# Internal Modules
from data_manager import load_track_data, load_team_data, load_race_lap_data, load_circuit_info, TEAM_COLORS
from physics import interpolate_telemetry, update_tire_temperatures, predict_lap_time

app = FastAPI(title="F1 2025 Monaco Intelligence")

# Serve the frontend directory
# Assuming main.py is in /backend and index.html is in /frontend
frontend_path = os.path.join(os.path.dirname(__file__), "..", "frontend")
app.mount("/static", StaticFiles(directory=frontend_path), name="static")

# Load Initial Data
track_points = load_track_data()
team_data = load_team_data()
avg_lap_time = load_race_lap_data()
circuit_info = load_circuit_info()
track_length = len(track_points)

# Global Simulation State
lap_progress = 0.0
current_lap = 1
total_laps = 78
tire_temps = {"FL": 90.0, "FR": 90.0, "RL": 90.0, "RR": 90.0}
prev_speed = 0.0

# Load ML Model
model_path = os.path.join(os.path.dirname(__file__), "..", "models", "aero_model.pkl")
model = joblib.load(model_path)

@app.get("/")
def home():
    return {"message": "Welcome to F1 Aero & Engine Intelligence - Monaco 2025"}

@app.get("/live", response_class=HTMLResponse)
def live_dashboard():
    """Serve the modular index.html"""
    html_file = os.path.join(frontend_path, "index.html")
    return FileResponse(html_file)


@app.get("/telemetry")
def telemetry(compound: str = "SOFT"):
    global lap_progress, current_lap, tire_temps, prev_speed
    
    # Increment progress
    lap_progress += 0.005  
    if lap_progress >= 1:
        lap_progress = 0.0
        current_lap += 1

    # Physics Calculations
    tel = interpolate_telemetry(lap_progress, track_points, track_length)
    tire_temps = update_tire_temperatures(tire_temps, tel['speed'], tel['rpm'], tel['brake_raw'])
    tire_age = (current_lap % 15) + 1
    pred_lap_time = predict_lap_time(avg_lap_time, current_lap, tire_age)

    # ML Prediction - Refined for Monaco Accuracy (Highest Wing Angle: 15)
    # Using 15 as it's the maximum in our aero_dataset and Monaco is max downforce
    prediction = model.predict(np.array([[tel['speed'], 15, 1 if tel['drs_raw'] >= 10 else 0]]))

    return {
        "lap_progress": lap_progress,
        "current_lap": current_lap,
        "total_laps": total_laps,
        "x": tel['x'], "y": tel['y'], "speed": tel['speed'], 
        "rpm": int(tel['rpm']), 
        "gear": "R" if tel['gear'] == -1 else (tel['gear'] if tel['gear'] > 0 else "N"),
        "throttle": round(float(tel['throttle']), 1),
        "brake": tel['brake_raw'],
        "drs": 1 if tel['drs_raw'] >= 10 else 0,
        "predicted_drag": float(prediction[0][0]),
        "predicted_downforce": float(prediction[0][1]),
        "tire_temps": {k: float(f"{v:.1f}") for k, v in tire_temps.items()},
        "predicted_lap_time": float(f"{pred_lap_time:.3f}"),
        "tire_age": int(tire_age)
    }

@app.get("/teams")
def get_teams():
    return {"teams": team_data, "colors": TEAM_COLORS}

@app.get("/track")
def get_track():
    return {"points": track_points}

@app.get("/circuit")
def get_circuit():
    return circuit_info

@app.get("/predict")
def predict(speed: float, wing_angle: float, drs: int):
    input_data = np.array([[speed, wing_angle, drs]])
    prediction = model.predict(input_data)
    return {
        "speed": speed,
        "predicted_drag": float(prediction[0][0]),
        "predicted_downforce": float(prediction[0][1])
    }

# Static Asset Catch-All (Must be last)
@app.get("/{path:path}")
async def serve_frontend(path: str):
    file_path = os.path.join(frontend_path, path)
    if os.path.isfile(file_path):
        return FileResponse(file_path)
    return HTMLResponse(status_code=404)
