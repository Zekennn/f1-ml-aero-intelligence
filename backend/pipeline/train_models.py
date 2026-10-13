"""
Train and export the website's models.

1. Lap time model  (gradient-boosted trees, exported to JSON and run in the browser)
   Data: 2025 + 2026 telemetry-repo race lap times (compound, tyre life, track temperature)
         + Stats-repo race lap times and results 2018–2024 (tyre age from pit stops, compound unknown)
   Features: circuit, season, compound, tyre age, track temperature, fuel load (fuel-corrected lap),
             team, team form (points in the previous 3 races), grid position, estimated lap length
   Test: the most recent completed 2026 races (held out), MAE in seconds.

2. Aero calibration: effective power at top speed fitted so the physics model's top speeds match
   real 2026 top speeds in the telemetry (Straight Mode CdA from web/lib/car2026.ts).

Writes web/public/data/models/laptime.json, web/data/aero-calibration.json, models/MODEL_REPORT.md
Run:  venv\\Scripts\\python.exe backend\\pipeline\\train_models.py
"""
from __future__ import annotations

import datetime as dt
import math
import statistics
from collections import defaultdict

import numpy as np
from sklearn.ensemble import HistGradientBoostingRegressor
from sklearn.metrics import mean_absolute_error

from build_site_data import canonical_gp, is_clean_lap, laps_table, load_all_races
from common import (
    MODELS_DIR, PUBLIC_DATA, SEASON, STATS, TEAMS_2026, WEB_DATA, fetch_race_file, lap_str_to_seconds,
    list_repo_grands_prix, log, num, read_json, team_2026, write_json,
)

FIRST_STATS_SEASON = 2018
TEST_RACES = 3  # most recent completed 2026 races held out for testing
COMPOUNDS = ["SOFT", "MEDIUM", "HARD", "UNKNOWN"]
FUEL_START_KG = {2018: 105, 2026: 70}  # 2019–2025: 110 kg; 2026 cars start with ~70 kg
FEATURES = ["circuit", "season", "compound", "tyre_age", "track_temp", "fuel_kg", "team", "team_form", "grid", "est_km", "anchor"]
SEC_PER_KM = 17.6  # typical race pace, used as the anchor at circuits with no earlier fastest lap
CATEGORICAL = ["circuit", "compound", "team"]

# Downforce setup each 2026 track runs (for the aero calibration)
LOW_DF = {"italian", "las-vegas", "azerbaijan", "belgian", "canadian"}
HIGH_DF = {"monaco", "singapore", "hungarian", "dutch", "mexico-city"}
STRAIGHT_CDA = 0.75  # Medium setup, Straight Mode (web/lib/car2026.ts)
SETUP_SCALE = {"low": 0.85, "medium": 1.0, "high": 1.15}


def fuel_start(season: int) -> float:
    return FUEL_START_KG.get(season, 110.0)


def est_lap_km(circuit_id: str | None, total_laps: int) -> float:
    """Race distance ≈ 305 km (Monaco 260 km) divided by the number of laps."""
    dist = 260.0 if circuit_id == "monaco" else 305.0
    return round(dist / max(total_laps, 1), 3)


# ---------------------------------------------------------------------------
# Context from the Stats repo
# ---------------------------------------------------------------------------
class RaceIndex:
    def __init__(self):
        self.races = load_all_races(FIRST_STATS_SEASON)
        # Fastest race lap per circuit and season since 2004 (for the pace anchor)
        self.fastest = defaultdict(dict)
        for r in load_all_races(2004):
            best = min((x["flTime"] for x in r["results"] if x["flTime"]), default=None)
            if best and r["circuitId"]:
                prev = self.fastest[r["circuitId"]].get(r["season"])
                self.fastest[r["circuitId"]][r["season"]] = min(best, prev) if prev else best
        self.by_key = {}
        for r in self.races:
            if r["results"]:
                self.by_key[(r["season"], r["gp"])] = r
        # Team points per round, for team form
        self.team_points = defaultdict(dict)  # (season, team) -> {round: points}
        for r in self.races:
            for x in r["results"]:
                d = self.team_points[(r["season"], x["team2026"])]
                d[r["round"]] = d.get(r["round"], 0) + x["points"]

    def anchor(self, circuit_id: str | None, season: int, est_km: float) -> float:
        """
        Pace reference for a circuit: the median of its fastest race laps in every season before the current one
        (2004–2025). One constant per circuit, so training rows of any year share it; the `season` feature
        handles changes between eras. Circuits never raced before use lap length × 17.6 s/km.
        """
        laps = [t for y, t in self.fastest.get(circuit_id, {}).items() if y < SEASON]
        return round(statistics.median(laps), 3) if laps else round(est_km * SEC_PER_KM, 3)

    def find(self, season: int, gp_name: str):
        return self.by_key.get((season, canonical_gp(gp_name)))

    def team_form(self, season: int, team: str, rnd: int) -> float:
        pts = self.team_points.get((season, team), {})
        return float(sum(pts.get(r, 0) for r in range(rnd - 3, rnd)))


# ---------------------------------------------------------------------------
# Dataset
# ---------------------------------------------------------------------------
def telemetry_rows(idx: RaceIndex, season: int) -> list[dict]:
    rows = []
    for gp in list_repo_grands_prix(season):
        event = idx.find(season, gp)
        if not event:
            continue
        laps = laps_table(fetch_race_file(season, gp, "session_laptimes.json") or {})
        clean = [l for l in laps if is_clean_lap(l)]
        if len(clean) < 50:
            continue
        med = statistics.median(num(l["time"]) for l in clean)
        total = max(int(num(l.get("lap"), 0)) for l in laps)
        grid = {x["code"]: x["grid"] for x in event["results"]}
        for l in clean:
            t = num(l["time"])
            if t > 1.07 * med:
                continue
            team = team_2026(l.get("team"))
            lap = int(num(l["lap"]))
            rows.append({
                "season": season, "round": event["round"], "gp": gp, "circuit": event["circuitId"],
                "compound": l["compound"], "tyre_age": num(l.get("life"), np.nan), "track_temp": num(l.get("wTT"), np.nan),
                "fuel_kg": fuel_start(season) * (1 - (lap - 1) / total), "team": team,
                "team_form": idx.team_form(season, team, event["round"]), "grid": grid.get(l.get("drv"), np.nan) or np.nan,
                "est_km": est_lap_km(event["circuitId"], total), "lap": lap, "time": t, "source": f"telemetry {season}",
                "anchor": idx.anchor(event["circuitId"], season, est_lap_km(event["circuitId"], total)),
            })
    return rows


def stats_rows(idx: RaceIndex, seasons: range) -> list[dict]:
    rows = []
    for r in idx.races:
        if r["season"] not in seasons or not r["results"]:
            continue
        folder = STATS / str(r["season"]) / r["folder"]
        lt = read_json(folder / "laptimes.json")
        try:
            laps = lt["MRData"]["RaceTable"]["Races"][0]["Laps"]
        except (TypeError, KeyError, IndexError):
            continue
        stops = defaultdict(list)
        ps = read_json(folder / "pitstops.json")
        try:
            for s in ps["MRData"]["RaceTable"]["Races"][0]["PitStops"]:
                stops[s["driverId"]].append(int(s["lap"]))
        except (TypeError, KeyError, IndexError):
            pass
        info = {x["driverId"]: x for x in r["results"]}
        total = max(int(l["number"]) for l in laps)
        times = [(int(l["number"]), t["driverId"], lap_str_to_seconds(t["time"])) for l in laps for t in l["Timings"]]
        valid = [x for x in times if x[0] > 1 and x[2]]
        if len(valid) < 200:
            continue
        med = statistics.median(x[2] for x in valid)
        for lap, did, t in valid:
            s = stops.get(did, [])
            if lap in s or (lap - 1) in s or t > 1.07 * med or did not in info:
                continue
            last = max([x for x in s if x < lap], default=0)
            x = info[did]
            rows.append({
                "season": r["season"], "round": r["round"], "gp": r["raceName"], "circuit": r["circuitId"],
                "compound": "UNKNOWN", "tyre_age": float(lap - last), "track_temp": np.nan,
                "fuel_kg": fuel_start(r["season"]) * (1 - (lap - 1) / total), "team": x["team2026"],
                "team_form": idx.team_form(r["season"], x["team2026"], r["round"]), "grid": x["grid"] or np.nan,
                "est_km": est_lap_km(r["circuitId"], total), "lap": lap, "time": t, "source": "stats",
                "anchor": idx.anchor(r["circuitId"], r["season"], est_lap_km(r["circuitId"], total)),
            })
    return rows


class Encoder:
    def __init__(self, rows):
        self.cats = {
            "circuit": sorted({r["circuit"] for r in rows}),
            "compound": COMPOUNDS,
            "team": TEAMS_2026,
        }

    def matrix(self, rows):
        X = np.empty((len(rows), len(FEATURES)), dtype=float)
        for i, r in enumerate(rows):
            for j, f in enumerate(FEATURES):
                v = r[f]
                if f in self.cats:
                    X[i, j] = self.cats[f].index(v) if v in self.cats[f] else np.nan
                else:
                    X[i, j] = np.nan if v is None else float(v)
        return X


def make_model():
    mono = [1 if f in ("tyre_age", "fuel_kg") else 0 for f in FEATURES]  # older tyres / more fuel can only be slower
    return HistGradientBoostingRegressor(
        loss="absolute_error", max_iter=300, learning_rate=0.08, max_leaf_nodes=24, min_samples_leaf=40,
        l2_regularization=0.5, categorical_features=[FEATURES.index(f) for f in CATEGORICAL],
        monotonic_cst=mono, random_state=7,
    )


# ---------------------------------------------------------------------------
# Export trees to JSON (and check the export against sklearn)
# ---------------------------------------------------------------------------
def export_trees(model) -> dict:
    """
    sklearn (>= 1.4) puts categorical columns first and ordinal-encodes them (categories_ = sorted values seen
    in training) before the trees see them. `order` and `catMaps` let the browser rebuild that input.
    """
    order = list(range(len(FEATURES)))
    cat_maps: list[list[int] | None] = [None] * len(FEATURES)
    pre = getattr(model, "_preprocessor", None)
    if pre is not None:
        order = []
        for name, tr, mask in pre.transformers_:
            if name == "remainder":
                continue
            cols = [i for i, on in enumerate(mask) if on]
            if name == "encoder":
                for col, cats in zip(cols, tr.categories_):
                    cat_maps[len(order)] = [int(c) for c in cats]
                    order.append(col)
            else:
                order.extend(cols)
    trees = []
    for (pred,) in model._predictors:
        nodes = pred.nodes
        bitsets = getattr(pred, "raw_left_cat_bitsets", None)
        t = {"f": [], "t": [], "c": [], "l": [], "r": [], "m": [], "v": []}
        for n in nodes:
            leaf = bool(n["is_leaf"])
            t["f"].append(-1 if leaf else int(n["feature_idx"]))
            t["l"].append(int(n["left"]))
            t["r"].append(int(n["right"]))
            t["m"].append(int(n["missing_go_to_left"]))
            t["v"].append(round(float(n["value"]), 8) if leaf else 0)
            if not leaf and n["is_categorical"]:
                words = bitsets[n["bitset_idx"]]
                left = [k for k in range(32 * len(words)) if (int(words[k // 32]) >> (k % 32)) & 1]
                t["c"].append(left)
                t["t"].append(None)
            else:
                t["c"].append(None)
                # Thresholds sit exactly on training values: rounding them would flip those samples
                thr = float(n["num_threshold"])
                if math.isinf(thr):  # "all values go left" split; JSON has no Infinity
                    thr = math.copysign(1e300, thr)
                t["t"].append(None if leaf else thr)
        trees.append(t)
    return {"baseline": float(np.ravel(model._baseline_prediction)[0]), "order": order, "catMaps": cat_maps, "trees": trees}


def model_input(exp: dict, x: np.ndarray) -> list[float]:
    """Same steps as web/lib/lapTimeModel.ts: reorder, then map raw category codes to the model's codes."""
    out = []
    for pos, col in enumerate(exp["order"]):
        v = x[col]
        cats = exp["catMaps"][pos]
        if cats is not None and not math.isnan(v):
            v = float(cats.index(int(v))) if int(v) in cats else math.nan
        out.append(v)
    return out


def predict_exported(exp: dict, X: np.ndarray) -> np.ndarray:
    out = np.full(len(X), exp["baseline"])
    Xm = [model_input(exp, x) for x in X]
    for t in exp["trees"]:
        for i, x in enumerate(Xm):
            k = 0
            while t["f"][k] != -1:
                v = x[t["f"][k]]
                if math.isnan(v):
                    go_left = t["m"][k] == 1
                elif t["c"][k] is not None:
                    go_left = int(v) in t["c"][k]
                else:
                    go_left = v <= t["t"][k]
                k = t["l"][k] if go_left else t["r"][k]
            out[i] += t["v"][k]
    return out


# ---------------------------------------------------------------------------
# Aero calibration
# ---------------------------------------------------------------------------
def calibrate_aero() -> dict:
    circuits = (read_json(WEB_DATA / "circuits.json") or {}).get("circuits", {})
    rows = []
    for slug, c in circuits.items():
        if c.get("dataSeason") != SEASON or not c.get("topSpeed") or not c.get("weather"):
            continue
        w = c["weather"]
        if not w.get("pressure") or w.get("air") is None:
            continue
        rho = w["pressure"] * 100 / (287.05 * (w["air"] + 273.15))
        setup = "low" if slug in LOW_DF else "high" if slug in HIGH_DF else "medium"
        cda = STRAIGHT_CDA * SETUP_SCALE[setup]
        v = c["topSpeed"] / 3.6
        rows.append({"slug": slug, "rho": round(rho, 3), "setup": setup, "cda": cda, "real": c["topSpeed"], "p": 0.5 * rho * cda * v ** 3 / 1000})
    p_eff = statistics.median(r["p"] for r in rows)
    for r in rows:
        r["predicted"] = round(math.cbrt(2 * p_eff * 1000 / (r["rho"] * r["cda"])) * 3.6)
        r["error"] = r["predicted"] - r["real"]
        del r["p"]
    mae = statistics.mean(abs(r["error"]) for r in rows)
    # Before calibration: the config's 750 kW in the same formula
    before = statistics.mean(abs(math.cbrt(2 * 750_000 / (r["rho"] * r["cda"])) * 3.6 - r["real"]) for r in rows)
    return {"effectivePowerKw": round(p_eff), "maeKmh": round(mae, 1), "maeKmhBefore": round(before, 1), "circuits": rows,
            "setupBySlug": {**{s: "low" for s in LOW_DF}, **{s: "high" for s in HIGH_DF}}}


# ---------------------------------------------------------------------------
def main() -> dict:
    log("Loading race context from Stats...")
    idx = RaceIndex()
    log("Building lap time dataset...")
    tel = telemetry_rows(idx, SEASON - 1) + telemetry_rows(idx, SEASON)
    hist = stats_rows(idx, range(FIRST_STATS_SEASON, SEASON - 1))
    rows = tel + hist
    log(f"  {len(tel):,} telemetry laps (2025–2026) + {len(hist):,} Stats laps (2018–2024)")

    rounds_2026 = sorted({r["round"] for r in tel if r["season"] == SEASON})
    test_rounds = set(rounds_2026[-TEST_RACES:])
    train = [r for r in rows if not (r["season"] == SEASON and r["round"] in test_rounds)]
    test = [r for r in rows if r["season"] == SEASON and r["round"] in test_rounds]

    enc = Encoder(rows)
    ratio = lambda rs: [r["time"] / r["anchor"] for r in rs]  # noqa: E731  (lap time ÷ pace anchor)
    model = make_model().fit(enc.matrix(train), ratio(train))
    pred = model.predict(enc.matrix(test)) * np.array([r["anchor"] for r in test])
    y = np.array([r["time"] for r in test])
    mae = float(mean_absolute_error(y, pred))
    per_race = {}
    for gp in sorted({r["gp"] for r in test}):
        m = np.array([r["gp"] == gp for r in test])
        per_race[gp] = round(float(np.mean(np.abs(y[m] - pred[m]))), 3)

    # Before: the old live-page formula with a perfect "average lap" from the last time we raced there
    sums = defaultdict(lambda: [0.0, 0])
    for x in train:
        s = sums[(x["circuit"], x["season"])]
        s[0] += x["time"]
        s[1] += 1
    avg = {k: v[0] / v[1] for k, v in sums.items()}

    def old_formula(r):
        seasons = [s for (c, s) in avg if c == r["circuit"] and s < r["season"]]
        if not seasons:
            return np.nan
        base = avg[(r["circuit"], max(seasons))]
        return base + (r["tyre_age"] or 0) * 0.04 - r["lap"] * 0.015
    old = np.array([old_formula(r) for r in test])
    ok = ~np.isnan(old)
    mae_old = float(np.mean(np.abs(y[ok] - old[ok]))) if ok.any() else None
    mae_new_same = float(np.mean(np.abs(y[ok] - pred[ok]))) if ok.any() else None

    log(f"  Test MAE (rounds {sorted(test_rounds)}): {mae:.3f} s  | per race {per_race}")
    log(f"  Old formula {mae_old if mae_old is None else round(mae_old, 3)} s vs new {mae_new_same if mae_new_same is None else round(mae_new_same, 3)} s on the same laps")

    # Final model on everything, exported for the browser
    final = make_model().fit(enc.matrix(rows), ratio(rows))
    exp = export_trees(final)
    sample_rows = rows[:: max(1, len(rows) // 300)]
    sample = enc.matrix(sample_rows)
    anchors = np.array([r["anchor"] for r in sample_rows])
    parity = float(np.max(np.abs(predict_exported(exp, sample) - final.predict(sample)) * anchors))
    log(f"  Exported {len(exp['trees'])} trees; max difference vs sklearn on {len(sample)} laps: {parity:.6f} s")

    # Context the browser needs to fill in features for 2026
    last_round = max(rounds_2026) if rounds_2026 else 1
    team_form = {t: idx.team_form(SEASON, t, last_round + 1) for t in TEAMS_2026}
    grids = defaultdict(list)
    for r in idx.races:
        if r["season"] == SEASON:
            for x in r["results"]:
                if x["grid"]:
                    grids[x["team2026"]].append(x["grid"])
    team_grid = {t: round(statistics.mean(g), 1) for t, g in grids.items()}
    circuits = (read_json(WEB_DATA / "circuits.json") or {}).get("circuits", {})
    circ_ctx = {}
    for slug, c in circuits.items():
        cid = (c.get("history") or {}).get("circuitId")
        est = est_lap_km(cid, c.get("laps") or 57)
        circ_ctx[slug] = {"circuitId": cid, "known": cid in enc.cats["circuit"], "estKm": est,
                          "anchor": idx.anchor(cid, SEASON, est), "trackTemp": (c.get("weather") or {}).get("track")}

    out = {
        "version": 1,
        "trainedAt": dt.datetime.now(dt.timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "features": FEATURES,
        "target": "lap time / anchor",  # predicted lap time = anchor × model output
        "categories": enc.cats,
        **exp,
        "context": {"season": SEASON, "fuelStartKg": fuel_start(SEASON), "teamForm": team_form, "teamGrid": team_grid, "circuits": circ_ctx},
        "metrics": {"testMae": round(mae, 3), "testRaces": per_race, "oldFormulaMae": None if mae_old is None else round(mae_old, 3),
                    "newMaeOnSameLaps": None if mae_new_same is None else round(mae_new_same, 3),
                    "trainLaps": len(train), "testLaps": len(test)},
    }
    size = write_json(PUBLIC_DATA / "models" / "laptime.json", out)
    log(f"  Wrote laptime.json ({size / 1000:.0f} KB)")

    # Degradation per compound learned by the model (seconds per lap of tyre age, medium setup, mid-race)
    deg = {}
    for comp in ("SOFT", "MEDIUM", "HARD"):
        probe = [{**r, "compound": comp} for r in test[:200]]
        anchors = np.array([p["anchor"] for p in probe])
        a = enc.matrix([{**p, "tyre_age": 2.0} for p in probe])
        b = enc.matrix([{**p, "tyre_age": 22.0} for p in probe])
        deg[comp] = round(float(np.mean((final.predict(b) - final.predict(a)) * anchors) / 20), 3)

    log("Calibrating aero model against 2026 top speeds...")
    aero = calibrate_aero()
    aero["calibratedAt"] = out["trainedAt"]
    write_json(WEB_DATA / "aero-calibration.json", aero, compact=False)
    log(f"  Effective power at top speed {aero['effectivePowerKw']} kW; top speed MAE {aero['maeKmh']} km/h (was {aero['maeKmhBefore']} km/h with 750 kW)")

    write_report(out, deg, aero, tel, hist, test_rounds)
    return {"laptime": out["metrics"], "aero": {k: aero[k] for k in ("effectivePowerKw", "maeKmh", "maeKmhBefore")}, "deg": deg}


def write_report(out, deg, aero, tel, hist, test_rounds):
    m = out["metrics"]
    lines = [
        "# Model report",
        "",
        f"Generated {out['trainedAt']} by `backend/pipeline/train_models.py`.",
        "",
        "## Lap time model",
        "",
        "Gradient-boosted regression trees (scikit-learn `HistGradientBoostingRegressor`, absolute-error loss), exported to",
        "`web/public/data/models/laptime.json` and evaluated in the browser by `web/lib/lapTimeModel.ts`.",
        "",
        "**Data**",
        f"- {len(tel):,} green-flag dry race laps from the TracingInsights 2025 and 2026 telemetry repos (compound, tyre life, track temperature).",
        f"- {len(hist):,} race laps from the Stats repo, 2018–2024 (tyre age from pit stops; compound and track temperature unknown).",
        "- Removed: lap 1, in/out laps, safety car / VSC / flag laps (telemetry), deleted laps, wet compounds, laps slower than 107% of the race median.",
        "",
        "**Features:** " + ", ".join(FEATURES) + ". Fuel load is a fuel-corrected lap number (start fuel × share of the race left).",
        "The model predicts lap time as a ratio of the anchor: the median of the circuit's fastest race laps 2004–2025",
        "(or lap length × 17.6 s/km for new circuits), so returning and new tracks still get a sensible baseline.",
        "Tyre age and fuel load are constrained so they can only make a lap slower.",
        "",
        "**Accuracy** (trained without, then tested on, the most recent 2026 races: rounds " + ", ".join(map(str, sorted(test_rounds))) + ")",
        "",
        "| | MAE |",
        "|---|---:|",
        f"| New model, all test laps | {m['testMae']:.3f} s |",
    ]
    if m["oldFormulaMae"] is not None:
        lines += [
            f"| Before: old live-page formula (average lap + 0.04 s × tyre age − 0.015 s × lap), same laps | {m['oldFormulaMae']:.3f} s |",
            f"| New model on those same laps | {m['newMaeOnSameLaps']:.3f} s |",
        ]
    lines += ["", "Per test race: " + ", ".join(f"{k} {v:.3f} s" for k, v in m["testRaces"].items()), ""]
    lines += [
        "Learned tyre degradation (average, seconds per lap of tyre age): " + ", ".join(f"{k.title()} {v:+.3f}" for k, v in deg.items()),
        "",
        "**Limitations:** no traffic, dirty air or driver effects; one model for all cars; tracks not raced since 2018 (or new tracks)",
        "rely on the estimated lap length; 2018–2024 laps have no compound or track temperature; 2026 has only part of a season.",
        "",
        "## Aero model",
        "",
        "Physics, not a neural network: q = ½ρv², D = q·CdA, L = q·ClA with the estimated 2026 coefficients in `web/lib/car2026.ts`.",
        f"Calibrated against real 2026 top speeds (fastest race lap, {len(aero['circuits'])} circuits, air density from each race's weather):",
        f"effective power at top speed **{aero['effectivePowerKw']} kW** (2026 cars run out of electrical deployment on long straights).",
        f"Top speed error {aero['maeKmh']} km/h MAE, compared with {aero['maeKmhBefore']} km/h using the nominal 750 kW.",
        "",
        "| Circuit | Setup | ρ (kg/m³) | Real (km/h) | Predicted (km/h) |",
        "|---|---|---:|---:|---:|",
    ] + [f"| {r['slug']} | {r['setup']} | {r['rho']:.3f} | {r['real']} | {r['predicted']} |" for r in sorted(aero["circuits"], key=lambda r: r["slug"])] + [
        "",
        "**Limitations:** coefficients are estimates (teams do not publish them); one effective power for every track; slipstream ignored.",
        "",
        "## Tyre temperature model",
        "",
        "The data repos contain **no tyre temperature data**. `web/lib/tyreModel.ts` is a physics-based *estimate* driven by",
        "speed, lateral and longitudinal G, braking, compound and track temperature. It is labelled \"Estimated\" everywhere.",
        "",
        "## Strategy helper",
        "",
        "`web/lib/strategy.ts` sums predicted lap times over the race for every 1-stop and 2-stop plan (at least two dry compounds),",
        "adding the circuit's real pit lane loss (in-lap + out-lap vs normal laps, telemetry repos) and the team's average",
        "2026 stationary time (DHL, PitStops repo). No safety cars, traffic or tyre warm-up.",
        "",
    ]
    (MODELS_DIR / "MODEL_REPORT.md").write_text("\n".join(lines), encoding="utf-8")
    log("  Wrote models/MODEL_REPORT.md")


if __name__ == "__main__":
    main()
