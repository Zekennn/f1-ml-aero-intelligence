import requests
import time

def test_telemetry():
    url = "http://127.0.0.1:8000/telemetry"
    for i in range(20):
        try:
            r = requests.get(url)
            data = r.json()
            forecast = data.get("next_lap_forecast", {})
            print(f"Step {i+1}: Lap {data['current_lap']}, Progress {data['lap_progress']:.3f}, Forecast DF: {forecast.get('downforce', 'N/A')}, Confidence: {forecast.get('confidence', 'N/A')}")
        except Exception as e:
            print(f"Error: {e}")
        time.sleep(0.5)

if __name__ == "__main__":
    test_telemetry()
