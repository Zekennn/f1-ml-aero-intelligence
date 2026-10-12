import SectionHeader from "./SectionHeader";
import CalendarView from "../calendar/CalendarView";
import { getCalendar } from "@/lib/calendar";

export default async function Calendar() {
  const calendar = await getCalendar();

  return (
    <section className="section section--tinted" id="calendar">
      <div className="container">
        <SectionHeader
          eyebrow="Calendar"
          title={`${calendar.season ?? ""} race calendar`.trim()}
          subtitle="Every round of the season. Select a race for results, track history and active aero details."
        />
        <CalendarView calendar={calendar} />
      </div>
    </section>
  );
}
