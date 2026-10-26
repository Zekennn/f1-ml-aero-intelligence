"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { aeroForces, coefficients } from "@/lib/aeroPhysics";
import type { SetupId } from "@/lib/car2026";
import { CircuitData, densityFromWeather, formatDuration, formatLap, loadCircuit, TEAMS_2026 } from "@/lib/circuitData";
import { LapTimeModel, loadLapTimeModel } from "@/lib/lapTimeModel";
import { RaceSim, Sample, Summary } from "@/lib/raceSim";
import { TYRE_WINDOWS, TyreTemps, tyreState, WHEELS } from "@/lib/tyreModel";
import StrategyPanel from "./StrategyPanel";
import TrackMap, { MAP_COLOURS } from "./TrackMap";

export type CircuitOption = {
  slug: string;
  name: string;
  round: number;
  laps: number;
  compounds: string[];
  dataSeason: number | null;
  pitLoss: number;
  pitLossEstimated: boolean;
  setup: SetupId;
};

type Props = {
  circuits: CircuitOption[];
  stationary: Record<string, { seconds: number; season: number }>;
  medianStationary: number;
};

type Display = {
  sample: Sample | null;
  lap: number;
  tLap: number;
  lapTime: number;
  tyreAge: number;
  compound: string;
  temps: TyreTemps | null;
  raceTime: number;
  lastLap: number | null;
};

const SPEEDS = [1, 2, 4] as const;
const COMPOUND_LABEL: Record<string, string> = { SOFT: "Soft", MEDIUM: "Medium", HARD: "Hard" };
const EMPTY: Display = { sample: null, lap: 1, tLap: 0, lapTime: 0, tyreAge: 1, compound: "", temps: null, raceTime: 0, lastLap: null };

const fmt = (n: number, d = 0) => n.toLocaleString(undefined, { minimumFractionDigits: d, maximumFractionDigits: d });

export default function TelemetrySimulator({ circuits, stationary, medianStationary }: Props) {
  // ---- inputs ----
  const [slug, setSlug] = useState("");
  const [compound, setCompound] = useState("");
  const [team, setTeam] = useState("");
  const [pitInput, setPitInput] = useState("");
  const [touched, setTouched] = useState(false);

  // ---- data ----
  const [model, setModel] = useState<LapTimeModel | null>(null);
  const [circuit, setCircuit] = useState<CircuitData | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  // ---- run ----
  const simRef = useRef<RaceSim | null>(null);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState<(typeof SPEEDS)[number]>(1);
  const [display, setDisplay] = useState<Display>(EMPTY);
  const [summaries, setSummaries] = useState<Summary[]>([]);
  const [pitPending, setPitPending] = useState(false);
  const [finished, setFinished] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const drawDot = useRef<((x: number, y: number) => void) | null>(null);

  const option = circuits.find((c) => c.slug === slug) ?? null;
  const totalLaps = option?.laps ?? 0;

  useEffect(() => {
    loadLapTimeModel().then(setModel, () => setLoadError("The lap time model could not be loaded."));
  }, []);

  useEffect(() => {
    setCircuit(null);
    if (!slug) return;
    let alive = true;
    loadCircuit(slug).then(
      (c) => alive && setCircuit(c),
      () => alive && setLoadError("Telemetry for this circuit could not be loaded."),
    );
    return () => {
      alive = false;
    };
  }, [slug]);

  // ---- validation ----
  const pitLap = pitInput.trim() === "" ? null : Number(pitInput);
  const pitError =
    pitLap !== null && (!Number.isInteger(pitLap) || pitLap < 1 || (totalLaps > 0 && pitLap > totalLaps))
      ? `Pit lap must be a whole number between 1 and ${totalLaps || "the race lap count"}.`
      : null;
  const missing = [!slug && "circuit", !compound && "tyre compound", !team && "team"].filter(Boolean) as string[];
  const ready = missing.length === 0 && !pitError && !!circuit && !!model;
  const pitStop = team && option ? Math.max(0, option.pitLoss - medianStationary) + (stationary[team]?.seconds ?? medianStationary) : 0;

  // ---- run control ----
  const resetRun = useCallback((message: string | null) => {
    simRef.current = null;
    setPlaying(false);
    setPitPending(false);
    setFinished(false);
    setSummaries([]);
    setDisplay(EMPTY);
    setNotice(message);
  }, []);

  const changeInput = (apply: () => void, resets: boolean) => {
    apply();
    setTouched(true);
    if (simRef.current) {
      if (resets) resetRun("Settings changed. Press Play to start a new run.");
      else if (playing) {
        setPlaying(false);
        setNotice("Settings changed. Press Play to continue.");
      }
    }
  };

  const play = () => {
    if (!ready || !circuit || !model || !option) return;
    if (!simRef.current || finished) {
      if (finished) resetRun(null);
      simRef.current = new RaceSim(circuit, model, {
        slug, team, compound, totalLaps: option.laps, pitLap, pitStopTime: pitStop, stationary: stationary[team]?.seconds ?? medianStationary,
      });
    } else {
      simRef.current.opts.pitLap = pitLap;
    }
    setNotice(null);
    setPlaying(true);
  };

  const togglePlay = () => {
    if (pitPending) return;
    if (playing) setPlaying(false);
    else play();
  };

  const restart = () => {
    resetRun(null);
    setTouched(true);
  };

  // Space toggles play/pause (not while typing in a field)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code !== "Space") return;
      const el = e.target as HTMLElement;
      if (el.closest("input, select, textarea, button, [contenteditable]")) return;
      e.preventDefault();
      togglePlay();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  // ---- animation loop ----
  useEffect(() => {
    if (!playing) return;
    let raf = 0;
    let last = performance.now();
    let lastUi = 0;
    const loop = (now: number) => {
      const sim = simRef.current;
      if (!sim) return;
      const dt = Math.min(0.1, (now - last) / 1000) * speed;
      last = now;
      const events = sim.step(dt);
      for (const ev of events) {
        if (ev.type === "summary") setSummaries((s) => [ev.summary, ...s]);
        if (ev.type === "pit") {
          setPitPending(true);
          setPlaying(false);
        }
        if (ev.type === "finish") {
          setFinished(true);
          setPlaying(false);
        }
      }
      const s = sim.sample();
      drawDot.current?.(s.x, s.y);
      if (now - lastUi > 100 || events.length) {
        lastUi = now;
        setDisplay({
          sample: s, lap: sim.lap, tLap: sim.tLap, lapTime: sim.lapTime, tyreAge: sim.tyreAge, compound: sim.compound,
          temps: sim.temps, raceTime: sim.raceTime + sim.tLap, lastLap: sim.laps.at(-1)?.time ?? null,
        });
      }
      if (!sim.finished && !sim.waitingForPit) raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [playing, speed]);

  const choosePit = (c: string) => {
    const sim = simRef.current;
    if (!sim) return;
    for (const ev of sim.choosePitCompound(c)) {
      if (ev.type === "summary") setSummaries((s) => [ev.summary, ...s]);
      if (ev.type === "finish") setFinished(true);
    }
    setPitPending(false);
    setPlaying(!sim.finished);
  };

  // ---- derived display values ----
  const s = display.sample;
  const rho = densityFromWeather(circuit?.weather);
  const straight = !!s?.aero;
  const forces = s && option ? aeroForces(s.speed, rho, coefficients(option.setup, straight ? "straight" : "corner")) : null;
  const is2025 = circuit?.season === 2025;
  const ref = circuit && team ? circuit.teams[team] : null;
  // eslint-disable-next-line react-hooks/refs
  const isRunning = !!simRef.current;
  const lapLabel = isRunning ? `LAP ${Math.min(display.lap, totalLaps)} / ${totalLaps}` : totalLaps ? `LAP – / ${totalLaps}` : "LAP – / –";
  const statusText = loadError ?? (missing.length ? `Please select a ${missing[0]}.` : pitError ?? (!circuit || !model ? "Loading data…" : null));

  return (
    <div className="tl">
      {/* Inputs + controls */}
      <div className="tl-bar">
        <label className="tl-field">
          <span>Circuit</span>
          <select className="select" value={slug} onChange={(e) => changeInput(() => {
            const next = circuits.find((c) => c.slug === e.target.value);
            setSlug(e.target.value);
            if (next && compound && !next.compounds.includes(compound)) setCompound("");
          }, true)} aria-invalid={touched && !slug}>
            <option value="">Select a circuit</option>
            {circuits.map((c) => (
              <option key={c.slug} value={c.slug}>R{c.round} · {c.name.replace(" Grand Prix", "")}</option>
            ))}
          </select>
          {touched && !slug && <small className="tl-error">Please select a circuit</small>}
        </label>
        <label className="tl-field">
          <span>Tyre compound</span>
          <select className="select" value={compound} onChange={(e) => changeInput(() => setCompound(e.target.value), true)} aria-invalid={touched && !compound}>
            <option value="">Select a tyre</option>
            {(option?.compounds ?? ["SOFT", "MEDIUM", "HARD"]).map((c) => (
              <option key={c} value={c}>{COMPOUND_LABEL[c] ?? c}</option>
            ))}
          </select>
          {touched && !compound && <small className="tl-error">Please select a tyre</small>}
        </label>
        <label className="tl-field">
          <span>Team</span>
          <select className="select" value={team} onChange={(e) => changeInput(() => setTeam(e.target.value), true)} aria-invalid={touched && !team}>
            <option value="">Select a team</option>
            {TEAMS_2026.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
          {touched && !team && <small className="tl-error">Please select a team</small>}
        </label>
        <label className="tl-field tl-field--narrow">
          <span>Pit on lap <em>(optional)</em></span>
          <input type="number" min={1} max={totalLaps || undefined} inputMode="numeric" value={pitInput} placeholder="–"
            onChange={(e) => changeInput(() => setPitInput(e.target.value), false)} aria-invalid={!!pitError} />
          {pitError && <small className="tl-error">{pitError}</small>}
        </label>

        <div className="tl-controls">
          <button type="button" className="tl-btn tl-btn--primary" onClick={togglePlay} disabled={!ready || pitPending}
            aria-keyshortcuts="Space" title={ready ? "Space" : statusText ?? undefined}>
            {playing ? "Pause" : finished ? "Replay" : "Play"}
          </button>
          <button type="button" className="tl-btn" onClick={restart} disabled={!isRunning}>Restart</button>
          <div className="tl-seg" role="group" aria-label="Playback speed">
            {SPEEDS.map((v) => (
              <button key={v} type="button" aria-pressed={speed === v} onClick={() => setSpeed(v)}>{v}x</button>
            ))}
          </div>
        </div>
      </div>
      <p className={`tl-status${notice ? " tl-status--notice" : ""}`} role="status">
        {notice ?? statusText ?? (playing ? "Running · press Space to pause" : finished ? "Race finished" : "Ready · press Play or Space")}
      </p>

      {/* Map + cards */}
      <div className="tl-main">
        <section className="tl-card tl-map" aria-label="Track map">
          <header className="tl-card__head">
            <div>
              <h2 className="tl-card__title">{option?.name ?? "Track map"}</h2>
              {circuit && (
                <p className="tl-card__sub">
                  Data source: {circuit.season} season{is2025 ? " (2026 race not run yet)" : ""}
                  {ref?.proxyFor && <> · {team} uses the {ref.proxyFor} lap (no {circuit.season} data)</>}
                </p>
              )}
            </div>
            <span className="tl-lap">{lapLabel}</span>
          </header>
          <TrackMap circuit={circuit} tel={ref?.telemetry ?? circuit?.fastestLap.telemetry ?? null} drawDot={drawDot}
            label={`Track map of ${option?.name ?? "the circuit"} coloured by throttle and braking`} />
          <ul className="tl-legend">
            <li><i style={{ background: MAP_COLOURS.full }} /> Full throttle</li>
            <li><i style={{ background: MAP_COLOURS.partial }} /> Partial throttle</li>
            <li><i style={{ background: MAP_COLOURS.brake }} /> Braking</li>
          </ul>
        </section>

        <div className="tl-cards">
          <section className="tl-card" aria-label="Car telemetry">
            <h3 className="tl-card__label">Telemetry {ref && <span>· {ref.driver}&apos;s lap {ref.lap} as reference</span>}</h3>
            <div className="tl-big">
              <div><span className="tl-num tl-num--xl">{s ? (s.gear > 0 ? s.gear : "N") : "–"}</span><small>Gear</small></div>
              <div><span className="tl-num tl-num--xl">{s ? fmt(s.speed) : "–"}</span><small>km/h</small></div>
            </div>
            <Meter label="Throttle" value={s?.throttle ?? 0} max={100} unit="%" />
            <Meter label="Brake" value={s?.brake ? 100 : 0} max={100} unit="%" tone="brake" />
            <Meter label="RPM" value={s?.rpm ?? 0} max={13000} unit="rpm" tone="rpm" />
            <div className="tl-aero-row">
              <span className={`tl-badge${straight ? " tl-badge--on" : ""}`}>
                {is2025 ? (straight ? "DRS open" : "DRS closed") : straight ? "Straight Mode" : "Corner Mode"}
              </span>
              <small>{is2025 ? "Real DRS data from the 2025 race" : "Active aero, derived from 2026 telemetry"}</small>
            </div>
          </section>

          <section className="tl-card" aria-label="Aerodynamics">
            <h3 className="tl-card__label">Aero <span>· physics model, ρ {fmt(rho, 3)} kg/m³</span></h3>
            <div className="tl-pair">
              <div><small>Drag</small><span className="tl-num">{forces ? fmt(forces.drag) : "–"}</span> <em>N</em></div>
              <div><small>Downforce</small><span className="tl-num tl-num--blue">{forces ? fmt(forces.downforce) : "–"}</span> <em>N</em></div>
            </div>
            <p className="tl-card__foot">{option ? `${option.setup[0].toUpperCase()}${option.setup.slice(1)} downforce setup · ${straight ? "flaps open" : "flaps closed"}` : "–"}</p>
          </section>

          <section className="tl-card" aria-label="Tyres">
            <h3 className="tl-card__label">Tyres <span className="tl-est">Estimated</span></h3>
            <div className="tl-tyres">
              {WHEELS.map((w) => {
                const t = display.temps?.[w];
                const state = t != null ? tyreState(t, display.compound || compound) : null;
                return (
                  <div key={w} className={`tl-tyre${state ? ` tl-tyre--${state}` : ""}`}>
                    <small>{w}</small>
                    <span className="tl-num">{t != null ? fmt(t) : "–"}</span><em>°C</em>
                    <small className="tl-tyre__state">{state ?? "–"}</small>
                  </div>
                );
              })}
            </div>
            <p className="tl-card__foot">
              {COMPOUND_LABEL[display.compound || compound] ?? "–"} · tyre age {isRunning ? display.tyreAge : 0} {display.tyreAge === 1 ? "lap" : "laps"}
              {(display.compound || compound) && <> · window {TYRE_WINDOWS[display.compound || compound][0]}–{TYRE_WINDOWS[display.compound || compound][1]} °C</>}
            </p>
          </section>

          <section className="tl-card" aria-label="Lap times">
            <h3 className="tl-card__label">Timing</h3>
            <dl className="tl-dl">
              <div><dt>Predicted this lap</dt><dd>{isRunning ? formatLap(display.lapTime) : "–"}</dd></div>
              <div><dt>Real reference lap</dt><dd>{ref ? formatLap(ref.time) : "–"}</dd></div>
              <div><dt>Last lap</dt><dd>{formatLap(display.lastLap)}</dd></div>
              <div><dt>Race time</dt><dd>{isRunning ? formatDuration(display.raceTime) : "–"}</dd></div>
              <div><dt>Pit stop cost</dt><dd>{team && option ? `${fmt(pitStop, 1)} s` : "–"}</dd></div>
            </dl>
          </section>
        </div>
      </div>

      {pitPending && (
        <div className="tl-pit" role="dialog" aria-modal="false" aria-labelledby="tl-pit-title">
          <h3 id="tl-pit-title">Pit stop, lap {display.lap}</h3>
          <p>
            {fmt(stationary[team]?.seconds ?? medianStationary, 2)} s stationary ({team}, {stationary[team]?.season ?? "2026"} average) +{" "}
            {fmt(Math.max(0, (option?.pitLoss ?? 0) - medianStationary), 1)} s pit lane loss{option?.pitLossEstimated ? " (estimated)" : ""}. Pick the new tyres to continue:
          </p>
          <div className="tl-pit__choices">
            {(option?.compounds ?? []).map((c) => (
              <button key={c} type="button" className={`tl-btn tl-compound tl-compound--${c.toLowerCase()}`} onClick={() => choosePit(c)}>
                {COMPOUND_LABEL[c] ?? c}
              </button>
            ))}
          </div>
        </div>
      )}

      {summaries.length > 0 && (
        <section className="tl-summaries" aria-label="Three-lap summaries">
          {summaries.map((sm) => <SummaryCard key={sm.fromLap} s={sm} />)}
        </section>
      )}

      {option && team && model && (
        <StrategyPanel model={model} slug={slug} team={team} totalLaps={option.laps} compounds={option.compounds}
          pitStopTime={pitStop} trackTemp={circuit?.weather.track ?? null} onUsePitLap={(lap) => changeInput(() => setPitInput(String(lap)), false)} />
      )}
    </div>
  );
}

function Meter({ label, value, max, unit, tone }: { label: string; value: number; max: number; unit: string; tone?: "brake" | "rpm" }) {
  const pct = Math.max(0, Math.min(100, (value / max) * 100));
  return (
    <div className="tl-meter">
      <div className="tl-meter__head"><span>{label}</span><span className="tl-num">{fmt(value)} <em>{unit}</em></span></div>
      <div className="tl-meter__track" role="meter" aria-label={label} aria-valuemin={0} aria-valuemax={max} aria-valuenow={Math.round(value)}>
        <span className={`tl-meter__fill${tone ? ` tl-meter__fill--${tone}` : ""}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

function SummaryCard({ s }: { s: Summary }) {
  const diff = s.predicted - s.reference;
  return (
    <article className="tl-card tl-summary">
      <h3 className="tl-card__title">Laps {s.fromLap}–{s.toLap}</h3>
      <dl className="tl-summary__grid">
        <div><dt>Average speed</dt><dd>{fmt(s.avgSpeed)} <em>km/h</em></dd></div>
        <div><dt>Average throttle</dt><dd>{fmt(s.avgThrottle)} <em>%</em></dd></div>
        <div><dt>Top speed</dt><dd>{fmt(s.topSpeed)} <em>km/h</em></dd></div>
        <div>
          <dt>Avg tyre temp <span className="tl-est">Estimated</span></dt>
          <dd className="tl-summary__temps">{WHEELS.map((w) => <span key={w}>{w} {fmt(s.avgTemps[w])}<em>°C</em></span>)}</dd>
        </div>
        <div><dt>Predicted lap (avg)</dt><dd>{formatLap(s.predicted)}</dd></div>
        <div><dt>Real reference lap</dt><dd>{formatLap(s.reference)}</dd></div>
        <div><dt>Difference</dt><dd className={diff > 0 ? "tl-slower" : "tl-faster"}>{diff > 0 ? "+" : "−"}{fmt(Math.abs(diff), 3)} <em>s</em></dd></div>
        <div><dt>Fastest of the 3</dt><dd>{formatLap(s.fastest.time)} <em>lap {s.fastest.lap}</em></dd></div>
        {s.pit && (
          <div className="tl-summary__pit"><dt>Pit stop</dt><dd>Lap {s.pit.lap}: {COMPOUND_LABEL[s.pit.from] ?? s.pit.from} → {COMPOUND_LABEL[s.pit.to] ?? s.pit.to}, {fmt(s.pit.time, 1)} <em>s</em></dd></div>
        )}
      </dl>
    </article>
  );
}
