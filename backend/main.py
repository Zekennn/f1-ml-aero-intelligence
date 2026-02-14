from fastapi import FastAPI
import joblib
import numpy as np
import random


app = FastAPI()
lap_progress = 0.0



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
def telementry():
    global lap_progress

#laps
    lap_progress +- 0.02
    if lap_progress > 1:
        lap_progress = 0.0

    if 0.2 < lap_progress < 0.4:
        speed = random.uniform(60, 70)#coner
    elif 0.6 < lap_progress < 0.8:
        speed = random.uniform(85, 95)#straight
    else:
        speed = random.uniform(70, 80)#medium

#DRS

    if 0.6 < lap_progress < 0.8:
        drs = 1
    else:
        drs = 0

        wing_angle = 10

    input_data = np.array([[speed, wing_angle, drs]])
    prediction = model.predict(input_data)

    drag = float(prediction[0][0])
    downforce = float(prediction[0][1])

    return{
        "lap_progress": lap_progress,
        "speed": speed,
        "drs": drs,
        "predicted_drag": drag,
        "predicted_downforce": downforce
    }
