"use client";

import { useEffect, useRef } from "react";
import { clamp, lerp, onFrame } from "./engine";

const LEDS = 15;

/**
 * Page-level motion chrome for the landing page:
 * - steering-wheel shift lights that fill as you scroll (green → red → blue)
 * - a cursor ring that trails the pointer and swells over anything clickable
 */
export default function Chrome() {
  const ledsRef = useRef<HTMLDivElement>(null);
  const gearRef = useRef<HTMLElement>(null);
  const ring = useRef<HTMLDivElement>(null);
  const dot = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const leds = Array.from(ledsRef.current?.children ?? []) as HTMLElement[];
    const fine = window.matchMedia("(pointer: fine)").matches && !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const pos = { x: -100, y: -100, tx: -100, ty: -100, s: 1, ts: 1 };
    let lastLit = -1;

    const move = (e: PointerEvent) => {
      pos.tx = e.clientX;
      pos.ty = e.clientY;
      const t = e.target as Element | null;
      const hot = t?.closest?.("a, button, input, [role=radio], .tool");
      pos.ts = hot ? 2.4 : 1;
      ring.current?.classList.toggle("is-hot", !!hot);
      ring.current?.classList.toggle("is-air", !hot && !!t?.closest?.(".hx"));
    };
    const down = () => (pos.ts *= 0.7);
    if (fine) {
      document.documentElement.classList.add("has-cursor");
      window.addEventListener("pointermove", move, { passive: true });
      window.addEventListener("pointerdown", down);
    }

    const off = onFrame((f) => {
      const max = document.documentElement.scrollHeight - window.innerHeight;
      const p = clamp(max > 0 ? f.y / max : 0);
      const lit = Math.round(p * LEDS);
      if (lit !== lastLit) {
        lastLit = lit;
        leds.forEach((el, i) => el.classList.toggle("is-on", i < lit));
        ledsRef.current?.classList.toggle("is-max", lit >= LEDS);
        if (gearRef.current) gearRef.current.textContent = p < 0.02 ? "N" : String(Math.min(8, 1 + Math.floor(p * 8)));
      }

      if (!fine) return;
      pos.x = lerp(pos.x, pos.tx, 0.2);
      pos.y = lerp(pos.y, pos.ty, 0.2);
      pos.s = lerp(pos.s, pos.ts, 0.15);
      if (ring.current) ring.current.style.transform = `translate3d(${pos.x}px, ${pos.y}px, 0) scale(${pos.s})`;
      if (dot.current) dot.current.style.transform = `translate3d(${pos.tx}px, ${pos.ty}px, 0)`;
    });

    return () => {
      off();
      document.documentElement.classList.remove("has-cursor");
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerdown", down);
    };
  }, []);

  return (
    <>
      <div className="shift" aria-hidden="true">
        <b className="shift__gear" ref={gearRef}>N</b>
        <div className="shift__leds" ref={ledsRef}>
          {Array.from({ length: LEDS }, (_, i) => (
            <i key={i} className={i < 5 ? "g" : i < 10 ? "r" : "b"} />
          ))}
        </div>
      </div>
      <div className="cursor-ring" ref={ring} aria-hidden="true" />
      <div className="cursor-dot" ref={dot} aria-hidden="true" />
    </>
  );
}
