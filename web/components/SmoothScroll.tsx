"use client";

import { useEffect } from "react";

/*
 * Site-wide smooth scrolling (no library).
 * - Mouse wheel / trackpad: the page eases towards the scroll target with a little inertia.
 * - In-page links (#section): animated with an ease-in-out curve, respecting the nav offset.
 * Touch, keyboard and scrollbar dragging stay native, and the page still scrolls natively
 * underneath, so sticky sections, IntersectionObservers and scroll listeners keep working.
 * Off for reduced-motion users, inside scrollable panels, and while scroll is locked
 * (intro, lightbox, mobile menu).
 */

const EASE = 0.1; // share of the remaining distance covered per 60 fps frame
const easeInOut = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

export default function SmoothScroll() {
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const root = document.documentElement;
    const max = () => root.scrollHeight - window.innerHeight;
    const clampY = (y: number) => Math.min(max(), Math.max(0, y));
    const jump = (y: number) => window.scrollTo({ top: y, behavior: "instant" });
    const locked = () =>
      root.style.overflow === "hidden" || document.body.style.overflow === "hidden" || !!document.querySelector("dialog[open]");

    let current = window.scrollY;
    let target = current;
    let raf = 0;
    let last = 0;
    let anim: { from: number; to: number; start: number; dur: number } | null = null;

    const stop = () => {
      cancelAnimationFrame(raf);
      raf = 0;
      anim = null;
    };

    const frame = (t: number) => {
      // Someone else moved the page (scrollbar drag, keyboard, find-in-page): hand back control
      if (Math.abs(window.scrollY - Math.round(current)) > 2) {
        current = target = window.scrollY;
        stop();
        return;
      }
      if (anim) {
        const k = Math.min(1, (t - anim.start) / anim.dur);
        current = anim.from + (anim.to - anim.from) * easeInOut(k);
        target = current;
        if (k >= 1) anim = null;
      } else {
        const dt = last ? Math.min(64, t - last) / 16.67 : 1;
        current += (target - current) * (1 - Math.pow(1 - EASE, dt));
        if (Math.abs(target - current) < 0.5) current = target;
      }
      last = t;
      jump(current);
      if (anim || current !== target) raf = requestAnimationFrame(frame);
      else stop();
    };
    const run = () => {
      if (!raf) {
        last = 0;
        raf = requestAnimationFrame(frame);
      }
    };

    // True if the wheel should scroll an inner panel (dialog, dropdown, table) instead of the page
    const innerScroll = (el: Element | null, dy: number) => {
      for (let node = el; node && node !== document.body && node !== root; node = node.parentElement) {
        const oy = getComputedStyle(node).overflowY;
        if ((oy === "auto" || oy === "scroll") && node.scrollHeight > node.clientHeight + 1) {
          if (dy < 0 ? node.scrollTop > 0 : node.scrollTop + node.clientHeight < node.scrollHeight - 1) return true;
        }
      }
      return false;
    };

    const onWheel = (e: WheelEvent) => {
      if (e.defaultPrevented || e.ctrlKey || locked()) return;
      if (Math.abs(e.deltaX) > Math.abs(e.deltaY)) return; // sideways gestures stay native
      if (innerScroll(e.target as Element, e.deltaY)) return;
      e.preventDefault();
      if (!raf || anim) {
        anim = null;
        current = target = window.scrollY;
      }
      const delta = e.deltaMode === 1 ? e.deltaY * 40 : e.deltaMode === 2 ? e.deltaY * window.innerHeight : e.deltaY;
      target = clampY(target + delta);
      run();
    };

    // Animate same-page hash links; links to other pages navigate normally
    const onClick = (e: MouseEvent) => {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const a = (e.target as Element).closest?.("a[href*='#']") as HTMLAnchorElement | null;
      if (!a || a.target === "_blank") return;
      const url = new URL(a.href, location.href);
      if (url.origin !== location.origin || url.pathname !== location.pathname || !url.hash) return;
      const id = decodeURIComponent(url.hash.slice(1));
      const dest = id === "top" ? document.body : document.getElementById(id);
      if (!dest) return;
      e.preventDefault();
      const offset = parseFloat(getComputedStyle(root).scrollPaddingTop) || 0;
      const to = clampY(id === "top" ? 0 : dest.getBoundingClientRect().top + window.scrollY - offset);
      const from = window.scrollY;
      const dist = Math.abs(to - from);
      current = from;
      anim = { from, to, start: performance.now(), dur: Math.min(1800, 500 + dist * 0.12) };
      if (location.hash !== url.hash) history.pushState(null, "", url.hash);
      run();
    };

    window.addEventListener("wheel", onWheel, { passive: false });
    document.addEventListener("click", onClick, true);
    return () => {
      stop();
      window.removeEventListener("wheel", onWheel);
      document.removeEventListener("click", onClick, true);
    };
  }, []);

  return null;
}
