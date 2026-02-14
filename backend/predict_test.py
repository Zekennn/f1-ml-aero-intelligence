import joblib
import numpy as np

model = joblib.load("../models/aero_model.pkl")

speed = 80
wing = 10
drs = 1
input_data = np.array([[speed, wing, drs]])

prediction = model.predict(input_data)

drag_pred = prediction[0][0]
downforce_pred = prediction[0][1]


print(f"Predicted Drag: {drag_pred:.2f} N")
print(f"Predicted Downforce: {downforce_pred:.2f} N")