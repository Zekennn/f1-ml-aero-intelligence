// Server-only: gathers everything the motion landing page needs into one small, serialisable object.
import { readFile } from "node:fs/promises";
import path from "node:path";
import { TEAMS } from "@/data/teams";
import { getCalendar } from "./calendar";
import { getDrivers } from "./drivers";
import { getStandings } from "./siteData";

export type LandingTeam = {
  name: string;
  slug: string;
  colour: string;
  position: number | null;
  points: number;
  wins: number;
  podiums: number;
  drivers: string[];
};

export type LandingDriver = {
  code: string;
  name: string;
  team: string;
  colour: string;
  image: string | null;
  points: number;
  progress: number[];
};

export type NextRace = {
  round: number;
  name: string;
  location: string;
  country: string;
  startUtc: string | null;
  date: string;
  laps: number | null;
  lapLength: number | null;
  /** Track outline already rotated and scaled into a 1000 × 640 box */
  path: string;
  corners: { n: number; x: number; y: number }[];
};

export type LandingData = {
  season: number;
  totalRounds: number;
  completedRounds: number;
  countries: number;
  rounds: string[];
  teams: LandingTeam[];
  drivers: LandingDriver[];
  nextRace: NextRace | null;
};

const colourOf = (team: string) => TEAMS.find((t) => t.name === team)?.colour ?? "#6B7280";

/** Reads the track outline for a circuit and fits it into a 1000 × 640 view box. */
async function loadTrack(slug: string) {
  try {
    const file = path.join(process.cwd(), "public", "data", "circuits", `${slug}.json`);
    const data = JSON.parse(await readFile(file, "utf-8"));
    const xs: number[] = data.outline?.x ?? [];
    const ys: number[] = data.outline?.y ?? [];
    if (xs.length < 10) return null;

    const angle = ((data.rotation ?? 0) * Math.PI) / 180;
    const rot = (x: number, y: number) => [x * Math.cos(angle) - y * Math.sin(angle), x * Math.sin(angle) + y * Math.cos(angle)];
    // Flip y: telemetry y grows upwards, SVG y grows downwards
    const pts = xs.map((x, i) => rot(x, ys[i])).map(([x, y]) => [x, -y]);
    const cs = (data.corners ?? []).map((c: { n: number; x: number; y: number }) => {
      const [x, y] = rot(c.x, c.y);
      return { n: c.n, x, y: -y };
    });

    const minX = Math.min(...pts.map((p) => p[0])), maxX = Math.max(...pts.map((p) => p[0]));
    const minY = Math.min(...pts.map((p) => p[1])), maxY = Math.max(...pts.map((p) => p[1]));
    const W = 1000, H = 640, pad = 48;
    const s = Math.min((W - pad * 2) / (maxX - minX), (H - pad * 2) / (maxY - minY));
    const ox = (W - (maxX - minX) * s) / 2, oy = (H - (maxY - minY) * s) / 2;
    const fit = (x: number, y: number) => [+(ox + (x - minX) * s).toFixed(1), +(oy + (y - minY) * s).toFixed(1)];

    const step = Math.max(1, Math.floor(pts.length / 260));
    const sampled = pts.filter((_, i) => i % step === 0).map(([x, y]) => fit(x, y));
    const d = `M${sampled.map((p) => p.join(" ")).join("L")}Z`;
    const corners = cs.map((c: { n: number; x: number; y: number }) => {
      const [x, y] = fit(c.x, c.y);
      return { n: c.n, x, y };
    });
    return { path: d, corners, lapLength: (data.lapLength as number) ?? null };
  } catch {
    return null;
  }
}

export async function getLandingData(): Promise<LandingData> {
  const [calendar, standings, { drivers: driverList }] = await Promise.all([getCalendar(), getStandings(), getDrivers()]);
  const races = calendar.races ?? [];
  const photoByCode = new Map(driverList.map((d) => [d.code, d.image]));

  const drivers: LandingDriver[] = (standings?.drivers ?? []).map((d) => ({
    code: d.code,
    name: d.driver,
    team: d.team,
    colour: colourOf(d.team),
    image: photoByCode.get(d.code) ?? null,
    points: d.points,
    progress: d.progress,
  }));

  // Teams in championship order; teams without standings fall to the end
  const byTeam = new Map((standings?.constructors ?? []).map((c) => [c.team, c]));
  const teams: LandingTeam[] = TEAMS.map((t) => {
    const c = byTeam.get(t.name);
    return {
      name: t.name,
      slug: t.slug,
      colour: t.colour,
      position: c?.position ?? null,
      points: c?.points ?? 0,
      wins: c?.wins ?? 0,
      podiums: c?.podiums ?? 0,
      drivers: drivers.filter((d) => d.team === t.name).slice(0, 2).map((d) => d.code),
    };
  }).sort((a, b) => (a.position ?? 99) - (b.position ?? 99));

  const upcoming = races.find((r) => r.status !== "completed");
  let nextRace: NextRace | null = null;
  if (upcoming) {
    const track = await loadTrack(upcoming.slug);
    if (track) {
      nextRace = {
        round: upcoming.round,
        name: upcoming.name,
        location: upcoming.location ?? upcoming.country,
        country: upcoming.country,
        startUtc: upcoming.raceStartUtc ?? null,
        date: upcoming.date,
        laps: upcoming.laps ?? null,
        lapLength: track.lapLength,
        path: track.path,
        corners: track.corners,
      };
    }
  }

  return {
    season: calendar.season ?? standings?.season ?? new Date().getFullYear(),
    totalRounds: races.length,
    completedRounds: races.filter((r) => r.status === "completed").length,
    countries: new Set(races.map((r) => r.country)).size,
    rounds: (standings?.rounds ?? []).map((r) => r.name.replace(" Grand Prix", "")),
    teams,
    drivers,
    nextRace,
  };
}
