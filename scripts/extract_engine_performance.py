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

def get_engine_performance(year=2025):
    print(f"Fetching {year} Monaco GP Qualifying data...")
    try:
        # Load the session
        session = fastf1.get_session(year, 'Monaco', 'Q')
        # Only load telemetry to save time
        session.load(telemetry=True, weather=False, messages=False, laps=True)

        laps = session.laps
        teams = laps['Team'].unique()
        
        performance_data = []

        for team in teams:
            print(f"Analyzing team: {team}...")
            # Get the fastest lap for this team
            team_laps = laps.pick_teams(team)
            if team_laps.empty:
                continue
            
            fastest_lap = team_laps.pick_fastest()
            # FastF1 telemetry might need to be explicitly loaded if not already
            telemetry = fastest_lap.get_telemetry()
            
            if telemetry.empty:
                print(f"No telemetry for {team}")
                continue

            # Metrics
            max_rpm = telemetry['RPM'].max()
            max_speed = telemetry['Speed'].max()
            avg_throttle = telemetry['Throttle'].mean()
            
            performance_data.append({
                'Team': team,
                'MaxRPM': int(max_rpm) if not pd.isna(max_rpm) else 0,
                'MaxSpeed': float(max_speed) if not pd.isna(max_speed) else 0,
                'AvgThrottle': round(float(avg_throttle), 2) if not pd.isna(avg_throttle) else 0,
                'Year': year
            })

        df = pd.DataFrame(performance_data)
        
        # Save to data/
        output_dir = os.path.join(ROOT_DIR, 'data')
        if not os.path.exists(output_dir):
            os.makedirs(output_dir)
            
        csv_path = os.path.join(output_dir, f'team_engine_performance_{year}.csv')
        df.to_csv(csv_path, index=False)
        print(f"Engine performance data saved to: {csv_path}")
        print(df)
        
        return csv_path

    except Exception as e:
        print(f"Error during extraction for {year}: {e}")
        return None

if __name__ == "__main__":
    # Start with 2024 as we know it exists, then try 2025
    print("Starting engine performance extraction...")
    res_2024 = get_engine_performance(2024)
    if res_2024:
        print("2024 data fetch successful.")
    
    res_2025 = get_engine_performance(2025)
    if res_2025:
        print("2025 data fetch successful.")
    elif not res_2024:
        print("CRITICAL: Failed to fetch any data.")
