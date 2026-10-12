// Server-only (reads files). Client components may only `import type` from here.
import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { TEAMS, type Team } from "@/data/teams";

/*
 * Reads the driver standings for the website.
 * - data/drivers.json  written by backend/update_drivers.py (auto-refreshed by the backend)
 * - public/images/drivers/<code>.png|webp|jpg  driver photos, named by the 3-letter code (nor.png)
 */

type SavedDriver = {
  position: number | null;
  driverId: string;
  code: string | null;
  number: number | null;
  name: string;
  nationality: string | null;
  teamId: string | null;
  team: string | null;
  points: number;
  wins: number;
  podiums: number;
  poles: number;
  inLatestRace: boolean;
};

export type Driver = SavedDriver & {
  image: string | null;
  /** Matching team from data/teams.ts (for the logo and display name), if any */
  siteTeam: Team | null;
};

export type DriverStandings = { season: number | null; updated: string | null; afterRound: number | null; drivers: Driver[] };

const PHOTOS_DIR = path.join(process.cwd(), "public", "images", "drivers");
const IMAGE_TYPES = ["png", "webp", "jpg", "jpeg"];

function findPhoto(code: string | null) {
  if (!code) return null;
  const name = code.toLowerCase();
  const type = IMAGE_TYPES.find((ext) => existsSync(path.join(PHOTOS_DIR, `${name}.${ext}`)));
  return type ? `/images/drivers/${name}.${type}` : null;
}

export async function getDrivers(): Promise<DriverStandings> {
  let saved: { season?: number; updated?: string; afterRound?: number; drivers?: SavedDriver[] } = {};
  try {
    saved = JSON.parse(await readFile(path.join(process.cwd(), "data", "drivers.json"), "utf-8"));
  } catch {
    // no data yet: the section shows a message
  }

  const drivers = (saved.drivers ?? []).map((d) => ({
    ...d,
    image: findPhoto(d.code),
    siteTeam: TEAMS.find((t) => t.ergastId === d.teamId) ?? null,
  }));

  return { season: saved.season ?? null, updated: saved.updated ?? null, afterRound: saved.afterRound ?? null, drivers };
}
