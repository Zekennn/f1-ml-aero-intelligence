from fastapi import FastAPI
import joblib
import numpy as np
import random
import pandas as pd
from fastapi.responses import HTMLResponse




app = FastAPI()

track_df = pd.read_csv("../data/tracks/monaco_track.csv")
track_points = track_df.values.tolist()

lap_progress = 0.0
    # get track position data
track_length = len(track_points)
index = int(lap_progress * track_length)

if index >= track_length:
    index = track_length - 1

x, y = track_points[index]




model = joblib.load("../models/aero_model.pkl")


@app.get("/")
def home():
    return {"message": "Welcome to the F1 Aero Prediction API!"}


@app.get("/predict")
def predict(speed: float, wing_angle: float, drs: int):

    input_data = np.array([[speed, wing_angle, drs]])
    prediction = model.predict(input_data)

    drag = float(prediction[0][0])
    downforce = float(prediction[0][1])

    return {
        "speed": speed,
        "wing_angle": wing_angle,
        "drs": drs,
        "predicted_drag": drag,
        "predicted_downforce": downforce
    }

@app.get("/telemetry")
def telemetry():
    global lap_progress

    # Move lap forward
    lap_progress += 0.01  

    if lap_progress >= 1:
        lap_progress = 0.0


    track_length = len(track_points)

    position = lap_progress * track_length
    index = int(position)
    next_index = (index + 1) % track_length

    fraction = position - index

    x1, y1 = track_points[index]
    x2, y2 = track_points[next_index]

    x = x1 + (x2 - x1) * fraction
    y = y1 + (y2 - y1) * fraction


    # SPEED ZONES

    if 0.2 < lap_progress < 0.4:
        speed = random.uniform(60, 70)  # corner
    elif 0.6 < lap_progress < 0.8:
        speed = random.uniform(85, 95)  # straight
    else:
        speed = random.uniform(70, 80)  # medium

    # DRS logic
    
    if 0.6 < lap_progress < 0.8:
        drs = 1
    else:
        drs = 0

    wing_angle = 10

    
    input_data = np.array([[speed, wing_angle, drs]])
    prediction = model.predict(input_data)

    drag = float(prediction[0][0])
    downforce = float(prediction[0][1])

    return {
        "lap_progress": lap_progress,
        "x": x,
        "y": y,
        "speed": speed,
        "drs": drs,
        "predicted_drag": drag,
        "predicted_downforce": downforce
    }

@app.get("/live", response_class=HTMLResponse)
def live_dashboard():
    return """
    <html>
        <head>
            <title>F1 Live Telemetry</title>
        </head>
        <body>
            <h1>Monaco Live Telemetry Simulation</h1>
            <div id="data"></div>

            <script>
                function fetchData() {
                    fetch('/telemetry')
                        .then(response => response.json())
                        .then(data => {
                            document.getElementById('data').innerHTML = `
                                <p><strong>Lap Progress:</strong> ${data.lap_progress.toFixed(3)}</p>
                                <p><strong>X:</strong> ${data.x.toFixed(2)}</p>
                                <p><strong>Y:</strong> ${data.y.toFixed(2)}</p>
                                <p><strong>Speed:</strong> ${data.speed.toFixed(2)} m/s</p>
                                <p><strong>DRS:</strong> ${data.drs}</p>
                                <p><strong>Drag:</strong> ${data.predicted_drag.toFixed(2)} N</p>
                                <p><strong>Downforce:</strong> ${data.predicted_downforce.toFixed(2)} N</p>
                            `;
                        });
                }

                // Update every 200 milliseconds
                setInterval(fetchData, 200);

                // Call once immediately
                fetchData();
            </script>
        </body>
    </html>
    """

