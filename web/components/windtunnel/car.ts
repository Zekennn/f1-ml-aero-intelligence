/**
 * Side view of a 2026-regulation Formula 1 car, drawn from scratch as plain vector paths.
 * Proportions were measured from the FIA 2026 side-view render (used only as a reference)
 * and are drawn to real scale from the car config, so the tunnel's scale bar is accurate.
 * Plain shape only: no logos, text, numbers or livery.
 *
 * Coordinates: metres, y up from the ground. Outline points are given relative to the
 * front axle ("rx"); `X()` places them on the car using the config's overhang and wheelbase.
 * The caller sets a transform that maps metres to pixels.
 */
import { CAR } from "@/lib/car2026";

type Pt = [number, number];

/** Wheelbase the outline points were measured at (the FIA render). */
const REF_WHEELBASE = 3.4;

/** Car position (m from the nose tip) of a point measured relative to the front axle. */
function X(rx: number): number {
  const wb = CAR.wheelbaseM;
  const along = rx <= 0 ? rx : rx <= REF_WHEELBASE ? (rx * wb) / REF_WHEELBASE : wb + (rx - REF_WHEELBASE);
  return CAR.frontOverhangM + along;
}
const P = (pts: Pt[]): Pt[] => pts.map(([rx, y]) => [X(rx), y]);

export const FRONT_AXLE_X = X(0);
export const REAR_AXLE_X = X(REF_WHEELBASE);
export const FRONT_RADIUS = CAR.frontTyreDiameterM / 2;
export const REAR_RADIUS = CAR.rearTyreDiameterM / 2;

// --- Outline (measured from the side-view reference, relative to the front axle) ---
const BODY = P([
  // nose tip and upper nose
  [-1.176, 0.166], [-1.1, 0.2], [-0.95, 0.25], [-0.6, 0.38], [-0.336, 0.48], [0, 0.555], [0.51, 0.64],
  // cockpit rim, headrest, airbox / roll hoop
  [0.92, 0.675], [1.6, 0.69], [1.72, 0.74], [1.77, 0.97], [1.85, 1.02], [2.09, 1.01],
  // engine cover sweeping down to the rear crash structure
  [2.41, 0.96], [2.85, 0.89], [3.28, 0.77], [3.58, 0.66], [3.8, 0.52], [3.95, 0.42], [3.95, 0.33], [3.6, 0.25],
  // underside: flat floor line, then the undercut below the sidepod inlet
  [3.1, 0.12], [1.55, 0.1], [1.38, 0.25], [1.26, 0.36],
  // chassis underside and nose underside
  [1.0, 0.3], [0.3, 0.33], [-0.34, 0.25], [-0.95, 0.15], [-1.1, 0.15],
]);

/** Sidepod top line ("coke bottle" taper) drawn over the body. */
const SIDEPOD_LINE = P([[1.26, 0.36], [1.18, 0.42], [1.18, 0.61], [1.5, 0.625], [2.3, 0.6], [2.9, 0.53], [3.2, 0.42], [3.35, 0.28]]);
const SIDEPOD_INLET = P([[1.18, 0.43], [1.25, 0.43], [1.25, 0.59], [1.18, 0.6]]);
const AIRBOX_INLET = P([[1.77, 0.86], [1.81, 0.97], [1.86, 0.97], [1.83, 0.86]]);

/** Simpler, flatter 2026 floor with a visible edge and a small diffuser kick. */
const FLOOR = P([
  [0.42, 0.24], [0.55, 0.3], [1.45, 0.3], [1.6, 0.1], [3.05, 0.09], [3.25, 0.16], [3.32, 0.12], [3.12, 0.05], [0.5, 0.05], [0.4, 0.1],
]);
const FLOOR_EDGE = P([[0.5, 0.05], [3.12, 0.05]]);

/** Flow-guiding vanes in front of the sidepods (floor fences) and the small sidepod winglet. */
const VANES: Pt[][] = [
  P([[0.6, 0.06], [0.66, 0.06], [0.78, 0.3], [0.72, 0.3]]),
  P([[0.82, 0.06], [0.88, 0.06], [0.98, 0.31], [0.92, 0.31]]),
  P([[1.02, 0.07], [1.08, 0.07], [1.16, 0.32], [1.1, 0.32]]),
];
const SIDEPOD_WINGLET = P([[0.98, 0.7], [1.22, 0.68], [1.24, 0.71], [1.0, 0.73]]);

const HALO = P([[0.92, 0.675], [1.04, 0.83], [1.24, 0.875], [1.71, 0.82], [1.76, 0.75]]);
const HELMET: Pt = [X(1.42), 0.78];

const FRONT_ENDPLATE = P([[-1.1, 0.06], [-0.37, 0.07], [-0.36, 0.36], [-0.6, 0.38], [-1.05, 0.16]]);
const REAR_ENDPLATE = P([[3.58, 0.26], [4.12, 0.26], [4.12, 0.93], [3.62, 0.93]]);

const FRONT_MAIN = { le: [X(-1.15), 0.065] as Pt, chord: 0.7, angle: 3, thick: 0.035 };
const FRONT_FLAP = { le: [X(-0.62), 0.12] as Pt, chord: 0.32, thick: 0.045 };
const FRONT_FLAP2 = { offset: 0.18, lift: 0.07, chord: 0.22, thick: 0.04, extra: 8 };
const REAR_MAIN = { le: [X(3.62), 0.72] as Pt, chord: 0.34, thick: 0.05 };
const REAR_FLAP = { chord: 0.21, thick: 0.05, slot: [-0.03, 0.035] as Pt };
const BEAM_WING = { le: [X(3.62), 0.36] as Pt, chord: 0.3, angle: 6, thick: 0.035 };

// --- Colours ---
const C = {
  body: "#1C355C", // a little lighter than the tunnel background
  edge: "rgba(229,231,235,0.75)",
  dark: "#050C18", // floor and tyres
  darkEdge: "rgba(229,231,235,0.35)",
  wheelCover: "#0F1D33",
  slot: "#081325",
  active: "#1E5EFF", // moving active aero parts
};

/** What the drawing needs to know about the wings (degrees). */
export type CarPose = {
  frontFlap: number; // active front flap angle
  rearFlap: number; // active rear flap angle
  rearClosed: number; // rear flap angle when closed (sets its pivot)
  rearMain: number; // fixed rear main plane angle
};

const rad = (deg: number) => (deg * Math.PI) / 180;
const along = ([x, y]: Pt, angle: number, d: number): Pt => [x + Math.cos(angle) * d, y + Math.sin(angle) * d];

function poly(ctx: CanvasRenderingContext2D, pts: Pt[], close = true) {
  ctx.beginPath();
  ctx.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
  if (close) ctx.closePath();
}

/** A thin cambered wing element from its leading edge; positive angle lifts the trailing edge. */
function airfoil(ctx: CanvasRenderingContext2D, [x, y]: Pt, angle: number, chord: number, thick: number) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.bezierCurveTo(chord * 0.1, thick * 0.6, chord * 0.6, thick * 0.35, chord, 0);
  ctx.bezierCurveTo(chord * 0.6, -thick * 1.1, chord * 0.1, -thick * 0.9, 0, 0);
  ctx.fill();
  ctx.stroke();
  ctx.restore();
}

/** Geometry of the moving parts, shared with the flap labels. */
function wingGeometry(pose: CarPose) {
  const fa = rad(pose.frontFlap);
  const flap2Le: Pt = [...along(FRONT_FLAP.le, fa, FRONT_FLAP2.offset)] as Pt;
  flap2Le[1] += FRONT_FLAP2.lift;
  const fa2 = fa + rad(FRONT_FLAP2.extra);

  const ma = rad(pose.rearMain);
  const mainTe = along(REAR_MAIN.le, ma, REAR_MAIN.chord);
  // The rear flap pivots about its trailing edge, so opening it lifts its leading edge and opens the slot.
  const closedLe: Pt = [mainTe[0] + REAR_FLAP.slot[0], mainTe[1] + REAR_FLAP.slot[1]];
  const te = along(closedLe, rad(pose.rearClosed), REAR_FLAP.chord);
  const ra = rad(pose.rearFlap);
  const rearLe = along(te, ra, -REAR_FLAP.chord);

  return { fa, flap2Le, fa2, ma, ra, rearLe };
}

/** Points (metres) on the active front and rear flaps, for the label leader lines. */
export function activeFlapAnchors(pose: CarPose): { front: Pt; rear: Pt } {
  const g = wingGeometry(pose);
  return {
    front: along(g.flap2Le, g.fa2, FRONT_FLAP2.chord * 0.5),
    rear: along(g.rearLe, g.ra, REAR_FLAP.chord * 0.5),
  };
}

function wheel(ctx: CanvasRenderingContext2D, cx: number, r: number, turn: number, line: number) {
  ctx.fillStyle = C.dark;
  ctx.strokeStyle = C.darkEdge;
  ctx.lineWidth = line;
  ctx.beginPath();
  ctx.arc(cx, r, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  // Solid wheel cover with a few bolt marks so the rotation is visible
  ctx.fillStyle = C.wheelCover;
  ctx.beginPath();
  ctx.arc(cx, r, r * 0.6, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = "rgba(229,231,235,0.35)";
  ctx.beginPath();
  for (let i = 0; i < 6; i++) {
    const a = turn + (i * Math.PI) / 3;
    const bx = cx + Math.cos(a) * r * 0.42;
    const by = r + Math.sin(a) * r * 0.42;
    ctx.moveTo(bx + r * 0.03, by);
    ctx.arc(bx, by, r * 0.03, 0, Math.PI * 2);
  }
  ctx.fill();
  ctx.fillStyle = "rgba(229,231,235,0.6)";
  ctx.beginPath();
  ctx.arc(cx, r, r * 0.09, 0, Math.PI * 2);
  ctx.fill();
}

/**
 * Draws the whole car. `line` is one device pixel in metres (for crisp outlines);
 * `wheelTurn` is the wheel rotation in radians (the rolling road spins them).
 */
export function drawCar(ctx: CanvasRenderingContext2D, pose: CarPose, line: number, wheelTurn: number) {
  const g = wingGeometry(pose);
  ctx.lineJoin = "round";
  ctx.lineCap = "round";

  // Floor (dark) with its edge picked out
  ctx.fillStyle = C.dark;
  ctx.strokeStyle = C.darkEdge;
  ctx.lineWidth = line;
  poly(ctx, FLOOR);
  ctx.fill();
  ctx.stroke();
  ctx.strokeStyle = "rgba(229,231,235,0.55)";
  ctx.lineWidth = 1.5 * line;
  poly(ctx, FLOOR_EDGE, false);
  ctx.stroke();

  // Rear wing endplate (see-through so the elements stay visible) and support pylon
  ctx.fillStyle = "rgba(28,53,92,0.55)";
  ctx.strokeStyle = C.edge;
  ctx.lineWidth = line;
  poly(ctx, REAR_ENDPLATE);
  ctx.fill();
  ctx.stroke();
  ctx.strokeStyle = C.body;
  ctx.lineWidth = 0.04;
  ctx.beginPath();
  ctx.moveTo(X(3.82), 0.42);
  ctx.lineTo(X(3.74), 0.73);
  ctx.stroke();

  // Suspension arms
  ctx.strokeStyle = "rgba(229,231,235,0.4)";
  ctx.lineWidth = 0.018;
  ctx.beginPath();
  for (const [ax, r, bx, by] of [
    [FRONT_AXLE_X, FRONT_RADIUS, X(0.55), 0.5], [FRONT_AXLE_X, FRONT_RADIUS, X(0.55), 0.3],
    [REAR_AXLE_X, REAR_RADIUS, X(2.9), 0.45], [REAR_AXLE_X, REAR_RADIUS, X(2.9), 0.25],
  ]) {
    ctx.moveTo(ax, r);
    ctx.lineTo(bx, by);
  }
  ctx.stroke();

  // Body
  ctx.fillStyle = C.body;
  ctx.strokeStyle = C.edge;
  ctx.lineWidth = line;
  poly(ctx, BODY);
  ctx.fill();
  ctx.stroke();
  poly(ctx, SIDEPOD_LINE, false);
  ctx.stroke();
  ctx.fillStyle = C.slot;
  poly(ctx, SIDEPOD_INLET);
  ctx.fill();
  poly(ctx, AIRBOX_INLET);
  ctx.fill();

  // Flow-guiding vanes and the sidepod winglet
  ctx.fillStyle = C.dark;
  ctx.strokeStyle = C.darkEdge;
  for (const v of VANES) {
    poly(ctx, v);
    ctx.fill();
    ctx.stroke();
  }
  ctx.fillStyle = C.body;
  ctx.strokeStyle = C.edge;
  poly(ctx, SIDEPOD_WINGLET);
  ctx.fill();
  ctx.stroke();

  // Driver helmet (plain) and halo
  ctx.fillStyle = "#2A4670";
  ctx.beginPath();
  ctx.arc(HELMET[0], HELMET[1], 0.1, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.strokeStyle = C.edge;
  ctx.lineWidth = 0.05;
  poly(ctx, HALO, false);
  ctx.stroke();
  ctx.strokeStyle = C.body;
  ctx.lineWidth = 0.05 - 2 * line;
  ctx.stroke();

  wheel(ctx, FRONT_AXLE_X, FRONT_RADIUS, wheelTurn, line);
  wheel(ctx, REAR_AXLE_X, REAR_RADIUS, wheelTurn * (FRONT_RADIUS / REAR_RADIUS), line);

  // Front wing: endplate, fixed main plane, then the active two-element flap
  ctx.fillStyle = "rgba(28,53,92,0.55)";
  ctx.strokeStyle = C.edge;
  ctx.lineWidth = line;
  poly(ctx, FRONT_ENDPLATE);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = C.body;
  airfoil(ctx, FRONT_MAIN.le, rad(FRONT_MAIN.angle), FRONT_MAIN.chord, FRONT_MAIN.thick);

  // Rear wing: beam wing and fixed main plane
  airfoil(ctx, BEAM_WING.le, rad(BEAM_WING.angle), BEAM_WING.chord, BEAM_WING.thick);
  airfoil(ctx, REAR_MAIN.le, g.ma, REAR_MAIN.chord, REAR_MAIN.thick);

  // Active aero parts in blue
  ctx.fillStyle = C.active;
  ctx.strokeStyle = "rgba(255,255,255,0.9)";
  airfoil(ctx, FRONT_FLAP.le, g.fa, FRONT_FLAP.chord, FRONT_FLAP.thick);
  airfoil(ctx, g.flap2Le, g.fa2, FRONT_FLAP2.chord, FRONT_FLAP2.thick);
  airfoil(ctx, g.rearLe, g.ra, REAR_FLAP.chord, REAR_FLAP.thick);
}
