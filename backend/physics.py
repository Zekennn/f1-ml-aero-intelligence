import numpy as np

def interpolate_telemetry(lap_progress, track_points, track_length):
    """Interpolate all rich telemetry channels for the current lap progress"""
    index = int(lap_progress * (track_length - 1))
    next_index = (index + 1) % track_length
    fraction = (lap_progress * (track_length - 1)) - index

    p1, p2 = track_points[index], track_points[next_index]
    
    # Interpolate all rich telemetry channels with explicit float casting
    f_p1 = [float(val) for val in p1]
    f_p2 = [float(val) for val in p2]
    
    x = f_p1[0] + (f_p2[0]-f_p1[0])*fraction
    y = f_p1[1] + (f_p2[1]-f_p1[1])*fraction
    speed = f_p1[2] + (f_p2[2]-f_p1[2])*fraction
    rpm = f_p1[3] + (f_p2[3]-f_p1[3])*fraction
    gear = int(f_p1[4]) # Gear is discrete
    throttle = f_p1[5] + (f_p2[5]-f_p1[5])*fraction
    brake_raw = bool(p1[6]) # Brake is bool
    drs_raw = int(p1[7])
    
    return {
        "x": x, "y": y, "speed": speed, "rpm": rpm, 
        "gear": gear, "throttle": throttle, 
        "brake_raw": brake_raw, "drs_raw": drs_raw
    }

def update_tire_temperatures(tire_temps, speed, rpm, brake_raw):
    """Enhanced tire temperature heuristic with real throttle/brake data"""
    f_speed = float(speed)
    f_rpm = float(rpm)
    f_brake = 2.0 if brake_raw else 0.0 # Heating boost during braking
    
    speed_factor = (f_speed / 300.0) * 0.4
    engine_heat = (f_rpm / 12000.0) * 0.3
    
    new_temps = {}
    for wheel in tire_temps:
        current_temp = float(tire_temps[wheel])
        cooling = (current_temp - 35.0) * 0.012 
        heating = speed_factor + f_brake + engine_heat
        new_temps[wheel] = max(75.0, min(145.0, current_temp + heating - cooling))
    
    return new_temps

def predict_lap_time(avg_lap_time, current_lap, tire_age):
    """Predict lap time based on tire age and fuel drop"""
    return avg_lap_time + (tire_age * 0.04) - (current_lap * 0.015)
