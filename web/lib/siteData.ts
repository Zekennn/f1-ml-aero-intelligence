// Server-only: reads the JSON written by backend/pipeline/build_site_data.py and train_models.py.
import { readFile } from "node:fs/promises";
import path from "node:path";
import type { CircuitIndex } from "./circuitData";

const DATA_DIR = path.join(process.cwd(), "data");

async function readJson<T>(file: string, fallback: T): Promise<T> {
  try {
    return JSON.parse(await readFile(path.join(DATA_DIR, file), "utf-8")) as T;
  } catch {
    return fallback;
  }
}

export type StandingRow = {
  position: number;
  points: number;
  wins: number;
  podiums: number;
  progress: number[];
};
export type DriverStanding = StandingRow & { driver: string; code: string; team: string };
export type TeamStanding = StandingRow & { team: string };
export type Standings = {
  season: number;
  afterRound: number;
  rounds: { round: number; name: string; slug: string | null }[];
  drivers: DriverStanding[];
  constructors: TeamStanding[];
};

export type PitTeamSeason = { team: string; team2026: string; stops: number; average: number; median: number; best: number };
export type PitStopData = {
  seasons: Record<string, { races: number; teams: PitTeamSeason[]; fastest: { team: string; driver: string; gp: string; lap: number; time: number }[] }>;
  teamStationary: Record<string, { seconds: number; season: number; stops: number }>;
};

export type AeroCalibration = { effectivePowerKw: number; maeKmh: number; setupBySlug: Record<string, "low" | "high"> };

export const getCircuitIndex = () => readJson<CircuitIndex>("circuits.json", { season: 2026, circuits: {} });
export const getStandings = () => readJson<Standings | null>("standings.json", null);
export const getPitStops = () => readJson<PitStopData | null>("pitstops.json", null);
export const getAeroCalibration = () => readJson<AeroCalibration>("aero-calibration.json", { effectivePowerKw: 283, maeKmh: 0, setupBySlug: {} });

/* ---------- Race winner model (backend/pipeline/train_winner_model.py) ---------- */
export type WmDriver = { code: string; name: string; team: string };
export type WmScore = { races: number; winner: number; podium: number; probOnWinner: number };
export type WmPick = WmDriver & { prob: number; winnerProb: number; winnerRank: number; correct: boolean };
export type WinnerModel = {
  generated: string;
  season: number;
  afterRound: number;
  roundsTotal: number;
  simulations: number;
  data: { races: number; trainRows: number; firstSeason: number; firstTrainSeason: number };
  features: { preRace: string[]; withQuali: string[] };
  validation: { season: number; races: number; preRace: WmScore; withQuali: WmScore; preRaceLogReg: number; withQualiLogReg: number; pole: number; leader: number }[];
  season2026: { preRace: WmScore; withQuali: WmScore; pole: number; leader: number };
  importance: { feature: string; label: string; value: number }[];
  backtest: { round: number; name: string; slug: string; winner: WmDriver & { grid: number }; preRace: WmPick; withQuali: WmPick }[];
  nextRace: { round: number; name: string; slug: string; date: string; sprint: boolean; drivers: (WmDriver & { win: number; podium: number })[] } | null;
  remaining: { round: number; name: string; slug: string; date: string; sprint: boolean; top: (WmDriver & { win: number })[] }[];
  championship: (WmDriver & { points: number; title: number; expected: number; p10: number; p90: number })[];
  teams: { team: string; points: number; expected: number }[];
};

export const getWinnerModel = () => readJson<WinnerModel | null>("winner-model.json", null);
