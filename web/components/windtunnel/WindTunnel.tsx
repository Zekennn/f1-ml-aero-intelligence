"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { AERO_BALANCE_FRONT, AERO_MEDIUM, SETUPS } from "@/lib/car2026";
import DetailPanel from "./DetailPanel";
import type { EngineParams, View } from "./engine";
import TunnelCanvas from "./TunnelCanvas";
import type { AeroModel } from "./types";
import { useReducedMotion } from "./useReducedMotion";

type Props = {
  model: AeroModel;
  onReset: () => void; // put the calculator inputs back to their defaults
};

// The most loaded the wings can be (High setup, Corner Mode): scales the flow effects to 0–1.
const MAX_REAR_CLA = AERO_MEDIUM.corner.ClA * SETUPS.high.scale * (1 - AERO_BALANCE_FRONT.corner);
const MAX_CDA = AERO_MEDIUM.corner.CdA * SETUPS.high.scale;

const Icon = ({ d }: { d: string }) => (
  <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true" fill="currentColor"><path d={d} /></svg>
);
const ICONS = {
  play: "M8 5v14l11-7z",
  pause: "M7 5h4v14H7zM13 5h4v14h-4z",
  reset: "M12 5V2L7 6l5 4V7a5 5 0 1 1-5 5H5a7 7 0 1 0 7-7z",
  expand: "M4 4h6v2H6v4H4zm10 0h6v6h-2V6h-4zM4 14h2v4h4v2H4zm14 0h2v6h-6v-2h4z",
  shrink: "M8 4h2v6H4V8h4zm6 0h2v4h4v2h-6zM4 14h6v6H8v-4H4zm10 0h6v2h-4v4h-2z",
};

/**
 * Wind tunnel simulator for the Aero page: an illustrative airflow animation driven by the
 * physics model, with the forces drawn on the car and listed alongside.
 */
export default function WindTunnel({ model, onReset }: Props) {
  const reduced = useReducedMotion();
  const cardRef = useRef<HTMLElement>(null);
  const [playing, setPlaying] = useState(true);
  const [view, setView] = useState<View>("particles");
  const [showArrows, setShowArrows] = useState(true);
  const [density, setDensity] = useState(1);
  const [onScreen, setOnScreen] = useState(true);
  const [nativeFull, setNativeFull] = useState(false);
  const [expanded, setExpanded] = useState(false); // fallback where the Fullscreen API is missing (iPhone)

  const running = playing && !reduced;

  const params = useMemo<EngineParams>(() => {
    const { inputs, coeffs, flaps, result } = model;
    return {
      speed: inputs.speedKmh,
      pose: { frontFlap: flaps.front, rearFlap: flaps.rear, rearClosed: flaps.rearClosed, rearMain: flaps.rearMain },
      open: inputs.mode === "straight" ? 1 : 0,
      load: (coeffs.ClA * (1 - coeffs.balanceFront)) / MAX_REAR_CLA,
      wake: coeffs.CdA / MAX_CDA,
      forces: result,
      playing,
      view,
      showArrows,
      density,
      still: reduced,
    };
  }, [model, playing, view, showArrows, density, reduced]);

  // Pause the animation while the box is scrolled off screen.
  useEffect(() => {
    const card = cardRef.current;
    if (!card) return;
    const io = new IntersectionObserver(([entry]) => setOnScreen(entry.isIntersecting));
    io.observe(card);
    return () => io.disconnect();
  }, []);

  useEffect(() => {
    const onChange = () => setNativeFull(document.fullscreenElement === cardRef.current);
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, []);

  useEffect(() => {
    if (!expanded) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setExpanded(false);
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [expanded]);

  const full = nativeFull || expanded;

  function toggleFullscreen() {
    const card = cardRef.current;
    if (!card) return;
    if (nativeFull) document.exitFullscreen();
    else if (expanded) setExpanded(false);
    else if (typeof card.requestFullscreen === "function") card.requestFullscreen().catch(() => setExpanded(true));
    else setExpanded(true);
  }

  function reset() {
    onReset();
    setPlaying(true);
    setView("particles");
    setShowArrows(true);
    setDensity(1);
  }

  return (
    <section ref={cardRef} className={`wt${full ? " wt--full" : ""}${expanded ? " wt--expanded" : ""}`} aria-labelledby="wt-title">
      <header className="wt__head">
        <div>
          <h2 id="wt-title" className="wt__title">Wind Tunnel</h2>
          <p className="wt__subtitle">A 2026-regulation car to scale. Switch active aero modes and watch both wing flaps and the airflow change.</p>
        </div>
        <span className={`wt-status${running ? " wt-status--on" : ""}`}>
          <span className="wt-status__dot" aria-hidden="true" />
          {running ? "Running" : "Paused"}
        </span>
      </header>

      <div className="wt__body">
        <TunnelCanvas params={params} active={onScreen} />
        <DetailPanel model={model} instant={reduced} />
      </div>

      <div className="wt__controls">
        <button
          type="button"
          className="wt-btn wt-btn--primary"
          onClick={() => setPlaying((p) => !p)}
          disabled={reduced}
          title={reduced ? "Animation is off because your system asks for reduced motion" : undefined}
        >
          <Icon d={running ? ICONS.pause : ICONS.play} />
          {running ? "Pause" : "Play"}
        </button>

        <div className="wt-seg" role="group" aria-label="View">
          {(["particles", "streamlines"] as const).map((v) => (
            <button key={v} type="button" className="wt-seg__btn" aria-pressed={view === v} onClick={() => setView(v)}>
              {v === "particles" ? "Particles" : "Streamlines"}
            </button>
          ))}
        </div>

        <button type="button" className="wt-switch" role="switch" aria-checked={showArrows} onClick={() => setShowArrows((s) => !s)}>
          <span className="wt-switch__track" aria-hidden="true"><span className="wt-switch__thumb" /></span>
          Force arrows
        </button>

        <label className="wt-range">
          Particle density
          <input
            type="range"
            min={0.25}
            max={2}
            step={0.25}
            value={density}
            disabled={view !== "particles" || reduced}
            onChange={(e) => setDensity(Number(e.target.value))}
          />
          <output>{density.toFixed(2).replace(/\.?0+$/, "")}×</output>
        </label>

        <div className="wt__controls-end">
          <button type="button" className="wt-btn" onClick={reset}>
            <Icon d={ICONS.reset} />
            Reset
          </button>
          <button type="button" className="wt-btn" onClick={toggleFullscreen} aria-pressed={full}>
            <Icon d={full ? ICONS.shrink : ICONS.expand} />
            {full ? "Exit fullscreen" : "Fullscreen"}
          </button>
        </div>
      </div>

      <p className="wt__caption">
        The airflow animation is illustrative, not a CFD simulation. Forces use real aerodynamic equations with estimated 2026 coefficients.
      </p>
    </section>
  );
}
