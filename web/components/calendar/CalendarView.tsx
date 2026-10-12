"use client";

import { useState } from "react";
import RaceCard from "./RaceCard";
import RaceDetail from "./RaceDetail";
import { formatUpdated } from "@/lib/calendar-format";
import type { Calendar, Race } from "@/lib/calendar";

type Filter = "all" | "upcoming" | "completed";

/** Filter bar, grid of race cards and the track detail dialog. */
export default function CalendarView({ calendar }: { calendar: Calendar }) {
  const [filter, setFilter] = useState<Filter>("all");
  const [open, setOpen] = useState<Race | null>(null);

  const races = calendar.races.filter((race) => filter === "all" || race.status === filter);

  return (
    <>
      <div className="cal-toolbar">
        <p className="cal-toolbar__updated">Data last updated: {formatUpdated(calendar.updated)}</p>
        <label className="cal-toolbar__filter">
          <span>Show</span>
          <select value={filter} onChange={(e) => setFilter(e.target.value as Filter)}>
            <option value="all">All races</option>
            <option value="upcoming">Upcoming</option>
            <option value="completed">Completed</option>
          </select>
        </label>
      </div>

      {calendar.races.length === 0 ? (
        <p className="cal-empty">
          No calendar data yet. From the project folder run <code>.\venv\Scripts\python.exe backend\update_calendar.py</code>
        </p>
      ) : races.length === 0 ? (
        <p className="cal-empty">No {filter} races.</p>
      ) : (
        <div className="cal-grid">
          {races.map((race) => (
            <RaceCard key={race.round} race={race} onOpen={setOpen} />
          ))}
        </div>
      )}

      <RaceDetail race={open} season={calendar.season} onClose={() => setOpen(null)} />
    </>
  );
}
