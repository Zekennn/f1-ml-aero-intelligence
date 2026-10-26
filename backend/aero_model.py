def calculate_coefficients(wing_angle: float, drs: int):
    Cl = 0.88 * wing_angle
    Cd = 0.02 + 0.04 * (wing_angle ** 2)

    if drs == 1:
        Cd *= 0.85
        Cl *= 0.90


    return Cd, Cl


def calculate_aero_forces(speed: float, wing_angle: float,drs: int):
    rho = 1.225  # Air density at sea level in kg/m^3
    area = 1.5  # Reference area in m^2

    Cd,Cl = calculate_coefficients(wing_angle, drs)
    drag = 0.5 * rho * speed**2 * Cd * area

    downforce = 0.5 * rho * speed**2 * Cl * area

    return drag, downforce

