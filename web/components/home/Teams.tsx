import Media from "../Media";
import SectionHeader from "./SectionHeader";
import { TEAMS, teamCar, teamLogo } from "@/data/teams";

export default function Teams() {
  return (
    <section className="section section--tinted" id="teams">
      <div className="container">
        <SectionHeader eyebrow="Teams" title="The constructors" subtitle="Eleven teams, two cars each. Placeholder intro text you can edit." />
        <div className="card-grid card-grid--teams">
          {TEAMS.map((team) => (
            <article key={team.slug} className="card team-card" style={{ "--team-colour": team.colour } as React.CSSProperties}>
              {/* Car on a light background tinted with the team colour */}
              <div className="team-card__stage">
                <Media src={teamCar(team)} alt={`${team.name} car`} label="car image" className="team-card__car" sizes="(max-width: 600px) 90vw, 280px" />
              </div>
              <div className="card__body">
                <div className="team-card__head">
                  {/* White logo needs a dark badge to stay visible on any team colour */}
                  <Media src={teamLogo(team)} alt={`${team.name} logo`} label="" className="team-logo" sizes="40px" />
                  <h3 className="card__title">{team.name}</h3>
                </div>
                <p className="card__meta">{team.text}</p>
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
