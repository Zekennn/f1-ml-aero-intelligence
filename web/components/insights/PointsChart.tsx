"use client";

import { PointerEvent, useState } from "react";

export type Series = { name: string; code: string; values: number[] };

// Validated categorical palette (dataviz skill), fixed order: P1 → P5
export const SERIES_COLOURS = ["#3d8bff", "#ff7a3d", "#22e0a0", "#ffc23d", "#ff7ab0"];

const W = 760;
const H = 320;
const PAD = { l: 44, r: 92, t: 12, b: 34 };

/** Cumulative points after each round for the top drivers, with a crosshair tooltip. */
export default function PointsChart({ series, rounds }: { series: Series[]; rounds: { round: number; name: string }[] }) {
  const [hover, setHover] = useState<number | null>(null);
  const n = rounds.length;
  const max = Math.max(10, ...series.flatMap((s) => s.values));
  const step = max > 300 ? 100 : max > 120 ? 50 : 25;
  const top = Math.ceil(max / step) * step;
  const ticks = Array.from({ length: top / step + 1 }, (_, i) => i * step);
  const px = (i: number) => PAD.l + (n <= 1 ? 0 : (i / (n - 1)) * (W - PAD.l - PAD.r));
  const py = (v: number) => H - PAD.b - (v / top) * (H - PAD.t - PAD.b);

  // End labels: keep them at least 14px apart
  const ends = series.map((s, i) => ({ i, y: py(s.values[n - 1] ?? 0) })).sort((a, b) => a.y - b.y);
  for (let k = 1; k < ends.length; k++) ends[k].y = Math.max(ends[k].y, ends[k - 1].y + 14);
  const endY = Object.fromEntries(ends.map((e) => [e.i, e.y]));

  function onMove(e: PointerEvent<SVGSVGElement>) {
    const r = e.currentTarget.getBoundingClientRect();
    const x = ((e.clientX - r.left) / r.width) * W;
    const i = Math.round(((x - PAD.l) / (W - PAD.l - PAD.r)) * (n - 1));
    setHover(Math.max(0, Math.min(n - 1, i)));
  }

  return (
    <figure className="ins-chart">
      <div className="ins-chart__plot">
        <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Line chart of cumulative points per round for the top five drivers" onPointerMove={onMove} onPointerLeave={() => setHover(null)}>
          {ticks.map((t) => (
            <g key={t}>
              <line x1={PAD.l} x2={W - PAD.r} y1={py(t)} y2={py(t)} className="ins-gridline" />
              <text x={PAD.l - 8} y={py(t)} className="ins-tick" textAnchor="end" dominantBaseline="middle">{t}</text>
            </g>
          ))}
          {rounds.map((r, i) => (i % 2 === 0 || i === n - 1) && (
            <text key={r.round} x={px(i)} y={H - 12} className="ins-tick" textAnchor="middle">R{r.round}</text>
          ))}
          {series.map((s, si) => (
            <path key={s.code} d={s.values.map((v, i) => `${i ? "L" : "M"}${px(i).toFixed(1)},${py(v).toFixed(1)}`).join("")}
              fill="none" stroke={SERIES_COLOURS[si]} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
          ))}
          {series.map((s, si) => (
            <text key={s.code} x={W - PAD.r + 8} y={endY[si]} className="ins-end" dominantBaseline="middle">
              <tspan fill={SERIES_COLOURS[si]}>●</tspan> {s.code} {s.values[n - 1]}
            </text>
          ))}
          {hover !== null && (
            <g>
              <line x1={px(hover)} x2={px(hover)} y1={PAD.t} y2={H - PAD.b} className="ins-cross" />
              {series.map((s, si) => (
                <circle key={s.code} cx={px(hover)} cy={py(s.values[hover])} r={4} fill={SERIES_COLOURS[si]} stroke="#fff" strokeWidth={2} />
              ))}
            </g>
          )}
        </svg>
        {hover !== null && (
          <div className={`ins-tip${hover > n * 0.6 ? " ins-tip--left" : ""}`} style={{ left: `${(px(hover) / W) * 100}%` }}>
            <strong>R{rounds[hover].round} · {rounds[hover].name.replace(" Grand Prix", "")}</strong>
            {[...series].map((s, si) => ({ s, si })).sort((a, b) => b.s.values[hover] - a.s.values[hover]).map(({ s, si }) => (
              <span key={s.code}><i style={{ background: SERIES_COLOURS[si] }} /> {s.name} <b>{s.values[hover]} pts</b></span>
            ))}
          </div>
        )}
      </div>
      <figcaption className="ins-legend">
        {series.map((s, si) => <span key={s.code}><i style={{ background: SERIES_COLOURS[si] }} /> {s.name}</span>)}
      </figcaption>
    </figure>
  );
}
