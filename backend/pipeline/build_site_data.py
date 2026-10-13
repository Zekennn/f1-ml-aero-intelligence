"""
Build the small, clean JSON files the website uses from the TracingInsights repos.

Outputs
  web/public/data/circuits/<slug>.json  per circuit: outline, corners, weather, fastest lap and one
                                        reference lap per 2026 team (distance-based, downsampled)
  web/data/circuits.json                index of every 2026 circuit: data source season, lap length,
                                        compounds, pit loss, history, pit stop record
  web/data/standings.json               2026 driver + constructor standings and points per round
  web/data/pitstops.json                DHL pit stops 2018–2026 per team, fastest stops, team averages

Run:  venv\\Scripts\\python.exe backend\\pipeline\\build_site_data.py [--refresh]
"""
from __future__ import annotations

import argparse
import math
import statistics
from collections import Counter, defaultdict

import numpy as np

from common import (
    PITSTOPS, PUBLIC_DATA, SEASON, STATS, TEAMS_2026, WEB_DATA, fetch_race_file, lap_str_to_seconds,
    list_repo_grands_prix, log, num, read_json, seconds_to_lap_str, team_2026, write_json,
)

GRID_POINTS = 400  # samples per lap after downsampling (≈ every 10–18 m)
MAX_CIRCUIT_BYTES = 300_000
DRY = ("SOFT", "MEDIUM", "HARD")

# Grand Prix names that are the same event under another name (for wins / first winner / times held)
GP_ALIASES = {
    "Mexican Grand Prix": "Mexico City Grand Prix",
    "Brazilian Grand Prix": "São Paulo Grand Prix",
    "Bahrain Grand Prix in Malaysia": "Bahrain Grand Prix",
}
# Lap records only count laps since the current layout (approximate years of the last big change)
LAYOUT_SINCE = {
    "albert_park": 2022, "yas_marina": 2021, "catalunya": 2023, "marina_bay": 2023, "silverstone": 2011,
    "red_bull_ring": 2014, "hungaroring": 2003, "monaco": 2015, "suzuka": 2003, "interlagos": 1990,
    "spa": 2007, "monza": 2000, "zandvoort": 2021, "bahrain": 2005, "baku": 2016, "villeneuve": 2002,
}
FASTEST_LAP_DATA_FROM = 2004  # Ergast has fastest race laps from 2004


def canonical_gp(name: str) -> str:
    return GP_ALIASES.get(name, name)


# ---------------------------------------------------------------------------
# Stats repo (Ergast format)
# ---------------------------------------------------------------------------
def _race_of(path):
    d = read_json(path)
    try:
        races = d["MRData"]["RaceTable"]["Races"]
        return races[0] if races else None
    except (KeyError, TypeError):
        return None


def load_all_races(first_season: int = 1950) -> list[dict]:
    """Every race in the Stats repo with winner, podium, pole and fastest lap."""
    races = []
    for season_dir in sorted(p for p in STATS.iterdir() if p.is_dir() and p.name.isdigit()):
        season = int(season_dir.name)
        if season < first_season:
            continue
        for gp_dir in sorted(p for p in season_dir.iterdir() if p.is_dir()):
            info = read_json(gp_dir / "event_info.json") or {}
            res = _race_of(gp_dir / "results.json")
            if not info and not res:
                continue
            base = res or info
            entry = {
                "season": season,
                "round": int(base.get("round", 0)),
                "raceName": base.get("raceName"),
                "gp": canonical_gp(base.get("raceName", "")),
                "circuitId": base.get("Circuit", {}).get("circuitId"),
                "date": base.get("date"),
                "folder": gp_dir.name,
                "results": [],
            }
            if res:
                for r in res.get("Results", []):
                    d = r["Driver"]
                    fl = r.get("FastestLap") or {}
                    entry["results"].append({
                        "pos": int(r["position"]),
                        "driver": f"{d['givenName']} {d['familyName']}",
                        "code": d.get("code"),
                        "driverId": d["driverId"],
                        "team": r["Constructor"]["name"],
                        "team2026": team_2026(r["Constructor"]["constructorId"]),
                        "grid": int(r.get("grid") or 0),
                        "points": float(r.get("points") or 0),
                        "status": r.get("status"),
                        "laps": int(r.get("laps") or 0),
                        "flRank": int(fl.get("rank", 0) or 0),
                        "flTime": lap_str_to_seconds((fl.get("Time") or {}).get("time")),
                    })
            q = _race_of(gp_dir / "quali_results.json")
            if q and q.get("QualifyingResults"):
                p = q["QualifyingResults"][0]
                entry["pole"] = {"driver": f"{p['Driver']['givenName']} {p['Driver']['familyName']}", "team": p["Constructor"]["name"]}
            races.append(entry)
    return races


def match_stats_event(races_2026: list[dict], cal_race: dict) -> dict | None:
    """Calendar race -> Stats 2026 event. Round first (Stats keeps cancelled events), then name."""
    same_round = [r for r in races_2026 if r["round"] == cal_race["round"]]
    if len(same_round) == 1:
        return same_round[0]
    named = [r for r in same_round if r["raceName"] == cal_race["name"] or r["gp"] == canonical_gp(cal_race["name"])]
    return named[0] if named else (same_round[0] if same_round else None)


def circuit_history(all_races: list[dict], event: dict | None, cal_race: dict) -> dict:
    gp = canonical_gp(cal_race["name"])
    circuit_id = event["circuitId"] if event else None
    lineage = [r for r in all_races if r["gp"] == gp and r["results"]]
    lineage.sort(key=lambda r: (r["season"], r["round"]))

    def winner(r):
        w = next((x for x in r["results"] if x["pos"] == 1), None)
        return {"driver": w["driver"], "team": w["team"], "year": r["season"]} if w else None

    first = winner(lineage[0]) if lineage else None
    held = len(lineage)

    prev = next((r for r in lineage if r["season"] == SEASON - 1), None)
    prev_note = None
    if prev is None and circuit_id:  # e.g. Barcelona GP: last year this circuit hosted another GP name
        prev = next((r for r in all_races if r["season"] == SEASON - 1 and r["circuitId"] == circuit_id and r["results"]), None)
        prev_note = prev["raceName"] if prev else None
    previous = winner(prev) if prev else None
    if previous and prev_note:
        previous["event"] = prev_note

    wins = Counter(w["driver"] for w in map(winner, lineage) if w)
    most = None
    if wins:
        top = max(wins.values())
        most = {"drivers": sorted(d for d, n in wins.items() if n == top), "wins": top}

    record = None
    if circuit_id:
        since = max(FASTEST_LAP_DATA_FROM, LAYOUT_SINCE.get(circuit_id, 0))
        best = None
        for r in all_races:
            if r["circuitId"] != circuit_id or r["season"] < since:
                continue
            for x in r["results"]:
                if x["flTime"] and (best is None or x["flTime"] < best[0]):
                    best = (x["flTime"], x["driver"], x["team"], r["season"])
        if best:
            record = {"time": seconds_to_lap_str(best[0]), "seconds": round(best[0], 3), "driver": best[1], "team": best[2], "year": best[3], "since": since}

    result_2026 = None
    if event and event["results"]:
        res = sorted(event["results"], key=lambda x: x["pos"])
        fl = min((x for x in res if x["flTime"]), key=lambda x: x["flTime"], default=None)
        result_2026 = {
            "winner": {"driver": res[0]["driver"], "team": res[0]["team"]},
            "pole": event.get("pole"),
            "podium": [{"position": x["pos"], "driver": x["driver"], "team": x["team"]} for x in res[:3]],
            "fastestLap": {"driver": fl["driver"], "team": fl["team"], "time": seconds_to_lap_str(fl["flTime"])} if fl else None,
        }

    return {
        "firstWinner": first,
        "timesHeld": held,
        "previousWinner": previous,
        "mostWins": most,
        "lapRecord": record,
        "result2026": result_2026,
        "circuitId": circuit_id,
        "statsEvent": event["raceName"] if event else None,
    }


# ---------------------------------------------------------------------------
# PitStops repo (DHL)
# ---------------------------------------------------------------------------
def load_dhl() -> dict[int, dict[str, list[dict]]]:
    out: dict[int, dict[str, list[dict]]] = {}
    for season_dir in sorted(p for p in PITSTOPS.iterdir() if p.is_dir() and p.name.isdigit()):
        season = int(season_dir.name)
        for f in sorted(season_dir.glob("*.json")):
            rows = read_json(f, []) or []
            clean = []
            for r in rows:
                t = num(r.get("Time (sec)"))
                if t is None or t <= 1.0 or t > 60:
                    continue
                clean.append({"team": r.get("Team"), "team2026": team_2026(r.get("Team")), "driver": r.get("Driver"), "time": t, "lap": r.get("Lap")})
            if clean:
                out.setdefault(season, {})[f.stem] = clean
    return out


def pitstop_summary(dhl) -> dict:
    seasons = {}
    for season, events in sorted(dhl.items()):
        by_team = defaultdict(list)
        all_stops = []
        for gp, rows in events.items():
            for r in rows:
                by_team[r["team"]].append(r["time"])
                all_stops.append({**r, "gp": gp})
        teams = []
        for team, times in by_team.items():
            times.sort()
            # Average of normal stops: drop slow outliers (problems) above 2x the median
            med = statistics.median(times)
            normal = [t for t in times if t <= 2 * med]
            teams.append({
                "team": team, "team2026": team_2026(team), "stops": len(times),
                "average": round(sum(normal) / len(normal), 3), "median": round(med, 3), "best": round(times[0], 2),
            })
        teams.sort(key=lambda t: t["average"])
        fastest = sorted(all_stops, key=lambda r: r["time"])[:15]
        seasons[str(season)] = {
            "races": len(events),
            "teams": teams,
            "fastest": [{"team": r["team"], "driver": r["driver"], "gp": r["gp"], "lap": r["lap"], "time": r["time"]} for r in fastest],
        }
    return seasons


def team_stationary(dhl) -> dict:
    """Average 2026 stationary time per 2026 team (2025 if a team has no 2026 stops)."""
    out = {}
    for team in TEAMS_2026:
        for season in (SEASON, SEASON - 1):
            times = [r["time"] for rows in dhl.get(season, {}).values() for r in rows if r["team2026"] == team]
            if times:
                med = statistics.median(times)
                normal = [t for t in times if t <= 2 * med]
                out[team] = {"seconds": round(sum(normal) / len(normal), 2), "season": season, "stops": len(times)}
                break
    return out


def fastest_pitstop_at(dhl, gp_names: list[str]) -> dict | None:
    best = None
    for season, events in dhl.items():
        for name in gp_names:
            for r in events.get(name, []):
                if best is None or r["time"] < best["time"]:
                    best = {"team": r["team"], "driver": r["driver"], "time": r["time"], "year": season}
    return best


# ---------------------------------------------------------------------------
# Telemetry repos
# ---------------------------------------------------------------------------
def laps_table(session: dict) -> list[dict]:
    """Columnar session_laptimes.json -> list of lap dicts."""
    if not session or "time" not in session:
        return []
    keys = list(session.keys())
    n = len(session["time"])
    return [{k: session[k][i] if i < len(session[k]) else None for k in keys} for i in range(n)]


def is_clean_lap(lap: dict, green_only: bool = True) -> bool:
    t = num(lap.get("time"))
    if t is None or lap.get("del") is True or lap.get("ff1G") is True:
        return False
    if num(lap.get("pin")) is not None or num(lap.get("pout")) is not None:
        return False
    if (num(lap.get("lap")) or 0) <= 1:
        return False
    if lap.get("compound") not in DRY:
        return False
    if green_only and str(lap.get("status")) not in ("1", "1.0"):
        return False
    return True


def pit_loss(laps: list[dict]) -> float | None:
    """Time lost to a pit stop: (in-lap + out-lap) − 2 × the driver's median clean lap."""
    by_drv = defaultdict(list)
    for lap in laps:
        by_drv[lap.get("drv")].append(lap)
    losses = []
    for drv, rows in by_drv.items():
        rows.sort(key=lambda r: num(r.get("lap"), 0))
        clean = [num(r["time"]) for r in rows if is_clean_lap(r)]
        if len(clean) < 5:
            continue
        ref = statistics.median(clean)
        for i, r in enumerate(rows[:-1]):
            nxt = rows[i + 1]
            if num(r.get("pin")) is not None and num(nxt.get("pout")) is not None and str(r.get("status")) == "1" and str(nxt.get("status")) == "1":
                tin, tout = num(r.get("time")), num(nxt.get("time"))
                if tin and tout:
                    loss = tin + tout - 2 * ref
                    if 10 <= loss <= 45:
                        losses.append(loss)
    return round(statistics.median(losses), 1) if len(losses) >= 3 else None


def pick_reference_laps(laps: list[dict]) -> tuple[dict | None, dict[str, dict]]:
    """Fastest clean lap of the race, and each 2026 team's fastest clean green-flag lap."""
    clean = [l for l in laps if is_clean_lap(l)] or [l for l in laps if is_clean_lap(l, green_only=False)]
    fastest = min(clean, key=lambda l: num(l["time"]), default=None)
    per_team = {}
    for lap in clean:
        team = team_2026(lap.get("team"))
        if team and (team not in per_team or num(lap["time"]) < num(per_team[team]["time"])):
            per_team[team] = lap
    return fastest, per_team


def rotate(x, y, deg):
    a = math.radians(deg or 0)
    c, s = math.cos(a), math.sin(a)
    return x * c - y * s, x * s + y * c


def resample_lap(tel: dict, grid: np.ndarray) -> dict | None:
    """Distance-based resampling onto `grid` (0..1 of lap distance)."""
    try:
        dist = np.asarray(tel["distance"], dtype=float)
    except (KeyError, TypeError, ValueError):
        return None
    if len(dist) < 50 or dist[-1] <= 0:
        return None
    order = np.argsort(dist, kind="stable")
    dist = dist[order]
    rel, keep = np.unique(dist / dist[-1], return_index=True)

    def ch(name, kind="linear"):
        v = np.asarray([num(x, 0.0) for x in tel.get(name, [0] * len(order))], dtype=float)[order][keep]
        if kind == "nearest":
            idx = np.clip(np.searchsorted(rel, grid), 0, len(rel) - 1)
            return v[idx]
        return np.interp(grid, rel, v)

    return {
        "length": float(dist[-1]),
        "t": ch("time"), "speed": ch("speed"), "throttle": ch("throttle"), "brake": ch("brake"),
        "gear": ch("gear", "nearest"), "rpm": ch("rpm"), "drs": ch("drs", "nearest"),
        "ax": ch("acc_x"), "ay": ch("acc_y"), "x": ch("x"), "y": ch("y"),
    }


def straight_mode(r: dict) -> np.ndarray:
    """2026 has no recorded active-aero channel: Straight Mode is derived where the car is flat out on a straight."""
    flat = (r["throttle"] >= 95) & (r["speed"] >= 200) & (np.abs(r["ay"]) / 9.81 < 1.0)
    out = flat.copy()
    # Drop very short bursts (< 3 % of the lap)
    n = len(out)
    i = 0
    while i < n:
        if out[i]:
            j = i
            while j < n and out[j]:
                j += 1
            if (j - i) < 0.03 * n:
                out[i:j] = False
            i = j
        else:
            i += 1
    return out


def zone_count(mask: np.ndarray) -> int:
    edges = np.diff(mask.astype(int))
    count = int((edges == 1).sum()) + (1 if mask[0] else 0)
    if mask[0] and mask[-1] and count > 1:
        count -= 1  # a zone across the start/finish line counts once
    return count


def pack_lap(r: dict, season: int) -> dict:
    aero = straight_mode(r) if season >= 2026 else (r["drs"] > 0.5)
    return {
        "t": [round(float(v), 2) for v in r["t"]],
        "speed": [int(round(v)) for v in r["speed"]],
        "throttle": [int(round(min(100, max(0, v)))) for v in r["throttle"]],
        "brake": [1 if v > 0.5 else 0 for v in r["brake"]],
        "gear": [int(v) for v in r["gear"]],
        "rpm": [int(round(v / 10) * 10) for v in r["rpm"]],
        "aero": [1 if v else 0 for v in aero],
        "gLat": [round(float(v) / 9.81, 2) for v in r["ay"]],
        "gLong": [round(float(v) / 9.81, 2) for v in r["ax"]],
    }


def build_circuit(cal_race: dict, folders: dict[int, list[str]], refresh: bool) -> tuple[dict | None, dict]:
    """Returns (circuit file data, index summary)."""
    name = cal_race["name"]
    season = next((s for s in (SEASON, SEASON - 1) if name in folders.get(s, [])), None)
    session = None
    if season == SEASON:
        session = fetch_race_file(season, name, "session_laptimes.json", refresh=refresh)
        if not session:
            season = SEASON - 1 if name in folders.get(SEASON - 1, []) else None
    if season == SEASON - 1:
        session = fetch_race_file(season, name, "session_laptimes.json")
    summary = {"season": season, "missing": []}
    if not session:
        summary["missing"].append("telemetry (no Race session in the 2026 or 2025 repo)")
        return None, summary

    laps = laps_table(session)
    weather = fetch_race_file(season, name, "weather.json") or {}
    corners = fetch_race_file(season, name, "corners.json") or {}
    fastest, per_team = pick_reference_laps(laps)
    if not fastest:
        summary["missing"].append("clean laps")
        return None, summary

    # Cadillac only exists from 2026: on 2025-sourced tracks use the slowest team's lap as a stand-in.
    proxies = {}
    for team in TEAMS_2026:
        if team not in per_team and per_team:
            slowest = max(per_team.items(), key=lambda kv: num(kv[1]["time"]))
            per_team[team] = slowest[1]
            proxies[team] = slowest[0]

    grid = np.linspace(0.0, 1.0, GRID_POINTS, endpoint=False)
    cache: dict[tuple, dict] = {}

    def lap_tel(lap):
        key = (lap["drv"], int(num(lap["lap"])))
        if key not in cache:
            tel = fetch_race_file(season, name, f"{key[0]}/{key[1]}_tel.json")
            cache[key] = resample_lap((tel or {}).get("tel", tel or {}), grid) if tel else None
        return cache[key]

    fast_r = lap_tel(fastest)
    if not fast_r:
        summary["missing"].append("fastest-lap telemetry")
        return None, summary

    rotation = None
    if isinstance(corners, dict) and corners.get("Rotation"):
        rotation = num(corners["Rotation"][0] if isinstance(corners["Rotation"], list) else corners["Rotation"], 0)
    xs, ys = zip(*(rotate(x, y, rotation) for x, y in zip(fast_r["x"], fast_r["y"])))
    outline = {"x": [int(round(v)) for v in xs], "y": [int(round(v)) for v in ys]}

    corner_list = []
    if isinstance(corners, dict) and corners.get("CornerNumber"):
        for i, n in enumerate(corners["CornerNumber"]):
            cx, cy = rotate(num(corners["X"][i], 0), num(corners["Y"][i], 0), rotation)
            corner_list.append({
                "n": int(num(n, 0)), "x": int(round(cx)), "y": int(round(cy)),
                "d": int(round(num(corners["Distance"][i], 0))),
                "type": (corners.get("Section") or [None] * len(corners["CornerNumber"]))[i],
            })

    def mean_of(key):
        vals = [num(v) for v in (weather.get(key) or []) if num(v) is not None]
        return round(sum(vals) / len(vals), 1) if vals else None

    rain = any(v is True for v in (weather.get("wR") or []))

    teams = {}
    for team in TEAMS_2026:
        lap = per_team.get(team)
        r = lap_tel(lap) if lap else None
        if not r:
            summary["missing"].append(f"{team} reference lap")
            continue
        teams[team] = {
            "driver": lap["drv"], "lap": int(num(lap["lap"])), "time": round(num(lap["time"]), 3),
            "compound": lap.get("compound"), "tyreLife": int(num(lap.get("life"), 0) or 0),
            "proxyFor": proxies.get(team), "sourceTeam": lap.get("team"),
            "telemetry": pack_lap(r, season),
        }

    compounds = sorted({l.get("compound") for l in laps if l.get("compound") in DRY}, key=DRY.index)
    straight = straight_mode(fast_r) if season >= 2026 else fast_r["drs"] > 0.5
    data = {
        "slug": cal_race["slug"],
        "name": name,
        "season": season,
        "laps": cal_race.get("laps"),
        "lapLength": round(fast_r["length"]),
        "rotation": rotation,
        "outline": outline,
        "corners": corner_list,
        "weather": {"air": mean_of("wAT"), "track": mean_of("wTT"), "pressure": mean_of("wP"), "humidity": mean_of("wH"), "rain": rain},
        "compounds": compounds,
        "aeroLabel": "Straight Mode (derived)" if season >= 2026 else "DRS",
        "fastestLap": {
            "driver": fastest["drv"], "team": team_2026(fastest.get("team")), "lap": int(num(fastest["lap"])),
            "time": round(num(fastest["time"]), 3), "compound": fastest.get("compound"),
            "telemetry": pack_lap(fast_r, season),
        },
        "teams": teams,
    }
    summary.update({
        "lapLength": data["lapLength"],
        "compounds": compounds,
        "weather": data["weather"],
        "pitLoss": pit_loss(laps),
        # 2026 active aero zones (derived from flat-out straights); unknown for 2025-sourced tracks
        "aeroZones": zone_count(straight) if season >= 2026 else None,
        "topSpeed": int(round(float(np.max(fast_r["speed"])))),
        "speedTrapMedian": _median_trap(laps),
        "proxies": proxies,
        "fastestLap": {k: data["fastestLap"][k] for k in ("driver", "team", "time", "compound")},
    })
    return data, summary


def _median_trap(laps):
    vals = sorted(num(l.get("vst")) for l in laps if is_clean_lap(l) and num(l.get("vst")))
    return round(statistics.median(vals)) if vals else None


def shrink_to_limit(data: dict) -> dict:
    """Keep each circuit file under MAX_CIRCUIT_BYTES by dropping every other sample if needed."""
    import json as _json
    while len(_json.dumps(data, separators=(",", ":")).encode()) > MAX_CIRCUIT_BYTES:
        for lap in [data["fastestLap"]] + list(data["teams"].values()):
            lap["telemetry"] = {k: v[::2] for k, v in lap["telemetry"].items()}
        data["outline"] = {k: v[::2] for k, v in data["outline"].items()}
    return data


# ---------------------------------------------------------------------------
# Standings
# ---------------------------------------------------------------------------
def standings(all_races: list[dict], calendar: list[dict]) -> dict:
    season_races = sorted((r for r in all_races if r["season"] == SEASON and r["results"]), key=lambda r: r["round"])
    rounds = []
    for r in season_races:
        cal = next((c for c in calendar if c["round"] == r["round"]), None)
        rounds.append({"round": r["round"], "name": cal["name"] if cal else r["raceName"], "slug": cal["slug"] if cal else None})

    drivers: dict[str, dict] = {}
    teams: dict[str, dict] = {}
    for idx, r in enumerate(season_races):
        sprint = read_json(STATS / str(SEASON) / r["folder"] / "sprint_results.json")
        sprint_pts = defaultdict(float)
        try:
            for s in sprint["MRData"]["RaceTable"]["Races"][0]["SprintResults"]:
                sprint_pts[s["Driver"]["driverId"]] += float(s.get("points") or 0)
        except (TypeError, KeyError, IndexError):
            pass
        for x in r["results"]:
            d = drivers.setdefault(x["driverId"], {"driver": x["driver"], "code": x["code"], "team": x["team2026"], "points": 0.0,
                                                     "wins": 0, "podiums": 0, "progress": [0.0] * len(season_races)})
            d["team"] = x["team2026"]
            pts = x["points"] + sprint_pts.get(x["driverId"], 0)
            d["points"] += pts
            d["wins"] += x["pos"] == 1
            d["podiums"] += x["pos"] <= 3
            t = teams.setdefault(x["team2026"], {"team": x["team2026"], "points": 0.0, "wins": 0, "podiums": 0, "progress": [0.0] * len(season_races)})
            t["points"] += pts
            t["wins"] += x["pos"] == 1
            t["podiums"] += x["pos"] <= 3
        for d in drivers.values():
            d["progress"][idx] = d["points"]
        for t in teams.values():
            t["progress"][idx] = t["points"]

    # Cross-check against the official standings after the last round
    official = {}
    if season_races:
        sp = read_json(STATS / str(SEASON) / season_races[-1]["folder"] / "driverPoints.json")
        try:
            for s in sp["MRData"]["StandingsTable"]["StandingsLists"][0]["DriverStandings"]:
                official[s["Driver"]["driverId"]] = float(s["points"])
        except (TypeError, KeyError, IndexError):
            pass
    for did, d in drivers.items():
        if did in official and abs(official[did] - d["points"]) > 0.01:
            d["points"] = official[did]  # trust the official table (penalties etc.)
            d["progress"][-1] = official[did]

    dl = sorted(drivers.values(), key=lambda d: (-d["points"], -d["wins"]))
    tl = sorted(teams.values(), key=lambda t: (-t["points"], -t["wins"]))
    for i, d in enumerate(dl):
        d["position"] = i + 1
    for i, t in enumerate(tl):
        t["position"] = i + 1
    return {"season": SEASON, "afterRound": rounds[-1]["round"] if rounds else 0, "rounds": rounds, "drivers": dl, "constructors": tl}


# ---------------------------------------------------------------------------
def main(refresh: bool = False) -> dict:
    calendar = (read_json(WEB_DATA / "calendar.json") or {}).get("races", [])
    if not calendar:
        raise SystemExit("web/data/calendar.json is missing: run backend/update_calendar.py first")

    log("Reading Stats repo (results 1950-2026)...")
    all_races = load_all_races()
    races_2026 = [r for r in all_races if r["season"] == SEASON]
    log("Reading PitStops repo (DHL 2018-2026)...")
    dhl = load_dhl()

    log("Listing telemetry repo folders...")
    folders = {s: list_repo_grands_prix(s) for s in (SEASON, SEASON - 1)}

    index = {"season": SEASON, "circuits": {}}
    report = {"2026": [], "2025": [], "missing": {}, "sizes": {}}
    for cal in calendar:
        log(f"  {cal['round']:>2} {cal['name']}")
        event = match_stats_event(races_2026, cal)
        data, summary = build_circuit(cal, folders, refresh)
        if data:
            data = shrink_to_limit(data)
            size = write_json(PUBLIC_DATA / "circuits" / f"{cal['slug']}.json", data)
            report["sizes"][cal["slug"]] = size
        history = circuit_history(all_races, event, cal)
        gp_names = sorted({cal["name"], canonical_gp(cal["name"])} | {k for k, v in GP_ALIASES.items() if v == canonical_gp(cal["name"])})
        index["circuits"][cal["slug"]] = {
            "round": cal["round"],
            "name": cal["name"],
            "laps": cal.get("laps"),
            "status": cal.get("status"),
            "dataSeason": summary.get("season"),
            "hasTelemetry": data is not None,
            "lapLength": summary.get("lapLength"),
            "compounds": summary.get("compounds") or list(DRY),
            "weather": summary.get("weather"),
            "pitLoss": summary.get("pitLoss"),
            "aeroZones": summary.get("aeroZones"),
            "topSpeed": summary.get("topSpeed"),
            "speedTrapMedian": summary.get("speedTrapMedian"),
            "fastestLap": summary.get("fastestLap"),
            "proxies": summary.get("proxies") or {},
            "history": history,
            "fastestPitStop": fastest_pitstop_at(dhl, gp_names),
        }
        if summary.get("season"):
            report[str(summary["season"])].append(cal["name"])
        miss = list(summary.get("missing", []))
        if not history["lapRecord"]:
            miss.append("lap record")
        if not index["circuits"][cal["slug"]]["fastestPitStop"]:
            miss.append("fastest pit stop")
        if summary.get("pitLoss") is None and data:
            miss.append("pit lane loss (too few clean stops)")
        if miss:
            report["missing"][cal["name"]] = miss

    # Fill pit loss gaps with the season median so the simulator always has a value
    known = [c["pitLoss"] for c in index["circuits"].values() if c["pitLoss"]]
    fallback = round(statistics.median(known), 1) if known else 22.0
    for c in index["circuits"].values():
        c["pitLossEstimated"] = c["pitLoss"] is None
        c["pitLoss"] = c["pitLoss"] or fallback

    write_json(WEB_DATA / "circuits.json", index, compact=False)
    write_json(WEB_DATA / "standings.json", standings(all_races, calendar), compact=False)
    write_json(WEB_DATA / "pitstops.json", {"seasons": pitstop_summary(dhl), "teamStationary": team_stationary(dhl)}, compact=False)

    log("")
    log("=== Data report ===")
    log(f"Circuits with 2026 telemetry ({len(report['2026'])}): " + ", ".join(report["2026"]))
    log(f"Circuits with 2025 telemetry ({len(report['2025'])}): " + ", ".join(report["2025"]))
    if report["sizes"]:
        log(f"Circuit files: largest {max(report['sizes'].values()) / 1000:.0f} KB, total {sum(report['sizes'].values()) / 1e6:.2f} MB")
    if report["missing"]:
        log("Missing data:")
        for gp, items in report["missing"].items():
            log(f"  - {gp}: {', '.join(items)}")
    else:
        log("Missing data: none")
    return {"index": index, "report": report}


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--refresh", action="store_true", help="re-download session files (picks up new races)")
    main(ap.parse_args().refresh)
