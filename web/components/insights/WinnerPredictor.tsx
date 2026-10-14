import Image from "next/image";
import { CSSProperties } from "react";
import { TEAMS } from "@/data/teams";
import type { WinnerModel } from "@/lib/siteData";

/*
 * 2026 race-winner predictor, rendered from web/data/winner-model.json
 * (backend/pipeline/train_winner_model.py). No backend needed at runtime.
 */

const colour = (team: string) => TEAMS.find((t) => t.name === team)?.colour ?? "#6B7280";

function pct(p: number, digits = 0) {
  if (p >= 0.9995) return ">99.9%";
  if (p > 0 && p < 0.001) return "<0.1%";
  return `${(p * 100).toFixed(digits)}%`;
}

function Avatar({ code, team, image }: { code: string; team: string; image?: string | null }) {
  return (
    <span className="wp-avatar" style={{ "--c": colour(team) } as CSSProperties}>
      {image ? <Image src={image} alt="" fill sizes="44px" /> : <i>{code.slice(0, 1)}</i>}
    </span>
  );
}

export default function WinnerPredictor({ model, images }: { model: WinnerModel; images: Record<string, string | null> }) {
  const { nextRace, championship, season2026: s26, validation, backtest, remaining, importance } = model;
  const maxWin = nextRace ? Math.max(...nextRace.drivers.map((d) => d.win)) : 1;
  const maxImp = Math.max(...importance.map((i) => i.value), 1e-9);
  const hitsPre = backtest.filter((b) => b.preRace.correct).length;
  const hitsQ = backtest.filter((b) => b.withQuali.correct).length;
  const leader = championship[0];
  const maxExpected = Math.max(...championship.map((c) => c.p90), 1);

  return (
    <div className="wp">
      {/* ---------- Next race ---------- */}
      {nextRace && (
        <section className="ins-card wp-next" aria-labelledby="wp-next">
          <header className="wp-head">
            <div>
              <p className="eyebrow-x"><span>Round {nextRace.round}</span> Next race · pre-weekend forecast</p>
              <h2 id="wp-next" className="wp-title">{nextRace.name}</h2>
            </div>
            <p className="wp-note">Win and podium probability before practice and qualifying, from results up to round {model.afterRound}.</p>
          </header>

          <ol className="wp-odds">
            {nextRace.drivers.slice(0, 10).map((d, i) => (
              <li key={d.code} className={i === 0 ? "is-fav" : ""} style={{ "--c": colour(d.team), "--w": d.win / maxWin, "--p": d.podium } as CSSProperties}>
                <span className="wp-odds__rank">{i + 1}</span>
                <Avatar code={d.code} team={d.team} image={images[d.code]} />
                <span className="wp-odds__who">
                  <b>{d.name}</b>
                  <small>{d.team}</small>
                </span>
                <span className="wp-odds__bar"><i /></span>
                <span className="wp-odds__win">{pct(d.win, 1)}</span>
                <span className="wp-odds__pod" title="Podium probability">
                  <i />
                  {pct(d.podium)} podium
                </span>
              </li>
            ))}
          </ol>
        </section>
      )}

      {/* ---------- Championship ---------- */}
      {leader && (
        <section className="ins-card wp-title-card" aria-labelledby="wp-champ">
          <header className="wp-head">
            <div>
              <p className="eyebrow-x"><span>{model.simulations.toLocaleString("en-GB")}</span> simulated finishes to the season</p>
              <h2 id="wp-champ" className="wp-title">Drivers&apos; title</h2>
            </div>
            <div className="wp-champ">
              <Avatar code={leader.code} team={leader.team} image={images[leader.code]} />
              <div>
                <b>{leader.name}</b>
                <span>{pct(leader.title, 1)} to win the title</span>
              </div>
            </div>
          </header>
          <div className="ins-table-wrap">
            <table className="ins-table wp-table">
              <thead>
                <tr>
                  <th scope="col">Driver</th>
                  <th scope="col" className="num">Now</th>
                  <th scope="col">Expected final points (10–90% range)</th>
                  <th scope="col" className="num">Title</th>
                </tr>
              </thead>
              <tbody>
                {championship.slice(0, 8).map((c) => (
                  <tr key={c.code} style={{ "--c": colour(c.team) } as CSSProperties}>
                    <th scope="row"><span className="wp-dot" />{c.name}</th>
                    <td className="num">{Math.round(c.points)}</td>
                    <td>
                      <span className="wp-range" aria-label={`${c.p10} to ${c.p90} points, expected ${Math.round(c.expected)}`}>
                        <i style={{ left: `${(c.p10 / maxExpected) * 100}%`, width: `${((c.p90 - c.p10) / maxExpected) * 100}%` }} />
                        <b style={{ left: `${(c.expected / maxExpected) * 100}%` }} />
                      </span>
                      <small className="wp-range__lbl">{Math.round(c.expected)} pts</small>
                    </td>
                    <td className="num strong">{pct(c.title, 1)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* ---------- Scorecard ---------- */}
      <section className="ins-card" aria-labelledby="wp-score">
        <header className="wp-head">
          <div>
            <p className="eyebrow-x"><span>Tested</span> on races it had never seen</p>
            <h2 id="wp-score" className="wp-title">How often it picks the winner</h2>
          </div>
          <p className="wp-note">
            Each 2026 race was predicted using only the results before it. Winner accuracy is how often the model&apos;s top pick won.
          </p>
        </header>
        <div className="wp-stats">
          <div className="wp-stat">
            <span className="wp-stat__val">{pct(s26.preRace.winner)}</span>
            <span className="wp-stat__lbl">Pre-weekend winner pick · 2026 ({hitsPre}/{backtest.length})</span>
            <span className="wp-stat__vs">Championship leader wins: {pct(s26.leader)}</span>
          </div>
          <div className="wp-stat">
            <span className="wp-stat__val">{pct(s26.withQuali.winner)}</span>
            <span className="wp-stat__lbl">With qualifying · 2026 ({hitsQ}/{backtest.length})</span>
            <span className="wp-stat__vs">Pole sitter wins: {pct(s26.pole)}</span>
          </div>
          <div className="wp-stat">
            <span className="wp-stat__val">{pct(s26.preRace.podium)}</span>
            <span className="wp-stat__lbl">Real podium finishers found in its top 3 · pre-weekend</span>
            <span className="wp-stat__vs">With qualifying: {pct(s26.withQuali.podium)}</span>
          </div>
        </div>
        <div className="ins-table-wrap">
          <table className="ins-table">
            <thead>
              <tr>
                <th scope="col">Test season</th>
                <th scope="col" className="num">Races</th>
                <th scope="col" className="num">Pre-weekend</th>
                <th scope="col" className="num">With qualifying</th>
                <th scope="col" className="num">Leader wins</th>
                <th scope="col" className="num">Pole wins</th>
              </tr>
            </thead>
            <tbody>
              {validation.map((v) => (
                <tr key={v.season}>
                  <th scope="row">{v.season}</th>
                  <td className="num">{v.races}</td>
                  <td className="num strong">{pct(v.preRace.winner)}</td>
                  <td className="num strong">{pct(v.withQuali.winner)}</td>
                  <td className="num muted">{pct(v.leader)}</td>
                  <td className="num muted">{pct(v.pole)}</td>
                </tr>
              ))}
              <tr>
                <th scope="row">2026 so far</th>
                <td className="num">{s26.preRace.races}</td>
                <td className="num strong">{pct(s26.preRace.winner)}</td>
                <td className="num strong">{pct(s26.withQuali.winner)}</td>
                <td className="num muted">{pct(s26.leader)}</td>
                <td className="num muted">{pct(s26.pole)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      {/* ---------- 2026 backtest ---------- */}
      <section className="ins-card" aria-labelledby="wp-back">
        <header className="wp-head">
          <div>
            <p className="eyebrow-x"><span>{backtest.length}</span> races replayed</p>
            <h2 id="wp-back" className="wp-title">2026, race by race</h2>
          </div>
          <p className="wp-note">The pre-weekend pick, and the pick once the grid was known, against the real winner.</p>
        </header>
        <ol className="wp-back">
          {backtest.map((b) => (
            <li key={b.round} style={{ "--c": colour(b.winner.team) } as CSSProperties}>
              <span className="wp-back__round">R{String(b.round).padStart(2, "0")}</span>
              <span className="wp-back__race">{b.name.replace(" Grand Prix", "")}</span>
              <span className="wp-back__winner"><span className="wp-dot" />{b.winner.code}</span>
              <span className={`wp-back__pick ${b.preRace.correct ? "is-hit" : ""}`} title={`Pre-weekend pick ${b.preRace.name}, ${pct(b.preRace.prob)}`}>
                {b.preRace.correct ? "✓" : "✗"} {b.preRace.code} <small>{pct(b.preRace.prob)}</small>
              </span>
              <span className={`wp-back__pick ${b.withQuali.correct ? "is-hit" : ""}`} title={`With-qualifying pick ${b.withQuali.name}, ${pct(b.withQuali.prob)}`}>
                {b.withQuali.correct ? "✓" : "✗"} {b.withQuali.code} <small>{pct(b.withQuali.prob)}</small>
              </span>
            </li>
          ))}
        </ol>
        <p className="wp-legend"><span>Winner</span><span>Pre-weekend pick</span><span>With qualifying</span></p>
      </section>

      <div className="ins-grid">
        {/* ---------- Rest of the season ---------- */}
        <section className="ins-card" aria-labelledby="wp-rest">
          <h2 id="wp-rest" className="ins-card__title">Rest of the season · favourites</h2>
          <ol className="wp-rest">
            {remaining.map((r) => (
              <li key={r.round}>
                <span className="wp-back__round">R{r.round}</span>
                <span className="wp-rest__race">
                  {r.name.replace(" Grand Prix", "")}
                  {r.sprint && <em>Sprint</em>}
                </span>
                <span className="wp-rest__top">
                  {r.top.map((t) => (
                    <span key={t.code} style={{ "--c": colour(t.team) } as CSSProperties}>
                      <span className="wp-dot" />{t.code} <small>{pct(t.win)}</small>
                    </span>
                  ))}
                </span>
              </li>
            ))}
          </ol>
        </section>

        {/* ---------- Feature importance ---------- */}
        <section className="ins-card" aria-labelledby="wp-imp">
          <h2 id="wp-imp" className="ins-card__title">What the model leans on</h2>
          <ol className="wp-imp">
            {importance.slice(0, 9).map((f) => (
              <li key={f.feature} style={{ "--w": Math.max(0, f.value) / maxImp } as CSSProperties}>
                <span>{f.label}</span>
                <span className="wp-imp__bar"><i /></span>
              </li>
            ))}
          </ol>
          <p className="ins-source">Permutation importance on the 2025 season (how much accuracy drops when a feature is shuffled), relative to the top feature.</p>
        </section>
      </div>

      {/* ---------- Method ---------- */}
      <details className="physics wp-method">
        <summary>Method: how the model works</summary>
        <div className="wp-method__body">
          <p>
            Follows <em>Formula One Race Prediction Model</em> (Spencer Staub, The George Washington University, 2022): one row per driver
            per race, a yes/no &ldquo;won the race&rdquo; target, features built only from what was known before that race, gradient-boosted
            trees, and drivers ranked by win probability inside each race. Accuracy is measured on later seasons the model never trained on.
          </p>
          <ul>
            <li>
              <b>Data:</b> only this site&apos;s own race archive: {model.data.races} races from {model.data.firstSeason} to {model.season}{" "}
              (results, qualifying and sprints), {model.data.trainRows.toLocaleString("en-GB")} driver-race rows used for training from{" "}
              {model.data.firstTrainSeason}. Nothing is fetched from outside.
            </li>
            <li>
              <b>Pre-weekend features:</b> {model.features.preRace.join(", ")}.
            </li>
            <li>
              <b>Added once qualifying is known:</b> {model.features.withQuali.join(", ")}.
            </li>
            <li>
              <b>Changes from the presentation:</b> scikit-learn gradient boosting instead of XGBoost; no driver or team name features, because
              they memorise the past and the 2026 rules reset the order; points are shares of the leader, so every points system compares
              fairly. Class balancing (the presentation&apos;s oversampling) was tested; it picked slightly more winners but made the
              probabilities much less reliable, so it isn&apos;t used.
            </li>
            <li>
              <b>Rest of season:</b> each remaining race (and sprint) is simulated {model.simulations.toLocaleString("en-GB")} times. The finishing
              order is drawn from the win probabilities, with a retirement chance from each driver&apos;s and car&apos;s recent reliability.
            </li>
            <li>
              <b>Limits:</b> results only (no practice pace, upgrades, penalties or weather), and the forecast assumes current form holds.
            </li>
          </ul>
        </div>
      </details>
    </div>
  );
}
