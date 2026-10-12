import Media from "../Media";
import SectionHeader from "./SectionHeader";
import { DRIVERS } from "@/data/drivers";
import { TEAMS, teamLogo } from "@/data/teams";

export default function Drivers() {
  return (
    <section className="section" id="drivers">
      <div className="container">
        <SectionHeader eyebrow="Drivers" title="This season's line-up" subtitle="Placeholder intro text about the driver line-up." />
        <div className="card-grid card-grid--drivers">
          {DRIVERS.map((d) => {
            const team = TEAMS.find((t) => t.name === d.team);
            return (
              <article key={d.name} className="card driver-card">
                {/* Photos are full-length cut-outs, so anchor to the top to show head and shoulders */}
                <Media src={d.image} alt={d.name} label="driver photo" className="card__media" objectPosition="center top" sizes="(max-width: 600px) 50vw, 240px" />
                <div className="card__body">
                  <div>
                    <h3 className="card__title">{d.name}</h3>
                    <div className="card__meta driver-card__team">
                      {team && <Media src={teamLogo(team)} alt="" className="team-logo team-logo--sm" sizes="22px" />}
                      {d.team}
                    </div>
                  </div>
                  <span className="driver-card__number" aria-label="Car number">{d.number}</span>
                </div>
              </article>
            );
          })}
        </div>
      </div>
    </section>
  );
}
