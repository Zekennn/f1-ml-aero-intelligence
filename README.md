# F1 ML Aero Intelligence

A racing fan website with machine-learning tools: live telemetry simulation,
a 2026 championship predictor and an aerodynamics (drag/downforce) calculator.

## Project structure

```
backend/     FastAPI JSON API + ML training / prediction scripts (Python)
web/         The website (Next.js): fan pages + data tool pages
  app/         Pages: /  /live  /predictor  /aero
  components/  UI components (home page sections live in components/home)
  data/        Editable content: teams, drivers, races, gallery, nav links
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

The website calls the API through `/backend/*`, which Next.js forwards to
FastAPI (see `web/next.config.mjs`). Set `BACKEND_URL` to point it elsewhere.
