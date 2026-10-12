import Media from "./Media";
import { type Race, isFinished, isRaceWeek, raceDates, trackImage } from "@/data/calendar";

/** One round of the calendar: track photo, round badge, status and dates. */
export default function RaceCard({ race, isNext = false }: { race: Race; isNext?: boolean }) {
  const finished = isFinished(race);
  const status = isRaceWeek(race) ? "Race week" : isNext ? "Next race" : finished ? "Finished" : null;

  return (
    <article className={`card race-card ${finished ? "race-card--finished" : ""}`}>
      <div className="race-card__media">
        <Media
          src={trackImage(race)}
          alt={`${race.circuit}, home of the ${race.name}`}
          label="track image"
          className="card__media"
          sizes="(max-width: 600px) 100vw, (max-width: 1024px) 50vw, 400px"
        />
        <span className="race-card__badge">R{race.round}</span>
        {status && <span className={`race-card__status race-card__status--${finished ? "done" : "live"}`}>{status}</span>}
      </div>
      <div className="card__body">
        <p className="race-card__round">Round {race.round} · {race.location}</p>
        <h3 className="card__title">{race.name}</h3>
        <p className="card__meta">{race.circuit}</p>
        <p className="race-card__date">{raceDates(race)}</p>
      </div>
    </article>
  );
}
