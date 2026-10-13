# Refresh everything after a race weekend:
#   pulls the four TracingInsights data repos, rebuilds the website data, retrains the models
#   and prints what changed (new races, new records, model accuracy).
# Usage:  .\update.ps1                 (add -with-fastf1 to also refresh the FastF1 calendar fallback)
param([switch]$WithFastF1, [switch]$NoTrain)

$python = Join-Path $PSScriptRoot "venv\Scripts\python.exe"
$flags = @()
if ($WithFastF1) { $flags += "--with-fastf1" }
if ($NoTrain) { $flags += "--no-train" }

$env:PYTHONIOENCODING = "utf-8"
Push-Location (Join-Path $PSScriptRoot "backend\pipeline")
try { & $python update_all.py @flags } finally { Pop-Location }
