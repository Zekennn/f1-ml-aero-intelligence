"use client";

import { PointerEvent, useMemo, useState } from "react";
import { aeroForces, coefficients } from "@/lib/aeroPhysics";
import type { SetupId } from "@/lib/car2026";

const MAX_KMH = 350;
const STEP = 10;
const W = 300;
const H = 170;
const PAD = { l: 38, r: 64, t: 10, b: 24 };

const DOWNFORCE = "#36e2ff";
const DRAG = "#ffb12e";

type Props = { setup: SetupId; rho: number; speedKmh: number };

const fmtK = (n: number) => (n >= 1000 ? `${Math.round(n / 1000)}k` : String(Math.round(n)));
const fmtN = (n: number) => `${Math.round(n).toLocaleString()} N`;

/** Drag and downforce against speed (0–350 km/h) for both active aero modes, on one newton axis. */
export default function ForceSpeedChart({ setup, rho, speedKmh }: Props) {
  const [hover, setHover] = useState<number | null>(null);

  const data = useMemo(() => {
    const corner = coefficients(setup, "corner");
    const straight = coefficients(setup, "straight");
    const rows = [];
    for (let s = 0; s <= MAX_KMH; s += STEP) {
      const c = aeroForces(s, rho, corner);
      const x = aeroForces(s, rho, straight);
      rows.push({ s, dfC: c.downforce, dfS: x.downforce, dC: c.drag, dS: x.drag });
    }
    return rows;
  }, [setup, rho]);

  const top = data[data.length - 1].dfC;
  const yMax = Math.ceil(top / 5000) * 5000 || 5000;
  const ticks = [0, yMax / 2, yMax];
  const px = (s: number) => PAD.l + (s / MAX_KMH) * (W - PAD.l - PAD.r);
  const py = (n: number) => H - PAD.b - (n / yMax) * (H - PAD.t - PAD.b);
  const line = (key: "dfC" | "dfS" | "dC" | "dS") => data.map((d, i) => `${i ? "L" : "M"}${px(d.s).toFixed(1)},${py(d[key]).toFixed(1)}`).join("");
  const last = data[data.length - 1];

  function onMove(e: PointerEvent<SVGSVGElement>) {
    const r = e.currentTarget.getBoundingClientRect();
    const s = (((e.clientX - r.left) / r.width) * W - PAD.l) / (W - PAD.l - PAD.r) * MAX_KMH;
    setHover(Math.round(Math.min(MAX_KMH, Math.max(0, s)) / STEP));
  }
  const h = hover === null ? null : data[hover];
  const current = Math.min(MAX_KMH, Math.max(0, speedKmh));

  return (
    <figure className="wt-fchart">
      <div className="wt-fchart__plot">
        <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Line chart of drag and downforce against speed for Corner and Straight Mode" onPointerMove={onMove} onPointerLeave={() => setHover(null)}>
          {ticks.map((t) => (
            <g key={t}>
              <line x1={PAD.l} x2={W - PAD.r} y1={py(t)} y2={py(t)} className="wt-fchart__grid" />
              <text x={PAD.l - 6} y={py(t)} className="wt-fchart__tick" textAnchor="end" dominantBaseline="middle">{fmtK(t)}</text>
            </g>
          ))}
          {[0, 100, 200, 300].map((s) => (
            <text key={s} x={px(s)} y={H - 8} className="wt-fchart__tick" textAnchor="middle">{s}</text>
          ))}
          <text x={W - PAD.r} y={H - 8} className="wt-fchart__tick" textAnchor="end">km/h</text>

          {/* Current speed */}
          <line x1={px(current)} x2={px(current)} y1={PAD.t} y2={H - PAD.b} className="wt-fchart__now" />

          <path d={line("dfC")} stroke={DOWNFORCE} className="wt-fchart__line" />
          <path d={line("dfS")} stroke={DOWNFORCE} className="wt-fchart__line wt-fchart__line--dash" />
          <path d={line("dC")} stroke={DRAG} className="wt-fchart__line" />
          <path d={line("dS")} stroke={DRAG} className="wt-fchart__line wt-fchart__line--dash" />

          {/* Direct labels at the line ends */}
          <text x={W - PAD.r + 4} y={py(last.dfC)} className="wt-fchart__end" dominantBaseline="middle">Downforce</text>
          <text x={W - PAD.r + 4} y={Math.max(py(last.dC), py(last.dfS) + 12)} className="wt-fchart__end" dominantBaseline="middle">Drag</text>

          {h && (
            <g>
              <line x1={px(h.s)} x2={px(h.s)} y1={PAD.t} y2={H - PAD.b} className="wt-fchart__cross" />
              {([["dfC", DOWNFORCE], ["dfS", DOWNFORCE], ["dC", DRAG], ["dS", DRAG]] as const).map(([k, col]) => (
                <circle key={k} cx={px(h.s)} cy={py(h[k])} r={3.5} fill={col} stroke="#03070e" strokeWidth={2} />
              ))}
            </g>
          )}
        </svg>
        {h && (
          <div className={`wt-fchart__tip${h.s > MAX_KMH * 0.55 ? " wt-fchart__tip--left" : ""}`} style={{ left: `${(px(h.s) / W) * 100}%` }}>
            <strong>{h.s} km/h</strong>
            <span><i className="wt-key" style={{ borderColor: DOWNFORCE }} /> Downforce, Corner {fmtN(h.dfC)}</span>
            <span><i className="wt-key wt-key--dash" style={{ borderColor: DOWNFORCE }} /> Downforce, Straight {fmtN(h.dfS)}</span>
            <span><i className="wt-key" style={{ borderColor: DRAG }} /> Drag, Corner {fmtN(h.dC)}</span>
            <span><i className="wt-key wt-key--dash" style={{ borderColor: DRAG }} /> Drag, Straight {fmtN(h.dS)}</span>
          </div>
        )}
      </div>
      <figcaption className="wt-fchart__legend">
        <span><i className="wt-key" style={{ borderColor: DOWNFORCE }} /> Downforce</span>
        <span><i className="wt-key" style={{ borderColor: DRAG }} /> Drag</span>
        <span><i className="wt-key wt-key--plain" /> Corner</span>
        <span><i className="wt-key wt-key--plain wt-key--dash" /> Straight</span>
      </figcaption>
    </figure>
  );
}
