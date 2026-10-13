"""
One command after a race weekend:
  1. pull the Stats and PitStops repos (clone them the first time),
  2. download any new race files from the 2026 telemetry repo (2025 files are cached),
  3. rebuild the website data (circuits, history, standings, pit stops),
  4. retrain the lap time model and recalibrate the aero model,
  5. print what changed: new races, new records, model accuracy.

Run from the project root:   .\\update.ps1            (or)   venv\\Scripts\\python.exe backend\\pipeline\\update_all.py
Options:  --with-fastf1   also refresh calendar.json / drivers.json from FastF1 first (backend/update_data.py)
          --no-train      rebuild the data only
"""
from __future__ import annotations

import argparse
import subprocess
import sys
import time

import build_site_data
import train_models
from common import MODELS_DIR, PUBLIC_DATA, ROOT, WEB_DATA, log, read_json, sync_git_repos


def snapshot() -> dict:
    circuits = (read_json(WEB_DATA / "circuits.json") or {}).get("circuits", {})
    standings = read_json(WEB_DATA / "standings.json") or {}
    pit = read_json(WEB_DATA / "pitstops.json") or {}
    model = read_json(PUBLIC_DATA / "models" / "laptime.json") or {}
    aero = read_json(WEB_DATA / "aero-calibration.json") or {}
    return {
        "completed": {s: c["history"]["result2026"] for s, c in circuits.items() if (c.get("history") or {}).get("result2026")},
        "records": {s: (c.get("history") or {}).get("lapRecord") for s, c in circuits.items()},
        "seasons": {s: c.get("dataSeason") for s, c in circuits.items()},
        "names": {s: c.get("name") for s, c in circuits.items()},
        "leader": (standings.get("drivers") or [{}])[0].get("driver"),
        "afterRound": standings.get("afterRound"),
        "fastestStop": ((pit.get("seasons") or {}).get("2026") or {}).get("fastest", [None])[0],
        "mae": (model.get("metrics") or {}).get("testMae"),
        "aeroMae": aero.get("maeKmh"),
    }


def report(before: dict, after: dict, heads: dict, seconds: float) -> None:
    log("")
    log("=" * 60)
    log("What changed")
    log("=" * 60)
    log(f"Repos: " + ", ".join(f"{k} @ {v}" for k, v in heads.items()))
    new_races = [s for s in after["completed"] if s not in before["completed"]]
    if new_races:
        for s in new_races:
            r = after["completed"][s]
            log(f"New race result: {after['names'][s]} - winner {r['winner']['driver']} ({r['winner'].get('team')})"
                + (f", fastest lap {r['fastestLap']['driver']} {r['fastestLap']['time']}" if r.get("fastestLap") else ""))
    else:
        log("No new race results.")
    switched = [s for s, season in after["seasons"].items() if season != before["seasons"].get(s) and before["seasons"].get(s)]
    for s in switched:
        log(f"Telemetry for {after['names'][s]} now from {after['seasons'][s]} (was {before['seasons'][s]}).")
    records = [s for s, rec in after["records"].items() if rec and (before["records"].get(s) or {}).get("time") != rec["time"]]
    for s in records:
        rec = after["records"][s]
        old = before["records"].get(s)
        log(f"New lap record at {after['names'][s]}: {rec['time']} by {rec['driver']} ({rec['year']})" + (f", was {old['time']}" if old else ""))
    if not records:
        log("No new lap records.")
    if after["fastestStop"] and after["fastestStop"] != before["fastestStop"]:
        f = after["fastestStop"]
        log(f"Fastest 2026 pit stop: {f['time']:.2f} s, {f['team']} ({f['driver']}) at the {f['gp']}")
    if after["afterRound"] != before["afterRound"]:
        log(f"Standings now after round {after['afterRound']} (was {before['afterRound']}). Leader: {after['leader']}")
    if after["mae"] is not None:
        log(f"Lap time model test MAE: {after['mae']:.3f} s" + (f" (was {before['mae']:.3f} s)" if before["mae"] is not None else ""))
    if after["aeroMae"] is not None:
        log(f"Aero top speed error: {after['aeroMae']} km/h" + (f" (was {before['aeroMae']} km/h)" if before["aeroMae"] is not None else ""))
    log(f"Model report: {MODELS_DIR / 'MODEL_REPORT.md'}")
    log(f"Done in {seconds:.0f} s. Restart or refresh the website to see the new data.")


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--with-fastf1", action="store_true", help="refresh calendar.json / drivers.json from FastF1 first")
    ap.add_argument("--no-train", action="store_true", help="skip retraining the models")
    args = ap.parse_args()
    start = time.time()

    before = snapshot()
    log("Step 1/4  Pulling Stats and PitStops...")
    heads = sync_git_repos()
    if args.with_fastf1:
        log("Step 1b   Refreshing the FastF1 calendar (fallback data)...")
        subprocess.run([sys.executable, str(ROOT / "backend" / "update_data.py")], check=False)
    log("Step 2/4  Building site data (downloads new 2026 race files)...")
    build_site_data.main(refresh=True)
    if not args.no_train:
        log("Step 3/4  Training models...")
        train_models.main()
    else:
        log("Step 3/4  Skipped (--no-train)")
    log("Step 4/4  Comparing with the previous data...")
    report(before, snapshot(), heads, time.time() - start)


if __name__ == "__main__":
    main()
