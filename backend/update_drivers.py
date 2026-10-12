"""
Refresh the driver standings shown on the website (web/data/drivers.json).

Runs automatically from the backend (live_data.py), or by hand together with
the calendar:  .\\venv\\Scripts\\python.exe backend\\update_data.py

For every driver in the 2026 championship it saves position, points, wins,
car number, code, nationality and current team (the team they drove for in
the latest race). Podiums and poles are counted from calendar.json, so run the
calendar refresh first. If the standings can't be fetched, the existing file
is kept as it is.
"""
import json
import sys
from collections import Counter
from datetime import datetime, timezone

import fastf1
from fastf1.ergast import Ergast

from update_calendar import (
    CACHE_DIR, CALENDAR_FILE, ROOT, SEASON, WEB_DATA,
    as_int, attempt, driver_name, log, write_json,
)

DRIVERS_FILE = WEB_DATA / "drivers.json"


def podiums_and_poles():
    """Count podiums and poles per driver from this season's saved race results."""
    podiums, poles = Counter(), Counter()
    try:
        calendar = json.loads(CALENDAR_FILE.read_text(encoding="utf-8"))
    except (OSError, ValueError):
        return podiums, poles
    for race in calendar.get("races", []):
        result = race.get("result") or {}
        for place in result.get("podium") or []:
            podiums[place["driver"]] += 1
        if result.get("pole"):
            poles[result["pole"]["driver"]] += 1
    return podiums, poles


def latest_teams(ergast: Ergast, rnd: int) -> dict:
    """driverId -> (team id, team name) for everyone who started the given round."""
    race = ergast.get_race_results(season=SEASON, round=rnd)
    if not race.content:
        return {}
    return {r.driverId: (r.constructorId, r.constructorName) for _, r in race.content[0].iterrows()}


def points(value):
    """340.0 -> 340, 12.5 -> 12.5"""
    value = float(value)
    return int(value) if value.is_integer() else value


def refresh(verbose: bool = True) -> dict:
    CACHE_DIR.mkdir(parents=True, exist_ok=True)
    fastf1.Cache.enable_cache(str(CACHE_DIR))
    ergast = Ergast(result_type="pandas", auto_cast=True)
    now = datetime.now(timezone.utc)

    if verbose:
        log(f"Getting {SEASON} driver standings...")
    with fastf1.Cache.disabled():
        standings = attempt("driver standings", lambda: ergast.get_driver_standings(season=SEASON))
    if standings is None or not standings.content or standings.content[0].empty:
        log("No driver standings yet - drivers.json left as it is.")
        return {"ok": False, "error": "standings unavailable"}

    table = standings.content[0]
    after_round = int(standings.description.iloc[0]["round"])

    # Current team = the team they raced for in the latest round (drivers can switch mid-season)
    with fastf1.Cache.disabled():
        teams = attempt(f"line-up for round {after_round}", lambda: latest_teams(ergast, after_round), default={})
    podiums, poles = podiums_and_poles()

    drivers = []
    for _, row in table.iterrows():
        name = driver_name(row)
        season_teams = list(zip(row.constructorIds, row.constructorNames))
        team_id, team = teams.get(row.driverId) or (season_teams[-1] if season_teams else (None, None))
        drivers.append({
            "position": as_int(row.position),
            "driverId": row.driverId,
            "code": row.driverCode,
            "number": as_int(row.driverNumber),
            "name": name,
            "nationality": row.driverNationality,
            "teamId": team_id,
            "team": team,
            "points": points(row.points),
            "wins": as_int(row.wins) or 0,
            "podiums": podiums.get(name, 0),
            "poles": poles.get(name, 0),
            # False if they didn't start the latest race (replaced, injured, reserve...)
            "inLatestRace": row.driverId in teams if teams else True,
        })

    write_json(DRIVERS_FILE, {
        "season": SEASON,
        "updated": now.strftime("%Y-%m-%dT%H:%M:%SZ"),
        "afterRound": after_round,
        "drivers": drivers,
    })
    log(f"Saved {len(drivers)} drivers (standings after round {after_round}) to {DRIVERS_FILE.relative_to(ROOT)}")
    return {"ok": True, "drivers": len(drivers), "afterRound": after_round}


if __name__ == "__main__":
    sys.exit(0 if refresh()["ok"] else 1)
