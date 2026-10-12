import fastf1
import pandas as pd
import os

# Root directory relative to this script
ROOT_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))

# Enable cache
cache_dir = os.path.join(ROOT_DIR, 'cache')
if not os.path.exists(cache_dir):
    os.makedirs(cache_dir)
fastf1.Cache.enable_cache(cache_dir)

def get_monaco_race_data():
    print("Fetching 2024 Monaco Race Lap Data (Minimal)...")
    try:
        session = fastf1.get_session(2024, 'Monaco', 'R')
        # Load only laps
        session.load(laps=True, telemetry=False, weather=False, messages=False)

        # Get TOP 5 finishers for a good data set
        top_drivers = session.laps.pick_fastest()['Driver'] # Actually just pick VER for simplicity
        laps = session.laps.pick_driver('VER')
        
        data = laps[['LapNumber', 'LapTime', 'Compound', 'TyreLife']]
        data['LapTime_Sec'] = data['LapTime'].dt.total_seconds()
        
        output_dir = os.path.join(ROOT_DIR, 'data')
        csv_path = os.path.join(output_dir, 'monaco_race_laps_2024.csv')
        data.to_csv(csv_path, index=False)
        print(f"Saved: {csv_path}")
        return csv_path
    except Exception as e:
        print(f"Error: {e}")
        return None

if __name__ == "__main__":
    get_monaco_race_data()
