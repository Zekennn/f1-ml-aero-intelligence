"""
Keeps the race winner model up to date while the backend is running.

The FastF1 calendar (refreshed by live_data.py) learns a race result within minutes, but the
model trains on the TracingInsights Stats archive, which publishes results later. So a background
thread compares the two every 30 minutes:

- the latest round with a complete result in web/data/calendar.json, and
- the round the model was last trained on (afterRound in web/data/winner-model.json).

When the calendar is ahead it runs `train_winner_model.py --auto`, which pulls the Stats repo and
retrains only if the archive already has the new race; otherwise it tries again next time.
The predictor page reads the model file on every request, so new odds appear on the next page load.

Set MODEL_REFRESH=0 before starting the backend to switch it off.
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
MODEL_FILE = ROOT / "web" / "data" / "winner-model.json"
CHECK_EVERY = timedelta(minutes=30)
FIRST_CHECK_DELAY = 60  # seconds: let the server and the first FastF1 refresh finish first
TRAIN_TIMEOUT = 20 * 60  # seconds
NOTHING_NEW = 10  # exit code from train_winner_model.py --auto

_lock = threading.Lock()
_wake = threading.Event()
_status = {
    "enabled": os.environ.get("MODEL_REFRESH", "1") != "0",
    "running": False,
    "calendarRound": None,
    "modelRound": None,
    "lastCheck": None,
    "lastResult": None,
    "lastRetrain": None,
    "nextCheck": None,
}


def _iso(dt: datetime) -> str:
    return dt.strftime("%Y-%m-%dT%H:%M:%SZ")


def _read(path: Path) -> dict:
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except (OSError, ValueError):
        return {}


def calendar_round() -> int:
    """Latest round whose result FastF1 reports as complete."""
    rounds = [r.get("round", 0) for r in _read(CALENDAR_FILE).get("races", []) if result_is_complete(r.get("result"))]
    return max(rounds, default=0)


def model_round() -> int:
    return int(_read(MODEL_FILE).get("afterRound") or 0)


def check_once(force: bool = False) -> dict:
    """Retrain if the calendar has a race the model hasn't seen (skipped if a check is already running)."""
    if not _lock.acquire(blocking=False):
        return {"skipped": "a check is already running"}
    try:
        cal, mod = calendar_round(), model_round()
        _status["calendarRound"], _status["modelRound"] = cal, mod
        if cal <= mod and not force:
            return {"upToDate": True, "round": mod}

        _status["running"] = True
        print(f"[model refresh] round {cal} has a result, model covers round {mod}: checking the archive...", flush=True)
        proc = subprocess.run(
            [sys.executable, "-X", "utf8", "train_winner_model.py", "--auto"],
            cwd=PIPELINE, capture_output=True, text=True, encoding="utf-8", errors="replace",
            env={**os.environ, "PYTHONIOENCODING": "utf-8"}, timeout=TRAIN_TIMEOUT,
        )
        tail = "\n".join((proc.stdout or "").strip().splitlines()[-6:])
        if proc.returncode == 0:
            _status["lastRetrain"] = _iso(datetime.now(timezone.utc))
            _status["modelRound"] = model_round()
            print(f"[model refresh] retrained:\n{tail}", flush=True)
            return {"retrained": True, "round": _status["modelRound"]}
        if proc.returncode == NOTHING_NEW:
            print("[model refresh] archive doesn't have the new race yet; will try again.", flush=True)
            return {"waitingForArchive": True, "calendarRound": cal, "modelRound": mod}
        print(f"[model refresh] training failed (exit {proc.returncode}):\n{(proc.stderr or '').strip()[-1500:]}", flush=True)
        return {"error": f"train_winner_model.py exited with {proc.returncode}"}
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
        nxt = datetime.now(timezone.utc) + CHECK_EVERY
        _status["nextCheck"] = _iso(nxt)
        _wake.wait(CHECK_EVERY.total_seconds())  # a manual request wakes it early


def start() -> None:
    """Start the background checker (once)."""
    if not _status["enabled"] or getattr(start, "_started", False):
        return
    start._started = True
    threading.Thread(target=_loop, name="model-refresh", daemon=True).start()


def request_check() -> None:
    """Ask the background thread to check right away."""
    _wake.set()


def status() -> dict:
    return dict(_status)
