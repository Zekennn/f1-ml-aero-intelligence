"use client";

import { FormEvent, useState } from "react";
import { API } from "@/lib/backend";
import BackendNotice from "./BackendNotice";

type Result = { predicted_drag: number; predicted_downforce: number };

/** Form for the /predict endpoint: speed + wing angle + DRS → drag and downforce. */
export default function AeroCalculator() {
  const [speed, setSpeed] = useState(330);
  const [wing, setWing] = useState(12);
  const [drs, setDrs] = useState(true);
  const [result, setResult] = useState<Result | null>(null);
  const [offline, setOffline] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const qs = new URLSearchParams({ speed: String(speed), wing_angle: String(wing), drs: drs ? "1" : "0" });
      const res = await fetch(`${API}/predict?${qs}`);
      if (!res.ok) throw new Error(String(res.status));
      setResult(await res.json());
      setOffline(false);
    } catch {
      setOffline(true);
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      {offline && <BackendNotice />}
      <div className="aero">
        <form className="panel" onSubmit={handleSubmit}>
          <label className="field">
            Speed (km/h)
            <input type="number" min={0} max={400} value={speed} onChange={(e) => setSpeed(Number(e.target.value))} required />
          </label>
          <label className="field">
            Rear wing angle (°)
            <input type="number" min={0} max={30} step={0.5} value={wing} onChange={(e) => setWing(Number(e.target.value))} required />
          </label>
          <label className="field field--check">
            <input type="checkbox" checked={drs} onChange={(e) => setDrs(e.target.checked)} />
            DRS open
          </label>
          <button type="submit" className="btn btn--primary" disabled={loading}>
            {loading ? "Calculating…" : "Predict forces"}
          </button>
        </form>

        <div className="panel">
          <div className="panel__title">Prediction</div>
          <div className="metric">
            <div className="metric__label">Drag</div>
            <div className="metric__value">{result ? Math.round(result.predicted_drag).toLocaleString() : "–"}<span className="metric__unit">N</span></div>
          </div>
          <div className="metric">
            <div className="metric__label">Downforce</div>
            <div className="metric__value metric__value--blue">{result ? Math.round(result.predicted_downforce).toLocaleString() : "–"}<span className="metric__unit">N</span></div>
          </div>
          {result && (
            <p className="card__meta">
              Downforce-to-drag ratio: {(result.predicted_downforce / result.predicted_drag).toFixed(2)}
            </p>
          )}
        </div>
      </div>
    </>
  );
}
