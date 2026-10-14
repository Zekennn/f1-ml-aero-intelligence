"use client";

import { CSSProperties, useEffect, useRef, useState } from "react";
import type { NextRace as Race } from "@/lib/landing";
import { onFrame, useInView } from "./engine";

const LAP_SECONDS = 7; // one animated lap

function useCountdown(target: number | null) {
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    const tick = () => setNow(Date.now());
    const first = window.setTimeout(tick, 0);
    const id = window.setInterval(tick, 1000);
    return () => {
      clearTimeout(first);
      clearInterval(id);
    };
  }, []);
  if (target === null || now === null) return null;
  const s = Math.max(0, Math.floor((target - now) / 1000));
  return { d: Math.floor(s / 86400), h: Math.floor((s % 86400) / 3600), m: Math.floor((s % 3600) / 60), s: s % 60, done: s === 0 };
}

/** Two digits that slide when they change. */
function Flip({ value, label }: { value: number; label: string }) {
  const v = String(value).padStart(2, "0");
  return (
    <div className="cd__unit">
      <span className="cd__digits">
        {v.split("").map((ch, i) => (
          <span className="cd__digit" key={i}>
            <span key={ch} className="cd__glyph">{ch}</span>
          </span>
        ))}
      </span>
      <small>{label}</small>
    </div>
  );
}

export default function NextRace({ race }: { race: Race }) {
  const ref = useRef<HTMLElement>(null);
  const pathRef = useRef<SVGPathElement>(null);
  const dotRef = useRef<SVGGElement>(null);
  const trailRef = useRef<SVGPathElement>(null);
  const inView = useInView(ref, { threshold: 0.3 });
  const target = race.startUtc ? Date.parse(race.startUtc) : Date.parse(`${race.date}T12:00:00Z`);
  const cd = useCountdown(target);

  // A dot laps the circuit with a fading comet trail behind it
  useEffect(() => {
    if (!inView || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const path = pathRef.current, dot = dotRef.current, trail = trailRef.current;
    if (!path || !dot || !trail) return;
    const len = path.getTotalLength();
    const start = performance.now() + 2200; // wait for the outline to finish drawing
    let visible = true;
    const io = new IntersectionObserver(([e]) => (visible = e.isIntersecting));
    io.observe(ref.current!);
    const off = onFrame((f) => {
      if (!visible || f.t < start) return;
      const t = (((f.t - start) / 1000) % LAP_SECONDS) / LAP_SECONDS;
      const p = path.getPointAtLength(t * len);
      dot.setAttribute("transform", `translate(${p.x} ${p.y})`);
      dot.style.opacity = "1";
      trail.style.strokeDashoffset = String(-(t - 0.14));
      trail.style.opacity = "1";
    });
    return () => {
      off();
      io.disconnect();
    };
  }, [inView]);

  const when = new Date(target);
  const dateLabel = when.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "long", timeZone: "UTC" });

  return (
    <section className={`nr ${inView ? "is-in" : ""}`} ref={ref} aria-labelledby="nr-title">
      <div className="container nr__inner">
        <div className="nr__copy">
          <p className="eyebrow-x"><span>04</span> Next up · round {race.round}</p>
          <h2 className="nr__title" id="nr-title">
            {race.name.replace(" Grand Prix", "")}
            <em>Grand Prix</em>
          </h2>
          <p className="nr__where">{race.location}, {race.country} · {dateLabel}</p>

          {cd && (
            <div className="cd" role="timer" aria-label={`${cd.d} days, ${cd.h} hours and ${cd.m} minutes to lights out`}>
              <Flip value={cd.d} label="days" />
              <Flip value={cd.h} label="hrs" />
              <Flip value={cd.m} label="min" />
              <Flip value={cd.s} label="sec" />
            </div>
          )}

          <dl className="nr__facts">
            {race.lapLength && <div><dt>Lap</dt><dd>{(race.lapLength / 1000).toFixed(3)} km</dd></div>}
            {race.laps && <div><dt>Laps</dt><dd>{race.laps}</dd></div>}
            {race.laps && race.lapLength && <div><dt>Distance</dt><dd>{((race.laps * race.lapLength) / 1000).toFixed(1)} km</dd></div>}
            <div><dt>Corners</dt><dd>{race.corners.length}</dd></div>
          </dl>
          <a href="#calendar" className="text-arrow">Full calendar →</a>
        </div>

        <div className="nr__track">
          <svg viewBox="0 0 1000 640" role="img" aria-label={`${race.name} circuit map`}>
            <defs>
              <filter id="nr-glow" x="-50%" y="-50%" width="200%" height="200%">
                <feGaussianBlur stdDeviation="6" result="b" />
                <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
              </filter>
            </defs>
            <path className="nr__base" d={race.path} />
            <path className="nr__line" d={race.path} pathLength={1} ref={pathRef} />
            <path className="nr__trail" d={race.path} pathLength={1} ref={trailRef} />
            {race.corners.map((c, i) => (
              <g key={c.n} className="nr__corner" style={{ "--i": i } as CSSProperties} transform={`translate(${c.x} ${c.y})`}>
                <circle r="11" />
                <text dy="4">{c.n}</text>
              </g>
            ))}
            <g ref={dotRef} className="nr__dot" filter="url(#nr-glow)">
              <circle r="9" />
            </g>
          </svg>
        </div>
      </div>
    </section>
  );
}
