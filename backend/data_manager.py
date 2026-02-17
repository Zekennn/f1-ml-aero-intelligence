import pandas as pd
import os
import json

# Base path relative to backend/
BASE_DATA_DIR = os.path.join(os.path.dirname(__file__), "..", "data")

def load_track_data():
    """Load real Monaco track data (2024 Pole Lap rich telemetry)"""
    try:
        path = os.path.join(BASE_DATA_DIR, "tracks", "monaco_real_track.csv")
        track_df = pd.read_csv(path)
        # Columns: X, Y, Speed, RPM, nGear, Throttle, Brake, DRS
        return track_df[['X', 'Y', 'Speed', 'RPM', 'nGear', 'Throttle', 'Brake', 'DRS']].values.tolist()
    except Exception as e:
        print(f"Error loading real track data: {e}")
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

def load_race_lap_data():
    """Load 2024 Monaco Race Lap data for predictions"""
    try:
        path = os.path.join(BASE_DATA_DIR, "monaco_race_laps_2024.csv")
        race_laps_df = pd.read_csv(path)
        avg_lap_time = race_laps_df['LapTime_Sec'].mean()
        return avg_lap_time
    except Exception as e:
        print(f"Error loading race lap data: {e}")
        return 75.0

def load_circuit_info():
    """Load Monaco circuit metadata (DRS zones, etc.)"""
    try:
        path = os.path.join(BASE_DATA_DIR, "tracks", "monaco_circuit_info.json")
        with open(path, 'r') as f:
            return json.load(f)
    except Exception as e:
        print(f"Error loading circuit info: {e}")
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
