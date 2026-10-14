"use client";

import Image from "next/image";
import Link from "next/link";
import { CSSProperties, useCallback, useEffect, useRef, useState } from "react";
import type { LandingDriver } from "@/lib/landing";
import { clamp, onFrame } from "./engine";

const SHOW = 10;
const SECONDS_PER_ROUND = 0.6;

/**
 * Bar-chart race of the drivers' championship, replaying every round of real points.
 * Starts when scrolled into view; scrub with the slider or pause/replay.
 * Bars and values are written straight to the DOM each frame; React only renders the round label.
 */
export default function ChampionshipRace({ drivers, rounds, season }: { drivers: LandingDriver[]; rounds: string[]; season: number }) {
  const ref = useRef<HTMLElement>(null);
  const rows = useRef<(HTMLLIElement | null)[]>([]);
  const last = Math.max(0, (drivers[0]?.progress.length ?? 1) - 1);

  const head = useRef(0); // playhead, in rounds (0-based, fractional)
  const [playing, setPlaying] = useState(false);
  const [round, setRound] = useState(0);
  const [atEnd, setAtEnd] = useState(false);
  const slider = useRef<HTMLInputElement>(null);
  const started = useRef(false);

  const paint = useCallback(() => {
    const r = head.current;
    const i0 = Math.floor(r), i1 = Math.min(last, i0 + 1), f = r - i0;
    const pts = drivers.map((d) => (d.progress[i0] ?? 0) + ((d.progress[i1] ?? 0) - (d.progress[i0] ?? 0)) * f);
    const order = pts.map((p, i) => i).sort((a, b) => pts[b] - pts[a] || a - b);
    const max = Math.max(1, pts[order[0]]);
    order.forEach((di, rank) => {
      const el = rows.current[di];
      if (!el) return;
      const shown = rank < SHOW;
      el.style.transform = `translate3d(0, ${Math.min(rank, SHOW) * 100}%, 0)`;
      el.style.opacity = shown ? "1" : "0";
      el.style.setProperty("--w", (pts[di] / max).toFixed(4));
      const val = el.querySelector(".race__val");
      const txt = Math.round(pts[di]).toString();
      if (val && val.textContent !== txt) val.textContent = txt;
      const rk = el.querySelector(".race__rank");
      if (rk && rk.textContent !== String(rank + 1)) rk.textContent = String(rank + 1);
      el.classList.toggle("is-leader", rank === 0);
    });
    const rr = Math.round(r);
    setRound((prev) => (prev === rr ? prev : rr));
    setAtEnd(r >= last);
    if (slider.current) {
      slider.current.value = String(r);
      slider.current.style.setProperty("--fill", `${(r / Math.max(1, last)) * 100}%`);
    }
  }, [drivers, last]);

  // First paint: reduced motion shows the final standings, everyone else starts from round 1
  useEffect(() => {
    head.current = window.matchMedia("(prefers-reduced-motion: reduce)").matches ? last : 0;
    if (head.current === last) started.current = true;
    paint();
  }, [last, paint]);

  // Autoplay once, the first time the board scrolls into view
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([e]) => {
        if (!e.isIntersecting || started.current) return;
        started.current = true;
        setPlaying(true);
        io.disconnect();
      },
      { threshold: 0.35 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  useEffect(() => {
    if (!playing) return;
    let prev = performance.now();
    const off = onFrame((f) => {
      const dt = (f.t - prev) / 1000;
      prev = f.t;
      head.current = clamp(head.current + dt / SECONDS_PER_ROUND, 0, last);
      paint();
      if (head.current >= last) setPlaying(false);
    });
    return off;
  }, [playing, last, paint]);

  const toggle = () => {
    if (head.current >= last) head.current = 0;
    setPlaying((p) => !p);
  };

  const leader = drivers[0];

  return (
    <section className="race" id="drivers" ref={ref}>
      <div className="container race__inner">
        <header className="race__head">
          <p className="eyebrow-x"><span>03</span> Drivers&apos; championship</p>
          <h2 className="race__title">
            {season}, <em>replayed</em>.
          </h2>
          <p className="race__sub">Every round of real points, in {Math.round((last + 1) * SECONDS_PER_ROUND)} seconds.</p>

          <div className="race__round" aria-live="polite">
            <span className="race__round-num">R{String(round + 1).padStart(2, "0")}</span>
            <span className="race__round-name">{rounds[round] ?? ""}</span>
          </div>

          <div className="race__controls">
            <button type="button" className="race__play" onClick={toggle} aria-label={playing ? "Pause" : atEnd ? "Replay" : "Play"}>
              {playing ? (
                <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 5h3v14H7zM14 5h3v14h-3z" /></svg>
              ) : (
                <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 4l13 8-13 8z" /></svg>
              )}
            </button>
            <input
              type="range"
              min={0}
              max={last}
              step={0.01}
              ref={slider}
              defaultValue={0}
              aria-label="Round"
              aria-valuetext={`Round ${round + 1}`}
              onChange={(e) => {
                setPlaying(false);
                started.current = true;
                head.current = Number(e.target.value);
                paint();
              }}
            />
          </div>

          {leader && (
            <p className="race__note">
              Leader after round {last + 1}: <b>{leader.name}</b>, {leader.points} pts.{" "}
              <Link href="/standings" className="text-arrow">All standings →</Link>
            </p>
          )}
        </header>

        <ol className="race__board" style={{ "--rows": SHOW } as CSSProperties} aria-label="Top ten drivers">
          {drivers.map((d, i) => (
            <li key={d.code} className="race__row" ref={(el) => { rows.current[i] = el; }} style={{ "--c": d.colour } as CSSProperties}>
              <span className="race__rank">{i + 1}</span>
              <span className="race__avatar">
                {d.image ? <Image src={d.image} alt="" fill sizes="44px" style={{ objectPosition: "center top" }} /> : <i>{d.code.slice(0, 1)}</i>}
              </span>
              <span className="race__code" title={d.name}>{d.code}</span>
              <span className="race__track">
                <span className="race__bar">
                  <span className="race__team">{d.team}</span>
                </span>
                <span className="race__val">0</span>
              </span>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
