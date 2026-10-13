import type { AeroResult } from "@/lib/aeroPhysics";
import { activeFlapAnchors, CarPose, drawCar, FRONT_AXLE_X, FRONT_RADIUS, REAR_AXLE_X, REAR_RADIUS } from "./car";
import { FlowState, Sample, sampleFlow, SPEED_COLOURS, speedBucket } from "./flow";

export type View = "particles" | "streamlines";

export type EngineParams = {
  speed: number;
  pose: CarPose; // wing and flap angles for the current setup and mode
  open: number; // 0 = Corner Mode (flaps closed), 1 = Straight Mode (flaps open)
  load: number; // rear wing loading 0-1, from the physics coefficients
  wake: number; // drag level 0-1, from CdA
  forces: AeroResult;
  playing: boolean;
  view: View;
  showArrows: boolean;
  density: number;
  still: boolean; // prefers-reduced-motion: draw a static streamline image instead of animating
};

export type Probe = { kind: "air"; kmh: number; ratio: number } | { kind: "car" } | { kind: "road" };

const X_MIN = -0.5; // metres of tunnel that are always in view (car runs from 0 to ~5.3 m)
const X_SPAN = 7.6;
const GROUND_M = 0.45; // depth of the rolling road band
const M_PER_N = 1.0 / 8000; // force arrow length: 1 m per 8 kN
const AERO_RATE = 10; // easing rate for flaps and flow (about 95% of the way in 0.3 s)
const FLOW_RATE = 3.2; // on-screen metres per second at 330 km/h
const STREAM_STEP = 0.02; // streamline integration step (m of free-stream travel)
const DOT_SPACING = 50; // streamline steps between moving dots
const LABEL_H = 22; // force label height, CSS px

const BG = "#0B1F3A";

type Streamline = { xs: Float32Array; ys: Float32Array; n: number; b: Uint8Array };

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

function layer() {
  const c = document.createElement("canvas");
  return { canvas: c, ctx: c.getContext("2d")! };
}

/** Draws and animates the wind tunnel on a canvas. Owned by TunnelCanvas; no React inside. */
export class TunnelEngine {
  params: EngineParams;

  private ctx: CanvasRenderingContext2D;
  private bg = layer(); // tunnel, grid and road (static)
  private trails = layer(); // particle trails, faded a little every frame
  private overlay = layer(); // legend and scale bar (static)
  private w = 0;
  private h = 0;
  private cssW = 0;
  private get compact() {
    return this.cssW < 640;
  }
  private dpr = 1;
  private k = 1; // device pixels per metre
  private ox = 0; // device-pixel position of the world origin
  private oy = 0;
  private x0 = 0; // visible world extents
  private x1 = 0;
  private y1 = 0;

  private px = new Float32Array(0);
  private py = new Float32Array(0);
  private life = new Float32Array(0);

  private s = 0; // free-stream distance travelled, drives particles, eddies, dots and wheels
  private last = 0;
  // Eased towards params
  private shown = { speed: 0, open: 0, load: 0, wake: 0, drag: 0, front: 0, rear: 0 };
  private pose: CarPose = { frontFlap: 0, rearFlap: 0, rearClosed: 0, rearMain: 0 };
  private flow: FlowState = { speed: 0, load: 0, wake: 0, open: 0, s: 0 };
  private probe: Sample = { u: 0, v: 0, inside: false };

  private lines: Streamline[] = [];
  private linePaths: Path2D[] = [];
  private linesKey = "";
  private font: string;

  constructor(private canvas: HTMLCanvasElement, params: EngineParams) {
    this.ctx = canvas.getContext("2d")!;
    this.params = params;
    this.font = getComputedStyle(canvas).fontFamily || "Inter, system-ui, sans-serif";
    this.snap();
  }

  resize(cssW: number, cssH: number, dpr: number) {
    const w = Math.max(1, Math.round(cssW * dpr));
    const h = Math.max(1, Math.round(cssH * dpr));
    this.cssW = cssW;
    this.dpr = dpr;
    this.w = w;
    this.h = h;
    for (const c of [this.canvas, this.bg.canvas, this.trails.canvas, this.overlay.canvas]) {
      c.width = w;
      c.height = h;
    }
    this.k = Math.min(w / X_SPAN, h / 2.4);
    this.ox = w / 2 - (X_MIN + X_SPAN / 2) * this.k;
    this.oy = h - Math.max(GROUND_M * this.k, 34 * dpr);
    this.x0 = -this.ox / this.k;
    this.x1 = (w - this.ox) / this.k;
    this.y1 = this.oy / this.k;
    this.linesKey = "";
    this.syncCount(true);
    this.paintBackground();
    this.paintOverlay();
  }

  /** Advance one animation frame. */
  frame(now: number) {
    const dt = this.last ? Math.min(0.05, (now - this.last) / 1000) : 1 / 60;
    this.last = now;
    if (this.params.still) return this.drawStill();

    this.ease(dt);
    this.syncCount(false);
    const playing = this.params.playing;
    if (playing) this.s += (dt * FLOW_RATE * this.shown.speed) / 330;
    this.draw(playing ? dt : 0, true);
  }

  /** Redraw without advancing time (after a resize, or for reduced motion). */
  drawStill() {
    if (!this.w) return;
    if (this.params.still) {
      this.snap();
      this.draw(0, false);
    } else this.draw(0, true);
  }

  /** Forget the frame clock, so resuming after a pause doesn't jump. */
  resetClock() {
    this.last = 0;
  }

  /** What the air is doing under a point given in CSS pixels, for the hover tooltip. */
  sample(cssX: number, cssY: number): Probe {
    const x = (cssX * this.dpr - this.ox) / this.k;
    const y = (this.oy - cssY * this.dpr) / this.k;
    if (y < 0) return { kind: "road" };
    const f = sampleFlow(x, y, { ...this.flow, s: this.s }, this.probe, true);
    if (f.inside) return { kind: "car" };
    const ratio = Math.hypot(f.u, f.v);
    return { kind: "air", ratio, kmh: ratio * this.shown.speed };
  }

  // ---------- state ----------

  /** Jump the eased values straight to their targets. */
  private snap() {
    const p = this.params;
    this.shown = {
      speed: clamp(p.speed || 0, 0, 400),
      open: p.open,
      load: p.load,
      wake: p.wake,
      drag: p.forces.drag,
      front: p.forces.front,
      rear: p.forces.rear,
    };
    this.pose = { ...p.pose };
    this.syncFlow();
  }

  private ease(dt: number) {
    const p = this.params;
    const a = this.shown;
    const k = (rate: number) => 1 - Math.exp(-dt * rate);
    const aero = k(AERO_RATE);
    a.speed += (clamp(p.speed || 0, 0, 400) - a.speed) * k(5);
    a.open += (p.open - a.open) * aero;
    a.load += (p.load - a.load) * aero;
    a.wake += (p.wake - a.wake) * aero;
    a.drag += (p.forces.drag - a.drag) * k(8);
    a.front += (p.forces.front - a.front) * k(8);
    a.rear += (p.forces.rear - a.rear) * k(8);
    for (const key of ["frontFlap", "rearFlap", "rearClosed", "rearMain"] as const) {
      this.pose[key] += (p.pose[key] - this.pose[key]) * aero;
    }
    this.syncFlow();
  }

  private syncFlow() {
    this.flow.speed = this.shown.speed;
    this.flow.load = this.shown.load;
    this.flow.wake = this.shown.wake;
    this.flow.open = this.shown.open;
    this.flow.s = this.s;
  }

  /** Match the particle count to the density setting; fewer particles on small screens. */
  private syncCount(force: boolean) {
    const base = this.cssW < 640 ? 450 : 1300;
    const n = Math.round(base * clamp(this.params.density, 0.25, 2));
    if (!force && n === this.px.length) return;
    const keep = Math.min(n, this.px.length);
    const px = new Float32Array(n);
    const py = new Float32Array(n);
    const life = new Float32Array(n);
    px.set(this.px.subarray(0, keep));
    py.set(this.py.subarray(0, keep));
    life.set(this.life.subarray(0, keep));
    this.px = px;
    this.py = py;
    this.life = life;
    for (let i = force ? 0 : keep; i < n; i++) this.spawn(i, true);
  }

  private spawn(i: number, anywhere: boolean) {
    this.px[i] = anywhere ? this.x0 + Math.random() * (this.x1 - this.x0) : this.x0 - Math.random() * 0.4;
    this.py[i] = 0.01 + Math.random() * (this.y1 - 0.01);
    this.life[i] = 5 + Math.random() * 7;
  }

  // ---------- drawing ----------

  private draw(dt: number, animate: boolean) {
    const c = this.ctx;
    const p = this.params;
    c.setTransform(1, 0, 0, 1, 0, 0);
    c.drawImage(this.bg.canvas, 0, 0);
    this.drawRoad();

    if (animate && p.view === "particles") {
      if (dt > 0) this.stepParticles(dt);
      c.drawImage(this.trails.canvas, 0, 0);
    } else this.drawStreamlines(animate);

    c.setTransform(this.k, 0, 0, -this.k, this.ox, this.oy);
    drawCar(c, this.pose, this.dpr / this.k, -this.s / FRONT_RADIUS);
    c.setTransform(1, 0, 0, 1, 0, 0);

    this.drawFlapLabels();
    if (p.showArrows) this.drawArrows(p.forces);
    c.drawImage(this.overlay.canvas, 0, 0);
  }

  private stepParticles(dt: number) {
    const t = this.trails.ctx;
    t.globalCompositeOperation = "destination-out";
    t.fillStyle = `rgba(0,0,0,${1 - Math.pow(0.84, dt * 60)})`;
    t.fillRect(0, 0, this.w, this.h);
    t.globalCompositeOperation = "source-over";

    const paths = SPEED_COLOURS.map(() => new Path2D());
    const move = (FLOW_RATE * this.shown.speed * dt) / 330; // metres per unit of velocity this frame
    const ageing = dt * Math.min(1, this.shown.speed / 100); // particles don't expire in still air
    const { k, ox, oy, x1, y1, px, py, life, flow, probe } = this;

    for (let i = 0; i < px.length; i++) {
      const x = px[i];
      const y = py[i];
      life[i] -= ageing;
      const f = sampleFlow(x, y, flow, probe);
      if (f.inside || life[i] <= 0 || x > x1 + 0.2 || y < 0.003 || y > y1 + 0.3) {
        this.spawn(i, false);
        continue;
      }
      const nx = x + f.u * move;
      const ny = y + f.v * move;
      const path = paths[speedBucket(Math.hypot(f.u, f.v))];
      path.moveTo(ox + x * k, oy - y * k);
      path.lineTo(ox + nx * k, oy - ny * k);
      px[i] = nx;
      py[i] = ny;
    }

    t.lineWidth = 1.3 * this.dpr;
    t.lineCap = "round";
    paths.forEach((path, b) => {
      t.strokeStyle = SPEED_COLOURS[b];
      t.stroke(path);
    });
  }

  /** Streamlines of the steady flow, rebuilt when the shape of the flow changes. */
  private buildStreamlines() {
    const a = this.shown;
    const key = [a.load.toFixed(2), a.wake.toFixed(2), a.open.toFixed(2), Math.round(a.speed / 10), this.w, this.h].join("|");
    if (key === this.linesKey) return;
    this.linesKey = key;

    const f: FlowState = { ...this.flow, s: 0 };
    const tmp: Sample = { u: 0, v: 0, inside: false };
    const { k, ox, oy, x0, x1, y1 } = this;
    const gap = Math.max(0.12, y1 / 30);
    const max = 1400;
    this.lines = [];

    const trace = (startX: number, startY: number) => {
      const line: Streamline = { xs: new Float32Array(max), ys: new Float32Array(max), b: new Uint8Array(max), n: 0 };
      let x = startX;
      let y = startY;
      for (let i = 0; i < max; i++) {
        const s1 = sampleFlow(x, y, f, tmp, true);
        if (s1.inside || y < 0.003 || y > y1 + 0.5 || x > x1 + 0.05) break;
        line.xs[i] = ox + x * k;
        line.ys[i] = oy - y * k;
        line.b[i] = speedBucket(Math.hypot(s1.u, s1.v));
        line.n = i + 1;
        // Midpoint (RK2) step
        const mx = x + (s1.u * STREAM_STEP) / 2;
        const my = y + (s1.v * STREAM_STEP) / 2;
        const s2 = sampleFlow(mx, my, f, tmp, true);
        x += s2.u * STREAM_STEP;
        y += s2.v * STREAM_STEP;
      }
      if (line.n > 1) this.lines.push(line);
    };

    for (let y = gap / 2; y < y1; y += gap) trace(x0 - 0.05, y);
    // Lines that meet the car stop there, so seed the wake directly behind it too.
    for (let y = 0.08; y < 1.4; y += gap) trace(5.7, y);

    this.linePaths = SPEED_COLOURS.map(() => new Path2D());
    for (const l of this.lines) {
      for (let i = 1; i < l.n; i++) {
        const path = this.linePaths[l.b[i]];
        path.moveTo(l.xs[i - 1], l.ys[i - 1]);
        path.lineTo(l.xs[i], l.ys[i]);
      }
    }
  }

  private drawStreamlines(dots: boolean) {
    this.buildStreamlines();
    const c = this.ctx;
    c.lineWidth = 1.2 * this.dpr;
    c.lineCap = "round";
    c.globalAlpha = 0.6;
    this.linePaths.forEach((path, b) => {
      c.strokeStyle = SPEED_COLOURS[b];
      c.stroke(path);
    });
    c.globalAlpha = 1;
    if (!dots) return;

    // Dots step along each line one integration step per STREAM_STEP of travel, so they move at the local air speed.
    const offset = (this.s / STREAM_STEP) % DOT_SPACING;
    const r = 1.8 * this.dpr;
    const paths = SPEED_COLOURS.map(() => new Path2D());
    for (const l of this.lines) {
      for (let j = offset; j < l.n; j += DOT_SPACING) {
        const i = Math.floor(j);
        const path = paths[Math.min(l.b[i] + 1, SPEED_COLOURS.length - 1)];
        path.moveTo(l.xs[i] + r, l.ys[i]);
        path.arc(l.xs[i], l.ys[i], r, 0, Math.PI * 2);
      }
    }
    paths.forEach((path, b) => {
      c.fillStyle = SPEED_COLOURS[b];
      c.fill(path);
    });
  }

  /** Moving dashes on the rolling road. */
  private drawRoad() {
    const c = this.ctx;
    const spacing = 0.6;
    const start = Math.floor(this.x0 / spacing) * spacing + (this.s % spacing);
    c.fillStyle = "rgba(255,255,255,0.12)";
    for (let x = start - spacing; x < this.x1; x += spacing) {
      c.fillRect(this.ox + x * this.k, this.oy + 4 * this.dpr, 0.25 * this.k, 2 * this.dpr);
    }
  }

  /** Front and rear downforce at the axles (from the aero balance), and drag behind the car. */
  private drawArrows(forces: AeroResult) {
    const { k, ox, oy, dpr, shown } = this;
    const sx = (x: number) => ox + x * k;
    const sy = (y: number) => oy - y * k;
    const maxLen = Math.max(0.3, Math.min(2.2, this.y1 - 1.3));
    // Phones: short kN labels so they fit between the arrows
    const fmt = (n: number) => (this.compact ? `${(n / 1000).toFixed(1)} kN` : `${Math.round(n).toLocaleString()} N`);

    // Downforce pushes each axle into the road.
    const front = clamp(shown.front * M_PER_N, 0.15, maxLen);
    const fTip = 2 * FRONT_RADIUS + 0.06;
    this.arrow(sx(FRONT_AXLE_X), sy(fTip + front), sx(FRONT_AXLE_X), sy(fTip), "#1E5EFF", "#FFFFFF");
    // Phones: centre each label above its own arrow so neighbouring labels can't overlap
    const above = (yTail: number) => sy(yTail) - (LABEL_H + 6) * dpr;
    if (this.compact) this.label(fmt(forces.front), sx(FRONT_AXLE_X), above(fTip + front), "center");
    else this.label(`Front ${fmt(forces.front)}`, sx(FRONT_AXLE_X) + 10 * dpr, sy(fTip + front));

    const rear = clamp(shown.rear * M_PER_N, 0.15, maxLen);
    const rTip = 2 * REAR_RADIUS + 0.06;
    this.arrow(sx(REAR_AXLE_X), sy(rTip + rear), sx(REAR_AXLE_X), sy(rTip), "#1E5EFF", "#FFFFFF");
    if (this.compact) this.label(fmt(forces.rear), sx(REAR_AXLE_X), above(rTip + rear), "center");
    else this.label(`Rear ${fmt(forces.rear)}`, sx(REAR_AXLE_X) - 10 * dpr, sy(rTip + rear), "right");

    // Drag acts backwards, the same way the air flows.
    const gx = REAR_AXLE_X + 0.9;
    const gy = 0.5;
    const drag = clamp(shown.drag * M_PER_N, 0.15, Math.max(0.2, this.x1 - gx - 0.15));
    this.arrow(sx(gx), sy(gy), sx(gx + drag), sy(gy), "#E5E7EB", BG);
    // Below the arrow if it fits above the road, otherwise above it.
    const below = sy(gy) + 14 * dpr;
    const labelY = below + LABEL_H * dpr > oy - 4 * dpr ? sy(gy) - (LABEL_H + 12) * dpr : below;
    this.label(`Drag ${fmt(forces.drag)}`, sx(gx), labelY);
  }

  /** "Active front flap" / "Active rear flap" callouts with leader lines. */
  private drawFlapLabels() {
    const { k, ox, oy, dpr } = this;
    const c = this.ctx;
    const a = activeFlapAnchors(this.pose);
    c.font = `600 ${11 * dpr}px ${this.font}`;
    const h = 20 * dpr;
    const width = (text: string) => c.measureText(text).width + 12 * dpr;
    // Label box bottom-left corner (device px) for each callout.
    let items: { text: string; at: [number, number]; x1: number; y1: number }[];
    if (this.compact) {
      // Phones: park both callouts in the top corners, below the legend, clear of the force labels.
      const top = 66 * dpr + h;
      items = [
        { text: "Front flap", at: a.front, x1: 12 * dpr, y1: top },
        { text: "Rear flap", at: a.rear, x1: this.w - width("Rear flap") - 12 * dpr, y1: top },
      ];
    } else {
      items = [
        // Up and to the left of the front wing, clear of the front downforce arrow at the axle
        { text: "Active front flap", at: a.front, x1: ox + Math.max(this.x0 + 0.1, -0.35) * k, y1: oy - 1.0 * k },
        { text: "Active rear flap", at: a.rear, x1: ox + (a.rear[0] + 0.3) * k, y1: oy - (a.rear[1] + 0.55) * k },
      ];
    }
    for (const it of items) {
      const x0 = ox + it.at[0] * k;
      const y0 = oy - it.at[1] * k;
      const { x1, y1 } = it;
      c.strokeStyle = "rgba(30,94,255,0.9)";
      c.lineWidth = 1.5 * dpr;
      c.beginPath();
      c.moveTo(x0, y0);
      c.lineTo(x1, y1);
      c.stroke();
      c.fillStyle = "#1E5EFF";
      c.beginPath();
      c.arc(x0, y0, 2.5 * dpr, 0, Math.PI * 2);
      c.fill();
      const w = width(it.text);
      const lx = clamp(x1, 6 * dpr, this.w - w - 6 * dpr);
      const ly = clamp(y1 - h, 6 * dpr, this.oy - h - 4 * dpr);
      c.beginPath();
      c.roundRect(lx, ly, w, h, 4 * dpr);
      c.fill();
      c.fillStyle = "#FFFFFF";
      c.textAlign = "left";
      c.textBaseline = "middle";
      c.fillText(it.text, lx + 6 * dpr, ly + h / 2 + 0.5 * dpr);
    }
  }

  private arrow(x0: number, y0: number, x1: number, y1: number, fill: string, edge: string) {
    const c = this.ctx;
    const d = this.dpr;
    const len = Math.hypot(x1 - x0, y1 - y0);
    const head = Math.min(13 * d, len * 0.6);
    c.save();
    c.translate(x0, y0);
    c.rotate(Math.atan2(y1 - y0, x1 - x0));
    c.beginPath();
    c.moveTo(0, -3 * d);
    c.lineTo(len - head, -3 * d);
    c.lineTo(len - head, -8 * d);
    c.lineTo(len, 0);
    c.lineTo(len - head, 8 * d);
    c.lineTo(len - head, 3 * d);
    c.lineTo(0, 3 * d);
    c.closePath();
    c.fillStyle = fill;
    c.fill();
    c.lineWidth = 1.5 * d;
    c.strokeStyle = edge;
    c.lineJoin = "round";
    c.stroke();
    c.restore();
  }

  /** Small white label with its top-left (or top-right) corner at (x, y), kept inside the canvas. */
  private label(text: string, x: number, y: number, align: "left" | "right" | "center" = "left") {
    const c = this.ctx;
    const d = this.dpr;
    c.font = `600 ${12 * d}px ${this.font}`;
    const w = c.measureText(text).width + 12 * d;
    const h = LABEL_H * d;
    const lx = clamp(align === "right" ? x - w : align === "center" ? x - w / 2 : x, 6 * d, this.w - w - 6 * d);
    const ly = clamp(y, 6 * d, this.oy - h - 4 * d);
    c.fillStyle = "rgba(255,255,255,0.94)";
    c.beginPath();
    c.roundRect(lx, ly, w, h, 4 * d);
    c.fill();
    c.fillStyle = BG;
    c.textBaseline = "middle";
    c.textAlign = "left";
    c.fillText(text, lx + 6 * d, ly + h / 2 + 0.5 * d);
  }

  private paintBackground() {
    const { ctx: g } = this.bg;
    const { w, h, k, ox, oy, dpr, x0, x1, y1 } = this;
    g.fillStyle = BG;
    g.fillRect(0, 0, w, h);

    g.lineWidth = dpr;
    for (let m = Math.ceil(x0 * 2) / 2; m <= x1; m += 0.5) {
      g.strokeStyle = Number.isInteger(m) ? "rgba(255,255,255,0.075)" : "rgba(255,255,255,0.035)";
      g.beginPath();
      g.moveTo(Math.round(ox + m * k) + 0.5, 0);
      g.lineTo(Math.round(ox + m * k) + 0.5, oy);
      g.stroke();
    }
    for (let m = 0.5; m <= y1; m += 0.5) {
      g.strokeStyle = Number.isInteger(m) ? "rgba(255,255,255,0.075)" : "rgba(255,255,255,0.035)";
      g.beginPath();
      g.moveTo(0, Math.round(oy - m * k) + 0.5);
      g.lineTo(w, Math.round(oy - m * k) + 0.5);
      g.stroke();
    }

    g.fillStyle = "#071629";
    g.fillRect(0, oy, w, h - oy);
    g.strokeStyle = "rgba(255,255,255,0.22)";
    g.beginPath();
    g.moveTo(0, oy + 0.5);
    g.lineTo(w, oy + 0.5);
    g.stroke();
  }

  private paintOverlay() {
    const { ctx: g } = this.overlay;
    const { w, h, k, oy, dpr: d } = this;
    g.clearRect(0, 0, w, h);
    g.textBaseline = "alphabetic";

    // Colour legend (top left), smaller on phones
    g.save();
    if (this.cssW < 640) g.scale(0.8, 0.8);
    const lx = 12 * d;
    const ly = 12 * d;
    g.fillStyle = "rgba(11,31,58,0.82)";
    g.strokeStyle = "rgba(255,255,255,0.14)";
    g.lineWidth = d;
    g.beginPath();
    g.roundRect(lx, ly, 136 * d, 58 * d, 6 * d);
    g.fill();
    g.stroke();
    g.fillStyle = "rgba(255,255,255,0.88)";
    g.font = `600 ${11 * d}px ${this.font}`;
    g.textAlign = "left";
    g.fillText("Air speed", lx + 10 * d, ly + 18 * d);
    const grad = g.createLinearGradient(lx + 10 * d, 0, lx + 126 * d, 0);
    grad.addColorStop(0, SPEED_COLOURS[0]);
    grad.addColorStop(0.5, SPEED_COLOURS[2]);
    grad.addColorStop(1, "#FFFFFF");
    g.fillStyle = grad;
    g.beginPath();
    g.roundRect(lx + 10 * d, ly + 27 * d, 116 * d, 6 * d, 3 * d);
    g.fill();
    g.fillStyle = "rgba(255,255,255,0.6)";
    g.font = `500 ${10 * d}px ${this.font}`;
    g.fillText("Slow", lx + 10 * d, ly + 48 * d);
    g.textAlign = "right";
    g.fillText("Fast", lx + 126 * d, ly + 48 * d);
    g.restore();

    // Scale bar in metres (on the road band, bottom left)
    const bx = 14 * d;
    const by = oy + Math.min(16 * d, (h - oy) * 0.45);
    g.strokeStyle = "rgba(255,255,255,0.7)";
    g.fillStyle = "rgba(255,255,255,0.7)";
    g.lineWidth = d;
    g.beginPath();
    g.moveTo(bx, by + 0.5);
    g.lineTo(bx + 2 * k, by + 0.5);
    for (let m = 0; m <= 2; m++) {
      g.moveTo(Math.round(bx + m * k) + 0.5, by - 4 * d);
      g.lineTo(Math.round(bx + m * k) + 0.5, by + 0.5);
    }
    g.stroke();
    g.font = `500 ${10 * d}px ${this.font}`;
    g.textAlign = "center";
    const ty = by + 13 * d;
    g.fillText("0", bx, ty);
    g.fillText("1", bx + k, ty);
    g.fillText("2 m", bx + 2 * k, ty);

    g.textAlign = "right";
    g.fillStyle = "rgba(255,255,255,0.35)";
    g.fillText("Rolling road", w - 14 * d, ty);
  }
}
