from fastapi import FastAPI
import joblib
import numpy as np
import random
import pandas as pd
from fastapi.responses import HTMLResponse




app = FastAPI()

# Load real Monaco track data
try:
    # Path relative to backend/
    track_df = pd.read_csv("../data/tracks/monaco_real_track.csv")
    track_points = track_df[['X', 'Y', 'Speed']].values.tolist()
except Exception as e:
    print(f"Error loading real track data: {e}")
    track_points = [[0, 0, 0]]

# Load 2025 Team Engine Performance data
try:
    teams_df = pd.read_csv("../data/team_engine_performance_2025.csv")
    team_data = teams_df.to_dict(orient='records')
except Exception as e:
    print(f"Error loading team performance data: {e}")
    team_data = []

lap_progress = 0.0
track_length = len(track_points)




model = joblib.load("../models/aero_model.pkl")

# Team colors for UI
TEAM_COLORS = {
    "McLaren": "#FF8700",
    "Ferrari": "#E10600",
    "Red Bull Racing": "#0600EF",
    "Mercedes": "#00D2BE",
    "Aston Martin": "#006F62",
    "Alpine": "#0090FF",
    "Williams": "#005AFF",
    "Racing Bulls": "#0000FF",
    "Haas F1 Team": "#FFFFFF",
    "Kick Sauber": "#52E252"
}


@app.get("/")
def home():
    return {"message": "Welcome to F1 Aero & Engine Intelligence - Monaco 2025"}


@app.get("/predict")
def predict(speed: float, wing_angle: float, drs: int):

    input_data = np.array([[speed, wing_angle, drs]])
    prediction = model.predict(input_data)

    drag = float(prediction[0][0])
    downforce = float(prediction[0][1])

    return {
        "speed": speed,
        "predicted_drag": drag,
        "predicted_downforce": downforce
    }

@app.get("/telemetry")
def telemetry():
    global lap_progress
    
    # Increment progress for real track points
    # Using 0.005 for smooth interpolation over the lap
    lap_progress += 0.005  
    if lap_progress >= 1:
        lap_progress = 0.0

    index = int(lap_progress * (track_length - 1))
    next_index = (index + 1) % track_length
    fraction = (lap_progress * (track_length - 1)) - index

    # Interpolate X, Y and Speed from real telemetry
    p1 = track_points[index]
    p2 = track_points[next_index]

    x = p1[0] + (p2[0] - p1[0]) * fraction
    y = p1[1] + (p2[1] - p1[1]) * fraction
    speed = p1[2] + (p2[2] - p1[2]) * fraction

    # DRS logic (simplified: DRS open on straights where speed > 250)
    drs = 1 if speed > 250 else 0
    wing_angle = 12 # Monaco spec

    # Predict aero using real speed and model
    input_data = np.array([[speed, wing_angle, drs]])
    prediction = model.predict(input_data)

    drag = float(prediction[0][0])
    downforce = float(prediction[0][1])

    return {
        "lap_progress": lap_progress,
        "x": x,
        "y": y,
        "speed": speed,
        "drs": drs,
        "predicted_drag": drag,
        "predicted_downforce": downforce
    }

@app.get("/teams")
def get_teams():
    return {"teams": team_data, "colors": TEAM_COLORS}

@app.get("/live", response_class=HTMLResponse)
def live_dashboard():
    return """
    <html>
        <head>
            <title>F1 2025 | Monaco Intelligence</title>
            <link href="https://fonts.googleapis.com/css2?family=Orbitron:wght@400;700&family=Inter:wght@300;400;600&display=swap" rel="stylesheet">
            <style>
                :root { --f1-red: #e10600; --bg: #0f1114; --card-bg: #1a1d23; --text: #f0f0f0; }
                body { font-family: 'Inter', sans-serif; background: var(--bg); color: var(--text); margin: 0; display: flex; flex-direction: column; align-items: center; }
                .navbar { width: 100%; padding: 15px 40px; background: #000; display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid var(--f1-red); box-sizing: border-box; }
                .logo { font-family: 'Orbitron', sans-serif; font-size: 1.2rem; font-weight: bold; color: var(--f1-red); }
                .team-select { background: #333; color: white; border: 1px solid #444; padding: 8px 15px; border-radius: 5px; font-family: 'Inter'; }
                
                .main-layout { display: flex; gap: 20px; width: 95%; max-width: 1300px; margin-top: 20px; }
                .track-section { flex: 2; background: var(--card-bg); padding: 20px; border-radius: 15px; box-shadow: 0 10px 30px rgba(0,0,0,0.5); }
                .stats-section { flex: 1; display: flex; flex-direction: column; gap: 15px; }
                
                canvas { background: #121418; border-radius: 10px; width: 100%; border: 1px solid #2a2e36; }
                
                .panel-title { font-family: 'Orbitron'; font-size: 0.9rem; color: var(--f1-red); margin-bottom: 10px; text-transform: uppercase; letter-spacing: 1px; }
                .stat-card { background: #23272f; padding: 15px; border-radius: 10px; border-left: 4px solid var(--f1-red); transition: transform 0.2s; }
                .stat-card:hover { transform: translateX(5px); }
                .label { font-size: 0.7rem; color: #888; text-transform: uppercase; font-weight: 600; }
                .value { font-family: 'Orbitron'; font-size: 1.6rem; font-weight: bold; margin-top: 5px; }
                .unit { font-size: 0.8rem; color: #666; margin-left: 4px; }
                
                .engine-panel { background: #1a1d23; padding: 20px; border-radius: 15px; border-top: 4px solid #52E252; margin-top: 15px; }
                .rpm-bar-container { height: 8px; background: #333; border-radius: 4px; margin: 10px 0; overflow: hidden; }
                .rpm-bar { height: 100%; background: linear-gradient(90deg, #00ff00, #ffff00, #ff0000); width: 0%; transition: width 0.1s; }
                
                .drs-status { display: inline-block; padding: 5px 12px; border-radius: 4px; font-size: 0.75rem; font-weight: bold; font-family: 'Orbitron'; }
                .drs-active { background: #00ff0033; color: #00ff00; border: 1px solid #00ff00; }
                .drs-disabled { background: #333; color: #666; }
            </style>
        </head>
        <body>
            <div class="navbar">
                <div class="logo">F1 AERO INTELLIGENCE</div>
                <select id="teamSelector" class="team-select" onchange="updateTeam()">
                    <option value="">Select Team</option>
                </select>
            </div>

            <div class="main-layout">
                <div class="track-section">
                    <div class="panel-title">Monaco GP 2025 Circuit</div>
                    <canvas id="trackCanvas" width="800" height="600"></canvas>
                </div>

                <div class="stats-section">
                    <div class="panel-title">Aero Performance</div>
                    <div class="stat-card">
                        <div class="label">Telemetry Speed</div>
                        <div id="speed" class="value">0.0 <span class="unit">KM/H</span></div>
                    </div>
                    <div class="stat-card">
                        <div class="label">Predicted Downforce</div>
                        <div id="downforce" class="value">0 <span class="unit">N</span></div>
                        <div id="drs" class="drs-status drs-disabled" style="margin-top:10px">DRS DISABLED</div>
                    </div>
                    
                    <div class="engine-panel">
                        <div class="panel-title" style="color:#52E252">2025 Engine Performance</div>
                        <div class="label">Max Target RPM</div>
                        <div id="maxRpm" class="value">0</div>
                        <div class="rpm-bar-container"><div id="rpmBar" class="rpm-bar"></div></div>
                        
                        <div style="display:flex; gap:10px; margin-top:15px;">
                            <div style="flex:1">
                                <div class="label">Top Speed</div>
                                <div id="topSpeed" class="value" style="font-size:1.1rem">0 <small style="font-size:0.6rem">KM/H</small></div>
                            </div>
                            <div style="flex:1">
                                <div class="label">Avg Throttle</div>
                                <div id="avgThrottle" class="value" style="font-size:1.1rem">0<small style="font-size:0.6rem">%</small></div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <script>
                const canvas = document.getElementById("trackCanvas");
                const ctx = canvas.getContext("2d");
                let trackPoints = [], teamData = {}, currentTeam = null, teamColors = {};
                let scale = 1, offsetX = 0, offsetY = 0;

                // Load Data
                Promise.all([
                    fetch('/track').then(r => r.json()),
                    fetch('/teams').then(r => r.json())
                ]).then(([track, teams]) => {
                    trackPoints = track.points;
                    teamColors = teams.colors;
                    
                    const selector = document.getElementById("teamSelector");
                    teams.teams.forEach(t => {
                        teamData[t.Team] = t;
                        let opt = document.createElement("option");
                        opt.value = t.Team; opt.innerText = t.Team;
                        selector.appendChild(opt);
                    });

                    // Setup Canvas
                    const xs = trackPoints.map(p => p[0]), ys = trackPoints.map(p => p[1]);
                    const minX = Math.min(...xs), maxX = Math.max(...xs);
                    const minY = Math.min(...ys), maxY = Math.max(...ys);
                    scale = Math.min((canvas.width - 80) / (maxX - minX), (canvas.height - 80) / (maxY - minY));
                    offsetX = -minX * scale + 40;
                    offsetY = -minY * scale + 40;
                    
                    animate();
                });

                function updateTeam() {
                    const teamName = document.getElementById("teamSelector").value;
                    currentTeam = teamData[teamName];
                    if (currentTeam) {
                        document.getElementById("maxRpm").innerText = currentTeam.MaxRPM.toLocaleString();
                        document.getElementById("topSpeed").innerText = currentTeam.MaxSpeed;
                        document.getElementById("avgThrottle").innerText = currentTeam.AvgThrottle;
                        document.getElementById("rpmBar").style.width = "100%";
                    }
                }

                function renderTrack() {
                    ctx.clearRect(0, 0, canvas.width, canvas.height);
                    ctx.beginPath();
                    ctx.lineWidth = 12; ctx.strokeStyle = "#1d2026"; ctx.lineJoin = "round";
                    trackPoints.forEach((p, i) => {
                        const x = p[0] * scale + offsetX;
                        const y = canvas.height - (p[1] * scale + offsetY);
                        if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
                    });
                    ctx.stroke();

                    ctx.lineWidth = 2; ctx.strokeStyle = "#444"; ctx.stroke();
                }

                function animate() {
                    fetch('/telemetry').then(r => r.json()).then(data => {
                        renderTrack();
                        
                        const cx = data.x * scale + offsetX;
                        const cy = canvas.height - (data.y * scale + offsetY);
                        const cColor = currentTeam ? teamColors[currentTeam.Team] : "#e10600";
                        
                        // Car Marker
                        ctx.beginPath(); ctx.arc(cx, cy, 10, 0, Math.PI*2);
                        ctx.fillStyle = cColor + "33"; ctx.fill();
                        ctx.beginPath(); ctx.arc(cx, cy, 6, 0, Math.PI*2);
                        ctx.fillStyle = cColor; ctx.fill();
                        
                        // Update UI
                        document.getElementById("speed").innerHTML = `${data.speed.toFixed(1)} <span class="unit">KM/H</span>`;
                        document.getElementById("downforce").innerHTML = `${Math.round(data.predicted_downforce).toLocaleString()} <span class="unit">N</span>`;
                        
                        const drs = document.getElementById("drs");
                        if (data.drs) { drs.innerText = "DRS ACTIVE"; drs.className = "drs-status drs-active"; }
                        else { drs.innerText = "DRS DISABLED"; drs.className = "drs-status drs-disabled"; }
                        
                        // RPM simulation for selected team
                        if (currentTeam) {
                            const rpmPercent = (data.speed / currentTeam.MaxSpeed) * 100;
                            document.getElementById("rpmBar").style.width = Math.min(rpmPercent, 100) + "%";
                        }
                    });
                    setTimeout(() => requestAnimationFrame(animate), 100);
                }
            </script>
        </body>
    </html>
    """

@app.get("/track")
def get_track():
    return {"points": track_points}
