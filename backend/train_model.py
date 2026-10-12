import pandas as pd
from sklearn.model_selection import train_test_split
from sklearn.neural_network import MLPRegressor
from sklearn.metrics import mean_squared_error, r2_score
import joblib

df = pd.read_csv("../data/aero_dataset.csv")

X = df[['speed', 'wing', 'drs']]
y = df[['drag', 'downforce']]

X_train, X_test,y_train,y_test = train_test_split(X,y, test_size = 0.2,random_state=42)

##NNM

model = MLPRegressor(
    hidden_layer_sizes=(64, 64),
    max_iter=5000,
    random_state=42
)

model.fit(X_train, y_train)

y_pred = model.predict(X_test)

mse = mean_squared_error(y_test, y_pred)
r2 = r2_score(y_test, y_pred)


print("Model Train Complete")
print(f"MSE: {mse}")
print(f"R2 Score: {r2}")

##saving Model

import os

# Create directory if it doesn't exist
model_path = "../models/aero_model.pkl"
os.makedirs(os.path.dirname(model_path), exist_ok=True)

joblib.dump(model, model_path)

print("Model saved to ../models/aero_model.pkl")
