"""
Keeps the website's FastF1 data up to date while the backend is running.

A background thread runs update_data.refresh_all():
- every 30 minutes normally
- every 5 minutes from lights out until a race's results are complete
  (and for the 2 days after a race, to pick up penalties)

Set LIVE_DATA=0 before starting the backend to switch it off.
"""
import json
import os
import threading
import traceback
from datetime import datetime, timedelta, timezone

from update_calendar import CALENDAR_FILE, RECHECK_FOR, result_is_complete
from update_data import refresh_all

NORMAL_INTERVAL = timedelta(minutes=30)
RACE_INTERVAL = timedelta(minutes=5)
FIRST_RUN_DELAY = 5  # seconds, so the server finishes starting first

_lock = threading.Lock()
_wake = threading.Event()
_status = {
    "enabled": os.environ.get("LIVE_DATA", "1") != "0",
    "running": False,
    "lastRun": None,
    "lastResult": None,
    "nextRun": None,
}


def _iso(dt: datetime) -> str:
    return dt.strftime("%Y-%m-%dT%H:%M:%SZ")


def _interval(now: datetime) -> timedelta:
    """Refresh often while a race is on or its results are still coming in."""
    try:
        races = json.loads(CALENDAR_FILE.read_text(encoding="utf-8")).get("races", [])
    except (OSError, ValueError):
        return RACE_INTERVAL  # no data yet: try again soon
    for race in races:
        if not race.get("raceStartUtc"):
            continue
        start = datetime.fromisoformat(race["raceStartUtc"].replace("Z", "+00:00"))
        if start <= now <= start + RECHECK_FOR and not result_is_complete(race.get("result")):
            return RACE_INTERVAL
        if start <= now <= start + timedelta(hours=6):
            return RACE_INTERVAL
    return NORMAL_INTERVAL


def run_once(full: bool = False) -> dict:
    """Refresh now (skipped if a refresh is already running)."""
    if not _lock.acquire(blocking=False):
        return {"skipped": "a refresh is already running"}
    try:
        _status["running"] = True
        result = refresh_all(full=full, verbose=False)
    except Exception as exc:  # noqa: BLE001 - never let the thread die
        traceback.print_exc()
        result = {"error": str(exc)}
    finally:
        _status["running"] = False
        _status["lastRun"] = _iso(datetime.now(timezone.utc))
        _lock.release()
    _status["lastResult"] = result
    return result


def _loop() -> None:
    _wake.wait(FIRST_RUN_DELAY)
    while True:
        _wake.clear()
        print("[live data] refreshing calendar and drivers from FastF1...", flush=True)
        run_once()
        now = datetime.now(timezone.utc)
        wait = _interval(now)
        _status["nextRun"] = _iso(now + wait)
        _wake.wait(wait.total_seconds())  # a manual refresh request wakes it early


def start() -> None:
    """Start the background refresher (once)."""
    if not _status["enabled"] or getattr(start, "_started", False):
        return
    start._started = True
    threading.Thread(target=_loop, name="live-data", daemon=True).start()


def request_refresh() -> None:
    """Ask the background thread to refresh right away."""
    _wake.set()


def status() -> dict:
    return dict(_status)
