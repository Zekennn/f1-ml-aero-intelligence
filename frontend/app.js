const canvas = document.getElementById("trackCanvas");
const ctx = canvas.getContext("2d");
let trackPoints = [], teamData = {}, currentTeam = null, teamColors = {}, drsZones = [];
let scale = 1, offsetX = 0, offsetY = 0;

// Set canvas size based on parent container
function resizeCanvas() {
    const parent = canvas.parentElement;
    canvas.width = parent.clientWidth;
    canvas.height = parent.clientHeight;
    if (trackPoints.length > 0) calculateScale();
}

window.addEventListener('resize', resizeCanvas);
resizeCanvas();

function calculateScale() {
    const xs = trackPoints.map(p => p[0]), ys = trackPoints.map(p => p[1]);
    const minX = Math.min(...xs), maxX = Math.max(...xs);
    const minY = Math.min(...ys), maxY = Math.max(...ys);
    scale = Math.min((canvas.width - 60) / (maxX - minX), (canvas.height - 60) / (maxY - minY));
    offsetX = -minX * scale + 30;
    offsetY = -minY * scale + 30;
}

// Load Data
Promise.all([
    fetch('/track').then(r => r.json()),
    fetch('/teams').then(r => r.json()),
    fetch('/circuit').then(r => r.json())
]).then(([track, teams, circuit]) => {
    trackPoints = track.points;
    teamColors = teams.colors;
    drsZones = circuit.drs_zones || [];

    const selector = document.getElementById("teamSelector");
    teams.teams.forEach(t => {
        teamData[t.Team] = t;
        let opt = document.createElement("option");
        opt.value = t.Team; opt.innerText = t.Team;
        selector.appendChild(opt);
    });

    calculateScale();
    animate();
});

function updateTeam() {
    const teamName = document.getElementById("teamSelector").value;
    currentTeam = teamData[teamName];
    if (currentTeam) {
        document.getElementById("teamNameInfo").innerText = "| " + currentTeam.Team;
        document.getElementById("topSpeed").innerText = currentTeam.MaxSpeed + " KM/H";
        document.getElementById("avgThrottle").innerText = currentTeam.AvgThrottle + "%";
        document.documentElement.style.setProperty('--f1-red', teamColors[teamName] || "#e10600");
    }
}

function renderTrack() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.beginPath();
    ctx.lineWidth = 14; ctx.strokeStyle = "#1d2026"; ctx.lineJoin = "round"; ctx.lineCap = "round";
    trackPoints.forEach((p, i) => {
        const x = p[0] * scale + offsetX;
        const y = canvas.height - (p[1] * scale + offsetY);
        if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    });
    ctx.stroke();

    ctx.lineWidth = 2; ctx.strokeStyle = "#444"; ctx.stroke();

    // Render DRS Zones
    drsZones.forEach(zone => {
        ctx.beginPath();
        ctx.lineWidth = 14; ctx.strokeStyle = "rgba(0, 210, 190, 0.3)"; // Translucent Mercedes Green
        zone.points.forEach((p, i) => {
            const x = p[0] * scale + offsetX;
            const y = canvas.height - (p[1] * scale + offsetY);
            if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
        });
        ctx.stroke();
    });
}

function updateCompound() { }

function animate() {
    const compound = document.getElementById("compoundSelector").value;
    fetch(`/telemetry?compound=${compound}`).then(r => r.json()).then(data => {
        renderTrack();

        const cx = data.x * scale + offsetX;
        const cy = canvas.height - (data.y * scale + offsetY);
        const cColor = currentTeam ? teamColors[currentTeam.Team] : "#e10600";

        // Car Marker
        ctx.shadowBlur = 10; ctx.shadowColor = cColor;
        ctx.beginPath(); ctx.arc(cx, cy, 8, 0, Math.PI * 2);
        ctx.fillStyle = cColor; ctx.fill();
        ctx.shadowBlur = 0;

        // Update UI
        document.getElementById("speed").innerHTML = `${data.speed.toFixed(1)} <span class="unit">KM/H</span>`;
        document.getElementById("drag").innerHTML = `${Math.round(data.predicted_drag).toLocaleString()} <span class="unit">N</span>`;
        document.getElementById("downforce").innerHTML = `${Math.round(data.predicted_downforce).toLocaleString()} <span class="unit">N</span>`;
        document.getElementById("lapNum").innerText = `LAP ${data.current_lap} / ${data.total_laps}`;
        document.getElementById("tireAge").innerText = `AGE: ${data.tire_age}`;

        // Rich Telemetry
        document.getElementById("gearNum").innerText = data.gear;
        document.getElementById("throttleBar").style.width = data.throttle + "%";
        document.getElementById("brakeBar").style.width = (data.brake ? 100 : 0) + "%";
        document.getElementById("realRpm").innerText = data.rpm.toLocaleString();
        document.getElementById("realRpmBar").style.width = Math.min((data.rpm / 12500) * 100, 100) + "%";

        const drs = document.getElementById("drs");
        if (data.drs) { drs.innerText = "DRS ACTIVE"; drs.className = "drs-status drs-active"; }
        else { drs.innerText = "DRS DISABLED"; drs.className = "drs-status drs-disabled"; }

        // Lap time formatting
        if (data.predicted_lap_time) {
            const m = Math.floor(data.predicted_lap_time / 60);
            const s = (data.predicted_lap_time % 60).toFixed(3);
            document.getElementById("predLap").innerText = `${m}:${s.padStart(6, '0')}`;
        }

        // Tire Temps
        for (let wheel in data.tire_temps) {
            const el = document.getElementById(`temp${wheel}`);
            if (el) {
                const temp = data.tire_temps[wheel];
                el.innerText = `${temp}°C`;
                el.style.color = temp > 120 ? "#ff0000" : (temp > 100 ? "#ffff00" : "#00D2BE");
            }
        }
    });
    setTimeout(() => requestAnimationFrame(animate), 50); // Increased frequency for smoother animation
}
