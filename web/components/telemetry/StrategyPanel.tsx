"use client";

import { useEffect, useState } from "react";
import { formatDuration } from "@/lib/circuitData";
import type { LapTimeModel } from "@/lib/lapTimeModel";
import { bestStrategies, Plan } from "@/lib/strategy";

type Props = {
  model: LapTimeModel;
  slug: string;
  team: string;
  totalLaps: number;
  compounds: string[];
  pitStopTime: number;
  trackTemp: number | null;
  onUsePitLap: (lap: number) => void;
};

const LABEL: Record<string, string> = { SOFT: "Soft", MEDIUM: "Medium", HARD: "Hard" };

/** 1-stop vs 2-stop comparison for the selected circuit and team. */
export default function StrategyPanel({ model, slug, team, totalLaps, compounds, pitStopTime, trackTemp, onUsePitLap }: Props) {
  const [plans, setPlans] = useState<{ oneStop: Plan | null; twoStop: Plan | null } | null>(null);

  useEffect(() => {
    setPlans(null);
    // Let the page paint first; the search takes a few tens of milliseconds
    const id = window.setTimeout(() => {
      setPlans(bestStrategies(model, { slug, team, totalLaps, compounds, pitStopTime, trackTemp }));
    }, 30);
    return () => window.clearTimeout(id);
  }, [model, slug, team, totalLaps, compounds, pitStopTime, trackTemp]);

  const one = plans?.oneStop;
  const two = plans?.twoStop;
  const best = one && two ? (one.raceTime <= two.raceTime ? "one" : "two") : null;
  const gap = one && two ? Math.abs(one.raceTime - two.raceTime) : 0;

  return (
    <section className="tl-card tl-strategy" aria-labelledby="tl-strategy-title">
      <header className="tl-card__head">
        <div>
          <h2 id="tl-strategy-title" className="tl-card__title">Strategy: 1-stop vs 2-stop</h2>
          <p className="tl-card__sub">
            {team} at this circuit, {totalLaps} laps · predicted with the lap time model, {pitStopTime.toFixed(1)} s per stop
          </p>
        </div>
        {best && (
          <span className="tl-badge tl-badge--on">
            {best === "one" ? "1-stop" : "2-stop"} faster by {gap.toFixed(1)} s
          </span>
        )}
      </header>
      {!plans ? (
        <p className="tl-card__foot">Working out the best plans…</p>
      ) : (
        <div className="tl-plans">
          {[one, two].map((p, i) =>
            p ? (
              <article key={i} className={`tl-plan${(best === "one" && i === 0) || (best === "two" && i === 1) ? " tl-plan--best" : ""}`}>
                <h3>{p.stops}-stop</h3>
                <p className="tl-plan__time"><span className="tl-num">{formatDuration(p.raceTime)}</span> <em>race time</em></p>
                <ol className="tl-plan__stints">
                  {p.stints.map((s) => (
                    <li key={s.from}>
                      <span className={`tl-dot tl-dot--${s.compound.toLowerCase()}`} aria-hidden="true" />
                      {LABEL[s.compound] ?? s.compound} · laps {s.from}–{s.to} <em>({s.laps})</em>
                    </li>
                  ))}
                </ol>
                <p className="tl-card__foot">
                  Pit {p.pitLaps.length > 1 ? "laps" : "lap"} {p.pitLaps.join(" and ")} · {p.pitTime.toFixed(1)} s in the pits
                </p>
                <button type="button" className="tl-btn tl-btn--small" onClick={() => onUsePitLap(p.pitLaps[0])}>
                  Use pit lap {p.pitLaps[0]} in the simulation
                </button>
              </article>
            ) : null,
          )}
        </div>
      )}
      <p className="tl-card__foot">Assumes new tyres at the start, no safety cars, traffic or tyre warm-up. Tyre degradation comes from the lap time model.</p>
    </section>
  );
}
