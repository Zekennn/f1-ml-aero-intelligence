"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { API } from "@/lib/backend";
import BackendNotice from "./BackendNotice";

/* ---------- Types for the FastAPI responses ---------- */
type Point = [number, number];
type TeamInfo = { Team: string; MaxSpeed: number; AvgThrottle: number };
type Telemetry = {
  x: number; y: number; speed: number; rpm: number; gear: number | string;
  throttle: number; brake: number; drs: number;
  predicted_drag: number; predicted_downforce: number; predicted_lap_time: number;
  current_lap: number; total_laps: number; tire_age: number;
  tire_temps: Record<"FL" | "FR" | "RL" | "RR", number>;
};

const TRACKS = ["Monaco", "Australia", "China"];
const COMPOUNDS = [
  { value: "SOFT", label: "Soft (C5)" },
  { value: "MEDIUM", label: "Medium (C4)" },
  { value: "HARD", label: "Hard (C3)" },
];
const POLL_MS = 50;
const DEFAULT_CAR_COLOUR = "#1E5EFF";

/** Format seconds as m:ss.sss */
function formatLap(seconds: number) {
  const m = Math.floor(seconds / 60);
  const s = (seconds % 60).toFixed(3).padStart(6, "0");
  return `${m}:${s}`;
}

/** Tyre temperature colour: normal → hot → overheating */
function tyreColour(temp: number) {
  if (temp > 120) return "#DC2626";
  if (temp > 100) return "#CA8A04";
  return "#0F766E";
}

export default function LiveDashboard() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Track geometry lives in refs because the draw loop reads it every frame
  const trackRef = useRef<Point[]>([]);
  const drsRef = useRef<{ points: Point[] }[]>([]);
  const compoundRef = useRef("SOFT");
  const carColourRef = useRef(DEFAULT_CAR_COLOUR);

  const [track, setTrack] = useState("Monaco");
  const [compound, setCompound] = useState("SOFT");
  const [teams, setTeams] = useState<Record<string, TeamInfo>>({});
  const [teamColours, setTeamColours] = useState<Record<string, string>>({});
  const [team, setTeam] = useState("");
  const [data, setData] = useState<Telemetry | null>(null);
  const [offline, setOffline] = useState(false);

  /* ---------- Load track outline + DRS zones ---------- */
  const loadTrack = useCallback(async () => {
    const [trackRes, circuitRes] = await Promise.all([
      fetch(`${API}/track`).then((r) => r.json()),
      fetch(`${API}/circuit`).then((r) => r.json()),
    ]);
    trackRef.current = trackRes.points ?? [];
    drsRef.current = circuitRes.drs_zones ?? [];
  }, []);

  // Initial load: current track, track geometry and team list
  useEffect(() => {
    (async () => {
      try {
        const current = await fetch(`${API}/current_track`).then((r) => r.json());
        if (current.track) setTrack(current.track);
        await loadTrack();
        const teamRes = await fetch(`${API}/teams`).then((r) => r.json());
        const byName: Record<string, TeamInfo> = {};
        (teamRes.teams as TeamInfo[]).forEach((t) => (byName[t.Team] = t));
        setTeams(byName);
        setTeamColours(teamRes.colors ?? {});
      } catch {
        setOffline(true);
      }
    })();
  }, [loadTrack]);

  /* ---------- Drawing ---------- */
  const draw = useCallback((car?: { x: number; y: number }) => {
    const canvas = canvasRef.current;
    const points = trackRef.current;
    if (!canvas || !points.length) return;

    // Match the canvas buffer to its on-screen size (sharp on high-DPI screens)
    const dpr = window.devicePixelRatio || 1;
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    if (canvas.width !== Math.round(w * dpr) || canvas.height !== Math.round(h * dpr)) {
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
    }
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);

    // Fit the track inside the canvas with padding
    const xs = points.map((p) => p[0]);
    const ys = points.map((p) => p[1]);
    const minX = Math.min(...xs), maxX = Math.max(...xs);
    const minY = Math.min(...ys), maxY = Math.max(...ys);
    const pad = 30;
    const scale = Math.min((w - pad * 2) / (maxX - minX), (h - pad * 2) / (maxY - minY));
    const offX = (w - (maxX - minX) * scale) / 2 - minX * scale;
    const offY = (h - (maxY - minY) * scale) / 2 - minY * scale;
    const toX = (x: number) => x * scale + offX;
    const toY = (y: number) => h - (y * scale + offY);

    const path = (pts: Point[]) => {
      ctx.beginPath();
      pts.forEach(([x, y], i) => (i === 0 ? ctx.moveTo(toX(x), toY(y)) : ctx.lineTo(toX(x), toY(y))));
    };

    // Track surface + centre line
    ctx.lineJoin = "round";
    ctx.lineCap = "round";
    path(points);
    ctx.lineWidth = 14;
    ctx.strokeStyle = "#1C3557";
    ctx.stroke();
    ctx.lineWidth = 2;
    ctx.strokeStyle = "#3D5A80";
    ctx.stroke();

    // DRS zones
    drsRef.current.forEach((zone) => {
      path(zone.points);
      ctx.lineWidth = 14;
      ctx.strokeStyle = "rgba(34, 197, 94, 0.35)";
      ctx.stroke();
    });

    // Car marker
    if (car) {
      ctx.beginPath();
      ctx.arc(toX(car.x), toY(car.y), 8, 0, Math.PI * 2);
      ctx.fillStyle = carColourRef.current;
      ctx.shadowBlur = 10;
      ctx.shadowColor = carColourRef.current;
      ctx.fill();
      ctx.shadowBlur = 0;
      ctx.lineWidth = 2;
      ctx.strokeStyle = "#FFFFFF";
      ctx.stroke();
    }
  }, []);

  /* ---------- Telemetry polling loop ---------- */
  useEffect(() => {
    let stopped = false;
    let timer: ReturnType<typeof setTimeout>;

    const tick = async () => {
      try {
        const res = await fetch(`${API}/telemetry?compound=${compoundRef.current}`);
        if (!res.ok) throw new Error(String(res.status));
        const t: Telemetry = await res.json();
        if (stopped) return;
        setOffline(false);
        setData(t);
        draw(t);
        timer = setTimeout(tick, POLL_MS);
      } catch {
        if (stopped) return;
        setOffline(true);
        timer = setTimeout(tick, 3000); // retry slowly while the backend is down
      }
    };
    tick();

    return () => {
      stopped = true;
      clearTimeout(timer);
    };
  }, [draw]);

  /* ---------- Control handlers ---------- */
  async function changeTrack(name: string) {
    setTrack(name);
    try {
      await fetch(`${API}/set_track?track_name=${encodeURIComponent(name)}`, { method: "POST" });
      await loadTrack();
    } catch {
      setOffline(true);
    }
  }

  function changeCompound(value: string) {
    setCompound(value);
    compoundRef.current = value;
  }

  function changeTeam(name: string) {
    setTeam(name);
    carColourRef.current = teamColours[name] || DEFAULT_CAR_COLOUR;
  }

  const teamInfo = teams[team];
  const rpmPct = data ? Math.min((data.rpm / 12500) * 100, 100) : 0;

  return (
    <>
      {offline && <BackendNotice />}

      <div className="dash-controls">
        <label>
          Circuit
          <select className="select" value={track} onChange={(e) => changeTrack(e.target.value)}>
            {TRACKS.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
        </label>
        <label>
          Tyre compound
          <select className="select" value={compound} onChange={(e) => changeCompound(e.target.value)}>
            {COMPOUNDS.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
          </select>
        </label>
        <label>
          Team
          <select className="select" value={team} onChange={(e) => changeTeam(e.target.value)}>
            <option value="">Select team</option>
            {Object.keys(teams).map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
        </label>
      </div>

      <div className="dash-grid">
        {/* Circuit map */}
        <div className="panel panel--track">
          <div className="panel__title">
            {track} circuit
            <span className="badge">Lap {data?.current_lap ?? 1} / {data?.total_laps ?? "–"}</span>
          </div>
          <canvas ref={canvasRef} className="track-canvas" aria-label={`Live position on the ${track} circuit`} />
        </div>

        {/* Car status */}
        <div className="panel">
          <div className="panel__title">Live telemetry</div>
          <div className="metric-row">
            <div className="metric">
              <div className="metric__label">Gear</div>
              <div className="metric__value metric__value--xl">{data?.gear ?? "N"}</div>
            </div>
            <div className="metric">
              <div className="metric__label">Speed</div>
              <div className="metric__value">{data ? data.speed.toFixed(0) : 0}<span className="metric__unit">km/h</span></div>
              <span className={`pill ${data?.drs ? "pill--on" : "pill--off"}`}>{data?.drs ? "DRS active" : "DRS off"}</span>
            </div>
          </div>
          <div className="metric">
            <div className="metric__label">Throttle</div>
            <div className="bar"><div className="bar__fill" style={{ width: `${data?.throttle ?? 0}%` }} /></div>
          </div>
          <div className="metric">
            <div className="metric__label">Brake</div>
            <div className="bar"><div className="bar__fill bar__fill--brake" style={{ width: data?.brake ? "100%" : "0%" }} /></div>
          </div>
        </div>

        {/* Aero predictions */}
        <div className="panel">
          <div className="panel__title">Aero performance</div>
          <div className="metric-row">
            <div className="metric">
              <div className="metric__label">Pred. drag</div>
              <div className="metric__value">{data ? Math.round(data.predicted_drag).toLocaleString() : 0}<span className="metric__unit">N</span></div>
            </div>
            <div className="metric">
              <div className="metric__label">Pred. downforce</div>
              <div className="metric__value">{data ? Math.round(data.predicted_downforce).toLocaleString() : 0}<span className="metric__unit">N</span></div>
            </div>
          </div>
          <div className="metric">
            <div className="metric__label">Predicted lap time</div>
            <div className="metric__value metric__value--blue">{data?.predicted_lap_time ? formatLap(data.predicted_lap_time) : "–"}</div>
          </div>
        </div>

        {/* Engine */}
        <div className="panel">
          <div className="panel__title">Engine {teamInfo && <span>{teamInfo.Team}</span>}</div>
          <div className="metric">
            <div className="metric__label">RPM: {data ? data.rpm.toLocaleString() : 0}</div>
            <div className="bar"><div className="bar__fill bar__fill--rpm" style={{ width: `${rpmPct}%` }} /></div>
          </div>
          <div className="metric-row">
            <div className="metric">
              <div className="metric__label">Top speed</div>
              <div className="metric__value">{teamInfo ? teamInfo.MaxSpeed : "–"}<span className="metric__unit">km/h</span></div>
            </div>
            <div className="metric">
              <div className="metric__label">Avg throttle</div>
              <div className="metric__value">{teamInfo ? `${teamInfo.AvgThrottle}%` : "–"}</div>
            </div>
          </div>
        </div>

        {/* Tyres */}
        <div className="panel">
          <div className="panel__title">Tyre temperatures <span>Age: {data?.tire_age ?? 0}</span></div>
          <div className="tyre-grid">
            {(["FL", "FR", "RL", "RR"] as const).map((wheel) => {
              const temp = data?.tire_temps[wheel] ?? 90;
              return (
                <div className="tyre" key={wheel}>
                  <div className="metric__label">{wheel}</div>
                  <div className="tyre__temp" style={{ color: tyreColour(temp) }}>{temp}°C</div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </>
  );
}
