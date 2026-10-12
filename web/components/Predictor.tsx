"use client";

import { useEffect, useState } from "react";
import { API } from "@/lib/backend";
import BackendNotice from "./BackendNotice";

type Prediction = { Driver: string; CurrentTeam: string; WinProbability: number };
type State =
  | { kind: "loading" }
  | { kind: "offline" }
  | { kind: "error" }
  | { kind: "ready"; predictions: Prediction[] };

/** Drivers' championship win probability, from /api/drivers-champ. */
export default function Predictor() {
  const [state, setState] = useState<State>({ kind: "loading" });

  useEffect(() => {
    fetch(`${API}/api/drivers-champ`)
      .then((r) => {
        if (!r.ok) throw new Error(String(r.status));
        return r.json();
      })
      .then((data) => {
        if (data.error) setState({ kind: "error" }); // backend couldn't find predictor_results.json
        else setState({ kind: "ready", predictions: data.predictions });
      })
      .catch(() => setState({ kind: "offline" }));
  }, []);

  if (state.kind === "loading") return <p className="section-subtitle">Loading predictions…</p>;
  if (state.kind === "offline") return <BackendNotice />;
  if (state.kind === "error") {
    return (
      <div className="notice" role="alert">
        Predictions haven&apos;t been generated yet. Run <code>python backend/train_predictor.py</code>, then refresh.
      </div>
    );
  }

  const max = Math.max(...state.predictions.map((p) => p.WinProbability), 1);

  return (
    <ol className="pred-list">
      {state.predictions.map((p, i) => (
        <li className="pred-row" key={p.Driver}>
          <span className={`pred-row__rank ${i < 3 ? "pred-row__rank--top" : ""}`}>{i + 1}</span>
          <div>
            <div className="pred-row__name">{p.Driver}</div>
            <div className="pred-row__team">{p.CurrentTeam}</div>
          </div>
          <div className="bar">
            <div className="bar__fill" style={{ width: `${((p.WinProbability / max) * 100).toFixed(1)}%` }} />
          </div>
          <span className="pred-row__prob">{p.WinProbability}%</span>
        </li>
      ))}
    </ol>
  );
}
