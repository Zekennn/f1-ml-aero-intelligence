"use client";

import { useState } from "react";
import type { PitStopData } from "@/lib/siteData";

/** Season filter, average stop time per team (horizontal bars) and the fastest stops table. */
export default function PitStopsView({ data }: { data: PitStopData }) {
  const seasons = Object.keys(data.seasons).sort().reverse();
  const [season, setSeason] = useState(seasons[0]);
  const s = data.seasons[season];
  const teams = s?.teams ?? [];
  // Bars start at zero so their lengths compare honestly
  const hi = Math.max(1, Math.ceil(Math.max(0, ...teams.map((t) => t.average))));
  const pct = (v: number) => (v / hi) * 100;
  const ticks = Array.from({ length: hi + 1 }, (_, i) => i);

  return (
    <>
      <div className="ins-filter">
        <label>
          <span>Season</span>
          <select className="select" value={season} onChange={(e) => setSeason(e.target.value)}>
            {seasons.map((y) => <option key={y} value={y}>{y}</option>)}
          </select>
        </label>
        <p>{s ? `${s.races} races · ${teams.reduce((n, t) => n + t.stops, 0).toLocaleString()} stops` : ""}</p>
      </div>

      <div className="ins-grid">
        <section className="ins-card" aria-labelledby="pit-avg">
          <h2 id="pit-avg" className="ins-card__title">Average stop time per team, {season}</h2>
          <p className="ins-card__sub">Stationary time from DHL. Stops more than twice the team&apos;s median (problems) are left out of the average.</p>
          <div className="ins-bars" role="img" aria-label={`Bar chart of average pit stop time per team in ${season}`}>
            <div className="ins-bars__axis" aria-hidden="true">
              {ticks.map((t) => <span key={t} style={{ left: `${pct(t)}%` }}>{t} s</span>)}
            </div>
            {teams.map((t, i) => (
              <div className="ins-bar" key={t.team} title={`${t.team}: ${t.average.toFixed(2)} s average, best ${t.best.toFixed(2)} s, ${t.stops} stops`}>
                <span className="ins-bar__label">{t.team}</span>
                <span className="ins-bar__track">
                  <span className={`ins-bar__fill${i === 0 ? " ins-bar__fill--best" : ""}`} style={{ width: `${pct(t.average)}%` }} />
                </span>
                <span className="ins-bar__value">{t.average.toFixed(2)} <em>s</em></span>
              </div>
            ))}
          </div>
        </section>

        <section className="ins-card" aria-labelledby="pit-fast">
          <h2 id="pit-fast" className="ins-card__title">Fastest stops, {season}</h2>
          <div className="ins-table-wrap">
            <table className="ins-table">
              <thead>
                <tr><th scope="col" className="num">#</th><th scope="col">Team</th><th scope="col">Driver</th><th scope="col">Grand Prix</th><th scope="col" className="num">Lap</th><th scope="col" className="num">Time</th></tr>
              </thead>
              <tbody>
                {(s?.fastest ?? []).map((f, i) => (
                  <tr key={i}>
                    <td className="num">{i + 1}</td>
                    <th scope="row">{f.team}</th>
                    <td>{f.driver}</td>
                    <td className="muted">{f.gp.replace(" Grand Prix", "")}</td>
                    <td className="num">{f.lap}</td>
                    <td className="num strong">{f.time.toFixed(2)} s</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </>
  );
}
