$ErrorActionPreference = "Stop"

# Create necessary directories
New-Item -ItemType Directory -Force -Path .\data | Out-Null
New-Item -ItemType Directory -Force -Path .\models | Out-Null

# Create and activate virtual environment
Write-Host "Creating virtual environment..."
python -m venv venv
.\venv\Scripts\Activate.ps1

# Install requirements
Write-Host "Installing requirements..."
pip install -r requirements.txt

# Run the pipeline
Write-Host "--- SYNTHETIC DATA PIPELINE ---"
cd backend
python generate_dataset.py
python train_model.py
python predict_test.py
python test_aero.py

Write-Host "`n--- REAL 2026 DATA PIPELINE ---"
Write-Host "Fetching 2026 data from FastF1..."
python fetch_real_data.py

Write-Host "Training new model on 2026 data..."
python train_real_model.py

Write-Host "Running next race predictions..."
python predict_next_race.py

cd ..
Write-Host "`nAll done! To run again in the future, activate the virtual environment with '.\venv\Scripts\Activate.ps1'."
