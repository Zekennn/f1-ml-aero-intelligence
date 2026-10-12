# Starts the whole website for local development:
#   - FastAPI backend (ML data)  -> http://127.0.0.1:8000
#   - Next.js frontend (website) -> http://localhost:3000   <- open this one
# Stop both with Ctrl+C in each window.

$root = $PSScriptRoot

Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$root\backend'; & '$root\venv\Scripts\python.exe' -m uvicorn main:app --port 8000"

Set-Location "$root\web"
if (-not (Test-Path node_modules)) { npm install }
npm run dev
