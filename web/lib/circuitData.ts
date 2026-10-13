/*
 * Types for the circuit data built by backend/pipeline/build_site_data.py from the TracingInsights repos.
 * - data/circuits.json                 index of every 2026 circuit (history, pit loss, data season...)
 * - public/data/circuits/<slug>.json   per-circuit telemetry, fetched by the browser
 */

export const DRY_COMPOUNDS = ["SOFT", "MEDIUM", "HARD"] as const;
export type Compound = (typeof DRY_COMPOUNDS)[number];

/** One lap resampled to fixed distance steps (same index = same point on track as the outline). */
export type LapTelemetry = {
  t: number[]; // seconds since the start of the lap
  speed: number[]; // km/h
  throttle: number[]; // %
  brake: number[]; // 0/1
  gear: number[];
  rpm: number[];
  aero: number[]; // 2026: Straight Mode (derived) 1/0 · 2025: DRS open 1/0 (real)
  gLat: number[]; // G
  gLong: number[]; // G
};

export type TeamLap = {
  driver: string;
  lap: number;
  time: number; // s
  compound: string;
  tyreLife: number;
  proxyFor: string | null; // team whose lap stands in (Cadillac on 2025-sourced tracks)
  sourceTeam: string;
  telemetry: LapTelemetry;
};

export type CircuitData = {
  slug: string;
  name: string;
  season: number; // telemetry source season (2026, or 2025 if the 2026 race isn't in the repo)
  laps: number | null;
  lapLength: number; // m
  rotation: number | null;
  outline: { x: number[]; y: number[] };
  corners: { n: number; x: number; y: number; d: number; type: string | null }[];
  weather: { air: number | null; track: number | null; pressure: number | null; humidity: number | null; rain: boolean };
  compounds: string[];
  aeroLabel: string;
  fastestLap: Omit<TeamLap, "tyreLife" | "proxyFor" | "sourceTeam"> & { team: string };
  teams: Record<string, TeamLap>;
};

type Person = { driver: string; team?: string };

export type CircuitHistory = {
  firstWinner: { driver: string; team: string; year: number } | null;
  timesHeld: number;
  previousWinner: { driver: string; team: string; year: number; event?: string } | null;
  mostWins: { drivers: string[]; wins: number } | null;
  lapRecord: { time: string; seconds: number; driver: string; team: string; year: number; since: number } | null;
  result2026: {
    winner: Person;
    pole: Person | null;
    podium: { position: number; driver: string; team: string }[];
    fastestLap: { driver: string; team: string; time: string } | null;
  } | null;
  circuitId: string | null;
  statsEvent: string | null;
};

export type CircuitSummary = {
  round: number;
  name: string;
  laps: number | null;
  status: string;
  dataSeason: number | null;
  hasTelemetry: boolean;
  lapLength: number | null;
  compounds: string[];
  weather: CircuitData["weather"] | null;
  pitLoss: number; // s, in-lap + out-lap vs normal laps (includes the stationary time)
  pitLossEstimated: boolean;
  aeroZones: number | null; // derived from 2026 telemetry
  topSpeed: number | null;
  fastestLap: { driver: string; team: string; time: number; compound: string } | null;
  proxies: Record<string, string>;
  history: CircuitHistory;
  fastestPitStop: { team: string; driver: string; time: number; year: number } | null;
};

export type CircuitIndex = { season: number; circuits: Record<string, CircuitSummary> };

export const TEAMS_2026 = [
  "McLaren", "Mercedes", "Red Bull", "Ferrari", "Williams", "Racing Bulls",
  "Aston Martin", "Haas", "Audi", "Alpine", "Cadillac",
] as const;

/** Browser: load one circuit's telemetry file. */
export async function loadCircuit(slug: string): Promise<CircuitData> {
  const res = await fetch(`/data/circuits/${slug}.json`);
  if (!res.ok) throw new Error(`No telemetry for ${slug}`);
  return res.json();
}

/** Air density from the race weather (pressure in mbar, temperature in °C). */
export function densityFromWeather(w: CircuitData["weather"] | null | undefined): number {
  if (!w?.pressure || w.air == null) return 1.225;
  return (w.pressure * 100) / (287.05 * (w.air + 273.15));
}

export const formatLap = (s: number | null | undefined) => {
  if (s == null || !Number.isFinite(s)) return "–";
  const m = Math.floor(s / 60);
  return `${m}:${(s - m * 60).toFixed(3).padStart(6, "0")}`;
};

export const formatDuration = (s: number) => {
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return h ? `${h}:${String(m).padStart(2, "0")}:${sec.toFixed(1).padStart(4, "0")}` : `${m}:${sec.toFixed(1).padStart(4, "0")}`;
};
