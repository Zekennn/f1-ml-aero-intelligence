"use client";

import { CSSProperties, useEffect, useRef } from "react";
import type { LandingDriver } from "@/lib/landing";
import { clamp, onFrame } from "./engine";

/**
 * Two skewed marquee bands running in opposite directions. They speed up with scroll
 * velocity and flip direction when you scroll back up — the band feels "driven" by you.
 */
export default function Ticker({ drivers, phrases }: { drivers: LandingDriver[]; phrases: string[] }) {
  const rowA = useRef<HTMLDivElement>(null);
  const rowB = useRef<HTMLDivElement>(null);
  const wrap = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    let xa = 0, xb = 0, dir = 1;
    let visible = true;
    const io = new IntersectionObserver(([e]) => (visible = e.isIntersecting));
    if (wrap.current) io.observe(wrap.current);
    const off = onFrame((f) => {
      if (!visible || !rowA.current || !rowB.current) return;
      if (Math.abs(f.vy) > 0.5) dir = f.vy > 0 ? 1 : -1;
      const boost = clamp(Math.abs(f.vy) * 0.35, 0, 22);
      const v = (0.9 + boost) * dir * (f.dt / 16.67);
      const wa = rowA.current.scrollWidth / 2, wb = rowB.current.scrollWidth / 2;
      xa = (((xa - v) % wa) - wa) % wa;
      xb = (((xb + v * 0.8) % wb) - wb) % wb;
      rowA.current.style.transform = `translate3d(${xa}px,0,0)`;
      rowB.current.style.transform = `translate3d(${xb}px,0,0)`;
      wrap.current?.style.setProperty("--blur", `${clamp(Math.abs(f.vy) / 40, 0, 1)}`);
    });
    return () => {
      off();
      io.disconnect();
    };
  }, []);

  const top = drivers.slice(0, 12);
  const standings = (
    <>
      {top.map((d, i) => (
        <span className="tick__item" key={d.code} style={{ "--c": d.colour } as CSSProperties}>
          <b>P{i + 1}</b>
          <i />
          {d.code}
          <em>{d.points} pts</em>
        </span>
      ))}
    </>
  );
  const words = (
    <>
      {phrases.map((p, i) => (
        <span className={`tick__word ${i % 2 ? "is-outline" : ""}`} key={p}>
          {p}
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2l2.6 7.4H22l-6 4.6 2.3 7.5L12 17l-6.3 4.5L8 14 2 9.4h7.4z" /></svg>
        </span>
      ))}
    </>
  );

  return (
    <section className="tick" id="ticker" ref={wrap} aria-label="Championship top 12">
      <div className="tick__band tick__band--a">
        <div className="tick__row" ref={rowA}>
          {standings}
          <span className="tick__dup" aria-hidden="true">{standings}</span>
        </div>
      </div>
      <div className="tick__band tick__band--b" aria-hidden="true">
        <div className="tick__row" ref={rowB}>
          {words}
          {words}
        </div>
      </div>
    </section>
  );
}
