"use client";

import { PointerEvent, useEffect, useRef, useState } from "react";
import { EngineParams, TunnelEngine } from "./engine";

type Tip = { x: number; y: number; text: string; flip: boolean };

/** The wind tunnel canvas: runs the animation loop while `active`, and shows a hover air-speed readout. */
export default function TunnelCanvas({ params, active }: { params: EngineParams; active: boolean }) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<TunnelEngine | null>(null);
  const [tip, setTip] = useState<Tip | null>(null);

  // Create the engine once and keep the canvas sized to its box at the device pixel ratio.
  useEffect(() => {
    const canvas = canvasRef.current!;
    const wrap = wrapRef.current!;
    const engine = new TunnelEngine(canvas, params);
    engineRef.current = engine;
    const ro = new ResizeObserver(() => {
      const r = wrap.getBoundingClientRect();
      engine.resize(r.width, r.height, Math.min(window.devicePixelRatio || 1, 2));
      engine.drawStill();
    });
    ro.observe(wrap);
    return () => {
      ro.disconnect();
      engineRef.current = null;
    };
  }, []); // params reach the engine through the effect below

  useEffect(() => {
    const engine = engineRef.current;
    if (!engine) return;
    engine.params = params;
    if (params.still) engine.drawStill();
  }, [params]);

  // Animate only while on screen, and never under reduced motion.
  useEffect(() => {
    const engine = engineRef.current;
    if (!engine || !active || params.still) return;
    let raf = 0;
    const loop = (now: number) => {
      engine.frame(now);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => {
      cancelAnimationFrame(raf);
      engine.resetClock();
    };
  }, [active, params.still]);

  function handleMove(e: PointerEvent<HTMLCanvasElement>) {
    const engine = engineRef.current;
    if (!engine) return;
    const r = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - r.left;
    const y = e.clientY - r.top;
    const probe = engine.sample(x, y);
    const text =
      probe.kind === "road" ? "Rolling road" :
      probe.kind === "car" ? "Car body" :
      `≈ ${Math.round(probe.kmh)} km/h · ${probe.ratio.toFixed(2)}× free stream`;
    setTip({ x, y, text, flip: x > r.width - 200 });
  }

  return (
    <div className="wt__stage" ref={wrapRef}>
      <canvas
        ref={canvasRef}
        className="wt__canvas"
        role="img"
        aria-label={`Side view of a 2026 Formula 1 car in a wind tunnel at ${params.speed} km/h, active aero flaps ${params.open ? "open (Straight Mode)" : "closed (Corner Mode)"}.`}
        onPointerMove={handleMove}
        onPointerLeave={() => setTip(null)}
      />
      {tip && (
        <div className={`wt__tip${tip.flip ? " wt__tip--flip" : ""}`} style={{ left: tip.x, top: tip.y }} role="status">
          {tip.text}
        </div>
      )}
    </div>
  );
}
