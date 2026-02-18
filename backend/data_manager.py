import pandas as pd
import os
import json

# Base path relative to backend/
BASE_DATA_DIR = os.path.join(os.path.dirname(__file__), "..", "data")

def load_track_data(track_name="Monaco"):
    """Load real track data (rich telemetry) for the specified track"""
    track_file_map = {
        "Monaco": "monaco_real_track.csv",
        "Australia": "australia_real_track.csv",
        "China": "china_real_track.csv"
    }
    
    filename = track_file_map.get(track_name, "monaco_real_track.csv")
    
    try:
        path = os.path.join(BASE_DATA_DIR, "tracks", filename)
        if not os.path.exists(path):
             print(f"Track file not found: {path}")
             return [[0, 0, 0, 0, 1, 0, False, 0]]
             
        track_df = pd.read_csv(path)
        # Columns: X, Y, Speed, RPM, nGear, Throttle, Brake, DRS
        return track_df[['X', 'Y', 'Speed', 'RPM', 'nGear', 'Throttle', 'Brake', 'DRS']].values.tolist()
    except Exception as e:
        print(f"Error loading real track data for {track_name}: {e}")
        return [[0, 0, 0, 0, 1, 0, False, 0]]

def load_team_data():
    """Load 2025 Team Engine Performance data"""
    try:
        path = os.path.join(BASE_DATA_DIR, "team_engine_performance_2025.csv")
        teams_df = pd.read_csv(path)
        return teams_df.to_dict(orient='records')
    except Exception as e:
        print(f"Error loading team performance data: {e}")
        return []

def load_race_lap_data(track_name="Monaco"):
    """Load Race Lap data for predictions"""
    # For now, we only have Monaco specific file, but we can default or expand later
    # Ideally should correspond to track
    if track_name == "Monaco":
        filename = "monaco_race_laps_2024.csv"
    else:
        # Fallback or specific files if we had them
        # For this demo, let's just return a default average if file missing or different track
        return 80.0 if track_name == "Australia" else (95.0 if track_name == "China" else 75.0)

    try:
        path = os.path.join(BASE_DATA_DIR, filename)
        if os.path.exists(path):
            race_laps_df = pd.read_csv(path)
            avg_lap_time = race_laps_df['LapTime_Sec'].mean()
            return avg_lap_time
        return 75.0
    except Exception as e:
        print(f"Error loading race lap data: {e}")
        return 75.0

def load_circuit_info(track_name="Monaco"):
    """Load circuit metadata (DRS zones, etc.) for the specified track"""
    track_file_map = {
        "Monaco": "monaco_circuit_info.json",
        "Australia": "australia_circuit_info.json",
        "China": "china_circuit_info.json"
    }
    
    filename = track_file_map.get(track_name, "monaco_circuit_info.json")

    try:
        path = os.path.join(BASE_DATA_DIR, "tracks", filename)
        with open(path, 'r') as f:
            return json.load(f)
    except Exception as e:
        print(f"Error loading circuit info for {track_name}: {e}")
        return {"drs_zones": []}

# Team colors for UI
TEAM_COLORS = {
    "McLaren": "#FF8700",
    "Ferrari": "#E10600",
    "Red Bull Racing": "#0600EF",
    "Mercedes": "#00D2BE",
    "Aston Martin": "#006F62",
    "Alpine": "#0090FF",
    "Williams": "#005AFF",
    "Racing Bulls": "#0000FF",
    "Haas F1 Team": "#FFFFFF",
    "Kick Sauber": "#52E252"
}
