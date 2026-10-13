/*
 * Strategy helper: predicted total race time for the best 1-stop and 2-stop plans.
 * Lap times come from the lap time model (tyre age, fuel, compound, team, circuit), pit stops cost the
 * circuit's real pit lane loss plus the team's average stationary time. Every plan uses at least two
 * dry compounds (the rule). No safety cars, traffic or tyre warm-up.
 */
import { LapTimeModel, predictLapTime } from "./lapTimeModel";

export type Stint = { compound: string; from: number; to: number; laps: number; time: number };
export type Plan = { stops: number; stints: Stint[]; pitLaps: number[]; raceTime: number; pitTime: number };

export type StrategyInput = {
  slug: string;
  team: string;
  totalLaps: number;
  compounds: string[];
  pitStopTime: number; // s per stop: lane loss + stationary
  trackTemp?: number | null;
  minStint?: number;
};

/** Best 1-stop and 2-stop plans. */
export function bestStrategies(model: LapTimeModel, p: StrategyInput): { oneStop: Plan | null; twoStop: Plan | null } {
  const N = p.totalLaps;
  const min = p.minStint ?? Math.max(5, Math.round(N * 0.12));
  const comps = p.compounds.length ? p.compounds : ["SOFT", "MEDIUM", "HARD"];

  // cum[c][s][e]: time for a stint on compound c from lap s to lap e (new tyres at lap s), 1-based laps
  const cum: Record<string, Float64Array[]> = {};
  for (const c of comps) {
    const rows: Float64Array[] = [];
    for (let s = 1; s <= N; s++) {
      const row = new Float64Array(N + 1);
      let sum = 0;
      for (let e = s; e <= N; e++) {
        sum += predictLapTime(model, { slug: p.slug, team: p.team, compound: c, tyreAge: e - s + 1, lap: e, totalLaps: N, trackTemp: p.trackTemp });
        row[e] = sum;
      }
      rows[s] = row;
    }
    cum[c] = rows;
  }
  const stint = (c: string, from: number, to: number): Stint => ({ compound: c, from, to, laps: to - from + 1, time: cum[c][from][to] });

  let oneStop: Plan | null = null;
  for (const a of comps) for (const b of comps) {
    if (a === b) continue;
    for (let pit = min; pit <= N - min; pit++) {
      const t = cum[a][1][pit] + cum[b][pit + 1][N] + p.pitStopTime;
      if (!oneStop || t < oneStop.raceTime) oneStop = { stops: 1, stints: [stint(a, 1, pit), stint(b, pit + 1, N)], pitLaps: [pit], raceTime: t, pitTime: p.pitStopTime };
    }
  }

  let twoStop: Plan | null = null;
  for (const a of comps) for (const b of comps) for (const c of comps) {
    if (a === b && b === c) continue;
    for (let p1 = min; p1 <= N - 2 * min; p1++) {
      const first = cum[a][1][p1];
      for (let p2 = p1 + min; p2 <= N - min; p2++) {
        const t = first + cum[b][p1 + 1][p2] + cum[c][p2 + 1][N] + 2 * p.pitStopTime;
        if (!twoStop || t < twoStop.raceTime) {
          twoStop = { stops: 2, stints: [stint(a, 1, p1), stint(b, p1 + 1, p2), stint(c, p2 + 1, N)], pitLaps: [p1, p2], raceTime: t, pitTime: 2 * p.pitStopTime };
        }
      }
    }
  }
  return { oneStop, twoStop };
}
