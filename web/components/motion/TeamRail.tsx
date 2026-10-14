"use client";

import Image from "next/image";
import Link from "next/link";
import { CSSProperties, useEffect, useRef, useState } from "react";
import type { LandingTeam } from "@/lib/landing";
import { clamp, lerp, usePinProgress, useReducedMotion } from "./engine";

/**
 * Pinned horizontal rail of the constructors in championship order.
 * Vertical scroll drives the rail sideways; scroll speed skews it and stretches
 * speed lines, and each car "drives in" with its own parallax as its panel arrives.
 */
export default function TeamRail({ teams, season }: { teams: LandingTeam[]; season: number }) {
  const ref = useRef<HTMLElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const barRef = useRef<HTMLSpanElement>(null);
  const [height, setHeight] = useState<number | null>(null);
  const reduced = useReducedMotion();
  const skew = useRef(0);
  const leader = teams[0]?.points || 1;

  // Section height = horizontal distance to travel + one screen
  useEffect(() => {
    if (reduced) return;
    const measure = () => {
      const track = trackRef.current;
      if (!track) return;
      setHeight(track.scrollWidth - window.innerWidth + window.innerHeight);
    };
    measure();
    const ro = new ResizeObserver(measure);
    if (trackRef.current) ro.observe(trackRef.current);
    window.addEventListener("resize", measure);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, [reduced]);

  usePinProgress(ref, (p, f) => {
    const track = trackRef.current;
    if (!track || reduced) return;
    const dist = track.scrollWidth - window.innerWidth;
    skew.current = lerp(skew.current, clamp(-f.vy * 0.18, -9, 9), 0.12);
    track.style.transform = `translate3d(${-p * dist}px,0,0) skewX(${skew.current}deg)`;
    track.style.setProperty("--speed", String(clamp(Math.abs(f.vy) / 30)));
    if (barRef.current) barRef.current.style.transform = `scaleX(${p})`;

    // Per-panel parallax: the car trails behind and catches up as the panel centres
    const vw = window.innerWidth;
    track.querySelectorAll<HTMLElement>(".rail__panel").forEach((panel) => {
      const r = panel.getBoundingClientRect();
      const centre = (r.left + r.width / 2 - vw / 2) / vw; // 0 when centred
      panel.style.setProperty("--off", centre.toFixed(3));
    });
  });

  return (
    <section
      className={`rail ${reduced ? "rail--static" : ""}`}
      id="teams"
      ref={ref}
      style={height && !reduced ? { height } : undefined}
    >
      <div className="rail__pin">
        <header className="rail__head container">
          <p className="eyebrow-x"><span>02</span> The constructors</p>
          <h2 className="rail__title">Eleven teams. <em>One order.</em></h2>
          <span className="rail__progress" aria-hidden="true"><span ref={barRef} /></span>
        </header>

        <div className="rail__track" ref={trackRef}>
          {teams.map((t, i) => (
            <article
              className="rail__panel"
              key={t.slug}
              style={{ "--team": t.colour, "--share": t.points / leader } as CSSProperties}
            >
              <span className="rail__pos" aria-hidden="true">{String(t.position ?? i + 1).padStart(2, "0")}</span>
              <div className="rail__wash" aria-hidden="true" />
              <div className="rail__lines" aria-hidden="true">
                {Array.from({ length: 6 }, (_, k) => <i key={k} style={{ "--k": k } as CSSProperties} />)}
              </div>
              <div className="rail__car">
                <Image src={`/images/teams/${t.slug}-car.webp`} alt={`${t.name} car`} fill sizes="(max-width: 700px) 90vw, 60vw" />
              </div>
              <div className="rail__info">
                <div className="rail__name">
                  <span className="rail__logo">
                    <Image src={`/images/teams/${t.slug}-logo.webp`} alt="" fill sizes="36px" />
                  </span>
                  <h3>{t.name}</h3>
                </div>
                <dl className="rail__stats">
                  <div><dt>Points</dt><dd>{t.points}</dd></div>
                  <div><dt>Wins</dt><dd>{t.wins}</dd></div>
                  <div><dt>Podiums</dt><dd>{t.podiums}</dd></div>
                </dl>
                <div className="rail__meter" aria-hidden="true"><i /></div>
                {t.drivers.length > 0 && <p className="rail__drivers">{t.drivers.join(" · ")}</p>}
              </div>
            </article>
          ))}
          <div className="rail__end">
            <p>{season} constructors&apos; championship, after every round so far.</p>
            <Link href="/standings" className="text-arrow">Full standings →</Link>
          </div>
        </div>
      </div>
    </section>
  );
}
