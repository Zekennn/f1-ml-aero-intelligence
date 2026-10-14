"""
Updates the website's race data automatically after each race while the backend is running.

The FastF1 calendar (refreshed by live_data.py) learns a race result within minutes. The rest of
the site - standings, circuit history and records, pit stops, the lap time model, the aero
calibration and the race winner model - is built from the TracingInsights archives, which
publish results (and, separately, telemetry) later. So a background thread checks every 30 min:

- behind: the calendar has a complete result for a round newer than the site's data
  (afterRound in web/data/standings.json or web/data/winner-model.json), or
- follow-up: a race finished in the last 4 days and the archives haven't been checked for 2 hours
  (late telemetry, post-race penalties).

In either case it runs `backend/pipeline/update_all.py --auto`: that pulls the archives and runs the
full update only if they actually contain something new, otherwise it exits and we try again later.
Pages read the JSON files on each request, so new data appears on the next page load.

Set RACE_REFRESH=0 before starting the backend to switch it off.
"""
import json
import os
import subprocess
import sys
import threading
import traceback
from datetime import datetime, timedelta, timezone
from pathlib import Path

from update_calendar import CALENDAR_FILE, result_is_complete

ROOT = Path(__file__).resolve().parents[1]
PIPELINE = ROOT / "backend" / "pipeline"
WEB_DATA = ROOT / "web" / "data"
CHECK_EVERY = timedelta(minutes=30)
FOLLOW_UP_FOR = timedelta(days=4)  # keep looking for late telemetry / penalties after a race
FOLLOW_UP_EVERY = timedelta(hours=2)
FIRST_CHECK_DELAY = 60  # seconds: let the server and the first FastF1 refresh finish first
UPDATE_TIMEOUT = 45 * 60  # seconds
NOTHING_NEW = 10  # exit code from update_all.py --auto

_lock = threading.Lock()
_wake = threading.Event()
_status = {
    "enabled": os.environ.get("RACE_REFRESH", "1") != "0",
    "running": False,
    "calendarRound": None,
    "siteRound": None,
    "modelRound": None,
    "lastCheck": None,
    "lastArchiveCheck": None,
    "lastResult": None,
    "lastUpdate": None,
    "nextCheck": None,
}


def _iso(dt: datetime) -> str:
    return dt.strftime("%Y-%m-%dT%H:%M:%SZ")


def _read(path: Path) -> dict:
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except (OSError, ValueError):
        return {}


def _complete_races() -> list[dict]:
    return [r for r in _read(CALENDAR_FILE).get("races", []) if result_is_complete(r.get("result"))]


def calendar_round() -> int:
    """Latest round whose result FastF1 reports as complete."""
    return max((r.get("round", 0) for r in _complete_races()), default=0)


def site_round() -> int:
    """Oldest of the rounds the site data and the winner model cover."""
    standings = int(_read(WEB_DATA / "standings.json").get("afterRound") or 0)
    model = int(_read(WEB_DATA / "winner-model.json").get("afterRound") or 0)
    _status["siteRound"], _status["modelRound"] = standings, model
    return min(standings, model)


def _last_race_start() -> datetime | None:
    starts = [r["raceStartUtc"] for r in _complete_races() if r.get("raceStartUtc")]
    return datetime.fromisoformat(max(starts).replace("Z", "+00:00")) if starts else None


def _due(now: datetime, force: bool) -> str | None:
    """Why the archives should be checked now, or None."""
    if force:
        return "requested"
    cal, site = calendar_round(), site_round()
    _status["calendarRound"] = cal
    if cal > site:
        return f"round {cal} has a result, site data covers round {site}"
    last = _last_race_start()
    checked = _status["lastArchiveCheck"]
    checked_at = datetime.fromisoformat(checked.replace("Z", "+00:00")) if checked else None
    if last and now - last <= FOLLOW_UP_FOR and (not checked_at or now - checked_at >= FOLLOW_UP_EVERY):
        return "follow-up after the latest race (late telemetry or penalties)"
    return None


def check_once(force: bool = False) -> dict:
    """Run the automatic update if it's due (skipped if one is already running)."""
    if not _lock.acquire(blocking=False):
        return {"skipped": "an update is already running"}
    try:
        now = datetime.now(timezone.utc)
        reason = _due(now, force)
        if not reason:
            return {"upToDate": True, "round": _status["siteRound"]}

        _status["running"] = True
        _status["lastArchiveCheck"] = _iso(now)
        print(f"[race refresh] {reason}: checking the archives...", flush=True)
        proc = subprocess.run(
            [sys.executable, "-X", "utf8", "update_all.py", "--auto"],
            cwd=PIPELINE, capture_output=True, text=True, encoding="utf-8", errors="replace",
            env={**os.environ, "PYTHONIOENCODING": "utf-8"}, timeout=UPDATE_TIMEOUT,
        )
        if proc.returncode == 0:
            _status["lastUpdate"] = _iso(datetime.now(timezone.utc))
            site_round()
            # update_all prints a "What changed" summary at the end: show it in the backend window
            out = (proc.stdout or "").strip()
            summary = out[out.rfind("What changed"):] if "What changed" in out else "\n".join(out.splitlines()[-12:])
            print(f"[race refresh] site data updated.\n{summary}", flush=True)
            return {"updated": True, "round": _status["siteRound"], "reason": reason}
        if proc.returncode == NOTHING_NEW:
            print("[race refresh] nothing new in the archives yet; will check again.", flush=True)
            return {"waitingForArchive": True, "reason": reason}
        print(f"[race refresh] update failed (exit {proc.returncode}):\n{(proc.stderr or proc.stdout or '').strip()[-1500:]}", flush=True)
        return {"error": f"update_all.py exited with {proc.returncode}", "reason": reason}
    except Exception as exc:  # noqa: BLE001 - never let the thread die
        traceback.print_exc()
        return {"error": str(exc)}
    finally:
        _status["running"] = False
        _status["lastCheck"] = _iso(datetime.now(timezone.utc))
        _lock.release()


def _loop() -> None:
    _wake.wait(FIRST_CHECK_DELAY)
    while True:
        _wake.clear()
        _status["lastResult"] = check_once()
        _status["nextCheck"] = _iso(datetime.now(timezone.utc) + CHECK_EVERY)
        _wake.wait(CHECK_EVERY.total_seconds())  # a request (or a new FastF1 result) wakes it early


def start() -> None:
    """Start the background checker (once)."""
    if not _status["enabled"] or getattr(start, "_started", False):
        return
    start._started = True
    threading.Thread(target=_loop, name="race-refresh", daemon=True).start()


def request_check() -> None:
    """Ask the background thread to check right away."""
    _wake.set()


def check_now() -> None:
    """Force an archive check now, in the background (used by the API)."""
    threading.Thread(target=lambda: _status.update(lastResult=check_once(force=True)), daemon=True).start()


def status() -> dict:
    return dict(_status)
