import TrackImage from "./TrackImage";
import { formatRaceDate } from "@/lib/calendar-format";
import type { Race } from "@/lib/calendar";

/** Calendar card. The whole card is a button that opens the track detail. */
export default function RaceCard({ race, onOpen }: { race: Race; onOpen: (race: Race) => void }) {
  const completed = race.status === "completed";
  const winner = race.result?.winner?.driver;

  return (
    <button
      type="button"
      className={`cal-card ${race.isNext ? "cal-card--next" : ""}`}
      onClick={() => onOpen(race)}
      aria-haspopup="dialog"
    >
      <span className="cal-card__top">
        <span className="cal-card__round">Round {race.round}</span>
        <span className="cal-card__badges">
          {race.isNext && <span className="cal-badge cal-badge--next">Next race</span>}
          <span className={`cal-badge cal-badge--${race.status}`}>{completed ? "Completed" : "Upcoming"}</span>
        </span>
      </span>

      <span className="cal-card__main">
        <TrackImage race={race} size="thumb" />
        <span className="cal-card__text">
          <span className="cal-card__name">{race.name}</span>
          <span className="cal-card__country">{race.country}</span>
          <span className="cal-card__date">{formatRaceDate(race.date)}</span>
        </span>
      </span>

      <span className="cal-card__foot">
        {completed ? (
          <>
            <span className="cal-card__label">Winner</span>
            <span className="cal-card__winner">{winner ?? "Results pending"}</span>
          </>
        ) : (
          <span className="cal-card__label">{race.circuit ?? "Track details"}</span>
        )}
        <span className="cal-card__more" aria-hidden="true">Details →</span>
      </span>
    </button>
  );
}
