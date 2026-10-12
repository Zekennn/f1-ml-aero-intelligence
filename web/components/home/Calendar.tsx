import Media from "../Media";
import SectionHeader from "./SectionHeader";
import { UPCOMING_RACES } from "@/data/site";

export default function Calendar() {
  return (
    <section className="section section--tinted" id="calendar">
      <div className="container">
        <SectionHeader eyebrow="Calendar" title="Upcoming races" subtitle="The next three rounds. Dates are placeholders, so confirm before you travel." />
        <div className="card-grid card-grid--races">
          {UPCOMING_RACES.map((race) => (
            <article key={race.round} className="card race-card">
              <Media src={race.image} alt={`Circuit for the ${race.name}`} label="circuit image" className="card__media" sizes="(max-width: 600px) 100vw, 400px" />
              <div className="card__body">
                <p className="race-card__round">Round {race.round}</p>
                <h3 className="card__title">{race.name}</h3>
                <p className="card__meta">{race.location}</p>
                <p className="race-card__date">{race.date}</p>
              </div>
            </article>
          ))}
        </div>
        <div className="section-cta">
          <a href="#" className="btn btn--primary">Full Calendar</a>
        </div>
      </div>
    </section>
  );
}
