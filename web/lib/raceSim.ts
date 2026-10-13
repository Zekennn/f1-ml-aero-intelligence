/*
 * Race simulation for the Live telemetry page (pure logic, no React).
 * The car follows the selected team's real reference lap from the TracingInsights telemetry. Each lap is
 * stretched to the lap time the model predicts for that lap (compound, tyre age, fuel, team, circuit),
 * so team, tyre and circuit all change the run. Tyre temperatures are estimated (tyreModel.ts).
 */
import type { CircuitData, LapTelemetry, TeamLap } from "./circuitData";
import { LapTimeModel, predictLapTime } from "./lapTimeModel";
import { freshTyres, stepTyres, TyreTemps, WHEELS } from "./tyreModel";

export type SimOptions = {
  slug: string;
  team: string;
  compound: string;
  totalLaps: number;
  pitLap: number | null;
  pitStopTime: number; // s added at the stop: lane loss + team stationary time
  stationary: number; // s, part of pitStopTime
};

export type Sample = {
  index: number;
  x: number;
  y: number;
  speed: number;
  throttle: number;
  brake: number;
  gear: number;
  rpm: number;
  aero: number;
  gLat: number;
  gLong: number;
};

export type LapRecord = {
  lap: number;
  compound: string;
  tyreAge: number;
  predicted: number; // s, model lap time
  time: number; // s, including any pit stop
  avgSpeed: number;
  avgThrottle: number;
  topSpeed: number;
  avgTemps: TyreTemps;
  pit: { from: string; to: string; time: number; stationary: number } | null;
};

export type Summary = {
  fromLap: number;
  toLap: number;
  avgSpeed: number;
  avgThrottle: number;
  topSpeed: number;
  avgTemps: TyreTemps;
  predicted: number; // average predicted lap time
  reference: number; // team's real reference lap
  fastest: { lap: number; time: number };
  pit: LapRecord["pit"] & { lap: number } | null;
};

export type SimEvent = { type: "lap"; record: LapRecord } | { type: "summary"; summary: Summary } | { type: "pit" } | { type: "finish" };

export class RaceSim {
  readonly ref: TeamLap;
  readonly tel: LapTelemetry;
  lap = 1;
  tLap = 0; // s into the current lap
  lapTime: number;
  tyreAge = 1;
  compound: string;
  temps: TyreTemps = freshTyres();
  raceTime = 0;
  finished = false;
  waitingForPit = false;
  laps: LapRecord[] = [];
  summaries: Summary[] = [];

  private acc = { t: 0, speed: 0, throttle: 0, top: 0, temps: { FL: 0, FR: 0, RL: 0, RR: 0 } as TyreTemps };
  private pendingPit: LapRecord | null = null;

  constructor(
    readonly circuit: CircuitData,
    readonly model: LapTimeModel,
    readonly opts: SimOptions,
  ) {
    this.ref = circuit.teams[opts.team];
    this.tel = this.ref.telemetry;
    this.compound = opts.compound;
    this.lapTime = this.predict();
  }

  /** Model lap time for the current lap. */
  predict(): number {
    const p = predictLapTime(this.model, {
      slug: this.opts.slug,
      team: this.opts.team,
      compound: this.compound,
      tyreAge: this.tyreAge,
      lap: this.lap,
      totalLaps: this.opts.totalLaps,
      trackTemp: this.circuit.weather.track,
    });
    return Number.isFinite(p) ? p : this.ref.time;
  }

  /** How much slower (>1) or faster this lap is than the reference lap. */
  get scale() {
    return this.lapTime / this.ref.time;
  }

  /** Telemetry at the current point of the lap (interpolated, speed scaled to the predicted pace). */
  sample(): Sample {
    const t = this.tel.t;
    const n = t.length;
    const tRef = Math.min(this.tLap / this.scale, this.ref.time - 1e-6);
    let lo = 0;
    let hi = n - 1;
    while (lo < hi) {
      const mid = (lo + hi + 1) >> 1;
      if (t[mid] <= tRef) lo = mid;
      else hi = mid - 1;
    }
    const i = lo;
    const j = (i + 1) % n;
    const tNext = j === 0 ? this.ref.time : t[j];
    const f = Math.min(1, Math.max(0, (tRef - t[i]) / Math.max(1e-6, tNext - t[i])));
    const mix = (a: number[]) => a[i] + (a[j] - a[i]) * f;
    const { x, y } = this.circuit.outline;
    return {
      index: i,
      x: x[i] + (x[j] - x[i]) * f,
      y: y[i] + (y[j] - y[i]) * f,
      speed: mix(this.tel.speed) / this.scale,
      throttle: mix(this.tel.throttle),
      brake: this.tel.brake[i],
      gear: this.tel.gear[i],
      rpm: mix(this.tel.rpm),
      aero: this.tel.aero[i],
      gLat: mix(this.tel.gLat),
      gLong: mix(this.tel.gLong),
    };
  }

  /** Advance simulated time. Returns what happened (lap completed, summary, pit, finish). */
  step(dt: number): SimEvent[] {
    const events: SimEvent[] = [];
    if (this.finished || this.waitingForPit) return events;
    let remaining = dt;
    while (remaining > 0 && !this.finished && !this.waitingForPit) {
      const h = Math.min(remaining, 0.05, this.lapTime - this.tLap);
      const s = this.sample();
      this.temps = stepTyres(this.temps, h, {
        speed: s.speed, gLat: s.gLat, gLong: s.gLong, brake: s.brake,
        compound: this.compound, trackTemp: this.circuit.weather.track ?? 35, tyreAge: this.tyreAge,
      });
      this.acc.t += h;
      this.acc.speed += s.speed * h;
      this.acc.throttle += s.throttle * h;
      this.acc.top = Math.max(this.acc.top, s.speed);
      for (const w of WHEELS) this.acc.temps[w] += this.temps[w] * h;
      this.tLap += h;
      remaining -= h;
      if (this.tLap >= this.lapTime - 1e-9) events.push(...this.completeLap());
    }
    return events;
  }

  private completeLap(): SimEvent[] {
    const a = this.acc;
    const record: LapRecord = {
      lap: this.lap,
      compound: this.compound,
      tyreAge: this.tyreAge,
      predicted: this.lapTime,
      time: this.lapTime,
      avgSpeed: a.speed / a.t,
      avgThrottle: a.throttle / a.t,
      topSpeed: a.top,
      avgTemps: { FL: a.temps.FL / a.t, FR: a.temps.FR / a.t, RL: a.temps.RL / a.t, RR: a.temps.RR / a.t },
      pit: null,
    };
    this.acc = { t: 0, speed: 0, throttle: 0, top: 0, temps: { FL: 0, FR: 0, RL: 0, RR: 0 } };

    if (this.opts.pitLap === this.lap && this.lap < this.opts.totalLaps) {
      // Stop here: wait for the user to pick the new compound
      this.pendingPit = record;
      this.waitingForPit = true;
      return [{ type: "pit" }];
    }
    return this.finishLap(record);
  }

  /** Called after a pit stop once the user has picked the new tyres. */
  choosePitCompound(compound: string): SimEvent[] {
    if (!this.pendingPit) return [];
    const record = this.pendingPit;
    record.pit = { from: this.compound, to: compound, time: this.opts.pitStopTime, stationary: this.opts.stationary };
    record.time += this.opts.pitStopTime;
    this.pendingPit = null;
    this.waitingForPit = false;
    this.compound = compound;
    this.tyreAge = 0; // becomes 1 on the next lap
    this.temps = freshTyres();
    return this.finishLap(record);
  }

  private finishLap(record: LapRecord): SimEvent[] {
    const events: SimEvent[] = [{ type: "lap", record }];
    this.laps.push(record);
    this.raceTime += record.time;
    if (this.lap % 3 === 0) {
      const summary = this.summarise(this.laps.slice(-3));
      this.summaries.push(summary);
      events.push({ type: "summary", summary });
    }
    if (this.lap >= this.opts.totalLaps) {
      this.finished = true;
      this.tLap = this.lapTime;
      events.push({ type: "finish" });
      return events;
    }
    this.lap += 1;
    this.tyreAge += 1;
    this.tLap = 0;
    this.lapTime = this.predict();
    return events;
  }

  private summarise(window: LapRecord[]): Summary {
    const total = window.reduce((s, l) => s + l.predicted, 0);
    const w = (pick: (l: LapRecord) => number) => window.reduce((s, l) => s + pick(l) * l.predicted, 0) / total;
    const fastest = window.reduce((best, l) => (l.time < best.time ? l : best), window[0]);
    const pitLap = window.find((l) => l.pit);
    return {
      fromLap: window[0].lap,
      toLap: window[window.length - 1].lap,
      avgSpeed: w((l) => l.avgSpeed),
      avgThrottle: w((l) => l.avgThrottle),
      topSpeed: Math.max(...window.map((l) => l.topSpeed)),
      avgTemps: { FL: w((l) => l.avgTemps.FL), FR: w((l) => l.avgTemps.FR), RL: w((l) => l.avgTemps.RL), RR: w((l) => l.avgTemps.RR) },
      predicted: total / window.length,
      reference: this.ref.time,
      fastest: { lap: fastest.lap, time: fastest.time },
      pit: pitLap?.pit ? { ...pitLap.pit, lap: pitLap.lap } : null,
    };
  }
}
