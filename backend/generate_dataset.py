import numpy as np
import pandas as pd
from aero_model import calculate_aero_forces

data = []

for i in range(5000):
    speed = np.random.uniform(50, 350)
    wing = np.random.uniform(5, 15)
    drs = np.random.randint(0, 2)

    drag, downforce = calculate_aero_forces(speed, wing, drs)

    data.append({
        'speed': speed,
        'wing': wing,
        'drs': drs,
        'drag': drag,
        'downforce': downforce
    })

df = pd.DataFrame(data)

df.to_csv("../data/aero_dataset.csv", index=False)

print("Dataset generated and saved to ../data/aero_dataset.csv")
