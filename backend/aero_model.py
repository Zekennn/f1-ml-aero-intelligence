def calculate_coefficients(wing_angle: float, drs: int):
    # Realistic F1 coefficients (Cl ~ 2.5-4.5, Cd ~ 0.7-1.2)
    Cl = 1.5 + 0.15 * wing_angle  # Wing angle 5 -> 2.25, 15 -> 3.75
    Cd = 0.5 + 0.003 * (wing_angle ** 2) # Wing angle 5 -> 0.575, 15 -> 1.175

    if drs == 1:
        Cd *= 0.82  # ~18% drag reduction
        Cl *= 0.92  # Minor downforce loss
    
    return Cd, Cl


def calculate_aero_forces(speed_kmh: float, wing_angle: float, drs: int):
    rho = 1.225  # Air density at sea level in kg/m^3
    area = 1.6   # Reference area in m^2
    
    # Convert speed from km/h to m/s
    speed_ms = speed_kmh / 3.6

    Cd, Cl = calculate_coefficients(wing_angle, drs)
    
    # F = 0.5 * rho * v^2 * C * A
    drag = 0.5 * rho * (speed_ms ** 2) * Cd * area
    downforce = 0.5 * rho * (speed_ms ** 2) * Cl * area

    return drag, downforce

