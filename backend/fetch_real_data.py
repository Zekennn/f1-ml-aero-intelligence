import os
import fastf1
import pandas as pd
from aero_model import calculate_aero_forces

# Enable FastF1 Cache
cache_dir = "../data/cache"
os.makedirs(cache_dir, exist_ok=True)
fastf1.Cache.enable_cache(cache_dir)

print("Fetching 2026 Formula 1 Data...")

# Fetch Round 1 and 2 of 2026 Season
sessions_to_fetch = [
    (2026, 1, 'R'),
    (2026, 2, 'R')
]

all_laps_data = []

for year, round_num, session_type in sessions_to_fetch:
    try:
        session = fastf1.get_session(year, round_num, session_type)
        session.load()
        
        # Get accurate laps with recorded times and speeds
        laps = session.laps.pick_accurate()
        
        for index, lap in laps.iterlaps():
            lap_time_seconds = lap['LapTime'].total_seconds()
            
            # SpeedST is typically in km/h
            speed_kmh = lap['SpeedST']
            
            # Filter out invalid rows
            if pd.isna(lap_time_seconds) or pd.isna(speed_kmh):
                continue
                
            speed_ms = speed_kmh / 3.6  # Convert km/h to m/s
            
            # For 2026, we will estimate a wing angle of 12 for the race
            wing_angle = 12 
            # We assume DRS is off (0) for most of the lap time average, but might be on in the speed trap
            drs = 1 if lap.get('IsPersonalBest') else 0 
            
            # Synthesize drag and downforce for the lap using the aero model
            drag, downforce = calculate_aero_forces(speed_ms, wing_angle, drs)
            
            all_laps_data.append({
                'track': session.event['EventName'],
                'driver': lap['Driver'],
                'lap_time': lap_time_seconds,
                'top_speed_kmh': speed_kmh,
                'top_speed_ms': speed_ms,
                'drs_active': drs,
                'wing_angle': wing_angle,
                'estimated_drag_N': drag,
                'estimated_downforce_N': downforce
            })
            
    except Exception as e:
        print(f"Could not load data for {year} Round {round_num}: {e}")

df = pd.DataFrame(all_laps_data)
output_path = "../data/real_2026_data.csv"
df.to_csv(output_path, index=False)

print(f"Successfully processed and saved {len(df)} real laps to {output_path}!")
