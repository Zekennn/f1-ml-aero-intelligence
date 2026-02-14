from fastapi import FastAPI
import joblib
import numpy as np

app = FastAPI()


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