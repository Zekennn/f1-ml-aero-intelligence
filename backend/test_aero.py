from aero_model import calculate_aero_forces

speed = 300
wing = 15
drs = 1
 
drag, downforce = calculate_aero_forces(speed, wing, drs)

print(f"Drag: {drag:+.2f} N")
print(f"Downforce: {downforce:+.2f} N")
