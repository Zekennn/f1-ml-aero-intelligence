"use client";

import { useEffect } from "react";

/**
 * Fades and lifts the main blocks of every page into view as they scroll in, in a
 * short stagger. One long-lived observer for the whole visit: a MutationObserver picks
 * up blocks rendered later, including whole pages after client-side navigation.
 * Classes are only added by JS, so without it everything is simply visible.
 */
const SELECTOR = [
  ".page-body .ins-card",
  ".page-body .tl-card",
  ".page-body .tl-controls",
  ".page-body .wt-panel",
  ".page-body .wt",
  ".page-body .physics",
  ".page-body .pred-row",
  ".page-body .panel",
  ".page-body .notice",
  ".page-body .aero",
].join(",");

export default function AutoReveal() {
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    let queue = 0;
    const revealed = new WeakSet<Element>();
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (!e.isIntersecting) continue;
          const el = e.target as HTMLElement;
          el.style.setProperty("--rv-delay", `${Math.min(queue++, 6) * 70}ms`);
          el.classList.add("rv-in");
          revealed.add(el);
          io.unobserve(el);
        }
        queue = 0;
      },
      { threshold: 0.08, rootMargin: "0px 0px -6% 0px" },
    );

    // Hide-and-observe every matching block that hasn't been revealed yet.
    // Observing an element twice is harmless, so repeated scans are safe. A block that
    // was already revealed never hides again, even if React rewrites its class list.
    const scan = () => {
      document.querySelectorAll<HTMLElement>(SELECTOR).forEach((el) => {
        if (revealed.has(el) || el.classList.contains("rv-in")) return;
        el.classList.add("rv");
        io.observe(el);
      });
    };

    let pending = 0;
    const schedule = () => {
      if (!pending) pending = requestAnimationFrame(() => { pending = 0; scan(); });
    };
    scan();
    const mo = new MutationObserver(schedule);
    mo.observe(document.body, { childList: true, subtree: true });

    return () => {
      cancelAnimationFrame(pending);
      io.disconnect();
      mo.disconnect();
    };
  }, []);

  return null;
}
