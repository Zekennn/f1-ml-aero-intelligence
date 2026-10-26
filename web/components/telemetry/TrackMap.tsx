"use client";

import { RefObject, useEffect, useRef } from "react";
import type { CircuitData, LapTelemetry } from "@/lib/circuitData";

export const MAP_COLOURS = { full: "#22e06b", partial: "#3d8bff", brake: "#ff3b4e" };

type Props = {
  circuit: CircuitData | null;
  tel: LapTelemetry | null;
  /** The simulator calls this every frame with the car's position (track metres). */
  drawDot: RefObject<((x: number, y: number) => void) | null>;
  label: string;
};

/** Track outline coloured by the reference lap's throttle (green full, blue partial, red braking). */
export default function TrackMap({ circuit, tel, drawDot, label }: Props) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const wrap = wrapRef.current;
    if (!canvas || !wrap) return;
    const ctx = canvas.getContext("2d")!;
    const bg = document.createElement("canvas");
    let toScreen = (x: number, y: number) => [x, y];
    let last: [number, number] | null = null;

    const paint = () => {
      const r = wrap.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const w = Math.max(1, Math.round(r.width * dpr));
      const h = Math.max(1, Math.round(r.height * dpr));
      canvas.width = bg.width = w;
      canvas.height = bg.height = h;
      const g = bg.getContext("2d")!;
      g.clearRect(0, 0, w, h);
      if (!circuit) return;

      const { x, y } = circuit.outline;
      const minX = Math.min(...x), maxX = Math.max(...x), minY = Math.min(...y), maxY = Math.max(...y);
      const pad = 28 * dpr;
      const k = Math.min((w - 2 * pad) / (maxX - minX || 1), (h - 2 * pad) / (maxY - minY || 1));
      const ox = (w - (maxX - minX) * k) / 2;
      const oy = (h - (maxY - minY) * k) / 2;
      toScreen = (px: number, py: number) => [ox + (px - minX) * k, h - (oy + (py - minY) * k)];

      // Wide pale track, then the coloured racing line
      g.lineCap = "round";
      g.lineJoin = "round";
      g.strokeStyle = "rgba(255,255,255,0.09)";
      g.lineWidth = 12 * dpr;
      g.beginPath();
      x.forEach((px, i) => {
        const [sx, sy] = toScreen(px, y[i]);
        if (i) g.lineTo(sx, sy);
        else g.moveTo(sx, sy);
      });
      g.closePath();
      g.stroke();

      g.lineWidth = 5 * dpr;
      for (let i = 0; i < x.length; i++) {
        const j = (i + 1) % x.length;
        const colour = !tel ? "#56627a" : tel.brake[i] ? MAP_COLOURS.brake : tel.throttle[i] >= 95 ? MAP_COLOURS.full : MAP_COLOURS.partial;
        const [ax, ay] = toScreen(x[i], y[i]);
        const [bx, by] = toScreen(x[j], y[j]);
        g.strokeStyle = colour;
        g.beginPath();
        g.moveTo(ax, ay);
        g.lineTo(bx, by);
        g.stroke();
      }

      // Start/finish line
      const [sx, sy] = toScreen(x[0], y[0]);
      g.fillStyle = "#FFFFFF";
      g.fillRect(sx - 3 * dpr, sy - 9 * dpr, 6 * dpr, 18 * dpr);

      // Corner numbers
      g.font = `600 ${10 * dpr}px Inter, system-ui, sans-serif`;
      g.textAlign = "center";
      g.textBaseline = "middle";
      for (const c of circuit.corners) {
        const [cx, cy] = toScreen(c.x, c.y);
        g.fillStyle = "rgba(10,18,34,0.92)";
        g.beginPath();
        g.arc(cx, cy, 8 * dpr, 0, Math.PI * 2);
        g.fill();
        g.fillStyle = "#eaf0fc";
        g.fillText(String(c.n), cx, cy + 0.5 * dpr);
      }
      draw(last);
    };

    const draw = (pos: [number, number] | null) => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(bg, 0, 0);
      if (!pos || !circuit) return;
      const dpr = canvas.width / Math.max(1, wrap.getBoundingClientRect().width);
      const [px, py] = toScreen(pos[0], pos[1]);
      ctx.fillStyle = "#ff2d55";
      ctx.strokeStyle = "#FFFFFF";
      ctx.lineWidth = 3 * dpr;
      ctx.beginPath();
      ctx.arc(px, py, 8 * dpr, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    };

    // eslint-disable-next-line react-hooks/immutability
    drawDot.current = (x, y) => {
      last = [x, y];
      draw(last);
    };
    const ro = new ResizeObserver(paint);
    ro.observe(wrap);
    paint();
    return () => {
      ro.disconnect();
      drawDot.current = null;
    };
  }, [circuit, tel, drawDot]);

  return (
    <div className="tl-map__canvas" ref={wrapRef}>
      <canvas ref={canvasRef} role="img" aria-label={label} />
      {!circuit && <p className="tl-map__empty">Choose a circuit to see the track.</p>}
    </div>
  );
}
