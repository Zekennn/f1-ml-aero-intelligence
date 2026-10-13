# F1 ML Aero Intelligence

A racing fan website with machine-learning tools: live telemetry simulation,
a 2026 championship predictor and an aerodynamics (drag/downforce) calculator.

## Project structure

```
backend/     FastAPI JSON API + ML training / prediction scripts (Python)
web/         The website (Next.js): fan pages + data tool pages
  app/         Pages: /  /live  /predictor  /aero
  components/  UI components (home page sections live in components/home)
  data/        Editable content (teams, gallery, nav links) + live FastF1 JSON
  public/      Images
scripts/     One-off FastF1 data extraction scripts
data/        Datasets, track geometry and FastF1 cache
models/      Trained models (*.pkl are git-ignored)
docs/        Documentation assets
run.ps1      Sets up the Python env and runs the full ML pipeline
dev.ps1      Starts the backend + website for local development
```

## Run locally

```powershell
.\run.ps1   # first time only: creates venv, installs deps, trains models
.\dev.ps1   # starts FastAPI on :8000 and the website on :3000
```

Then open http://localhost:3000.

## Live F1 data (calendar + drivers)

The calendar and driver standings come from FastF1 and are saved to
`web/data/calendar.json` and `web/data/drivers.json`.

- **Automatic:** while the backend runs it refreshes the data every 30 minutes,
  and every 5 minutes during and after a race until the results are in
  (`backend/live_data.py`). Open pages pick up new data within a minute.
  - Status: http://127.0.0.1:8000/api/live-data
  - Refresh now: `Invoke-RestMethod -Method Post http://127.0.0.1:8000/api/live-data/refresh`
  - Switch off: `$env:LIVE_DATA = "0"` before starting the backend
- **By hand:**

  ```powershell
  .\venv\Scripts\python.exe backend\update_data.py         # quick: only what's new
  .\venv\Scripts\python.exe backend\update_data.py --full  # re-download everything
  ```

- Track photos: `web/public/images/tracks/<slug>.jpg` (also .jpeg/.png/.webp).
  The slug is the Grand Prix name without "Grand Prix", lowercase, dashes for
  spaces, no accents: `British Grand Prix` → `british.jpg`, `São Paulo Grand Prix` → `sao-paulo.jpg`.
- Driver photos: `web/public/images/drivers/<code>.png` (also .webp/.jpg), named by the
  driver's 3-letter code in lowercase: `nor.png`, `ver.png`, `tsu.png`.
- Active aero: edit `zones` and `note` per track in `web/data/active-aero.json`.
  The refresh only adds new tracks and never changes your values.

The website calls the API through `/backend/*`, which Next.js forwards to
FastAPI (see `web/next.config.mjs`). Set `BACKEND_URL` to point it elsewhere.

## TracingInsights data (telemetry, history, pit stops, models)

The live telemetry simulator, track history, standings, pit stops and the lap time model are built from
four TracingInsights repos, kept in `data/sources/` (git-ignored, never published):

| Repo | Licence | How it is fetched |
|---|---|---|
| [TracingInsights-Archive/Stats](https://github.com/TracingInsights-Archive/Stats) | MIT | `git clone --depth 1` (sparse: lap times only from 2018) |
| [TracingInsights-Archive/PitStops](https://github.com/TracingInsights-Archive/PitStops) | MIT | `git clone --depth 1` |
| [TracingInsights/2026](https://github.com/TracingInsights/2026) | Apache-2.0 | only the Race files the site uses (~3 MB per race; the repo is 4 GB) |
| [TracingInsights/2025](https://github.com/TracingInsights/2025) | Apache-2.0 | same, for tracks whose 2026 race hasn't happened (the repo is 15 GB) |

**Refresh everything after a race weekend** (from the project root, in PowerShell):

```powershell
.\update.ps1                # pull repos, rebuild site data, retrain models, print what changed
.\update.ps1 -WithFastF1    # also refresh the FastF1 calendar fallback first
.\update.ps1 -NoTrain       # data only, skip retraining
```

Then refresh the website. The pieces can also run on their own:

```powershell
cd backend\pipeline
..\..\venv\Scripts\python.exe build_site_data.py --refresh   # site data + data report
..\..\venv\Scripts\python.exe train_models.py                # lap time model + aero calibration
```

- Outputs: `web/data/{circuits,standings,pitstops,aero-calibration}.json`, `web/public/data/circuits/*.json`
  (one file per circuit, under 300 KB) and `web/public/data/models/laptime.json`.
- Model accuracy, data used and limitations: `models/MODEL_REPORT.md`.
- Tyre temperatures are **estimated** (the repos have no tyre temperature data): `web/lib/tyreModel.ts`.
- The old neural-network aero model and `/predict` endpoint are kept but disconnected (`web/lib/mlAeroModel.ts`).
