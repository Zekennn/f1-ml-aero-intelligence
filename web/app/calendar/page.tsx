import type { Metadata } from "next";
import PageHead from "@/components/PageHead";
import RaceCard from "@/components/RaceCard";
import { RACES, isFinished, upcomingRaces } from "@/data/calendar";

export const metadata: Metadata = { title: "Calendar" };

// Re-render hourly so "Finished" / "Next race" follow the real date
export const revalidate = 3600;

export default function CalendarPage() {
  const next = upcomingRaces(1)[0];
  const done = RACES.filter(isFinished).length;

  return (
    <>
      <PageHead
        eyebrow="Season 2026"
        title="Race calendar"
        text={`${RACES.length} rounds across five continents. ${done} completed, ${RACES.length - done} to go. Confirm dates before you travel.`}
      />
      <section className="page-body">
        <div className="container">
          <div className="card-grid card-grid--races">
            {RACES.map((race) => (
              <RaceCard key={race.round} race={race} isNext={!isFinished(race) && race.round === next.round} />
            ))}
          </div>
        </div>
      </section>
    </>
  );
}
