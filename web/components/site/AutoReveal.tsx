"use client";

import { usePathname } from "next/navigation";
import { useEffect } from "react";

/**
 * Fades and lifts the main blocks of every page into view as they scroll in, in a
 * short stagger. Works on server-rendered markup and on blocks that render later.
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
  const pathname = usePathname();

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    let queue = 0;
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (!e.isIntersecting) continue;
          const el = e.target as HTMLElement;
          el.style.setProperty("--rv-delay", `${Math.min(queue++, 6) * 70}ms`);
          el.classList.add("rv-in");
          io.unobserve(el);
        }
        queue = 0;
      },
      { threshold: 0.08, rootMargin: "0px 0px -6% 0px" },
    );
    const scan = () => {
      document.querySelectorAll<HTMLElement>(SELECTOR).forEach((el) => {
        if (el.dataset.rv) return;
        el.dataset.rv = "1";
        el.classList.add("rv");
        io.observe(el);
      });
    };
    scan();
    const mo = new MutationObserver(scan);
    mo.observe(document.body, { childList: true, subtree: true });
    return () => {
      io.disconnect();
      mo.disconnect();
    };
  }, [pathname]);

  return null;
}
