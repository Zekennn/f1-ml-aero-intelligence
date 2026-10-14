"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { aeroForces, coefficients, topSpeedKmh } from "@/lib/aeroPhysics";
import { FLAP_ANGLES, MODES, type ModeId } from "@/lib/car2026";
import { clamp, lerp, onFrame } from "./engine";
import { Magnetic, SplitText } from "./primitives";

/*
 * Hero: a live wind-tunnel stream — straight, uninterrupted airflow.
 *
 * Particles run right → left in lanes; each lane has its own speed, so the stream is
 * coloured by speed like a CFD plot (blue = slow, red = fast). Straight Mode pushes the
 * whole stream faster and hotter, Corner Mode slows it down. The pointer is the only
 * body in the tunnel: a cylinder in potential flow that the air parts around.
 */

const PALETTE = ["#2340ff", "#0a8dff", "#00d0ff", "#2df5c4", "#d6f75a", "#ffb12e", "#ff4b2b", "#ff2d6f"];
const BUCKETS = 28;

const RHO = 1.2;
const CORNER_KMH = 228;
const STRAIGHT_KMH = topSpeedKmh(RHO, coefficients("medium", "straight").CdA);

function hexToRgb(h: string) {
  const n = parseInt(h.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
const COLOURS = Array.from({ length: BUCKETS }, (_, i) => {
  const t = (i / (BUCKETS - 1)) * (PALETTE.length - 1);
  const a = hexToRgb(PALETTE[Math.floor(t)]);
  const b = hexToRgb(PALETTE[Math.min(PALETTE.length - 1, Math.floor(t) + 1)]);
  const f = t - Math.floor(t);
  return `rgba(${a.map((c, k) => Math.round(lerp(c, b[k], f))).join(",")},0.8)`;
});

type Props = { season: number; completed: number; total: number };

export default function AeroHero({ season, completed, total }: Props) {
  const sectionRef = useRef<HTMLElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const hudRef = useRef<HTMLDivElement>(null);
  const readouts = useRef<Record<string, HTMLElement | null>>({});

  const [mode, setMode] = useState<ModeId>("straight");
  const [autoCycle, setAutoCycle] = useState(true);
  const modeRef = useRef<ModeId>(mode);
  useEffect(() => {
    modeRef.current = mode;
  }, [mode]);

  // Demo: flip between the two active-aero modes until the visitor takes over
  useEffect(() => {
    if (!autoCycle) return;
    const id = window.setInterval(() => setMode((m) => (m === "straight" ? "corner" : "straight")), 4200);
    return () => clearInterval(id);
  }, [autoCycle]);

  const choose = (m: ModeId) => {
    setAutoCycle(false);
    setMode(m);
  };

  /* ---------------- Flow simulation ---------------- */
  useEffect(() => {
    const section = sectionRef.current!;
    const canvas = canvasRef.current!;
    const ctx = canvas.getContext("2d", { alpha: false })!;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    let W = 0, H = 0, dpr = 1;
    let N = 0;
    let px = new Float32Array(0), py = new Float32Array(0), age = new Float32Array(0);
    const buckets: number[][] = Array.from({ length: BUCKETS }, () => []);
    const segX0: number[] = [], segY0: number[] = [];

    let ps = new Float32Array(0); // each particle's own speed factor (its lane)
    const pointer = { x: -9999, y: -9999, tx: -9999, ty: -9999, r: 0, tr: 0 };

    // Eased simulation state (follows the active-aero mode)
    let speed = 1; // stream speed multiplier
    let heat = 0; // shifts the colours towards the fast end in Straight Mode
    let visible = true;

    function resize() {
      const r = section.getBoundingClientRect();
      dpr = Math.min(2, window.devicePixelRatio || 1);
      W = r.width;
      H = r.height;
      canvas.width = Math.round(W * dpr);
      canvas.height = Math.round(H * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.fillStyle = "#03070e";
      ctx.fillRect(0, 0, W, H);
      N = Math.min(2200, Math.round((W * H) / (W < 700 ? 900 : 620)));
      px = new Float32Array(N);
      py = new Float32Array(N);
      ps = new Float32Array(N);
      age = new Float32Array(N);
      for (let i = 0; i < N; i++) spawn(i, true);
      if (reduced) drawStatic();
    }

    // Lane speed: slow broad bands and a little per-particle jitter
    const laneSpeed = (y: number) => 0.95 + 0.38 * Math.sin(y * 0.011) + 0.22 * Math.sin(y * 0.037 + 1.3);

    function spawn(i: number, anywhere = false) {
      px[i] = anywhere ? Math.random() * W : W + Math.random() * 60;
      py[i] = Math.random() * H;
      ps[i] = laneSpeed(py[i]) * (0.9 + Math.random() * 0.2);
      age[i] = 0;
    }

    // Velocity at (x, y): uniform stream right → left, parted by the pointer. False inside it.
    const vel = { x: 0, y: 0 };
    function field(x: number, y: number, S: number) {
      let A = 1, B = 0;
      const R2 = pointer.r * pointer.r;
      if (R2 > 1) {
        const dx = x - pointer.x, dy = y - pointer.y;
        const r2 = dx * dx + dy * dy;
        if (r2 < R2 * 0.92) return false;
        const f = R2 / (r2 * r2);
        A -= f * (dx * dx - dy * dy);
        B += f * 2 * dx * dy;
      }
      vel.x = -S * A;
      vel.y = S * B;
      return true;
    }

    const bucketOf = (m: number) => Math.round(clamp((m - 0.45 + heat) / 1.25) * (BUCKETS - 1));

    function drawStatic() {
      // Reduced motion: still, straight streamlines
      ctx.fillStyle = "#03070e";
      ctx.fillRect(0, 0, W, H);
      ctx.lineWidth = 1;
      ctx.globalCompositeOperation = "lighter";
      for (let y = 4; y < H; y += 9) {
        ctx.strokeStyle = COLOURS[bucketOf(laneSpeed(y))];
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(W, y);
        ctx.stroke();
      }
      ctx.globalCompositeOperation = "source-over";
    }

    function step(dtScale: number) {
      const target = modeRef.current;
      speed = lerp(speed, target === "straight" ? 1.3 : 0.85, 0.04);
      heat = lerp(heat, target === "straight" ? 0.22 : -0.12, 0.04);

      pointer.x = lerp(pointer.x, pointer.tx, 0.2);
      pointer.y = lerp(pointer.y, pointer.ty, 0.2);
      pointer.r = lerp(pointer.r, pointer.tr, 0.12);

      const S = (W < 700 ? 4.2 : 5.6) * speed * dtScale;

      // Fade the previous frame to leave short trails
      ctx.globalCompositeOperation = "source-over";
      ctx.fillStyle = "rgba(3,7,14,0.17)";
      ctx.fillRect(0, 0, W, H);

      for (const b of buckets) b.length = 0;
      segX0.length = segY0.length = N;
      for (let i = 0; i < N; i++) {
        const x = px[i], y = py[i];
        const Si = S * ps[i];
        if (!field(x, y, Si)) {
          spawn(i);
          continue;
        }
        segX0[i] = x;
        segY0[i] = y;
        px[i] = x + vel.x;
        py[i] = y + vel.y;
        age[i] += dtScale;
        if (px[i] < -20 || py[i] < -20 || py[i] > H + 20) {
          spawn(i);
          continue;
        }
        if (age[i] < 2) continue; // skip the first frame after a respawn (no streak across the screen)
        buckets[bucketOf(Math.hypot(vel.x, vel.y) / S)].push(i);
      }

      ctx.globalCompositeOperation = "lighter";
      ctx.lineWidth = W < 700 ? 1 : 1.25;
      ctx.lineCap = "round";
      for (let b = 0; b < BUCKETS; b++) {
        const list = buckets[b];
        if (!list.length) continue;
        ctx.strokeStyle = COLOURS[b];
        ctx.beginPath();
        for (const i of list) {
          ctx.moveTo(segX0[i], segY0[i]);
          ctx.lineTo(px[i], py[i]);
        }
        ctx.stroke();
      }
    }

    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(section);
    const io = new IntersectionObserver(([e]) => (visible = e.isIntersecting));
    io.observe(section);

    const onMove = (e: PointerEvent) => {
      const r = section.getBoundingClientRect();
      pointer.tx = e.clientX - r.left;
      pointer.ty = e.clientY - r.top;
      if (pointer.x < -999) {
        pointer.x = pointer.tx;
        pointer.y = pointer.ty;
      }
      pointer.tr = W < 700 ? 34 : 54;
    };
    const onLeave = () => (pointer.tr = 0);
    section.addEventListener("pointermove", onMove);
    section.addEventListener("pointerleave", onLeave);

    let last = performance.now();
    let hudTick = 0;
    let shownSpeed = 300;
    const off = onFrame((f) => {
      // Scroll-out choreography: content lifts away, the stream fades
      const p = clamp(f.y / Math.max(1, H));
      if (contentRef.current) {
        contentRef.current.style.transform = `translate3d(0, ${-p * 140}px, 0)`;
        contentRef.current.style.opacity = String(1 - p * 1.6);
      }
      if (hudRef.current) hudRef.current.style.opacity = String(1 - p * 2);
      canvas.style.opacity = String(1 - p * 0.75);

      const dtScale = clamp((f.t - last) / 16.67, 0.25, 3);
      last = f.t;
      if (!visible || document.hidden || reduced) return;
      step(dtScale);

      // Telemetry readouts, from the same physics as the Aero calculator
      if (f.t - hudTick > 90) {
        hudTick = f.t;
        const m = modeRef.current;
        const c = coefficients("medium", m);
        const target = m === "straight" ? STRAIGHT_KMH : CORNER_KMH;
        shownSpeed = lerp(shownSpeed, target + Math.sin(f.t / 300) * 1.5, 0.18);
        const res = aeroForces(shownSpeed, RHO, c);
        const set = (k: string, v: string) => {
          const el = readouts.current[k];
          if (el && el.textContent !== v) el.textContent = v;
        };
        set("speed", Math.round(shownSpeed).toString());
        set("drag", (res.drag / 1000).toFixed(2));
        set("df", (res.downforce / 1000).toFixed(2));
        set("kg", Math.round(res.downforceKg).toLocaleString("en-GB"));
        set("ld", res.ld.toFixed(2));
        if (readouts.current.bar) readouts.current.bar.style.transform = `scaleX(${clamp(shownSpeed / 360)})`;
      }
    });

    const onVis = () => (last = performance.now());
    document.addEventListener("visibilitychange", onVis);

    return () => {
      off();
      ro.disconnect();
      io.disconnect();
      section.removeEventListener("pointermove", onMove);
      section.removeEventListener("pointerleave", onLeave);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, []);

  const flap = (m: ModeId) => `${FLAP_ANGLES.rear[m].medium}°`;

  return (
    <section className="hx" id="home" ref={sectionRef} data-mode={mode}>
      <canvas className="hx__canvas" ref={canvasRef} aria-hidden="true" />
      <div className="hx__vignette" aria-hidden="true" />

      <div className="container hx__content" ref={contentRef}>
        <p className="hx__eyebrow hx-in" style={{ "--d": 0 } as React.CSSProperties}>
          <span className="live-dot" /> {season} season · round {completed} of {total}
        </p>
        <h1 className="hx__title">
          <span className="hx__line"><SplitText text="See the air." /></span>
          <span className="hx__line hx__line--outline"><SplitText text="Read the race." offset={10} /></span>
        </h1>
        <p className="hx__lede hx-in" style={{ "--d": 8 } as React.CSSProperties}>
          Live 2026 telemetry, a championship model and a wind tunnel you can play with. Move your cursor through the
          stream — you&apos;re the obstacle now.
        </p>
        <div className="hx__actions hx-in" style={{ "--d": 10 } as React.CSSProperties}>
          <Magnetic>
            <Link href="/aero" className="mbtn mbtn--hot">
              <span>Enter the wind tunnel</span>
              <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6" /></svg>
            </Link>
          </Magnetic>
          <Magnetic>
            <Link href="/live" className="mbtn mbtn--ghost"><span>Live telemetry</span></Link>
          </Magnetic>
        </div>
      </div>

      <aside className="hx__hud hx-in" ref={hudRef} style={{ "--d": 12 } as React.CSSProperties} aria-label="Active aero simulation">
        <div className="hud__head">
          <span>Active aero</span>
          <button type="button" className="hud__auto" onClick={() => setAutoCycle(true)} disabled={autoCycle} title="Switch modes automatically again">
            {autoCycle ? "auto" : "manual · resume auto"}
          </button>
        </div>
        <div className="hud__toggle" role="radiogroup" aria-label="Active aero mode">
          {(["corner", "straight"] as ModeId[]).map((m) => (
            <button key={m} type="button" role="radio" aria-checked={mode === m} className={mode === m ? "is-on" : ""} onClick={() => choose(m)}>
              {MODES[m].label.replace(" Mode", "")}
              <small>{MODES[m].short}</small>
            </button>
          ))}
        </div>
        <div className="hud__speed">
          <span ref={(el) => { readouts.current.speed = el; }}>300</span>
          <small>km/h</small>
        </div>
        <div className="hud__bar"><i ref={(el) => { readouts.current.bar = el; }} /></div>
        <dl className="hud__grid">
          <div><dt>Downforce</dt><dd><span ref={(el) => { readouts.current.df = el; }}>0</span> kN</dd></div>
          <div><dt>Drag</dt><dd><span ref={(el) => { readouts.current.drag = el; }}>0</span> kN</dd></div>
          <div><dt>Grip equiv.</dt><dd><span ref={(el) => { readouts.current.kg = el; }}>0</span> kg</dd></div>
          <div><dt>L / D</dt><dd><span ref={(el) => { readouts.current.ld = el; }}>0</span></dd></div>
        </dl>
        <p className="hud__foot">Rear flap {flap(mode)} · {MODES[mode].description}</p>
      </aside>

      <a href="#ticker" className="hx__cue" aria-label="Scroll to content">
        <span>Scroll</span>
        <i />
      </a>
    </section>
  );
}
