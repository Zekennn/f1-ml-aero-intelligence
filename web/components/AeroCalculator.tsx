"use client";

import { useMemo, useState } from "react";
import { aeroForces, airDensity, coefficients, flapAngles } from "@/lib/aeroPhysics";
import { DEFAULT_INPUTS, MODES, ModeId, POWER, SETUPS, SetupId, TRACK_PRESETS } from "@/lib/car2026";
import PhysicsInfo from "./PhysicsInfo";
import WindTunnel from "./windtunnel/WindTunnel";
import type { AeroInputs, AeroModel } from "./windtunnel/types";

const fmt = (n: number, d = 0) => n.toLocaleString(undefined, { minimumFractionDigits: d, maximumFractionDigits: d });

/**
 * 2026 aero calculator: speed, active aero mode, track setup and air conditions → drag and
 * downforce from the aerodynamic equations (see lib/aeroPhysics.ts and lib/car2026.ts).
 * Results update live. The old neural-network model is kept, disconnected, in lib/mlAeroModel.ts.
 */
export default function AeroCalculator() {
  const [inputs, setInputs] = useState<AeroInputs>(DEFAULT_INPUTS);
  const set = <K extends keyof AeroInputs>(key: K, value: AeroInputs[K]) => setInputs((i) => ({ ...i, [key]: value }));

  const model = useMemo<AeroModel>(() => {
    const speed = Number.isFinite(inputs.speedKmh) ? inputs.speedKmh : 0;
    const rho = airDensity(Number.isFinite(inputs.tempC) ? inputs.tempC : 15, Number.isFinite(inputs.altitudeM) ? inputs.altitudeM : 0);
    const coeffs = coefficients(inputs.setup, inputs.mode);
    const f = flapAngles(inputs.setup, inputs.mode);
    return {
      inputs: { ...inputs, speedKmh: speed },
      rho,
      coeffs,
      flaps: { ...f, rearClosed: flapAngles(inputs.setup, "corner").rear },
      result: aeroForces(speed, rho, coeffs),
      corner: aeroForces(speed, rho, coefficients(inputs.setup, "corner")),
      straight: aeroForces(speed, rho, coefficients(inputs.setup, "straight")),
    };
  }, [inputs]);

  const preset = TRACK_PRESETS.find((t) => t.altitudeM === inputs.altitudeM)?.id ?? "custom";
  const r = model.result;

  return (
    <>
      <div className="aero-note" role="note">
        <strong>About these numbers.</strong> Forces use real aerodynamic equations with estimated 2026 coefficients,
        based on FIA targets. Teams do not publish real values. The airflow animation is illustrative, not a CFD simulation.
      </div>

      <div className="aero">
        <form className="panel aero-form" onSubmit={(e) => e.preventDefault()}>
          <label className="field">
            Speed (km/h)
            <div className="aero-speed">
              <input type="range" min={0} max={350} step={5} value={inputs.speedKmh} onChange={(e) => set("speedKmh", Number(e.target.value))} aria-label="Speed slider" />
              <input type="number" min={0} max={400} value={inputs.speedKmh} onChange={(e) => set("speedKmh", Number(e.target.value))} />
            </div>
          </label>

          <div className="field">
            <span id="aero-mode">Active Aero Mode</span>
            <div className="aero-mode" role="radiogroup" aria-labelledby="aero-mode">
              {(Object.keys(MODES) as ModeId[]).map((m) => (
                <button key={m} type="button" role="radio" aria-checked={inputs.mode === m} className="aero-mode__btn" onClick={() => set("mode", m)}>
                  {MODES[m].label}
                  <small>{MODES[m].short} · {MODES[m].description}</small>
                </button>
              ))}
            </div>
          </div>

          <label className="field">
            Track downforce setup
            <select className="select" value={inputs.setup} onChange={(e) => set("setup", e.target.value as SetupId)}>
              {(Object.keys(SETUPS) as SetupId[]).map((s) => (
                <option key={s} value={s}>{SETUPS[s].label} ({SETUPS[s].example})</option>
              ))}
            </select>
          </label>

          <p className="aero-readonly">
            Flap angles in this setup and mode: front flap <strong>{model.flaps.front}°</strong>, rear flap{" "}
            <strong>{model.flaps.rear}°</strong> (rear main plane {model.flaps.rearMain}°)
          </p>

          <fieldset className="aero-air">
            <legend>Air conditions (optional)</legend>
            <label className="field">
              Track preset
              <select
                className="select"
                value={preset}
                onChange={(e) => {
                  const t = TRACK_PRESETS.find((p) => p.id === e.target.value);
                  if (t) set("altitudeM", t.altitudeM);
                }}
              >
                {TRACK_PRESETS.map((t) => (
                  <option key={t.id} value={t.id}>{t.label} (~{fmt(t.altitudeM)} m)</option>
                ))}
                {preset === "custom" && <option value="custom">Custom altitude</option>}
              </select>
            </label>
            <div className="aero-air__row">
              <label className="field">
                Air temp (°C)
                <input type="number" min={-20} max={50} value={inputs.tempC} onChange={(e) => set("tempC", Number(e.target.value))} />
              </label>
              <label className="field">
                Altitude (m)
                <input type="number" min={0} max={4000} step={10} value={inputs.altitudeM} onChange={(e) => set("altitudeM", Number(e.target.value))} />
              </label>
            </div>
            <p className="aero-readonly">
              Air density <strong>{fmt(model.rho, 3)} kg/m³</strong> (sea level at 15 °C is 1.225)
            </p>
          </fieldset>
        </form>

        <div className="panel">
          <div className="panel__title">
            Result
            <span className="badge">{MODES[inputs.mode].label}</span>
          </div>
          <div className="metric">
            <div className="metric__label">Drag</div>
            <div className="metric__value">{fmt(r.drag)}<span className="metric__unit">N</span></div>
          </div>
          <div className="metric">
            <div className="metric__label">Downforce</div>
            <div className="metric__value metric__value--blue">
              {fmt(r.downforce)}<span className="metric__unit">N · {fmt(r.weights, 2)}× car weight</span>
            </div>
          </div>
          <div className="metric-row">
            <div className="metric">
              <div className="metric__label">L/D</div>
              <div className="metric__value">{fmt(r.ld, 2)}</div>
            </div>
            <div className="metric">
              <div className="metric__label">Drag power</div>
              <div className="metric__value">{fmt(r.powerKw)}<span className="metric__unit">kW</span></div>
            </div>
          </div>
          <div className="metric">
            <div className="metric__label">Estimated top speed*</div>
            <div className="metric__value">{fmt(r.topSpeedKmh)}<span className="metric__unit">km/h</span></div>
          </div>
          <p className="card__meta">
            * Simplified: where drag power equals the effective power at top speed, {POWER.topSpeedKw} kW. Calibrated to real 2026
            top speeds in the TracingInsights telemetry (±{POWER.calibrationMaeKmh} km/h); peak power is about {POWER.totalKw} kW
            ({POWER.combustionKw} kW combustion + {POWER.electricKw} kW electric) but deployment runs out on long straights.
          </p>
        </div>
      </div>

      <WindTunnel model={model} onReset={() => setInputs(DEFAULT_INPUTS)} />

      <PhysicsInfo />
    </>
  );
}
