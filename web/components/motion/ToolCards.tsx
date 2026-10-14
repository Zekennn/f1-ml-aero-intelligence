"use client";

import Link from "next/link";
import { CSSProperties, PointerEvent, ReactNode } from "react";
import type { LandingDriver } from "@/lib/landing";
import { Reveal } from "./primitives";

/** Card that tilts towards the pointer with a spotlight following it. */
function TiltCard({ href, children, accent }: { href: string; children: ReactNode; accent: string }) {
  const move = (e: PointerEvent<HTMLAnchorElement>) => {
    if (e.pointerType !== "mouse") return;
    const el = e.currentTarget;
    const r = el.getBoundingClientRect();
    const x = (e.clientX - r.left) / r.width, y = (e.clientY - r.top) / r.height;
    el.style.setProperty("--mx", `${x * 100}%`);
    el.style.setProperty("--my", `${y * 100}%`);
    el.style.setProperty("--rx", `${(0.5 - y) * 10}deg`);
    el.style.setProperty("--ry", `${(x - 0.5) * 12}deg`);
  };
  const leave = (e: PointerEvent<HTMLAnchorElement>) => {
    e.currentTarget.style.setProperty("--rx", "0deg");
    e.currentTarget.style.setProperty("--ry", "0deg");
  };
  return (
    <Link href={href} className="tool" style={{ "--accent": accent } as CSSProperties} onPointerMove={move} onPointerLeave={leave}>
      {children}
    </Link>
  );
}

// A deterministic "speed trace" shape for the telemetry card (two identical periods so it can loop)
const TRACE = (() => {
  const pts: string[] = [];
  for (let i = 0; i <= 200; i++) {
    const x = i * 4;
    const t = (i % 100) / 100;
    const y = 70 - 42 * Math.abs(Math.sin(t * Math.PI * 3)) ** 0.6 - 10 * Math.sin(t * Math.PI * 7);
    pts.push(`${x},${y.toFixed(1)}`);
  }
  return pts.join(" ");
})();

export default function ToolCards({ drivers }: { drivers: LandingDriver[] }) {
  const top = drivers.slice(0, 6);
  const max = Math.max(1, top[0]?.points ?? 1);

  return (
    <section className="tools" id="insights">
      <div className="container">
        <Reveal className="tools__head">
          <p className="eyebrow-x"><span>05</span> Data &amp; insights</p>
          <h2 className="tools__title">Under the hood.</h2>
          <p className="tools__sub">Machine-learning tools built on real 2026 timing data. Pick one and take it for a lap.</p>
        </Reveal>

        <Reveal className="tools__grid" threshold={0.15}>
          <TiltCard href="/live" accent="#36e2ff">
            <div className="tool__viz tool__viz--trace" aria-hidden="true">
              <svg viewBox="0 0 400 90" preserveAspectRatio="none">
                <g className="trace-move">
                  <polyline points={TRACE} />
                </g>
              </svg>
              <span className="tool__chip"><i /> Speed trace</span>
            </div>
            <h3>Live telemetry</h3>
            <p>Race any 2026 team around every circuit on real reference laps, with pit stops and tyre temperatures.</p>
            <span className="tool__cta">Open dashboard →</span>
          </TiltCard>

          <TiltCard href="/predictor" accent="#ffb12e">
            <div className="tool__viz tool__viz--bars" aria-hidden="true">
              {top.map((d, i) => (
                <span key={d.code} style={{ "--h": d.points / max, "--c": d.colour, "--i": i } as CSSProperties}>
                  <i />
                  <b>{d.code}</b>
                </span>
              ))}
              <span className="tool__chip">Points so far</span>
            </div>
            <h3>2026 winner predictor</h3>
            <p>Next-race win odds and title chances, from a race-by-race model trained on our own 2006–2026 results.</p>
            <span className="tool__cta">View predictions →</span>
          </TiltCard>

          <TiltCard href="/aero" accent="#ff2d55">
            <div className="tool__viz tool__viz--wing" aria-hidden="true">
              <svg viewBox="0 0 400 90" preserveAspectRatio="xMidYMid slice">
                {Array.from({ length: 7 }, (_, i) => {
                  const y = 12 + i * 11;
                  const bend = y < 45 ? -(45 - y) * 0.5 - 6 : (y - 45) * 0.2 + 4;
                  return <path key={i} className="stream" style={{ "--i": i } as CSSProperties} d={`M0 ${y} C 140 ${y} 160 ${y + bend} 210 ${y + bend} S 300 ${y + bend * 1.6} 400 ${y + bend * 2}`} />;
                })}
                <path className="airfoil" d="M150 52 C 175 36 235 34 262 46 C 238 48 186 52 150 52 Z" />
              </svg>
            </div>
            <h3>Aero calculator</h3>
            <p>Pick a speed, active aero mode and track setup for drag and downforce from real equations — with a live wind tunnel.</p>
            <span className="tool__cta">Try it →</span>
          </TiltCard>
        </Reveal>
      </div>
    </section>
  );
}
