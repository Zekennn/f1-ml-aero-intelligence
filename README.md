# F1 ML Aero Intelligence

A racing fan website with machine-learning tools: live telemetry simulation,
a 2026 championship predictor and an aerodynamics (drag/downforce) calculator.

## Project structure

```
backend/     FastAPI JSON API + ML training / prediction scripts (Python)
web/         The website (Next.js): fan pages + data tool pages
  app/         Pages: /  /live  /predictor  /aero
  components/  UI components (home page sections live in components/home)
  data/        Editable content: teams, drivers, gallery, nav links, calendar JSON
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

## Race calendar

The home page calendar reads `web/data/calendar.json`, built from FastF1.
Refresh it after each race weekend (the page picks it up on the next reload):

```powershell
.\venv\Scripts\python.exe backend\update_calendar.py         # quick: only new results
.\venv\Scripts\python.exe backend\update_calendar.py --full  # re-download everything
```

- Track photos: `web/public/images/tracks/<slug>.jpg` (also .jpeg/.png/.webp).
  The slug is the Grand Prix name without "Grand Prix", lowercase, dashes for
  spaces, no accents: `British Grand Prix` → `british.jpg`, `São Paulo Grand Prix` → `sao-paulo.jpg`.
- Active aero: edit `zones` and `note` per track in `web/data/active-aero.json`.
  The refresh script only adds new tracks and never changes your values.

The website calls the API through `/backend/*`, which Next.js forwards to
FastAPI (see `web/next.config.mjs`). Set `BACKEND_URL` to point it elsewhere.
