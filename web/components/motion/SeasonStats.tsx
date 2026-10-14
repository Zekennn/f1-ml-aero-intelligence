"use client";

import { CSSProperties, useRef } from "react";
import { useInView } from "./engine";

/** A number whose digits spin like a mechanical counter when it scrolls into view. */
function Odometer({ value, on, delay = 0 }: { value: number; on: boolean; delay?: number }) {
  const digits = String(value).split("");
  return (
    <span className="odo" aria-label={String(value)} role="text">
      {digits.map((d, i) => (
        <span className="odo__col" key={i} aria-hidden="true">
          <span
            className="odo__strip"
            style={{
              transform: on ? `translateY(${-(10 + Number(d)) * 10 / 2}%)` : "translateY(0)",
              transitionDelay: `${delay + i * 120}ms`,
            } as CSSProperties}
          >
            {Array.from({ length: 20 }, (_, n) => (
              <span key={n}>{n % 10}</span>
            ))}
          </span>
        </span>
      ))}
    </span>
  );
}

type Props = { completed: number; total: number; teams: number; countries: number; leaderPoints: number; leader: string };

export default function SeasonStats({ completed, total, teams, countries, leaderPoints, leader }: Props) {
  const ref = useRef<HTMLElement>(null);
  const on = useInView(ref, { threshold: 0.35 });
  const pct = total ? Math.round((completed / total) * 100) : 0;

  const stats = [
    { value: completed, suffix: `/${total}`, label: "Rounds run" },
    { value: teams, label: "Constructors" },
    { value: teams * 2, label: "Race seats" },
    { value: countries, label: "Countries" },
    { value: leaderPoints, label: `${leader} points` },
  ];

  return (
    <section className={`stx ${on ? "is-in" : ""}`} ref={ref} aria-label="Season at a glance">
      <div className="container">
        <div className="stx__grid">
          {stats.map((s, i) => (
            <div className="stx__item" key={s.label} style={{ "--i": i } as CSSProperties}>
              <span className="stx__value">
                <Odometer value={s.value} on={on} delay={i * 140} />
                {s.suffix && <small>{s.suffix}</small>}
              </span>
              <span className="stx__label">{s.label}</span>
            </div>
          ))}
        </div>

        <div className="stx__season" aria-label={`Season ${pct}% complete`}>
          <div className="stx__lights">
            {Array.from({ length: total }, (_, i) => (
              <i key={i} className={i < completed ? "is-done" : i === completed ? "is-next" : ""} style={{ "--i": i } as CSSProperties} />
            ))}
          </div>
          <span className="stx__pct">
            Season <b>{pct}%</b> complete
          </span>
        </div>
      </div>
    </section>
  );
}
