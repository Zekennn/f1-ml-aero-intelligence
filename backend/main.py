from fastapi import FastAPI
import joblib
import numpy as np
import pandas as pd
import os
import json

# Internal Modules
# Internal Modules
try:
    from .data_manager import load_track_data, load_team_data, load_race_lap_data, load_circuit_info, TEAM_COLORS
    from .physics import interpolate_telemetry, update_tire_temperatures, predict_lap_time
except ImportError:
    from data_manager import load_track_data, load_team_data, load_race_lap_data, load_circuit_info, TEAM_COLORS
    from physics import interpolate_telemetry, update_tire_temperatures, predict_lap_time

# FastF1 calendar + driver data, refreshed in the background (see live_data.py)
try:
    from . import live_data
    from .update_calendar import CALENDAR_FILE
    from .update_drivers import DRIVERS_FILE
except ImportError:
    import live_data
    from update_calendar import CALENDAR_FILE
    from update_drivers import DRIVERS_FILE

app = FastAPI(title="F1 2025 Monaco Intelligence")

# This app is a JSON API only. The website lives in /web (Next.js) and
# reaches these endpoints through its /backend/* proxy.

# State for Current Track
# Simulation State
SIM_STATE = {
    "track_name": "Monaco",
    "lap_progress": 0.0,
    "current_lap": 1,
    "total_laps": 78,
    "tire_temps": {"FL": 90.0, "FR": 90.0, "RL": 90.0, "RR": 90.0},
    "prev_speed": 0.0,
    "downforce_history": [],
    "current_lap_downforce": [],
    "next_lap_forecast": {"downforce": 0.0, "confidence": 0.0},
    "track_points": [],
    "circuit_info": {"drs_zones": []},
    "avg_lap_time": 75.0,
    "track_length": 0
}

TRACK_CONFIGS = {
    "Monaco": {"laps": 78, "wing": 15.0},
    "Australia": {"laps": 58, "wing": 10.0},
    "China": {"laps": 56, "wing": 11.0}
}

def reload_track_data(track_name):
    SIM_STATE["track_name"] = track_name
    SIM_STATE["track_points"] = load_track_data(track_name)
    SIM_STATE["circuit_info"] = load_circuit_info(track_name)
    SIM_STATE["avg_lap_time"] = load_race_lap_data(track_name)
    SIM_STATE["track_length"] = len(SIM_STATE["track_points"])
    config = TRACK_CONFIGS.get(track_name, {"laps": 70, "wing": 12.0})
    SIM_STATE["total_laps"] = config["laps"]
    SIM_STATE["wing"] = config["wing"]
    
    # Reset simulation markers
    SIM_STATE["lap_progress"] = 0.0
    SIM_STATE["current_lap"] = 1
    SIM_STATE["downforce_history"] = []
    SIM_STATE["current_lap_downforce"] = []
    SIM_STATE["next_lap_forecast"] = {"downforce": 0.0, "confidence": 0.0}

# Initial Load
reload_track_data("Monaco")
team_data = load_team_data()

# Load ML Model
model_path = os.path.join(os.path.dirname(__file__), "..", "models", "aero_model.pkl")
model = joblib.load(model_path)

@app.get("/")
def root():
    """Health check. The website itself runs from /web on port 3000."""
    return {"status": "ok", "website": "http://localhost:3000"}

@app.get("/api/drivers-champ")
def drivers_champ_data():
    """Serve 2026 Champion Prediction JSON data"""
    predictor_path = os.path.join(os.path.dirname(__file__), "..", "models", "predictor_results.json")
    try:
        with open(predictor_path, 'r') as f:
            return json.load(f)
    except Exception as e:
        return {"error": f"Could not load predictor data: {e}"}

@app.on_event("startup")
def start_live_data():
    live_data.start()

def _read_json(path):
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except (OSError, ValueError):
        return {"error": f"{path.name} not available yet"}

@app.get("/api/calendar")
def calendar_data():
    """2026 race calendar built from FastF1 (auto-refreshed)."""
    return _read_json(CALENDAR_FILE)

@app.get("/api/drivers")
def drivers_data():
    """2026 driver standings from FastF1 (auto-refreshed)."""
    return _read_json(DRIVERS_FILE)

@app.get("/api/live-data")
def live_data_status():
    """When the FastF1 data was last refreshed and when the next refresh is due."""
    return live_data.status()

@app.post("/api/live-data/refresh")
def live_data_refresh():
    """Refresh the FastF1 data now instead of waiting for the next scheduled run."""
    live_data.request_refresh()
    return {"requested": True}

@app.post("/set_track")
def set_track(track_name: str):
    if track_name not in TRACK_CONFIGS:
        return {"error": "Invalid track name"}
        
    reload_track_data(track_name)
    return {"message": f"Track switched to {track_name}", "circuit_info": SIM_STATE["circuit_info"]}


@app.get("/telemetry")
def telemetry(compound: str = "SOFT"):
    # Increment progress
    SIM_STATE["lap_progress"] += 0.005  
    if SIM_STATE["lap_progress"]  >= 1:
        SIM_STATE["lap_progress"]  = 0.0
        SIM_STATE["current_lap"] += 1
        # Calculate average downforce for the completed lap
        if SIM_STATE["current_lap_downforce"]:
            avg_df = sum(SIM_STATE["current_lap_downforce"]) / len(SIM_STATE["current_lap_downforce"])
            SIM_STATE["downforce_history"].append(avg_df)
            SIM_STATE["current_lap_downforce"] = []
            
            # Simple Time-Series Forecast (SMA-3 or similar)
            if len(SIM_STATE["downforce_history"]) >= 2:
                recent = SIM_STATE["downforce_history"][-3:]
                # We update the baseline here, but real-time refinement happens below
                SIM_STATE["next_lap_forecast"]["downforce"] = sum(recent) / len(recent)
                SIM_STATE["next_lap_forecast"]["confidence"] = min(0.95, 0.4 + (len(SIM_STATE["downforce_history"]) / 10.0))
            else:
                SIM_STATE["next_lap_forecast"]["downforce"] = avg_df
                SIM_STATE["next_lap_forecast"]["confidence"] = 0.4

    # Physics Calculations
    tel = interpolate_telemetry(SIM_STATE["lap_progress"], SIM_STATE["track_points"], SIM_STATE["track_length"])
    SIM_STATE["tire_temps"] = update_tire_temperatures(SIM_STATE["tire_temps"], tel['speed'], tel['rpm'], tel['brake_raw'])
    tire_age = (SIM_STATE["current_lap"] % 15) + 1
    pred_lap_time = predict_lap_time(SIM_STATE["avg_lap_time"], SIM_STATE["current_lap"], tire_age)

    # ML Prediction
    input_df = pd.DataFrame([{
        'speed': tel['speed'],
        'wing': SIM_STATE.get("wing", 12.0),
        'drs': 1 if tel['drs_raw'] >= 10 else 0
    }])
    
    prediction = model.predict(input_df)
    df_val = float(prediction[0][1])
    SIM_STATE["current_lap_downforce"].append(df_val)

    # Real-time Forecast Refinement (Always active)
    if len(SIM_STATE["current_lap_downforce"]) > 10:
        current_avg = sum(SIM_STATE["current_lap_downforce"]) / len(SIM_STATE["current_lap_downforce"])
        
        # Blend current lap performance into the forecast
        if SIM_STATE["downforce_history"]:
            # If we have history, blend 70% trend + 30% current lap form
            trend_val = SIM_STATE["next_lap_forecast"]["downforce"]
            SIM_STATE["next_lap_forecast"]["downforce"] = (trend_val * 0.7) + (current_avg * 0.3)
        else:
            # First lap warmup
            SIM_STATE["next_lap_forecast"]["downforce"] = current_avg
            
        # Confidence increases with samples
        base_conf = 0.4 if SIM_STATE["downforce_history"] else 0.1
        SIM_STATE["next_lap_forecast"]["confidence"] = min(0.9, base_conf + (len(SIM_STATE["current_lap_downforce"]) / 1000.0))

    return {
        "lap_progress": SIM_STATE["lap_progress"],
        "current_lap": SIM_STATE["current_lap"],
        "total_laps": SIM_STATE["total_laps"],
        "x": tel['x'], "y": tel['y'], "speed": tel['speed'], 
        "rpm": int(tel['rpm']), 
        "gear": "R" if tel['gear'] == -1 else (tel['gear'] if tel['gear'] > 0 else "N"),
        "throttle": round(float(tel['throttle']), 1),
        "brake": tel['brake_raw'],
        "drs": 1 if tel['drs_raw'] >= 10 else 0,
        "predicted_drag": float(prediction[0][0]),
        "predicted_downforce": df_val,
        "tire_temps": {k: float(f"{v:.1f}") for k, v in SIM_STATE["tire_temps"].items()},
        "predicted_lap_time": float(f"{pred_lap_time:.3f}"),
        "tire_age": int(tire_age),
        "next_lap_forecast": SIM_STATE["next_lap_forecast"]
    }


@app.get("/teams")
def get_teams():
    return {"teams": team_data, "colors": TEAM_COLORS}

@app.get("/track")
def get_track():
    return {"points": SIM_STATE["track_points"]}

@app.get("/current_track")
def get_current_track():
    return {"track": SIM_STATE["track_name"]}

@app.get("/circuit")
def get_circuit():
    return SIM_STATE["circuit_info"]

@app.get("/predict")
def predict(speed: float, wing_angle: float, drs: int):
    input_data = np.array([[speed, wing_angle, drs]])
    prediction = model.predict(input_data)
    return {
        "speed": speed,
        "predicted_drag": float(prediction[0][0]),
        "predicted_downforce": float(prediction[0][1])
    }
