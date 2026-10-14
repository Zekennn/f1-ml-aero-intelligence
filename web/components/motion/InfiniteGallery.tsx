"use client";

import Image from "next/image";
import { CSSProperties, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { GalleryPhoto } from "@/lib/gallery";
import { clamp, lerp, onFrame } from "./engine";

/*
 * Endless drag-anywhere photo gallery.
 *
 * The photos are scattered over a block of cells (each cell gets its own offset, size and depth)
 * that is bigger than the screen, and every tile wraps around the block's edges independently,
 * so the canvas never ends in any direction. Dragging throws it with inertia; when idle it drifts;
 * scrolling the page slides it too. Tiles move at slightly different speeds (depth) and lean and
 * shrink a little with speed. A click without a drag opens the photo full screen.
 */

type Layout = { cell: number; cols: number; rows: number; slots: Slot[] };
type Slot = { photo: number; bx: number; by: number; w: number; h: number; depth: number; delay: number; first: boolean };

// Small deterministic random (same scatter on the server and in the browser)
function rand(seed: number) {
  const x = Math.sin(seed * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
}

function buildLayout(vw: number, vh: number, photos: GalleryPhoto[]): Layout {
  const cell = vw < 700 ? Math.max(200, vw * 0.6) : clamp(vw * 0.24, 280, 420);
  const rows = Math.max(3, Math.ceil(vh / cell) + 2);
  const cols = Math.max(4, Math.ceil(vw / cell) + 2, Math.ceil(photos.length / rows));
  const seen = new Set<number>();
  const slots: Slot[] = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const k = r * cols + c;
      const photo = (r * cols + c + r * 5) % photos.length; // shift each row so copies never stack vertically
      const p = photos[photo];
      const size = cell * (0.5 + rand(k + 1) * 0.26);
      const ratio = p.height / p.width;
      const w = ratio >= 1 ? size / Math.min(ratio, 1.6) : size; // portrait: the long side is `size`
      const h = w * ratio;
      slots.push({
        photo,
        bx: c * cell + (cell - w) * (0.15 + rand(k + 7) * 0.7),
        by: r * cell + (cell - h) * (0.15 + rand(k + 13) * 0.7),
        w,
        h,
        depth: 0.82 + rand(k + 29) * 0.36,
        delay: rand(k + 41) * 0.6,
        first: !seen.has(photo) && (seen.add(photo), true),
      });
    }
  }
  return { cell, cols, rows, slots };
}

const mod = (a: number, n: number) => ((a % n) + n) % n;

export default function InfiniteGallery({ photos }: { photos: GalleryPhoto[] }) {
  const sectionRef = useRef<HTMLElement>(null);
  const viewRef = useRef<HTMLDivElement>(null);
  const tiles = useRef<(HTMLDivElement | null)[]>([]);
  const [layout, setLayout] = useState<Layout | null>(null);
  const [inView, setInView] = useState(false);
  const [open, setOpen] = useState<number | null>(null);
  const openRef = useRef<number | null>(null);
  useEffect(() => {
    openRef.current = open;
  }, [open]);

  // Shared motion state (mutated every frame, never re-rendered)
  const m = useRef({ x: 0, y: 0, vx: 0, vy: 0, dragging: false, speed: 0, lastScroll: 0, reduced: false });

  // Layout follows the viewport size
  useEffect(() => {
    if (!photos.length) return;
    const measure = () => setLayout(buildLayout(window.innerWidth, window.innerHeight, photos));
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, [photos]);

  // Entrance + run the loop only near the screen
  useEffect(() => {
    const el = sectionRef.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => setInView(e.isIntersecting), { rootMargin: "20% 0px" });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  // Frame loop: inertia, idle drift, scroll parallax, wrap-around placement
  useEffect(() => {
    if (!layout || !inView) return;
    const s = m.current;
    s.reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    s.lastScroll = window.scrollY;
    const BW = layout.cols * layout.cell;
    const BH = layout.rows * layout.cell;
    const { cell } = layout;

    return onFrame((f) => {
      const k = f.dt / 16.67;
      // Page scroll slides the canvas the other way (a little faster than the page: parallax)
      const scrolled = window.scrollY - s.lastScroll;
      s.lastScroll = window.scrollY;
      if (!s.dragging && openRef.current === null) {
        if (!s.reduced) {
          s.vx *= Math.pow(0.93, k);
          s.vy *= Math.pow(0.93, k);
          // Idle drift once the throw has settled
          if (Math.abs(s.vx) < 0.4 && Math.abs(s.vy) < 0.4) {
            s.vx = lerp(s.vx, -0.35, 0.02);
            s.vy = lerp(s.vy, -0.12, 0.02);
          }
        } else {
          s.vx = s.vy = 0;
        }
        s.x += s.vx * k;
        s.y += s.vy * k - scrolled * 0.35;
      }
      const speed = Math.hypot(s.vx, s.vy);
      s.speed = lerp(s.speed, s.reduced ? 0 : speed, 0.15);
      const squeeze = 1 - Math.min(0.1, s.speed * 0.006);
      const lean = s.reduced ? 0 : clamp(s.vx * 0.12, -6, 6);

      for (let i = 0; i < layout.slots.length; i++) {
        const el = tiles.current[i];
        if (!el) continue;
        const t = layout.slots[i];
        const x = mod(t.bx + s.x * t.depth + cell, BW) - cell;
        const y = mod(t.by + s.y * t.depth + cell, BH) - cell;
        el.style.transform = `translate3d(${x.toFixed(1)}px, ${y.toFixed(1)}px, 0) rotate(${(lean * t.depth * 0.35).toFixed(2)}deg) scale(${squeeze.toFixed(3)})`;
      }
    });
  }, [layout, inView]);

  /* ---------- Input: drag (mouse/pen anywhere, touch horizontally), sideways wheel, arrow keys ---------- */
  const drag = useRef({ id: -1, x: 0, y: 0, t: 0, moved: 0, photo: -1 });

  const onPointerDown = (e: React.PointerEvent) => {
    if (e.button !== 0) return;
    const d = drag.current;
    const tile = (e.target as Element).closest<HTMLElement>("[data-photo]");
    Object.assign(d, { id: e.pointerId, x: e.clientX, y: e.clientY, t: performance.now(), moved: 0, photo: tile ? Number(tile.dataset.photo) : -1 });
    m.current.dragging = true;
    m.current.vx = m.current.vy = 0;
    viewRef.current?.setPointerCapture(e.pointerId);
    viewRef.current?.classList.add("is-dragging");
  };

  const onPointerMove = (e: React.PointerEvent) => {
    const d = drag.current;
    if (e.pointerId !== d.id || !m.current.dragging) return;
    const now = performance.now();
    const dx = e.clientX - d.x;
    const dy = e.pointerType === "touch" ? 0 : e.clientY - d.y; // touch: vertical swipes scroll the page
    const dt = Math.max(1, now - d.t) / 16.67;
    m.current.x += dx;
    m.current.y += dy;
    m.current.vx = lerp(m.current.vx, dx / dt, 0.6);
    m.current.vy = lerp(m.current.vy, dy / dt, 0.6);
    d.moved += Math.hypot(dx, e.clientY - d.y);
    Object.assign(d, { x: e.clientX, y: e.clientY, t: now });
  };

  const endDrag = (e: React.PointerEvent, cancelled = false) => {
    const d = drag.current;
    if (e.pointerId !== d.id) return;
    m.current.dragging = false;
    viewRef.current?.classList.remove("is-dragging");
    if (!cancelled && d.moved < 6 && d.photo >= 0) setOpen(d.photo); // a click, not a drag
    d.id = -1;
  };

  useEffect(() => {
    const el = viewRef.current;
    if (!el) return;
    // Sideways trackpad swipes pan the gallery; vertical wheel keeps scrolling the page
    const onWheel = (e: WheelEvent) => {
      if (Math.abs(e.deltaX) <= Math.abs(e.deltaY)) return;
      e.preventDefault();
      m.current.vx = clamp(-e.deltaX * 0.35, -40, 40);
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [layout]);

  const onKeyDown = (e: React.KeyboardEvent) => {
    const step = 9;
    const keys: Record<string, [number, number]> = { ArrowLeft: [step, 0], ArrowRight: [-step, 0], ArrowUp: [0, step], ArrowDown: [0, -step] };
    const v = keys[e.key];
    if (!v || e.target !== e.currentTarget) return;
    e.preventDefault();
    m.current.vx = v[0];
    m.current.vy = v[1];
  };

  /* ---------- Lightbox ---------- */
  const step = useCallback((dir: number) => setOpen((i) => (i === null ? i : mod(i + dir, photos.length))), [photos.length]);
  useEffect(() => {
    if (open === null) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(null);
      if (e.key === "ArrowLeft") step(-1);
      if (e.key === "ArrowRight") step(1);
    };
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open, step]);

  const count = useMemo(() => photos.length, [photos]);

  return (
    <section className={`ig ${inView ? "is-in" : ""}`} id="gallery" ref={sectionRef} aria-labelledby="ig-title">
      <div
        className="ig__view"
        ref={viewRef}
        tabIndex={0}
        aria-label="Photo gallery. Drag, or use the arrow keys, to move around. Select a photo to open it."
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={(e) => endDrag(e)}
        onPointerCancel={(e) => endDrag(e, true)}
        onKeyDown={onKeyDown}
      >
        {layout?.slots.map((t, i) => {
          const p = photos[t.photo];
          return (
            <div
              key={i}
              className="ig__tile"
              ref={(el) => { tiles.current[i] = el; }}
              style={{ width: t.w, height: t.h, zIndex: Math.round(t.depth * 100), "--delay": `${t.delay}s` } as CSSProperties}
            >
              <button
                type="button"
                className="ig__card"
                data-photo={t.photo}
                tabIndex={t.first ? 0 : -1}
                aria-hidden={!t.first}
                aria-label={`Open ${p.alt}`}
                onClick={(e) => { if (e.detail === 0) setOpen(t.photo); /* keyboard Enter/Space */ }}
              >
                <Image
                  src={p.src}
                  alt=""
                  fill
                  sizes={`${Math.ceil(t.w)}px`}
                  draggable={false}
                  onLoad={(e) => e.currentTarget.classList.add("is-loaded")}
                />
              </button>
            </div>
          );
        })}
      </div>

      <div className="ig__overlay" aria-hidden="true">
        <span className="ig__shade ig__shade--top" />
        <span className="ig__shade ig__shade--bottom" />
      </div>
      <header className="ig__title">
        <p className="eyebrow-x"><span>{String(count).padStart(2, "0")}</span> Gallery</p>
        <h2 id="ig-title">From the<br />paddock</h2>
        <p className="ig__hint">
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 13V5.5a1.5 1.5 0 0 1 3 0V12M11 11.5v-2a1.5 1.5 0 0 1 3 0V12M14 10.5a1.5 1.5 0 0 1 3 0V12M17 11.5a1.5 1.5 0 0 1 3 0V16a6 6 0 0 1-6 6h-2a6 6 0 0 1-5-2.7L4.2 15a1.6 1.6 0 0 1 2.6-1.8L8 15" /></svg>
          <span className="ig__hint-mouse">Drag to explore · click to open</span>
          <span className="ig__hint-touch">Swipe · tap to open</span>
        </p>
      </header>

      {/* Rendered on <body> so it sits above the navbar (the section is its own stacking layer) */}
      {open !== null && createPortal(
        <div className="lightbox ig-box" role="dialog" aria-modal="true" aria-label="Photo viewer" onClick={(e) => e.target === e.currentTarget && setOpen(null)}>
          <button className="lightbox__close" aria-label="Close" autoFocus onClick={() => setOpen(null)}>&times;</button>
          <button className="lightbox__nav lightbox__nav--prev" aria-label="Previous photo" onClick={() => step(-1)}>&#8249;</button>
          <div className="lightbox__frame" onClick={(e) => e.target === e.currentTarget && setOpen(null)}>
            <Image key={open} src={photos[open].src} alt={photos[open].alt} fill sizes="100vw" className="ig-box__img" />
          </div>
          <button className="lightbox__nav lightbox__nav--next" aria-label="Next photo" onClick={() => step(1)}>&#8250;</button>
          <p className="ig-box__count">{String(open + 1).padStart(2, "0")} / {String(count).padStart(2, "0")}</p>
        </div>,
        document.body,
      )}
    </section>
  );
}
