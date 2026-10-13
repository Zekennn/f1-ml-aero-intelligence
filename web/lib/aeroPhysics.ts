import { AERO_BALANCE_FRONT, AERO_MEDIUM, AIR, CAR, FLAP_ANGLES, ModeId, POWER, SETUPS, SetupId } from "./car2026";

export type Coefficients = { CdA: number; ClA: number; balanceFront: number };

export type AeroResult = {
  v: number; // m/s
  rho: number; // kg/m³
  q: number; // dynamic pressure, Pa
  drag: number; // N
  downforce: number; // N
  front: number; // N on the front axle
  rear: number; // N on the rear axle
  downforceKg: number; // kg equivalent
  weights: number; // downforce ÷ car weight
  ld: number; // aero efficiency L/D
  powerKw: number; // power needed to push through the air
  topSpeedKmh: number; // simplified estimate
};

/**
 * Air density from temperature and altitude: the standard-atmosphere pressure at that
 * altitude, then the ideal gas law ρ = p / (R·T).
 */
export function airDensity(tempC: number, altitudeM: number): number {
  const p = AIR.seaLevelPressurePa * Math.pow(1 - 2.25577e-5 * altitudeM, 5.25588);
  return p / (AIR.gasConstant * (tempC + 273.15));
}

export function coefficients(setup: SetupId, mode: ModeId): Coefficients {
  const base = AERO_MEDIUM[mode];
  const scale = SETUPS[setup].scale;
  return { CdA: base.CdA * scale, ClA: base.ClA * scale, balanceFront: AERO_BALANCE_FRONT[mode] };
}

export function flapAngles(setup: SetupId, mode: ModeId) {
  return {
    front: FLAP_ANGLES.front[mode][setup],
    rear: FLAP_ANGLES.rear[mode][setup],
    rearMain: FLAP_ANGLES.rearMainPlane[setup],
  };
}

/**
 * Top speed where drag power equals the available power: v = (2P / (ρ·CdA))^(1/3).
 * Simplified: ignores rolling resistance and energy deployment limits.
 */
export function topSpeedKmh(rho: number, CdA: number, powerKw = POWER.totalKw): number {
  return Math.cbrt((2 * powerKw * 1000) / (rho * CdA)) * 3.6;
}

/** Aerodynamic forces at a speed: q = ½ρv², D = q·CdA, L = q·ClA, P = D·v. */
export function aeroForces(speedKmh: number, rho: number, c: Coefficients): AeroResult {
  const v = Math.max(0, speedKmh) / 3.6;
  const q = 0.5 * rho * v * v;
  const drag = q * c.CdA;
  const downforce = q * c.ClA;
  return {
    v,
    rho,
    q,
    drag,
    downforce,
    front: downforce * c.balanceFront,
    rear: downforce * (1 - c.balanceFront),
    downforceKg: downforce / AIR.gravity,
    weights: downforce / (CAR.massKg * AIR.gravity),
    ld: c.ClA / c.CdA,
    powerKw: (drag * v) / 1000,
    topSpeedKmh: topSpeedKmh(rho, c.CdA),
  };
}
