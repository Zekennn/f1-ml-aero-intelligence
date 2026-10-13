import type { Metadata } from "next";
import PageHead from "@/components/PageHead";
import PointsChart from "@/components/insights/PointsChart";
import { getStandings } from "@/lib/siteData";

export const metadata: Metadata = { title: "Standings" };

const pts = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(1));

export default async function StandingsPage() {
  const s = await getStandings();

  return (
    <>
      <PageHead
        eyebrow="Season"
        title={`${s?.season ?? 2026} standings`}
        text={s ? `Driver and constructor championships after round ${s.afterRound} of the season, from the TracingInsights Stats repo.` : "Standings will appear once the data pipeline has run."}
      />
      <section className="page-body">
        <div className="container ins">
          {!s ? (
            <p className="notice">No standings yet. Run the data update (see README) to build them.</p>
          ) : (
            <>
              <section className="ins-card" aria-labelledby="ins-progress">
                <h2 id="ins-progress" className="ins-card__title">Points progression, top 5 drivers</h2>
                <PointsChart
                  rounds={s.rounds}
                  series={s.drivers.slice(0, 5).map((d) => ({ name: d.driver, code: d.code, values: d.progress.map((v) => Math.round(v)) }))}
                />
              </section>

              <div className="ins-grid">
                <section className="ins-card" aria-labelledby="ins-drivers">
                  <h2 id="ins-drivers" className="ins-card__title">Drivers</h2>
                  <div className="ins-table-wrap">
                    <table className="ins-table">
                      <thead>
                        <tr><th scope="col">Pos</th><th scope="col">Driver</th><th scope="col">Team</th><th scope="col" className="num">Points</th><th scope="col" className="num">Wins</th><th scope="col" className="num">Podiums</th></tr>
                      </thead>
                      <tbody>
                        {s.drivers.map((d) => (
                          <tr key={d.code ?? d.driver}>
                            <td className="num">{d.position}</td>
                            <th scope="row">{d.driver}</th>
                            <td className="muted">{d.team}</td>
                            <td className="num strong">{pts(d.points)}</td>
                            <td className="num">{d.wins}</td>
                            <td className="num">{d.podiums}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </section>

                <section className="ins-card" aria-labelledby="ins-teams">
                  <h2 id="ins-teams" className="ins-card__title">Constructors</h2>
                  <div className="ins-table-wrap">
                    <table className="ins-table">
                      <thead>
                        <tr><th scope="col">Pos</th><th scope="col">Team</th><th scope="col" className="num">Points</th><th scope="col" className="num">Wins</th><th scope="col" className="num">Podiums</th></tr>
                      </thead>
                      <tbody>
                        {s.constructors.map((t) => (
                          <tr key={t.team}>
                            <td className="num">{t.position}</td>
                            <th scope="row">{t.team}</th>
                            <td className="num strong">{pts(t.points)}</td>
                            <td className="num">{t.wins}</td>
                            <td className="num">{t.podiums}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </section>
              </div>
              <p className="ins-source">Points include sprint races. Wins and podiums count Grands Prix only. Source: TracingInsights Stats (MIT).</p>
            </>
          )}
        </div>
      </section>
    </>
  );
}
