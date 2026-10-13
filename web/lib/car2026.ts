/**
 * ============================================================================
 *  2026 FORMULA 1 CAR CONFIG — the one place to edit car data
 * ============================================================================
 *
 * Used by the Aero Calculator (physics) and the Wind Tunnel (drawing to scale).
 *
 * Sources and honesty:
 *  - Mass, wheelbase and width follow the FIA 2026 technical regulations.
 *  - Power is approximate: ~400 kW combustion + 350 kW electric (MGU-K).
 *  - ALL aerodynamic numbers below are ESTIMATES. Teams do not publish their
 *    real drag or downforce coefficients. They are tuned so that at 300 km/h in
 *    Corner Mode the car makes ~2× its own weight in downforce, in line with the
 *    FIA's stated targets (less downforce and much less drag than 2022–2025 cars).
 */

// ---------------------------------------------------------------------------
// Car
// ---------------------------------------------------------------------------
export const CAR = {
  /** Minimum mass with driver, without fuel (kg). */
  massKg: 768,
  /** Distance between front and rear axle centres (m). */
  wheelbaseM: 3.4,
  /** Maximum overall width (m). */
  widthM: 1.9,
  /** Tyre outer diameters (m), approximate 2026 sizes. */
  frontTyreDiameterM: 0.705,
  rearTyreDiameterM: 0.71,
  /** Nose tip to front axle (m) — measured from the FIA side-view render. */
  frontOverhangM: 1.18,
  /** Rear axle to the back of the rear wing (m) — measured from the render. */
  rearOverhangM: 0.72,
} as const;

// ---------------------------------------------------------------------------
// Power unit (approximate)
// ---------------------------------------------------------------------------
export const POWER = {
  combustionKw: 400,
  electricKw: 350,
  get totalKw() {
    return this.combustionKw + this.electricKw; // ≈ 750 kW
  },
};

// ---------------------------------------------------------------------------
// Active aero modes
// ---------------------------------------------------------------------------
export type ModeId = "corner" | "straight";

export const MODES: Record<ModeId, { label: string; short: string; description: string }> = {
  corner: { label: "Corner Mode", short: "Z-mode", description: "Front and rear flaps closed: high downforce" },
  straight: { label: "Straight Mode", short: "X-mode", description: "Front and rear flaps open: low drag" },
};

// ---------------------------------------------------------------------------
// Track downforce setups
// ---------------------------------------------------------------------------
export type SetupId = "low" | "medium" | "high";

/**
 * `scale` multiplies BOTH CdA and ClA relative to the Medium setup
 * (Low ≈ 15% less, High ≈ 15% more).
 */
export const SETUPS: Record<SetupId, { label: string; example: string; scale: number }> = {
  low: { label: "Low downforce", example: "e.g. Monza", scale: 0.85 },
  medium: { label: "Medium downforce", example: "most tracks", scale: 1.0 },
  high: { label: "High downforce", example: "e.g. Monaco", scale: 1.15 },
};

// ---------------------------------------------------------------------------
// Aerodynamic coefficients — ESTIMATES (Medium setup)
//   CdA = drag coefficient × frontal area (m²)
//   ClA = downforce (lift) coefficient × reference area (m²)
// ---------------------------------------------------------------------------
export const AERO_MEDIUM: Record<ModeId, { CdA: number; ClA: number }> = {
  corner: { CdA: 1.1, ClA: 3.6 },
  straight: { CdA: 0.75, ClA: 1.9 },
};

/**
 * Share of total downforce on the front axle (0–1). Because the front flap also
 * opens in Straight Mode, the balance only moves slightly and the car stays stable.
 */
export const AERO_BALANCE_FRONT: Record<ModeId, number> = {
  corner: 0.44,
  straight: 0.42,
};

// ---------------------------------------------------------------------------
// Wing angles shown in the UI and drawn in the wind tunnel (degrees) — illustrative
// ---------------------------------------------------------------------------
export const FLAP_ANGLES = {
  /** Active front flap (two-element) angle. */
  front: {
    corner: { low: 18, medium: 22, high: 26 },
    straight: { low: 6, medium: 7, high: 8 },
  },
  /** Active rear upper flap angle. */
  rear: {
    corner: { low: 24, medium: 30, high: 36 },
    straight: { low: 6, medium: 8, high: 10 },
  },
  /** Fixed rear main plane angle per setup (does not move with the mode). */
  rearMainPlane: { low: 5, medium: 8, high: 11 },
} satisfies Record<string, unknown>;

// ---------------------------------------------------------------------------
// Air
// ---------------------------------------------------------------------------
export const AIR = {
  /** Sea level, 15 °C (International Standard Atmosphere). */
  defaultDensity: 1.225,
  defaultTempC: 15,
  defaultAltitudeM: 0,
  seaLevelPressurePa: 101325,
  /** Specific gas constant for dry air, J/(kg·K). */
  gasConstant: 287.05,
  gravity: 9.81,
};

/** Track presets fill in the altitude (approximate, metres above sea level). */
export const TRACK_PRESETS = [
  { id: "sea", label: "Sea level (standard)", altitudeM: 0 },
  { id: "monaco", label: "Monaco", altitudeM: 10 },
  { id: "silverstone", label: "Silverstone", altitudeM: 150 },
  { id: "monza", label: "Monza", altitudeM: 160 },
  { id: "spielberg", label: "Red Bull Ring", altitudeM: 680 },
  { id: "interlagos", label: "Interlagos (São Paulo)", altitudeM: 780 },
  { id: "mexico", label: "Mexico City", altitudeM: 2240 },
] as const;

/** Calculator defaults (also what Reset returns to). */
export const DEFAULT_INPUTS = {
  speedKmh: 300,
  mode: "corner" as ModeId,
  setup: "medium" as SetupId,
  tempC: AIR.defaultTempC,
  altitudeM: AIR.defaultAltitudeM,
};
