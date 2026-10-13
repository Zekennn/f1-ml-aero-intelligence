"use client";

import { useEffect, useRef } from "react";
import Countdown from "./Countdown";
import TrackImage from "./TrackImage";
import { formatRaceDate } from "@/lib/calendar-format";
import type { Race } from "@/lib/calendar";

const EMPTY = "—";

/** A label/value row; shows a dash when there's no value. */
function Fact({ label, children }: { label: string; children?: React.ReactNode }) {
  return (
    <div className="race-detail__fact">
      <dt>{label}</dt>
      <dd>{children ?? EMPTY}</dd>
    </div>
  );
}

const withTeam = (p?: { driver: string; team?: string } | null) =>
  p ? <>{p.driver}{p.team && <span className="race-detail__muted"> · {p.team}</span>}</> : undefined;

/**
 * Track detail in a native <dialog>: Escape, the close button or a click
 * outside the panel closes it. On phones it becomes a full-width bottom sheet.
 */
export default function RaceDetail({ race, season, onClose }: { race: Race | null; season: number | null; onClose: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (race && !dialog.open) dialog.showModal();
    if (!race && dialog.open) dialog.close();
  }, [race]);

  const completed = race?.status === "completed";
  const result = race?.result;
  const history = race?.history;
  const year = season ?? new Date().getFullYear();

  return (
    <dialog
      ref={ref}
      className="race-detail"
      aria-labelledby="race-detail-title"
      onClose={onClose}
      onClick={(e) => e.target === e.currentTarget && ref.current?.close()}
    >
      {race && (
        <div className="race-detail__panel">
          <header className="race-detail__head">
            <p className="race-detail__eyebrow">
              Round {race.round}
              <span className={`cal-badge cal-badge--${race.status}`}>{completed ? "Completed" : "Upcoming"}</span>
            </p>
            <button type="button" className="race-detail__close" aria-label="Close" onClick={() => ref.current?.close()}>
              <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" /></svg>
            </button>
          </header>

          <TrackImage race={race} size="medium" />

          <h2 id="race-detail-title" className="race-detail__title">{race.name}</h2>
          {race.track.heldAt && <p className="race-detail__note">This year&apos;s event: {race.track.heldAt}.</p>}
          <dl className="race-detail__facts">
            <Fact label="Circuit">{race.circuit}</Fact>
            <Fact label="Country">{race.location && race.location !== race.country ? `${race.location}, ${race.country}` : race.country}</Fact>
            <Fact label="Race day">{formatRaceDate(race.date)}</Fact>
            <Fact label="Laps">
              {race.laps != null && (
                <>
                  {race.laps}
                  {race.lapsFrom !== year && race.lapsFrom && <span className="race-detail__muted"> (as in {race.lapsFrom})</span>}
                </>
              )}
            </Fact>
          </dl>

          {completed ? (
            <section className="race-detail__section">
              <h3>{year} results</h3>
              {result ? (
                <>
                  <dl className="race-detail__facts">
                    <Fact label="Winner">{withTeam(result.winner)}</Fact>
                    <Fact label="Pole position">{withTeam(result.pole)}</Fact>
                    <Fact label="Fastest lap">
                      {result.fastestLap && <>{result.fastestLap.driver}{result.fastestLap.time && <span className="race-detail__muted"> · {result.fastestLap.time}</span>}</>}
                    </Fact>
                  </dl>
                  {result.podium.length > 0 && (
                    <ol className="podium">
                      {result.podium.map((p) => (
                        <li key={p.position} className={`podium__step podium__step--p${p.position}`}>
                          <span className="podium__pos">P{p.position}</span>
                          <span className="podium__driver">{p.driver}</span>
                          <span className="podium__team">{p.team}</span>
                        </li>
                      ))}
                    </ol>
                  )}
                </>
              ) : (
                <p className="race-detail__empty">Results will show here after the next data refresh.</p>
              )}
            </section>
          ) : (
            <section className="race-detail__section">
              <h3>Countdown to race day</h3>
              {race.raceStartUtc ? <Countdown target={race.raceStartUtc} /> : <p className="race-detail__empty">Start time not announced yet.</p>}
            </section>
          )}

          <section className="race-detail__section">
            <h3>Track history</h3>
            <dl className="race-detail__facts">
              <Fact label="First winner">{history?.firstWinner && <>{history.firstWinner.driver} <span className="race-detail__muted">({history.firstWinner.year})</span></>}</Fact>
              <Fact label="Times held">{history?.timesHeld ?? undefined}</Fact>
              <Fact label={`Previous winner (${year - 1})`}>
                {history?.previousWinner && (
                  <>
                    {withTeam(history.previousWinner)}
                    {history.previousWinner.event && <span className="race-detail__muted"> ({history.previousWinner.event})</span>}
                  </>
                )}
              </Fact>
              <Fact label="Most wins">
                {history?.mostWins && <>{history.mostWins.drivers.join(", ")} <span className="race-detail__muted">· {history.mostWins.wins} {history.mostWins.wins === 1 ? "win" : "wins"}</span></>}
              </Fact>
              <Fact label="Race lap record">
                {history?.lapRecord && <>{history.lapRecord.time} <span className="race-detail__muted">· {history.lapRecord.driver}, {history.lapRecord.year}</span></>}
              </Fact>
              <Fact label="Fastest pit stop">
                {race.track.fastestPitStop && (
                  <>
                    {race.track.fastestPitStop.time.toFixed(2)} s{" "}
                    <span className="race-detail__muted">· {race.track.fastestPitStop.team} ({race.track.fastestPitStop.driver}), {race.track.fastestPitStop.year}</span>
                  </>
                )}
              </Fact>
              <Fact label="Pit lane time loss">{race.track.pitLoss != null ? `${race.track.pitLoss.toFixed(1)} s` : undefined}</Fact>
            </dl>
          </section>

          <section className="race-detail__section">
            <h3>Active aero</h3>
            <dl className="race-detail__facts">
              <Fact label="Active aero zones">
                {race.aero.zones ?? (race.track.aeroZonesDerived != null ? (
                  <>{race.track.aeroZonesDerived} <span className="race-detail__muted">(derived from 2026 telemetry)</span></>
                ) : undefined)}
              </Fact>
            </dl>
            <p className="race-detail__note">{race.aero.note || "No notes for this track yet."}</p>
          </section>

          <p className="race-detail__source">
            Data source: {race.track.dataSeason ? `${race.track.dataSeason} season telemetry` : "no telemetry yet"}
            {race.track.dataSeason && race.track.dataSeason < year ? " (this year's race isn't in the data yet)" : ""} · history from{" "}
            {race.track.historySource}. The lap record counts race laps on the current layout (approximate).
          </p>
        </div>
      )}
    </dialog>
  );
}
