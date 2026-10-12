import Media from "../Media";
import SectionHeader from "./SectionHeader";
import { TEAMS } from "@/data/teams";

export default function Teams() {
  return (
    <section className="section section--tinted" id="teams">
      <div className="container">
        <SectionHeader eyebrow="Teams" title="The constructors" subtitle="Eleven teams, two cars each. Placeholder intro text you can edit." />
        <div className="card-grid card-grid--teams">
          {TEAMS.map((team) => (
            <article key={team.name} className="card team-card" style={{ "--team-colour": team.colour } as React.CSSProperties}>
              <Media src={team.image} alt={`${team.name} team`} label="team image" className="card__media" sizes="(max-width: 600px) 100vw, 300px" />
              <div className="card__body">
                <h3 className="card__title">{team.name}</h3>
                <p className="card__meta">{team.text}</p>
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
