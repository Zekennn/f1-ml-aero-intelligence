"""
Refresh the race calendar shown on the website.

Run from the project folder after each race weekend:

    .\\venv\\Scripts\\python.exe backend\\update_calendar.py          (quick: only fetches what's new)
    .\\venv\\Scripts\\python.exe backend\\update_calendar.py --full   (re-fetch everything)

What it does
- Gets the season schedule from FastF1 (races only, no testing).
- Gets results and track history from FastF1's Ergast-compatible interface.
- Writes everything to web/data/calendar.json.
- Adds any new track to web/data/active-aero.json. Values you have typed
  in there are never changed.

The Ergast server only allows a few hundred requests an hour, so a normal run
reuses results and history already saved in calendar.json and only downloads
what is missing. Anything that can't be fetched keeps its last saved value (or
stays empty) and the script carries on.
"""
import json
import re
import sys
import time
import unicodedata
import warnings
from datetime import datetime, timedelta, timezone
from pathlib import Path

import fastf1
import pandas as pd
from fastf1.ergast import Ergast

SEASON = 2026

ROOT = Path(__file__).resolve().parent.parent
WEB_DATA = ROOT / "web" / "data"
CALENDAR_FILE = WEB_DATA / "calendar.json"
AERO_FILE = WEB_DATA / "active-aero.json"
CACHE_DIR = ROOT / "data" / "cache"

# A race counts as completed this long after lights out
RACE_LENGTH = timedelta(hours=3)

# Grands Prix that have been renamed. Track history includes the old names too.
GP_ALIASES = {
    "Mexico City Grand Prix": ["Mexican Grand Prix"],
    "Brazilian Grand Prix": ["São Paulo Grand Prix"],
    "São Paulo Grand Prix": ["Brazilian Grand Prix"],
    "Bahrain Grand Prix in Malaysia": ["Bahrain Grand Prix"],
}

# Ergast uses short country names for a few countries
COUNTRY_NAMES = {"USA": "United States", "UK": "United Kingdom", "UAE": "United Arab Emirates"}

warnings.filterwarnings("ignore")
fastf1.set_log_level("ERROR")


# ---------------------------------------------------------------- helpers
def log(msg: str) -> None:
    print(msg, flush=True)


def attempt(label, fn, default=None, retries=2):
    """Run fn(); on any error print a warning and return default instead of crashing.
    If the server is busy or slow, wait and try again."""
    for tries_left in range(retries, -1, -1):
        try:
            return fn()
        except Exception as exc:  # noqa: BLE001 - we really do want to keep going
            busy = "Too Many Requests" in str(exc)
            slow = "timed out" in str(exc) or "Connection" in str(exc)
            if (busy or slow) and tries_left:
                wait = 20 if busy else 5
                log(f"  ... server {'busy' if busy else 'slow'}, retrying {label} in {wait}s")
                time.sleep(wait)
                continue
            log(f"  ! could not get {label}: {str(exc).splitlines()[0]}")
            return default


def slugify(event_name: str) -> str:
    """'São Paulo Grand Prix' -> 'sao-paulo'. Used for image and active-aero names."""
    name = re.sub(r"\s+grand prix$", "", event_name.strip(), flags=re.I)
    name = unicodedata.normalize("NFKD", name).encode("ascii", "ignore").decode()
    return re.sub(r"[^a-z0-9]+", "-", name.lower()).strip("-")


def driver_name(row) -> str:
    return f"{row.givenName} {row.familyName}"


def lap_time(value):
    """Timedelta -> '1:22.670'."""
    if value is None or pd.isna(value):
        return None
    ms = round(value.total_seconds() * 1000)
    minutes, ms = divmod(ms, 60_000)
    seconds, ms = divmod(ms, 1000)
    return f"{minutes}:{seconds:02d}.{ms:03d}"


def as_int(value):
    return None if value is None or pd.isna(value) else int(value)


def iso_utc(value):
    return None if value is None or pd.isna(value) else pd.Timestamp(value).strftime("%Y-%m-%dT%H:%M:%SZ")


def all_pages(response):
    """Follow Ergast paging until every result has been downloaded."""
    pages = [response]
    while True:
        try:
            pages.append(pages[-1].get_next_result_page())
        except ValueError:  # raised when there are no more pages
            return pages


def races_with_results(response):
    """Yield (race info, results table) pairs from a multi-race Ergast response."""
    for page in all_pages(response):
        for (_, race), results in zip(page.description.iterrows(), page.content):
            yield race, results


# ---------------------------------------------------------------- fetching
def load_schedule() -> pd.DataFrame:
    schedule = fastf1.get_event_schedule(SEASON, include_testing=False)
    return schedule[schedule["RoundNumber"] > 0]


def load_all_winners(ergast: Ergast) -> list[dict]:
    """Winner of every championship race before this season (about a dozen API calls)."""
    winners = []
    for race, results in races_with_results(ergast.get_race_results(results_position=1, limit=100)):
        if results.empty or int(race.season) >= SEASON:
            continue
        top = results.iloc[0]
        winners.append({
            "season": int(race.season),
            "raceName": race.raceName,
            "circuitId": race.circuitId,
            "driver": driver_name(top),
            "team": top.constructorName,
            "laps": as_int(top.laps),
        })
    return winners


def load_lap_record(ergast: Ergast, circuit_id: str):
    """Fastest race lap ever set at a circuit (Ergast has lap times from 2004)."""
    best = None
    for race, results in races_with_results(ergast.get_race_results(circuit=circuit_id, fastest_rank=1, limit=100)):
        for _, row in results.iterrows():
            time = row.get("fastestLapTime")  # missing on races without timing data
            if time is None or pd.isna(time):
                continue
            if best is None or time < best[0]:
                best = (time, driver_name(row), int(race.season))
    if best is None:
        return None
    return {"driver": best[1], "time": lap_time(best[0]), "year": best[2]}


def load_result(ergast: Ergast, rnd: int):
    """2026 race result: winner, pole, fastest lap, podium and laps."""
    race = ergast.get_race_results(season=SEASON, round=rnd)
    if not race.content or race.content[0].empty:
        return None
    df = race.content[0].sort_values("position")

    podium = [
        {"position": int(r.position), "driver": driver_name(r), "team": r.constructorName}
        for _, r in df.head(3).iterrows()
    ]

    fastest = None
    fl = df[df["fastestLapRank"] == 1]
    if not fl.empty:
        fastest = {"driver": driver_name(fl.iloc[0]), "time": lap_time(fl.iloc[0].fastestLapTime)}

    def pole():
        quali = ergast.get_qualifying_results(season=SEASON, round=rnd)
        if not quali.content or quali.content[0].empty:
            return None
        p1 = quali.content[0].sort_values("position").iloc[0]
        return {"driver": driver_name(p1), "team": p1.constructorName}

    return {
        "winner": podium[0] if podium else None,
        "pole": attempt(f"pole for round {rnd}", pole),
        "fastestLap": fastest,
        "podium": podium,
        "laps": as_int(df.iloc[0].laps),
    }


# History fields worked out from past winners. They only change once a season,
# so they are saved in calendar.json and reused on quick runs.
HISTORY_KEYS = ("firstWinner", "pastRaces", "previousWinner", "lastLaps", "lastLapsYear")


def history_before_season(winners: list[dict], race_name: str, circuit_id: str) -> dict:
    """Track history up to the end of last season."""
    names = {race_name, *GP_ALIASES.get(race_name, [])}
    same_gp = sorted((w for w in winners if w["raceName"] in names), key=lambda w: w["season"])
    previous = next((w for w in winners if w["season"] == SEASON - 1 and w["circuitId"] == circuit_id), None)
    at_track = [w for w in winners if w["circuitId"] == circuit_id and w["laps"]]
    latest = max(at_track, key=lambda w: w["season"]) if at_track else None
    return {
        "firstWinner": {"driver": same_gp[0]["driver"], "year": same_gp[0]["season"]} if same_gp else None,
        "pastRaces": len(same_gp),
        "previousWinner": {"driver": previous["driver"], "team": previous["team"], "year": previous["season"]} if previous else None,
        # race distance last time here, shown for upcoming races
        "lastLaps": latest["laps"] if latest else None,
        "lastLapsYear": latest["season"] if latest else None,
    }


def seconds(time_text):
    """'1:22.670' -> 82.67"""
    minutes, secs = time_text.split(":")
    return int(minutes) * 60 + float(secs)


def result_is_complete(result) -> bool:
    return bool(result and result.get("winner") and result.get("pole") and result.get("fastestLap"))


# ---------------------------------------------------------------- files
def write_json(path: Path, data) -> None:
    """Write via a temp file so a crash never leaves a half-written file behind."""
    tmp = path.with_suffix(".tmp")
    tmp.write_text(json.dumps(data, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    tmp.replace(path)


def update_active_aero(races: list[dict]) -> None:
    """Add a blank entry for any new track. Existing entries are left exactly as they are."""
    if AERO_FILE.exists():
        try:
            aero = json.loads(AERO_FILE.read_text(encoding="utf-8"))
        except json.JSONDecodeError as exc:
            log(f"  ! {AERO_FILE.name} has a typo ({exc}). Left it untouched - please fix it.")
            return
    else:
        aero = {}

    added = [r["slug"] for r in races if r["slug"] not in aero]
    for race in races:
        aero.setdefault(race["slug"], {"grandPrix": race["name"], "zones": None, "note": ""})
    if added:
        write_json(AERO_FILE, aero)
        log(f"Added {len(added)} new track(s) to {AERO_FILE.name}: {', '.join(added)}")


# ---------------------------------------------------------------- main
def load_previous() -> dict:
    """Races saved by the last run, keyed by slug (empty if there is no usable file)."""
    try:
        saved = json.loads(CALENDAR_FILE.read_text(encoding="utf-8"))
        return {race["slug"]: race for race in saved.get("races", [])} if saved.get("season") == SEASON else {}
    except (OSError, ValueError, KeyError):
        return {}


def race_start_utc(event) -> pd.Timestamp:
    start = event.get("Session5DateUtc")
    if start is None or pd.isna(start):
        start = event.EventDate
    start = pd.Timestamp(start)
    return start.tz_localize("UTC") if start.tzinfo is None else start


def main() -> int:
    full = "--full" in sys.argv
    CACHE_DIR.mkdir(parents=True, exist_ok=True)
    fastf1.Cache.enable_cache(str(CACHE_DIR))
    now = datetime.now(timezone.utc)
    previous = {} if full else load_previous()

    log(f"Getting the {SEASON} schedule from FastF1...")
    schedule = attempt("schedule", load_schedule)
    if schedule is None or schedule.empty:
        log("No schedule - nothing written, the website keeps its current data.")
        return 1

    ergast = Ergast(result_type="pandas", auto_cast=True)

    log("Getting circuit details...")
    with fastf1.Cache.disabled():
        ergast_schedule = attempt("Ergast schedule", lambda: ergast.get_race_schedule(SEASON))
    ergast_rounds = {} if ergast_schedule is None else {int(r["round"]): r for _, r in ergast_schedule.iterrows()}

    # Past winners are only needed when a track has no saved history yet
    slugs = [slugify(name) for name in schedule["EventName"]]
    need_history = any((previous.get(s, {}).get("history") or {}).get("pastRaces") is None for s in slugs)
    winners = None
    if need_history:
        log("Getting past race winners for track history (one-off, about a dozen requests)...")
        winners = attempt("past race winners", lambda: load_all_winners(ergast), retries=4)

    races = []
    for (_, event), slug in zip(schedule.iterrows(), slugs):
        rnd = int(event.RoundNumber)
        info = ergast_rounds.get(rnd)
        circuit_id = None if info is None else info.circuitId
        prev = previous.get(slug, {})
        prev_history = prev.get("history") or {}
        log(f"Round {rnd:>2}: {event.EventName}")

        start = race_start_utc(event)
        completed = start + RACE_LENGTH < now

        # History up to last season: fresh if we downloaded winners, otherwise the saved copy
        if winners is not None and info is not None:
            base = history_before_season(winners, info.raceName, circuit_id)
        else:
            base = {key: prev_history.get(key) for key in HISTORY_KEYS}

        # 2026 result: reuse the saved one once it's complete, otherwise download it
        result, result_laps = None, None
        if completed:
            if result_is_complete(prev.get("result")) and prev.get("lapsFrom") == SEASON:
                result, result_laps = prev["result"], prev.get("laps")
            else:
                with fastf1.Cache.disabled():
                    fetched = attempt(f"result for round {rnd}", lambda: load_result(ergast, rnd))
                if fetched:
                    result_laps = fetched.pop("laps")
                    result = fetched
                elif prev.get("result"):
                    result, result_laps = prev["result"], prev.get("laps")

        if result_laps:
            laps, laps_from = result_laps, SEASON
        else:
            laps, laps_from = base["lastLaps"], base["lastLapsYear"]

        # Lap record: saved value (or download once), then check this year's fastest lap
        record = prev_history.get("lapRecord")
        if record is None and circuit_id:
            record = attempt(f"lap record at {circuit_id}", lambda: load_lap_record(ergast, circuit_id))
        fastest = (result or {}).get("fastestLap")
        if fastest and fastest.get("time") and (record is None or seconds(fastest["time"]) < seconds(record["time"])):
            record = {"driver": fastest["driver"], "time": fastest["time"], "year": SEASON}

        history = dict(base)
        winner = (result or {}).get("winner")
        if base["pastRaces"] is not None:
            history["timesHeld"] = base["pastRaces"] + (1 if winner else 0)
        if history["firstWinner"] is None and base["pastRaces"] == 0 and winner:
            history["firstWinner"] = {"driver": winner["driver"], "year": SEASON}  # first time this GP is held
        history["lapRecord"] = record

        country = event.Country
        if info is not None and info.country:
            country = COUNTRY_NAMES.get(info.country, info.country)

        races.append({
            "round": rnd,
            "slug": slug,
            "name": event.EventName,
            "country": country,
            "location": info.locality if info is not None else event.Location,
            "circuit": info.circuitName if info is not None else prev.get("circuit"),
            "date": pd.Timestamp(event.EventDate).strftime("%Y-%m-%d"),
            "raceStartUtc": iso_utc(start),
            "status": "completed" if completed else "upcoming",
            "laps": laps,
            "lapsFrom": laps_from,
            "result": result,
            "history": history,
        })

    write_json(CALENDAR_FILE, {
        "season": SEASON,
        "updated": now.strftime("%Y-%m-%dT%H:%M:%SZ"),
        "races": races,
    })
    update_active_aero(races)

    done = sum(r["status"] == "completed" for r in races)
    missing = [r["round"] for r in races if r["status"] == "completed" and not result_is_complete(r["result"])]
    log(f"\nSaved {len(races)} races ({done} completed) to {CALENDAR_FILE.relative_to(ROOT)}")
    if missing:
        log(f"Results still missing for round(s) {missing} - run this again later to fill them in.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
