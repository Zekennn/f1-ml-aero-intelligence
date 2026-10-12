import Media from "../Media";
import SectionHeader from "./SectionHeader";
import { teamLogo } from "@/data/teams";
import { getDrivers } from "@/lib/drivers";
import { formatUpdated } from "@/lib/calendar-format";

export default async function Drivers() {
  const { drivers, season, afterRound, updated } = await getDrivers();

  return (
    <section className="section" id="drivers">
      <div className="container">
        <SectionHeader
          eyebrow="Drivers"
          title={`${season ?? ""} driver standings`.trim()}
          subtitle="Every driver in this year's championship, in points order, with their current team."
        />
        <p className="data-updated">
          {afterRound ? `After round ${afterRound} · ` : ""}Data last updated: {formatUpdated(updated)}
        </p>

        {drivers.length === 0 ? (
          <p className="cal-empty">
            No driver data yet. Start the backend, or run <code>.\venv\Scripts\python.exe backend\update_data.py</code>
          </p>
        ) : (
          <div className="card-grid card-grid--drivers">
            {drivers.map((d) => {
              const team = d.siteTeam;
              return (
                <article key={d.driverId} className={`card driver-card ${d.inLatestRace ? "" : "driver-card--inactive"}`}>
                  <div className="driver-card__photo">
                    {/* Photos are full-length cut-outs, so anchor to the top to show head and shoulders */}
                    {d.image ? (
                      <Media src={d.image} alt={d.name} label="driver photo" className="card__media" objectPosition="center top" sizes="(max-width: 600px) 50vw, 240px" />
                    ) : (
                      <div className="media is-missing card__media" data-label="driver photo" role="img" aria-label={`No photo of ${d.name} yet`} />
                    )}
                    {d.position && <span className="driver-card__position" aria-label={`Championship position ${d.position}`}>P{d.position}</span>}
                  </div>
                  <div className="card__body">
                    <div>
                      <h3 className="card__title">{d.name}</h3>
                      <div className="card__meta driver-card__team">
                        {team && <Media src={teamLogo(team)} alt="" className="team-logo team-logo--sm" sizes="22px" />}
                        {team?.name ?? d.team}
                      </div>
                    </div>
                    {d.number != null && <span className="driver-card__number" aria-label="Car number">{d.number}</span>}
                  </div>
                  <dl className="driver-card__stats">
                    <div><dt>Points</dt><dd>{d.points}</dd></div>
                    <div><dt>Wins</dt><dd>{d.wins}</dd></div>
                    <div><dt>Podiums</dt><dd>{d.podiums}</dd></div>
                  </dl>
                  {!d.inLatestRace && <p className="driver-card__note">Not in the latest race</p>}
                </article>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
}
