// Server-only (reads files). Client components may only `import type` from here.
import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import path from "node:path";

/*
 * Reads the race calendar for the website.
 * - data/calendar.json    written by backend/update_calendar.py (don't edit by hand)
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
  firstWinner: { driver: string; year: number } | null;
  timesHeld?: number | null;
  previousWinner: { driver: string; team: string; year: number } | null;
  lapRecord: { driver: string; time: string; year: number } | null;
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
  const now = Date.now();

  const races: Race[] = (saved.races ?? []).map((race) => {
    const started = race.raceStartUtc ? Date.parse(race.raceStartUtc) : Date.parse(`${race.date}T23:59:59Z`);
    const zones = aero[race.slug]?.zones;
    return {
      ...race,
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
