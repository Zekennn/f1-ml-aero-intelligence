import fastf1
import matplotlib.pyplot as plt
import pandas as pd
import json
import os

# Root directory relative to this script
ROOT_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))

# Enable cache to speed up data loading
cache_dir = os.path.join(ROOT_DIR, 'cache')
if not os.path.exists(cache_dir):
    os.makedirs(cache_dir)
fastf1.Cache.enable_cache(cache_dir)

def extract_monaco_data():
    print("Fetching 2024 Monaco GP Qualifying data...")
    try:
        # Load the session for 2024 (more recent and accurate)
        session = fastf1.get_session(2024, 'Monaco', 'Q')
        session.load()

        # Get the fastest lap (Charles Leclerc Pole Lap 2024)
        lap = session.laps.pick_fastest()
        print(f"Fastest lap driver: {lap['Driver']} - Time: {lap['LapTime']}")

        # Get telemetry data with all channels
        tel = lap.get_telemetry()
        
        # Select rich telemetry set
        # nGear is the current gear
        # Brake is boolean or pressure (FastF1 usually boolean)
        data = tel[['X', 'Y', 'Speed', 'RPM', 'nGear', 'Throttle', 'Brake', 'DRS']]
        
        # Ensure the output directory exists
        output_dir = os.path.join(ROOT_DIR, 'data', 'tracks')
        if not os.path.exists(output_dir):
            os.makedirs(output_dir)
            
        csv_path = os.path.join(output_dir, 'monaco_real_track.csv')
        data.to_csv(csv_path, index=False)
        print(f"Saved real Monaco 2024 telemetry to: {csv_path}")

        # --- NEW: Extract DRS Zones from Circuit Info ---
        circuit_info = session.get_circuit_info()
        drs_zones = []
        
        # Telemetry has 'Distance' which we use to map X,Y
        tel_with_dist = lap.get_telemetry().add_distance()
        
        # FastF1 DRS zones are usually given as start/end distance
        # We find the X,Y coordinates at those distances
        # Note: CircuitInfo doesn't always have drs_zones explicitly in a list, 
        # but we can detect them from the telemetry of a qualifying lap
        
        # Heuristic: Find continuous segments where DRS >= 10 in the POLE LAP
        data['Distance'] = tel_with_dist['Distance']
        drs_active = data[data['DRS'] >= 10]
        
        if not drs_active.empty:
            # Group into continuous segments (zones)
            drs_active['diff'] = drs_active['Distance'].diff()
            # If distance jump > 100m, it's a new zone
            zone_ids = (drs_active['diff'] > 100).cumsum()
            
            for zone_id, group in drs_active.groupby(zone_ids):
                drs_zones.append({
                    "start_x": float(group.iloc[0]['X']),
                    "start_y": float(group.iloc[0]['Y']),
                    "end_x": float(group.iloc[-1]['X']),
                    "end_y": float(group.iloc[-1]['Y']),
                    "points": group[['X', 'Y']].values.tolist()
                })
        
        circuit_meta = {
            "track": "Monaco",
            "year": 2024,
            "drs_zones": drs_zones,
            "total_distance": float(tel_with_dist['Distance'].max())
        }
        
        meta_path = os.path.join(output_dir, 'monaco_circuit_info.json')
        with open(meta_path, 'w') as f:
            json.dump(circuit_meta, f, indent=4)
        print(f"Saved circuit metadata with {len(drs_zones)} DRS zones to: {meta_path}")

        return csv_path, meta_path

    except Exception as e:
        print(f"Error during extraction: {e}")
        return None

if __name__ == "__main__":
    extract_monaco_data()
