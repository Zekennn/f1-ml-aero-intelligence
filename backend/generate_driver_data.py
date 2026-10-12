import pandas as pd
import numpy as np
import os

# Data for 2021-2025 (Simplified/Approximate for the predictor)
data = [
    # 2021
    {"Year": 2021, "Driver": "Max Verstappen", "Team": "Red Bull Racing", "Points": 395.5, "Wins": 10, "Podiums": 18, "TechIndex": 0.95},
    {"Year": 2021, "Driver": "Lewis Hamilton", "Team": "Mercedes", "Points": 387.5, "Wins": 8, "Podiums": 17, "TechIndex": 0.96},
    {"Year": 2021, "Driver": "Valtteri Bottas", "Team": "Mercedes", "Points": 226, "Wins": 1, "Podiums": 11, "TechIndex": 0.96},
    {"Year": 2021, "Driver": "Sergio Perez", "Team": "Red Bull Racing", "Points": 190, "Wins": 1, "Podiums": 5, "TechIndex": 0.95},
    {"Year": 2021, "Driver": "Lando Norris", "Team": "McLaren", "Points": 160, "Wins": 0, "Podiums": 4, "TechIndex": 0.88},
    {"Year": 2021, "Driver": "George Russell", "Team": "Williams", "Points": 16, "Wins": 0, "Podiums": 1, "TechIndex": 0.65},
    {"Year": 2021, "Driver": "Oscar Piastri", "Team": "F2", "Points": 0, "Wins": 0, "Podiums": 0, "TechIndex": 0.5},
    
    # 2022
    {"Year": 2022, "Driver": "Lando Norris", "Team": "McLaren", "Points": 122, "Wins": 0, "Podiums": 1, "TechIndex": 0.85},
    {"Year": 2022, "Driver": "Oscar Piastri", "Team": "Alpine (Reserve)", "Points": 0, "Wins": 0, "Podiums": 0, "TechIndex": 0.5},
    
    # 2023
    {"Year": 2023, "Driver": "Lando Norris", "Team": "McLaren", "Points": 205, "Wins": 0, "Podiums": 7, "TechIndex": 0.92},
    {"Year": 2023, "Driver": "Oscar Piastri", "Team": "McLaren", "Points": 97, "Wins": 0, "Podiums": 2, "TechIndex": 0.92},
    {"Year": 2023, "Driver": "George Russell", "Team": "Mercedes", "Points": 175, "Wins": 0, "Podiums": 2, "TechIndex": 0.90},
    {"Year": 2023, "Driver": "Fernando Alonso", "Team": "Aston Martin", "Points": 206, "Wins": 0, "Podiums": 8, "TechIndex": 0.85},
    {"Year": 2023, "Driver": "Charles Leclerc", "Team": "Ferrari", "Points": 206, "Wins": 0, "Podiums": 6, "TechIndex": 0.91},
    
    # 2024 (Projected/Recent)
    {"Year": 2024, "Driver": "Max Verstappen", "Team": "Red Bull Racing", "Points": 437, "Wins": 9, "Podiums": 15, "TechIndex": 0.94},
    {"Year": 2024, "Driver": "Lando Norris", "Team": "McLaren", "Points": 331, "Wins": 3, "Podiums": 12, "TechIndex": 0.96},
    {"Year": 2024, "Driver": "Charles Leclerc", "Team": "Ferrari", "Points": 307, "Wins": 3, "Podiums": 11, "TechIndex": 0.94},
    {"Year": 2024, "Driver": "Oscar Piastri", "Team": "McLaren", "Points": 262, "Wins": 2, "Podiums": 7, "TechIndex": 0.96},
    {"Year": 2024, "Driver": "Lewis Hamilton", "Team": "Mercedes", "Points": 190, "Wins": 2, "Podiums": 5, "TechIndex": 0.90},

    # 2025 (Simulated for this tool context)
    {"Year": 2025, "Driver": "Lando Norris", "Team": "McLaren", "Points": 410, "Wins": 7, "Podiums": 16, "TechIndex": 0.98},
    {"Year": 2025, "Driver": "Max Verstappen", "Team": "Red Bull Racing", "Points": 385, "Wins": 6, "Podiums": 14, "TechIndex": 0.94},
    {"Year": 2025, "Driver": "Charles Leclerc", "Team": "Ferrari", "Points": 360, "Wins": 5, "Podiums": 13, "TechIndex": 0.95},
    {"Year": 2025, "Driver": "Oscar Piastri", "Team": "McLaren", "Points": 320, "Wins": 4, "Podiums": 10, "TechIndex": 0.98},
    {"Year": 2025, "Driver": "Lewis Hamilton", "Team": "Ferrari", "Points": 290, "Wins": 2, "Podiums": 8, "TechIndex": 0.95},
]

df = pd.DataFrame(data)
os.makedirs("../data", exist_ok=True)
df.to_csv("../data/driver_performance_2021_2025.csv", index=False)
print("Historical driver data generated.")
