/*
 * Lap time model in the browser.
 * Gradient-boosted trees trained by backend/pipeline/train_models.py on TracingInsights race laps
 * (2025–2026 telemetry repos + Stats repo 2018–2024), exported to public/data/models/laptime.json.
 * The trees predict lap time ÷ the circuit's pace anchor; see models/MODEL_REPORT.md.
 */

type Tree = { f: number[]; t: (number | null)[]; c: (number[] | null)[]; l: number[]; r: number[]; m: number[]; v: number[] };

export type LapTimeModel = {
  features: string[];
  categories: { circuit: string[]; compound: string[]; team: string[] };
  baseline: number;
  order: number[];
  catMaps: (number[] | null)[];
  trees: Tree[];
  context: {
    season: number;
    fuelStartKg: number;
    teamForm: Record<string, number>;
    teamGrid: Record<string, number>;
    circuits: Record<string, { circuitId: string | null; known: boolean; estKm: number; anchor: number; trackTemp: number | null }>;
  };
  metrics: { testMae: number; testRaces: Record<string, number>; oldFormulaMae: number | null; trainLaps: number; testLaps: number };
  trainedAt: string;
};

export type LapInput = {
  slug: string;
  team: string;
  compound: string;
  tyreAge: number; // laps on this set
  lap: number; // 1-based race lap
  totalLaps: number;
  trackTemp?: number | null;
};

let cached: Promise<LapTimeModel> | null = null;

export function loadLapTimeModel(): Promise<LapTimeModel> {
  cached ??= fetch("/data/models/laptime.json").then((r) => {
    if (!r.ok) throw new Error("Lap time model not found");
    return r.json();
  });
  return cached;
}

/** Raw feature vector in the training order. Unknown categories become NaN, like in training. */
function features(m: LapTimeModel, p: LapInput): number[] {
  const ctx = m.context.circuits[p.slug];
  const cat = (list: string[], v: string | null | undefined) => {
    const i = v == null ? -1 : list.indexOf(v);
    return i < 0 ? NaN : i;
  };
  const fuel = m.context.fuelStartKg * (1 - (p.lap - 1) / Math.max(1, p.totalLaps));
  const values: Record<string, number> = {
    circuit: cat(m.categories.circuit, ctx?.circuitId),
    season: m.context.season,
    compound: cat(m.categories.compound, p.compound),
    tyre_age: p.tyreAge,
    track_temp: p.trackTemp ?? ctx?.trackTemp ?? NaN,
    fuel_kg: Math.max(0, fuel),
    team: cat(m.categories.team, p.team),
    team_form: m.context.teamForm[p.team] ?? NaN,
    grid: m.context.teamGrid[p.team] ?? NaN,
    est_km: ctx?.estKm ?? NaN,
    anchor: ctx?.anchor ?? NaN,
  };
  return m.features.map((f) => values[f] ?? NaN);
}

/** Predicted lap time in seconds. */
export function predictLapTime(m: LapTimeModel, p: LapInput): number {
  const raw = features(m, p);
  // Same preprocessing as sklearn: categorical columns first, ordinal-encoded by the training categories
  const x = m.order.map((col, pos) => {
    const v = raw[col];
    const cats = m.catMaps[pos];
    if (cats && Number.isFinite(v)) {
      const i = cats.indexOf(v);
      return i < 0 ? NaN : i;
    }
    return v;
  });
  let out = m.baseline;
  for (const t of m.trees) {
    let k = 0;
    while (t.f[k] !== -1) {
      const v = x[t.f[k]];
      let left: boolean;
      if (Number.isNaN(v)) left = t.m[k] === 1;
      else if (t.c[k]) left = (t.c[k] as number[]).includes(v);
      else left = v <= (t.t[k] as number);
      k = left ? t.l[k] : t.r[k];
    }
    out += t.v[k];
  }
  return out * (m.context.circuits[p.slug]?.anchor ?? NaN);
}
