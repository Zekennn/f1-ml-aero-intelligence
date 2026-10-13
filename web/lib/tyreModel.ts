/*
 * ESTIMATED tyre temperatures.
 * The TracingInsights repos contain NO tyre temperature data, so this is a simple physics-based
 * estimate: each tyre heats up with the work it does (speed × load from cornering, braking and
 * traction) and cools towards the track/air temperature, faster at higher speed. It is labelled
 * "Estimated" wherever it is shown.
 */

export type Wheel = "FL" | "FR" | "RL" | "RR";
export type TyreTemps = Record<Wheel, number>;
export const WHEELS: Wheel[] = ["FL", "FR", "RL", "RR"];

/** Working window per compound (°C): below = cold, inside = optimal, above = hot. */
export const TYRE_WINDOWS: Record<string, [number, number]> = {
  SOFT: [85, 105],
  MEDIUM: [90, 110],
  HARD: [95, 115],
};
const HEAT_FACTOR: Record<string, number> = { SOFT: 1.12, MEDIUM: 1.0, HARD: 0.88 };

export type TyreState = "cold" | "optimal" | "hot";

export function tyreState(temp: number, compound: string): TyreState {
  const [lo, hi] = TYRE_WINDOWS[compound] ?? TYRE_WINDOWS.MEDIUM;
  return temp < lo ? "cold" : temp > hi ? "hot" : "optimal";
}

/** Tyres fitted from blankets (~70 °C core in this model's terms). */
export function freshTyres(): TyreTemps {
  return { FL: 75, FR: 75, RL: 75, RR: 75 };
}

const HEAT = 1.35; // °C per second per unit of work
const COOL = 0.018; // per second, scaled up with speed

/**
 * Advance the estimate by dt seconds.
 * gLat > 0 = turning left (right-hand tyres on the outside), gLong < 0 = braking.
 */
export function stepTyres(
  temps: TyreTemps,
  dt: number,
  s: { speed: number; gLat: number; gLong: number; brake: number; compound: string; trackTemp: number; tyreAge: number },
): TyreTemps {
  const v = Math.max(0, s.speed) / 100; // in 100 km/h units
  const lat = Math.min(6, Math.abs(s.gLat));
  const braking = s.brake ? Math.min(6, Math.max(0, -s.gLong)) : 0;
  const traction = Math.min(2, Math.max(0, s.gLong));
  const outerRight = s.gLat > 0;
  const k = HEAT_FACTOR[s.compound] ?? 1;
  const wear = 1 + Math.min(0.15, s.tyreAge * 0.004); // worn tyres run a little hotter
  const ambient = s.trackTemp + 8;

  const next = { ...temps };
  for (const w of WHEELS) {
    const front = w[0] === "F";
    const right = w[1] === "R";
    const loadShare = right === outerRight ? 0.62 : 0.38; // outside tyres carry more of the cornering load
    const work =
      0.55 + // rolling and aero load
      lat * loadShare * (front ? 1.05 : 0.95) +
      braking * (front ? 0.6 : 0.4) +
      traction * (front ? 0 : 0.7);
    const heat = HEAT * k * wear * v * work;
    const cool = COOL * (1 + 1.6 * v) * (temps[w] - ambient);
    next[w] = Math.min(140, Math.max(ambient, temps[w] + (heat - cool) * dt));
  }
  return next;
}
