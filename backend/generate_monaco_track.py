import numpy as np
import pandas as pd

points = []

num_points = 400
radius_x = 150
radius_y = 80

for i in range(num_points):
    theta = 2 * np.pi * i / num_points

    
    x = radius_x * np.cos(theta)
    y = radius_y * np.sin(theta)

    
    x += 20 * np.sin(3 * theta)
    y += 15 * np.cos(5 * theta)

    points.append([x, y])


points.append(points[0])

df = pd.DataFrame(points, columns=["x", "y"])
df.to_csv("../data/tracks/monaco_track.csv", index=False)

print("High-resolution Monaco track generated successfully.")
