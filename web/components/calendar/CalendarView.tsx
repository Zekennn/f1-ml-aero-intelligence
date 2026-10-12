"use client";

import { useState } from "react";
import RaceCard from "./RaceCard";
import RaceDetail from "./RaceDetail";
import { formatUpdated } from "@/lib/calendar-format";
import type { Calendar } from "@/lib/calendar";

type Filter = "all" | "upcoming" | "completed";

/** Filter bar, grid of race cards and the track detail dialog. */
export default function CalendarView({ calendar }: { calendar: Calendar }) {
  const [filter, setFilter] = useState<Filter>("all");
  // Keep the round, not the race object, so the open panel shows fresh data after a live refresh
  const [openRound, setOpenRound] = useState<number | null>(null);

  const races = calendar.races.filter((race) => filter === "all" || race.status === filter);
  const open = calendar.races.find((race) => race.round === openRound) ?? null;

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
          No calendar data yet. Start the backend, or run <code>.\venv\Scripts\python.exe backend\update_data.py</code>
        </p>
      ) : races.length === 0 ? (
        <p className="cal-empty">No {filter} races.</p>
      ) : (
        <div className="cal-grid">
          {races.map((race) => (
            <RaceCard key={race.round} race={race} onOpen={(r) => setOpenRound(r.round)} />
          ))}
        </div>
      )}

      <RaceDetail race={open} season={calendar.season} onClose={() => setOpenRound(null)} />
    </>
  );
}
