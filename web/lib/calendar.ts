// Server-only (reads files). Client components may only `import type` from here.
import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import path from "node:path";
import type { CircuitIndex } from "./circuitData";

/*
 * Reads the race calendar for the website.
 * - data/calendar.json    written by backend/update_calendar.py from FastF1 (dates, status, live results)
 * - data/circuits.json    written by backend/pipeline/build_site_data.py from the TracingInsights Stats and
 *                         PitStops repos: track history, 2026 results, pit stops (preferred over FastF1)
 * - data/active-aero.json your manual active aero values
 * - public/images/tracks/<slug>.jpg|jpeg|png|webp  your track photos
 */

type Person = { driver: string; team?: string };
type Podium = { position: number; driver: string; team: string };

export type RaceResult = {
  winner: Podium | null;
  pole: Person | null;
  fastestLap: { driver: string; time: string | null } | null;
  podium: Podium[];
};

export type TrackHistory = {
  firstWinner: { driver: string; team?: string; year: number } | null;
  timesHeld?: number | null;
  previousWinner: { driver: string; team: string; year: number; event?: string } | null;
  lapRecord: { driver: string; time: string; year: number; team?: string } | null;
  mostWins?: { drivers: string[]; wins: number } | null;
};

/** Extra track facts from the TracingInsights data (FastF1 values are only a fallback). */
export type TrackData = {
  historySource: "TracingInsights Stats" | "FastF1";
  dataSeason: number | null; // telemetry season used on the Live telemetry page
  fastestPitStop: { team: string; driver: string; time: number; year: number } | null;
  pitLoss: number | null;
  aeroZonesDerived: number | null;
  heldAt: string | null; // e.g. "Bahrain Grand Prix in Malaysia" when the event moved
};

/** One race as saved by the Python script. */
type SavedRace = {
  round: number;
  slug: string;
  name: string;
  country: string;
  location: string | null;
  circuit: string | null;
  date: string;
  raceStartUtc: string | null;
  status: "upcoming" | "completed";
  laps: number | null;
  lapsFrom: number | null;
  result: RaceResult | null;
  history: TrackHistory;
};

export type ActiveAero = { zones: number | null; note: string };

/** One race as the page uses it. */
export type Race = SavedRace & {
  image: string | null;
  aero: ActiveAero;
  isNext: boolean;
  track: TrackData;
};

export type Calendar = { season: number | null; updated: string | null; races: Race[] };

const DATA_DIR = path.join(process.cwd(), "data");
const TRACKS_DIR = path.join(process.cwd(), "public", "images", "tracks");
const IMAGE_TYPES = ["jpg", "jpeg", "png", "webp"];

// A race shows as completed this long after lights out, even before the data is refreshed
const RACE_LENGTH_MS = 3 * 60 * 60 * 1000;

async function readJson<T>(file: string, fallback: T): Promise<T> {
  try {
    return JSON.parse(await readFile(path.join(DATA_DIR, file), "utf-8")) as T;
  } catch {
    return fallback; // missing file or a typo: show the page without it
  }
}

function findTrackImage(slug: string) {
  const type = IMAGE_TYPES.find((ext) => existsSync(path.join(TRACKS_DIR, `${slug}.${ext}`)));
  return type ? `/images/tracks/${slug}.${type}` : null;
}

export async function getCalendar(): Promise<Calendar> {
  const saved = await readJson<{ season?: number; updated?: string; races?: SavedRace[] }>("calendar.json", {});
  const aero = await readJson<Record<string, Partial<ActiveAero>>>("active-aero.json", {});
  const index = await readJson<CircuitIndex>("circuits.json", { season: 0, circuits: {} });
  const now = Date.now();

  const races: Race[] = (saved.races ?? []).map((race) => {
    const started = race.raceStartUtc ? Date.parse(race.raceStartUtc) : Date.parse(`${race.date}T23:59:59Z`);
    const zones = aero[race.slug]?.zones;
    const stats = index.circuits[race.slug];
    const h = stats?.history;
    // Prefer the Stats repo; keep FastF1's values only where the Stats data has nothing
    const history: TrackHistory = h
      ? {
          firstWinner: h.firstWinner ?? race.history?.firstWinner ?? null,
          timesHeld: h.timesHeld || race.history?.timesHeld || null,
          previousWinner: h.previousWinner ?? race.history?.previousWinner ?? null,
          lapRecord: h.lapRecord ?? race.history?.lapRecord ?? null,
          mostWins: h.mostWins,
        }
      : race.history;
    const r = h?.result2026;
    const result: RaceResult | null = r
      ? {
          winner: { position: 1, driver: r.winner.driver, team: r.winner.team ?? "" },
          pole: r.pole,
          fastestLap: r.fastestLap ? { driver: r.fastestLap.driver, time: r.fastestLap.time } : race.result?.fastestLap ?? null,
          podium: r.podium,
        }
      : race.result;
    return {
      ...race,
      history,
      result,
      track: {
        historySource: h ? "TracingInsights Stats" : "FastF1",
        dataSeason: stats?.dataSeason ?? null,
        fastestPitStop: stats?.fastestPitStop ?? null,
        pitLoss: stats && !stats.pitLossEstimated ? stats.pitLoss : null,
        aeroZonesDerived: stats?.aeroZones ?? null,
        heldAt: h?.statsEvent && h.statsEvent !== race.name ? h.statsEvent : null,
      },
      status: race.status === "completed" || started + RACE_LENGTH_MS < now ? "completed" : "upcoming",
      image: findTrackImage(race.slug),
      aero: { zones: typeof zones === "number" ? zones : null, note: aero[race.slug]?.note?.trim() ?? "" },
      isNext: false,
    };
  });

  const next = races.find((race) => race.status === "upcoming");
  if (next) next.isNext = true;

  return { season: saved.season ?? null, updated: saved.updated ?? null, races };
}
