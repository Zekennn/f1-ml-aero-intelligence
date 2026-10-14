"use client";

import { RefObject, useEffect, useRef, useState } from "react";

/*
 * Tiny motion engine for the landing page.
 * One shared requestAnimationFrame loop reports scroll position and a smoothed
 * scroll velocity to every subscriber, so sections never run their own loops
 * or re-render React on every frame — they write styles directly.
 */

export type Frame = { y: number; vy: number; t: number; dt: number };
type Sub = (f: Frame) => void;

const subs = new Set<Sub>();
let running = false;
let lastY = 0;
let lastT = 0;
let vy = 0;

function tick(t: number) {
  const y = window.scrollY;
  const dt = Math.min(64, Math.max(1, t - lastT));
  vy += ((y - lastY) / dt * 16.67 - vy) * 0.14;
  lastY = y;
  lastT = t;
  const frame = { y, vy, t, dt };
  subs.forEach((fn) => fn(frame));
  if (subs.size) requestAnimationFrame(tick);
  else running = false;
}

/** Subscribe to the shared frame loop. Returns an unsubscribe function. */
export function onFrame(fn: Sub) {
  subs.add(fn);
  if (!running) {
    running = true;
    lastY = window.scrollY;
    lastT = performance.now();
    requestAnimationFrame(tick);
  }
  return () => void subs.delete(fn);
}

export const clamp = (v: number, a = 0, b = 1) => Math.min(b, Math.max(a, v));
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
/** Maps v from [a, b] to [0, 1], clamped. */
export const range = (v: number, a: number, b: number) => clamp((v - a) / (b - a));
export const easeOut = (t: number) => 1 - Math.pow(1 - t, 3);
export const easeInOut = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

export function useReducedMotion() {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReduced(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);
  return reduced;
}

/** True once the element has entered the viewport (or while it is in view if once = false). */
export function useInView<T extends Element>(ref: RefObject<T | null>, { once = true, threshold = 0.2, rootMargin = "0px" } = {}) {
  const [inView, setInView] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setInView(true);
          if (once) io.disconnect();
        } else if (!once) setInView(false);
      },
      { threshold, rootMargin },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [ref, once, threshold, rootMargin]);
  return inView;
}

/**
 * Progress (0 → 1) of a tall "pinned" section: 0 when its top reaches the top of the
 * viewport, 1 when its bottom reaches the bottom. The callback runs every frame while
 * the section is near the screen.
 */
export function usePinProgress<T extends HTMLElement>(ref: RefObject<T | null>, cb: (p: number, f: Frame) => void) {
  const cbRef = useRef(cb);
  useEffect(() => {
    cbRef.current = cb;
  });
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    let visible = false;
    const io = new IntersectionObserver(([e]) => (visible = e.isIntersecting), { rootMargin: "50% 0px" });
    io.observe(el);
    const off = onFrame((f) => {
      if (!visible) return;
      const r = el.getBoundingClientRect();
      const span = r.height - window.innerHeight;
      cbRef.current(span > 0 ? clamp(-r.top / span) : 0, f);
    });
    return () => {
      off();
      io.disconnect();
    };
  }, [ref]);
}

/** Progress of an element travelling through the viewport: 0 as it enters at the bottom, 1 as it leaves at the top. */
export function useViewProgress<T extends HTMLElement>(ref: RefObject<T | null>, cb: (p: number, f: Frame) => void) {
  const cbRef = useRef(cb);
  useEffect(() => {
    cbRef.current = cb;
  });
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    let visible = false;
    const io = new IntersectionObserver(([e]) => (visible = e.isIntersecting), { rootMargin: "20% 0px" });
    io.observe(el);
    const off = onFrame((f) => {
      if (!visible) return;
      const r = el.getBoundingClientRect();
      cbRef.current(clamp((window.innerHeight - r.top) / (window.innerHeight + r.height)), f);
    });
    return () => {
      off();
      io.disconnect();
    };
  }, [ref]);
}
