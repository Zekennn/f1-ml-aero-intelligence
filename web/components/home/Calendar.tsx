import Link from "next/link";
import RaceCard from "../RaceCard";
import SectionHeader from "./SectionHeader";
import { upcomingRaces } from "@/data/calendar";

export default function Calendar() {
  const races = upcomingRaces(3);

  return (
    <section className="section section--tinted" id="calendar">
      <div className="container">
        <SectionHeader eyebrow="Calendar" title="Upcoming races" subtitle="The next three rounds of the 2026 season. Confirm dates before you travel." />
        <div className="card-grid card-grid--races">
          {races.map((race, i) => (
            <RaceCard key={race.round} race={race} isNext={i === 0} />
          ))}
        </div>
        <div className="section-cta">
          <Link href="/calendar" className="btn btn--primary">Full Calendar</Link>
        </div>
      </div>
    </section>
  );
}
