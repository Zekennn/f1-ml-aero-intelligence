/**
 * Simplified, illustrative flow field around a 2026-style open-wheel car seen from the side.
 * This is NOT CFD: it superimposes potential flow around a few elliptical bodies (mirrored
 * under the ground so the air stays parallel to the floor and speeds up underneath it) and
 * adds hand-tuned upwash and swirling wake terms, so it is cheap enough to sample thousands
 * of times per frame.
 *
 * World units are metres: x runs from the nose tip (0) to the rear wing (~5.3), air flows
 * towards +x, and y is the height above the ground. Velocities are multiples of the
 * free-stream speed. The strength of the wing terms comes from the physics model.
 */
import { CAR } from "@/lib/car2026";

export type FlowState = {
  speed: number; // km/h
  load: number; // rear wing loading 0–1 (from rear downforce coefficient)
  wake: number; // drag level 0–1 (from CdA): wake size and slowdown
  open: number; // active aero flaps: 0 = closed (Corner Mode), 1 = open (Straight Mode)
  s: number; // distance the free stream has travelled (m); moves the wake eddies downstream
};

export type Sample = { u: number; v: number; inside: boolean };

type Body = { cx: number; cy: number; rx: number; ry: number };

const FRONT_AXLE = CAR.frontOverhangM;
const REAR_AXLE = CAR.frontOverhangM + CAR.wheelbaseM;
const RF = CAR.frontTyreDiameterM / 2;
const RR = CAR.rearTyreDiameterM / 2;
const TAIL = REAR_AXLE + CAR.rearOverhangM; // back of the rear wing

const BODIES: Body[] = [
  { cx: 2.65, cy: 0.4, rx: 2.2, ry: 0.34 }, // chassis, sidepods and engine cover (floor at ~6 cm)
  { cx: 0.62, cy: 0.33, rx: 0.62, ry: 0.13 }, // long thin nose
  { cx: 2.95, cy: 0.8, rx: 0.8, ry: 0.22 }, // halo, driver and airbox
  { cx: FRONT_AXLE, cy: RF, rx: RF + 0.01, ry: RF + 0.01 }, // front wheel
  { cx: REAR_AXLE, cy: RR, rx: RR + 0.01, ry: RR + 0.01 }, // rear wheel
  { cx: 0.4, cy: 0.14, rx: 0.42, ry: 0.07 }, // front wing, resized by the flap
  { cx: TAIL - 0.3, cy: 0.84, rx: 0.3, ry: 0.1 }, // rear wing, resized by load and flap
];
const FRONT_WING = BODIES[5];
const REAR_WING = BODIES[6];

const MAX_SPEED = 3;

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/**
 * Air velocity at (x, y). `steady` damps the time-varying swirl, for streamlines and hover readouts.
 * Writes into and returns `out` so the animation loop doesn't allocate.
 */
export function sampleFlow(x: number, y: number, f: FlowState, out: Sample, steady = false): Sample {
  const load = clamp(f.load, 0, 1);
  const wake = clamp(f.wake, 0, 1);
  const open = clamp(f.open, 0, 1);
  const spd = clamp(f.speed / 330, 0, 1.25);

  // Closed flaps make the wings deeper; open flaps let air through the slot.
  FRONT_WING.ry = 0.05 + 0.04 * (1 - open);
  REAR_WING.ry = 0.05 + 0.09 * load * (1 - 0.5 * open);

  let u = 1;
  let v = 0;
  let inside = false;

  for (const b of BODIES) {
    const X = (x - b.cx) / b.rx;
    const stretch = b.ry / b.rx;
    // The body itself
    let Y = (y - b.cy) / b.ry;
    let r2 = X * X + Y * Y;
    if (r2 < 1) inside = true;
    else {
      const r4 = r2 * r2;
      u -= (X * X - Y * Y) / r4;
      v -= (stretch * 2 * X * Y) / r4;
    }
    // Its mirror image below the ground
    Y = (y + b.cy) / b.ry;
    r2 = X * X + Y * Y;
    if (r2 >= 1) {
      const r4 = r2 * r2;
      u -= (X * X - Y * Y) / r4;
      v -= (stretch * 2 * X * Y) / r4;
    }
  }

  const swirl = steady ? 0.25 : 1;
  const phase = (x - f.s) * 11; // eddies ~0.57 m apart, carried downstream with the air

  // Front wing lifts the air over the front tyres.
  {
    const ax = (x - 0.85) / 0.45;
    const ay = (y - 0.45) / 0.3;
    v += 0.25 * (0.4 + 0.6 * load) * Math.exp(-(ax * ax + ay * ay));
  }

  // Upwash: the loaded rear wing throws air upwards around and behind it.
  {
    const ax = (x - (TAIL - 0.05)) / 0.75;
    const ay = (y - 1.0) / 0.55;
    v += 0.65 * load * Math.exp(-(ax * ax + ay * ay));
  }

  // Rear wing wake: slower, swirling air that rises with the upwash. Longer at speed, bigger with more drag.
  if (x > TAIL - 0.35) {
    const d = x - (TAIL - 0.35);
    const len = (1.2 + 3.8 * spd) * (0.5 + 0.9 * wake);
    const yc = 0.86 + d * (0.04 + 0.3 * load);
    const hw = 0.1 + 0.26 * wake + d * 0.12 * (0.3 + wake);
    const n = (y - yc) / hw;
    const g = Math.exp(-n * n - d / len);
    u *= 1 - 0.85 * wake * g;
    u += swirl * 0.75 * wake * g * Math.sin(phase + 2.2 * n);
    v += swirl * 0.85 * wake * g * Math.cos(phase * 1.3 - 1.7 * n);
  }

  // Rear wheel and diffuser wake, low down behind the car.
  if (x > REAR_AXLE + RR - 0.05) {
    const d = x - (REAR_AXLE + RR - 0.05);
    const len = 0.9 + 2.6 * spd;
    const n = (y - 0.3 - d * 0.06) / (0.28 + 0.09 * d);
    const g = Math.exp(-n * n - d / len);
    u *= 1 - 0.6 * g;
    u += swirl * 0.5 * g * Math.sin(phase * 1.2 + 2 * n + 1.3);
    v += swirl * 0.55 * g * Math.cos(phase + 1.9 * n) + 0.15 * g;
  }

  // Front wheel wake running down the sidepods.
  if (x > FRONT_AXLE + 0.3 && x < REAR_AXLE - 0.8 && y < 0.85) {
    const d = x - (FRONT_AXLE + 0.3);
    const n = (y - 0.4) / 0.3;
    const g = Math.exp(-n * n - d / 0.7);
    u *= 1 - 0.35 * g;
    v += swirl * 0.25 * g * Math.cos(phase * 1.4 + 2 * n);
  }

  const m = Math.hypot(u, v);
  if (m > MAX_SPEED) {
    u *= MAX_SPEED / m;
    v *= MAX_SPEED / m;
  }
  out.u = u;
  out.v = v;
  out.inside = inside;
  return out;
}

/** Particle colours from slow (dark blue) through normal (blue) to fast (white). */
export const SPEED_COLOURS = ["#2C4A9C", "#3157C4", "#1E5EFF", "#4A80FF", "#86A8FF", "#C4D4FF", "#FFFFFF"];
const SPEED_STEPS = [0.5, 0.78, 0.98, 1.15, 1.35, 1.6];

/** Colour index for a speed given as a multiple of the free stream. */
export function speedBucket(m: number): number {
  let i = 0;
  while (i < SPEED_STEPS.length && m >= SPEED_STEPS[i]) i++;
  return i;
}
