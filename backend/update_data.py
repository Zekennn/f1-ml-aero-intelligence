"""
Refresh all FastF1 data for the website: race calendar, then driver standings.

The backend does this automatically while it's running (see live_data.py).
To run it by hand from the project folder:

    .\\venv\\Scripts\\python.exe backend\\update_data.py          (quick: only fetches what's new)
    .\\venv\\Scripts\\python.exe backend\\update_data.py --full   (re-fetch everything)
"""
import sys
import traceback

import update_calendar
import update_drivers


def _safe(name, fn):
    try:
        return fn()
    except Exception as exc:  # noqa: BLE001 - one failing part must not stop the other
        traceback.print_exc()
        return {"ok": False, "error": f"{name}: {exc}"}


def refresh_all(full: bool = False, verbose: bool = True) -> dict:
    calendar = _safe("calendar", lambda: update_calendar.refresh(full=full, verbose=verbose))
    # Drivers second: podium and pole counts come from the fresh calendar results
    drivers = _safe("drivers", lambda: update_drivers.refresh(verbose=verbose))
    return {"calendar": calendar, "drivers": drivers}


if __name__ == "__main__":
    result = refresh_all(full="--full" in sys.argv)
    sys.exit(0 if all(part.get("ok") for part in result.values()) else 1)
