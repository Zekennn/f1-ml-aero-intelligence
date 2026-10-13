"use client";

import type { ReactNode } from "react";
import { CAR, MODES, SETUPS } from "@/lib/car2026";
import AnimatedNumber from "./AnimatedNumber";
import ForceSpeedChart from "./ForceSpeedChart";
import type { AeroModel } from "./types";

function Group({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="wt-group">
      <h3 className="wt-group__title">{title}</h3>
      {children}
    </section>
  );
}

function Row({ label, hint, accent, children }: { label: string; hint?: string; accent?: boolean; children: ReactNode }) {
  return (
    <div className="wt-row">
      <span className="wt-row__label">
        {label}
        {hint && <small>{hint}</small>}
      </span>
      <span className={`wt-row__value${accent ? " wt-row__value--blue" : ""}`}>{children}</span>
    </div>
  );
}

function change(to: number, from: number) {
  if (!from) return "–";
  const pct = ((to - from) / from) * 100;
  return `${pct > 0 ? "+" : ""}${pct.toFixed(0)}%`;
}

/** Live readout next to the wind tunnel: conditions, physics forces, performance and mode comparison. */
export default function DetailPanel({ model, instant }: { model: AeroModel; instant: boolean }) {
  const n = (value: number, decimals = 0) => <AnimatedNumber value={value} decimals={decimals} instant={instant} />;
  const { inputs, rho, flaps, result: r, corner, straight } = model;
  const isCorner = inputs.mode === "corner";

  return (
    <aside className="wt-panel" aria-label="Wind tunnel details">
      <Group title="Conditions">
        <Row label="Speed">
          {n(inputs.speedKmh)} km/h <span className="wt-sub">· {n(r.v, 1)} m/s</span>
        </Row>
        <Row label="Air density">{n(rho, 3)} kg/m³</Row>
        <Row label="Mode">
          <span className={`badge${isCorner ? "" : " badge--blue"}`}>{MODES[inputs.mode].label}</span>
        </Row>
        <Row label="Setup">{SETUPS[inputs.setup].label}</Row>
        <Row label="Flap angles" hint="front / rear, illustrative">
          {n(flaps.front)}° / {n(flaps.rear)}°
        </Row>
      </Group>

      <Group title="Forces · physics">
        <Row label="Drag">{n(r.drag)} N</Row>
        <Row label="Downforce" accent>
          {n(r.downforce)} N <span className="wt-sub">· {n(r.downforceKg)} kg</span>
        </Row>
        <Row label="Front / rear split" hint={`${Math.round(model.coeffs.balanceFront * 100)}% front`}>
          {n(r.front)} / {n(r.rear)} N
        </Row>
        <Row label="Aero efficiency (L/D)">{n(r.ld, 2)}</Row>
      </Group>

      <Group title="Performance">
        <Row label="Drag power">{n(r.powerKw)} kW</Row>
        <Row label="Downforce vs car weight" hint={`${CAR.massKg} kg car`}>
          {n(r.weights, 2)}× weight
        </Row>
        <Row label="Est. top speed" hint="simplified, see Physics">
          {n(r.topSpeedKmh)} km/h
        </Row>
      </Group>

      <Group title="Corner vs Straight Mode">
        <p className="wt-caption-sm">At {Math.round(inputs.speedKmh)} km/h, {SETUPS[inputs.setup].label.toLowerCase()}</p>
        <table className="wt-compare">
          <thead>
            <tr>
              <th scope="col"><span className="sr-only">Force</span></th>
              <th scope="col">Corner</th>
              <th scope="col">Straight</th>
              <th scope="col">Change</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <th scope="row">Drag (N)</th>
              <td>{n(corner.drag)}</td>
              <td>{n(straight.drag)}</td>
              <td>{change(straight.drag, corner.drag)}</td>
            </tr>
            <tr>
              <th scope="row">Downforce (N)</th>
              <td>{n(corner.downforce)}</td>
              <td>{n(straight.downforce)}</td>
              <td>{change(straight.downforce, corner.downforce)}</td>
            </tr>
          </tbody>
        </table>
      </Group>

      <Group title="Forces vs speed">
        <ForceSpeedChart setup={inputs.setup} rho={rho} speedKmh={inputs.speedKmh} />
      </Group>
    </aside>
  );
}
