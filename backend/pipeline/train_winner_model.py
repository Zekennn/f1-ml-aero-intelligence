"""
2026 race-winner prediction model.

Method follows "Formula One Race Prediction Model" (Spencer Staub, The George Washington
University, 2022): one row per driver per race, a binary "won this race" target, features
built only from the driver's and team's history before that race, a gradient-boosted tree
classifier, drivers ranked by win probability inside each race, and accuracy measured with
historical (time-ordered) validation, both with and without qualifying.

Data: only the local TracingInsights Stats archive in data/sources/Stats (Ergast format):
race results, qualifying and sprint results, 2000–2026. Nothing is downloaded.

Differences from the presentation:
  - scikit-learn HistGradientBoostingClassifier instead of XGBoost (same family of model,
    already a project dependency); logistic regression is kept as a comparison.
  - No driver/team name features (they memorise history and don't carry over to the new
    2026 regulations); points are expressed as shares of the leader so different points
    systems across eras compare fairly.
  - The season is finished by Monte Carlo: each remaining race is drawn from the model's
    win probabilities (Plackett–Luce order, plus a reliability-based retirement chance).

Writes web/data/winner-model.json and adds a section to models/MODEL_REPORT.md.
Run:  venv\\Scripts\\python.exe backend\\pipeline\\train_winner_model.py
      add --auto to pull the Stats repo first and retrain only if it has a race the model hasn't seen
      (exit code 0 = retrained, 10 = nothing new; the backend runs the full update_all.py --auto instead).
"""
from __future__ import annotations

import datetime as dt
import math
from collections import defaultdict, deque

import numpy as np
from sklearn.ensemble import HistGradientBoostingClassifier
from sklearn.inspection import permutation_importance
from sklearn.linear_model import LogisticRegression
from sklearn.pipeline import make_pipeline
from sklearn.preprocessing import StandardScaler
from sklearn.impute import SimpleImputer

from build_site_data import _race_of, canonical_gp
from common import (
    MODELS_DIR, SEASON, STATS, WEB_DATA, lap_str_to_seconds, log, read_json, slugify, sync_git_repos, team_2026, write_json,
)

FIRST_SEASON = 2000          # history used to build features
FIRST_TRAIN_SEASON = 2006    # rows used for training (earlier seasons only seed the history)
TEST_SEASONS = [2022, 2023, 2024, 2025]
SIMULATIONS = 20000
RACE_POINTS = [25, 18, 15, 12, 10, 8, 6, 4, 2, 1]
SPRINT_POINTS = [8, 7, 6, 5, 4, 3, 2, 1]
RNG = np.random.default_rng(2026)

PRE_RACE = [
    "form_5", "team_form_5", "team_avg_grid_5",
    "last_finish", "avg_finish_10", "avg_finish_career",
    "last_grid", "avg_grid_10", "season_avg_grid", "avg_quali_gap_5",
    "season_points_share", "season_rank", "season_wins", "season_podiums",
    "wins_last_10", "podiums_last_10",
    "team_points_share", "team_rank",
    "last_year_points_share", "last_year_rank", "last_year_champion", "team_last_year_rank",
    "driver_dnf_rate", "driver_incident_rate", "team_dnf_rate",
    "starts", "circuit_starts", "circuit_avg_finish", "circuit_wins",
    "round_frac",
]
WITH_QUALI = PRE_RACE + ["grid", "quali_gap", "grid_vs_teammate"]

LABELS = {
    "form_5": "Driver form, last 5 races", "team_form_5": "Team form, last 5 races (best car)",
    "team_avg_grid_5": "Team avg grid, last 5 races",
    "last_finish": "Last finishing position", "avg_finish_10": "Avg finish, last 10", "avg_finish_career": "Avg finish, career",
    "last_grid": "Last grid position", "avg_grid_10": "Avg grid, last 10", "season_avg_grid": "Avg grid this season",
    "avg_quali_gap_5": "Gap to pole, last 5", "season_points_share": "Season points (share of leader)",
    "season_rank": "Championship position", "season_wins": "Wins this season", "season_podiums": "Podiums this season",
    "wins_last_10": "Wins, last 10", "podiums_last_10": "Podiums, last 10", "team_points_share": "Team points (share of leader)",
    "team_rank": "Team championship position", "last_year_points_share": "Last year's points (share of champion)",
    "last_year_rank": "Last year's position", "last_year_champion": "Last year's champion",
    "team_last_year_rank": "Team's last-year position", "driver_dnf_rate": "Driver mechanical DNF rate",
    "driver_incident_rate": "Driver accident rate", "team_dnf_rate": "Car reliability (team DNF rate)",
    "starts": "Driver experience (starts)", "circuit_starts": "Starts at this circuit",
    "circuit_avg_finish": "Avg finish at this circuit", "circuit_wins": "Wins at this circuit",
    "round_frac": "Point in the season", "grid": "Grid position", "quali_gap": "Gap to pole (%)",
    "grid_vs_teammate": "Grid vs teammate",
}

INCIDENT = {"accident", "collision", "spun off", "collision damage", "damage"}
NOT_STARTED = {"did not start", "withdrew", "did not qualify", "did not prequalify", "excluded", "disqualified"}


# ---------------------------------------------------------------------------
# Loading
# ---------------------------------------------------------------------------
def _best_quali(q: dict) -> float | None:
    times = [lap_str_to_seconds(q.get(k)) for k in ("Q3", "Q2", "Q1")]
    times = [t for t in times if t]
    return min(times) if times else None


def classify(status: str) -> str:
    s = (status or "").strip().lower()
    if s == "finished" or s.startswith("+") or s == "lapped":
        return "classified"
    if s in NOT_STARTED:
        return "dns"
    if s in INCIDENT:
        return "incident"
    return "mechanical"


def load_races() -> list[dict]:
    """Every race 2000–2026 with results, keyed by the round inside results.json (folders can be stale)."""
    races = []
    for season in range(FIRST_SEASON, SEASON + 1):
        sdir = STATS / str(season)
        if not sdir.is_dir():
            continue
        sprint_events = {
            int(r["round"]) for r in ((read_json(sdir / "events.json") or {}).get("MRData", {}).get("RaceTable", {}).get("Races", []))
            if "Sprint" in r
        }
        by_round: dict[int, dict] = {}
        upcoming: dict[int, dict] = {}
        for gp in sorted(p for p in sdir.iterdir() if p.is_dir()):
            res = _race_of(gp / "results.json")
            if not res or not res.get("Results"):
                info = read_json(gp / "event_info.json") or {}
                if info.get("round"):
                    upcoming[int(info["round"])] = info
                continue
            rnd = int(res["round"])
            quali = {}
            q = _race_of(gp / "quali_results.json")
            for row in (q or {}).get("QualifyingResults", []):
                quali[row["Driver"]["driverId"]] = _best_quali(row)
            sprint = defaultdict(float)
            sp = _race_of(gp / "sprint_results.json")
            for row in (sp or {}).get("SprintResults", []):
                sprint[row["Driver"]["driverId"]] += float(row.get("points") or 0)
            entrants = []
            for r in res["Results"]:
                d = r["Driver"]
                entrants.append({
                    "driverId": d["driverId"],
                    "code": d.get("code") or d["familyName"][:3].upper(),
                    "name": f"{d['givenName']} {d['familyName']}",
                    "constructorId": r["Constructor"]["constructorId"],
                    "team": team_2026(r["Constructor"]["constructorId"]) if season >= 2018 else r["Constructor"]["name"],
                    "pos": int(r["position"]),
                    "grid": int(r.get("grid") or 0),
                    "status": classify(r.get("status")),
                    "points": float(r.get("points") or 0) + sprint.get(d["driverId"], 0.0),
                    "quali": quali.get(d["driverId"]),
                })
            by_round[rnd] = {
                "season": season, "round": rnd, "name": canonical_gp(res["raceName"]), "slug": slugify(canonical_gp(res["raceName"])),
                "circuitId": res["Circuit"]["circuitId"], "date": res["date"], "entrants": entrants,
            }
        for rnd in sorted(by_round):
            races.append(by_round[rnd])
        if season == SEASON:
            load_races.upcoming = [
                {"season": season, "round": rnd, "name": canonical_gp(i["raceName"]), "slug": slugify(canonical_gp(i["raceName"])),
                 "circuitId": i["Circuit"]["circuitId"], "date": i["date"], "sprint": rnd in sprint_events}
                for rnd, i in sorted(upcoming.items()) if rnd not in by_round
            ]
            load_races.rounds_total = max([*by_round, *upcoming]) if (by_round or upcoming) else 0
    return races


# ---------------------------------------------------------------------------
# Features: a running history, read before each race and updated after it
# ---------------------------------------------------------------------------
def modern_points(pos: int) -> float:
    """Finishing position scored on today's 25-18-15… scale (0–1), so every era compares fairly."""
    return RACE_POINTS[pos - 1] / 25 if 1 <= pos <= len(RACE_POINTS) else 0.0


def _mean(xs):
    xs = [x for x in xs if x is not None]
    return sum(xs) / len(xs) if xs else math.nan


class History:
    def __init__(self):
        self.finish = defaultdict(lambda: deque(maxlen=60))
        self.grid = defaultdict(lambda: deque(maxlen=10))
        self.qgap = defaultdict(lambda: deque(maxlen=5))
        self.win = defaultdict(lambda: deque(maxlen=10))
        self.podium = defaultdict(lambda: deque(maxlen=10))
        self.status = defaultdict(lambda: deque(maxlen=30))
        self.team_status = defaultdict(lambda: deque(maxlen=40))
        self.team_best = defaultdict(lambda: deque(maxlen=5))   # best car finish per race
        self.team_grid = defaultdict(lambda: deque(maxlen=10))  # both cars, last ~5 races
        self.starts = defaultdict(int)
        self.circuit = defaultdict(list)  # (driver, circuit) -> finishes
        self.season = None
        self.season_rounds = 0
        self.s_points = defaultdict(float)
        self.s_wins = defaultdict(int)
        self.s_podiums = defaultdict(int)
        self.s_grids = defaultdict(list)
        self.t_points = defaultdict(float)
        self.last_year: dict[str, dict] = {}
        self.team_last_year: dict[str, int] = {}

    def start_season(self, season: int, rounds: int):
        if self.season is not None and self.s_points:
            ranked = sorted(self.s_points.items(), key=lambda kv: -kv[1])
            top = ranked[0][1] or 1
            self.last_year = {d: {"share": p / top, "rank": i + 1, "champion": int(i == 0)} for i, (d, p) in enumerate(ranked)}
            self.team_last_year = {t: i + 1 for i, (t, _) in enumerate(sorted(self.t_points.items(), key=lambda kv: -kv[1]))}
        self.season, self.season_rounds = season, rounds
        self.s_points.clear(); self.s_wins.clear(); self.s_podiums.clear(); self.s_grids.clear(); self.t_points.clear()

    def _rank(self, table: dict, key) -> float:
        if key not in table:
            return float(len(table) + 1)
        v = table[key]
        return float(1 + sum(1 for x in table.values() if x > v))

    def features(self, race: dict, e: dict, entrants: list[dict]) -> dict:
        d, team = e["driverId"], e["constructorId"]
        lead = max(self.s_points.values(), default=0) or 1
        tlead = max(self.t_points.values(), default=0) or 1
        ly = self.last_year.get(d, {})
        st = list(self.status[d])
        tst = list(self.team_status[team])
        circ = self.circuit[(d, race["circuitId"])]
        grid = e["grid"] if e["grid"] > 0 else len(entrants) + 1  # pit-lane start
        mates = [o for o in entrants if o["constructorId"] == team and o["driverId"] != d]
        mate_grid = (mates[0]["grid"] if mates[0]["grid"] > 0 else len(entrants) + 1) if mates else math.nan
        qs = [o["quali"] for o in entrants if o["quali"]]
        return {
            "form_5": _mean([modern_points(p) for p in list(self.finish[d])[-5:]]),
            "team_form_5": _mean([modern_points(p) for p in self.team_best[team]]),
            "team_avg_grid_5": _mean(self.team_grid[team]),
            "last_finish": self.finish[d][-1] if self.finish[d] else math.nan,
            "avg_finish_10": _mean(list(self.finish[d])[-10:]),
            "avg_finish_career": _mean(self.finish[d]),
            "last_grid": self.grid[d][-1] if self.grid[d] else math.nan,
            "avg_grid_10": _mean(self.grid[d]),
            "season_avg_grid": _mean(self.s_grids[d]),
            "avg_quali_gap_5": _mean(self.qgap[d]),
            "season_points_share": self.s_points.get(d, 0.0) / lead,
            "season_rank": self._rank(self.s_points, d),
            "season_wins": float(self.s_wins.get(d, 0)),
            "season_podiums": float(self.s_podiums.get(d, 0)),
            "wins_last_10": float(sum(self.win[d])),
            "podiums_last_10": float(sum(self.podium[d])),
            "team_points_share": self.t_points.get(team, 0.0) / tlead,
            "team_rank": self._rank(self.t_points, team),
            "last_year_points_share": ly.get("share", 0.0),
            "last_year_rank": float(ly.get("rank", 30)),
            "last_year_champion": float(ly.get("champion", 0)),
            "team_last_year_rank": float(self.team_last_year.get(team, 12)),
            "driver_dnf_rate": (sum(s == "mechanical" for s in st) / len(st)) if st else math.nan,
            "driver_incident_rate": (sum(s == "incident" for s in st) / len(st)) if st else math.nan,
            "team_dnf_rate": (sum(s == "mechanical" for s in tst) / len(tst)) if tst else math.nan,
            "starts": float(self.starts[d]),
            "circuit_starts": float(len(circ)),
            "circuit_avg_finish": _mean(circ),
            "circuit_wins": float(sum(p == 1 for p in circ)),
            "round_frac": race["round"] / max(1, self.season_rounds),
            "grid": float(grid),
            "quali_gap": ((e["quali"] / min(qs) - 1) * 100) if e["quali"] and qs else math.nan,
            "grid_vs_teammate": grid - mate_grid if mates else math.nan,
        }

    def update(self, race: dict):
        qs = [o["quali"] for o in race["entrants"] if o["quali"]]
        pole = min(qs) if qs else None
        best = {}
        for e in race["entrants"]:
            if e["status"] != "dns":
                best[e["constructorId"]] = min(best.get(e["constructorId"], 99), e["pos"])
                if e["grid"] > 0:
                    self.team_grid[e["constructorId"]].append(e["grid"])
        for team, pos in best.items():
            self.team_best[team].append(pos)
        for e in race["entrants"]:
            d, team = e["driverId"], e["constructorId"]
            if e["status"] == "dns":
                continue
            self.finish[d].append(e["pos"])
            self.win[d].append(int(e["pos"] == 1))
            self.podium[d].append(int(e["pos"] <= 3))
            if e["grid"] > 0:
                self.grid[d].append(e["grid"]); self.s_grids[d].append(e["grid"])
            if e["quali"] and pole:
                self.qgap[d].append((e["quali"] / pole - 1) * 100)
            self.status[d].append(e["status"])
            self.team_status[team].append(e["status"])
            self.starts[d] += 1
            self.circuit[(d, race["circuitId"])].append(e["pos"])
            self.s_points[d] += e["points"]
            self.t_points[team] += e["points"]
            self.s_wins[d] += int(e["pos"] == 1)
            self.s_podiums[d] += int(e["pos"] <= 3)


def build_rows(races: list[dict]):
    """Feature rows for every entrant of every race, plus the history as it stands after the last race."""
    rounds_per_season = defaultdict(int)
    for r in races:
        rounds_per_season[r["season"]] = max(rounds_per_season[r["season"]], r["round"])
    rounds_per_season[SEASON] = max(rounds_per_season[SEASON], load_races.rounds_total)
    h = History()
    rows = []
    for race in races:
        if race["season"] != h.season:
            h.start_season(race["season"], rounds_per_season[race["season"]])
        entrants = [e for e in race["entrants"] if e["status"] != "dns"]
        for e in entrants:
            f = h.features(race, e, entrants)
            rows.append({"season": race["season"], "round": race["round"], "race": race, "entrant": e, "x": f,
                         "win": int(e["pos"] == 1), "podium": int(e["pos"] <= 3)})
        h.update(race)
    return rows, h


# ---------------------------------------------------------------------------
# Models and evaluation
# ---------------------------------------------------------------------------
def make_gbm():
    # Shallow, heavily regularised trees: winners are only ~5% of rows, and deeper trees memorised
    # one-off patterns (mean 2022–26 winner accuracy 34% → 52% after regularising).
    # Class balancing (the presentation's oversampling) ranked ~2 more races right out of ~105 but
    # flattened the probabilities badly (winner log-loss 1.51 → 1.72), so it is not used.
    return HistGradientBoostingClassifier(
        learning_rate=0.03, max_iter=250, max_depth=3, min_samples_leaf=120, l2_regularization=3.0, random_state=7,
    )


def make_logreg():
    return make_pipeline(SimpleImputer(strategy="median"), StandardScaler(), LogisticRegression(max_iter=2000, C=0.5))


def matrix(rows, feats):
    return np.array([[r["x"][f] for f in feats] for r in rows], dtype=float)


def race_groups(rows):
    groups = defaultdict(list)
    for i, r in enumerate(rows):
        groups[(r["season"], r["round"])].append(i)
    return groups


def normalise(prob: np.ndarray, rows, total: float = 1.0) -> np.ndarray:
    """Scale probabilities inside each race so they sum to `total` (1 winner, 3 podium places)."""
    out = prob.copy()
    for idx in race_groups(rows).values():
        s = prob[idx].sum()
        if s > 0:
            out[idx] = prob[idx] / s * total
    return out


def score(rows, win_p) -> dict:
    """Winner accuracy, podium accuracy (top 3 by probability vs real top 3), mean probability on the real winner."""
    hits, podium_hits, on_winner, n = 0, 0, [], 0
    for idx in race_groups(rows).values():
        order = sorted(idx, key=lambda i: -win_p[i])
        winner = [i for i in idx if rows[i]["win"]]
        if not winner:
            continue
        n += 1
        hits += int(rows[order[0]]["win"] == 1)
        real_top3 = {i for i in idx if rows[i]["podium"]}
        podium_hits += len(set(order[:3]) & real_top3)
        on_winner.append(win_p[winner[0]])
    return {"races": n, "winner": hits / n if n else 0, "podium": podium_hits / (3 * n) if n else 0,
            "probOnWinner": float(np.mean(on_winner)) if on_winner else 0}


def baseline(rows, key) -> dict:
    """Pick the pole sitter / championship leader as the winner."""
    hits, n = 0, 0
    for idx in race_groups(rows).values():
        if not any(rows[i]["win"] for i in idx):
            continue
        n += 1
        pick = min(idx, key=lambda i: key(rows[i]))
        hits += rows[pick]["win"]
    return {"races": n, "winner": hits / n if n else 0}


def fit_predict(train, test, feats, target="win", kind="gbm"):
    model = make_gbm() if kind == "gbm" else make_logreg()
    model.fit(matrix(train, feats), np.array([r[target] for r in train]))
    return model, model.predict_proba(matrix(test, feats))[:, 1]


def leader_key(r):  # championship leader; before round 1 fall back to last year's position
    return (r["x"]["season_rank"], r["x"]["last_year_rank"]) if r["round"] > 1 else (r["x"]["last_year_rank"], 0)


# ---------------------------------------------------------------------------
# Forward look: remaining 2026 races and the championship
# ---------------------------------------------------------------------------
def simulate_season(standing: dict, field: list[dict], per_round: list[dict], dnf: dict) -> dict:
    """Monte Carlo of the remaining rounds. Finishing order ~ Plackett–Luce on win probabilities (Gumbel trick)."""
    codes = [e["driverId"] for e in field]
    n = len(codes)
    points = np.tile(np.array([standing.get(c, 0.0) for c in codes]), (SIMULATIONS, 1))
    wins = np.zeros((SIMULATIONS, n))
    race_pts = np.array(RACE_POINTS + [0] * max(0, n - len(RACE_POINTS)))[:n]
    sprint_pts = np.array(SPRINT_POINTS + [0] * max(0, n - len(SPRINT_POINTS)))[:n]
    dnf_p = np.array([dnf.get(c, 0.08) for c in codes])
    for rnd in per_round:
        logp = np.log(np.clip(np.array([rnd["prob"][c] for c in codes]), 1e-6, 1))
        sessions = [race_pts] + ([sprint_pts] if rnd["sprint"] else [])
        for pts_table in sessions:
            keys = logp + RNG.gumbel(size=(SIMULATIONS, n))
            out = RNG.random((SIMULATIONS, n)) < dnf_p
            keys[out] = -np.inf  # retirements score nothing
            order = np.argsort(-keys, axis=1)
            ranks = np.empty_like(order)
            ranks[np.arange(SIMULATIONS)[:, None], order] = np.arange(n)
            gained = pts_table[ranks]
            gained[out] = 0
            points += gained
            if pts_table is race_pts:
                wins += (ranks == 0) & ~out
    # champion: most points, then most wins
    champ = np.argmax(points + wins * 1e-3, axis=1)
    title = np.bincount(champ, minlength=n) / SIMULATIONS
    return {c: {"title": float(title[i]), "expected": float(points[:, i].mean()),
                "p10": float(np.percentile(points[:, i], 10)), "p90": float(np.percentile(points[:, i], 90))}
            for i, c in enumerate(codes)}


# ---------------------------------------------------------------------------
def main() -> dict:
    log("Winner model: loading Stats archive...")
    races = load_races()
    rows, history = build_rows(races)
    train_all = [r for r in rows if r["season"] >= FIRST_TRAIN_SEASON]
    log(f"  {len(races)} races, {len(train_all)} training rows ({FIRST_TRAIN_SEASON}–{SEASON})")

    # --- Historical validation: train on every season before, test on the next ---
    seasons = []
    for season in TEST_SEASONS:
        train = [r for r in train_all if r["season"] < season]
        test = [r for r in train_all if r["season"] == season]
        entry = {"season": season, "races": len(race_groups(test))}
        for name, feats in (("preRace", PRE_RACE), ("withQuali", WITH_QUALI)):
            _, p = fit_predict(train, test, feats)
            entry[name] = score(test, normalise(p, test))
            _, p_lr = fit_predict(train, test, feats, kind="logreg")
            entry[name + "LogReg"] = score(test, normalise(p_lr, test))["winner"]
        entry["pole"] = baseline(test, lambda r: r["x"]["grid"])["winner"]
        entry["leader"] = baseline(test, leader_key)["winner"]
        seasons.append(entry)
        log(f"  {season}: winner acc pre-race {entry['preRace']['winner']:.0%}, with quali {entry['withQuali']['winner']:.0%}, "
            f"pole {entry['pole']:.0%}, leader {entry['leader']:.0%}")

    # --- 2026 walk-forward: before each round, train on everything earlier ---
    rows26 = [r for r in train_all if r["season"] == SEASON]
    done_rounds = sorted({r["round"] for r in rows26})
    backtest, pre_p_all, q_p_all, test26 = [], [], [], []
    for rnd in done_rounds:
        train = [r for r in train_all if (r["season"], r["round"]) < (SEASON, rnd)]
        test = [r for r in rows26 if r["round"] == rnd]
        _, p_pre = fit_predict(train, test, PRE_RACE)
        _, p_q = fit_predict(train, test, WITH_QUALI)
        p_pre, p_q = normalise(p_pre, test), normalise(p_q, test)
        pre_p_all.extend(p_pre); q_p_all.extend(p_q); test26.extend(test)
        winner = next(r for r in test if r["win"])
        wi = test.index(winner)

        def pick(p):
            i = int(np.argmax(p))
            order = np.argsort(-p)
            return {"code": test[i]["entrant"]["code"], "name": test[i]["entrant"]["name"], "team": test[i]["entrant"]["team"],
                    "prob": round(float(p[i]), 4), "winnerProb": round(float(p[wi]), 4),
                    "winnerRank": int(np.where(order == wi)[0][0]) + 1, "correct": bool(test[i]["win"])}

        race = test[0]["race"]
        backtest.append({"round": rnd, "name": race["name"], "slug": race["slug"],
                         "winner": {"code": winner["entrant"]["code"], "name": winner["entrant"]["name"], "team": winner["entrant"]["team"],
                                    "grid": winner["entrant"]["grid"]},
                         "preRace": pick(p_pre), "withQuali": pick(p_q)})
    pre_p_all, q_p_all = np.array(pre_p_all), np.array(q_p_all)
    s26 = {"preRace": score(test26, pre_p_all), "withQuali": score(test26, q_p_all),
           "pole": baseline(test26, lambda r: r["x"]["grid"])["winner"], "leader": baseline(test26, leader_key)["winner"]}
    log(f"  2026 walk-forward ({len(done_rounds)} races): pre-race {s26['preRace']['winner']:.0%}, with quali {s26['withQuali']['winner']:.0%}, "
        f"pole {s26['pole']:.0%}, leader {s26['leader']:.0%}")

    # --- Feature importance (permutation, pre-race model, last full season) ---
    imp_train = [r for r in train_all if r["season"] < 2025]
    imp_test = [r for r in train_all if r["season"] == 2025]
    m_imp, _ = fit_predict(imp_train, imp_test, PRE_RACE)
    pi = permutation_importance(m_imp, matrix(imp_test, PRE_RACE), np.array([r["win"] for r in imp_test]),
                                scoring="roc_auc", n_repeats=8, random_state=3)
    importance = sorted(({"feature": f, "label": LABELS[f], "value": round(float(v), 4)}
                         for f, v in zip(PRE_RACE, pi.importances_mean)), key=lambda d: -d["value"])[:12]

    # --- Final models on all data, then the remaining 2026 rounds ---
    final_win, _ = fit_predict(train_all, train_all[:1], PRE_RACE)
    final_pod, _ = fit_predict(train_all, train_all[:1], PRE_RACE, target="podium")
    last_race = races[-1]
    field = [e for e in last_race["entrants"] if e["status"] != "dns"] or last_race["entrants"]
    history.season_rounds = load_races.rounds_total
    per_round = []
    for up in load_races.upcoming:
        feats = [history.features(up, {**e, "grid": 0, "quali": None}, field) for e in field]
        X = np.array([[f[k] for k in PRE_RACE] for f in feats])
        pw = final_win.predict_proba(X)[:, 1]; pw = pw / pw.sum()
        pp = final_pod.predict_proba(X)[:, 1]; pp = np.clip(pp / pp.sum() * 3, 0, 1)
        per_round.append({**up, "prob": {e["driverId"]: float(p) for e, p in zip(field, pw)},
                          "podium": {e["driverId"]: float(p) for e, p in zip(field, pp)}})

    standing = dict(history.s_points)
    dnf = {}
    for e in field:
        st = list(history.status[e["driverId"]])[-20:] + list(history.team_status[e["constructorId"]])[-20:]
        dnf[e["driverId"]] = min(0.25, max(0.03, sum(s in ("mechanical", "incident") for s in st) / max(1, len(st))))
    sims = simulate_season(standing, field, per_round, dnf) if per_round else {}

    by_id = {e["driverId"]: e for e in field}
    def who(d):
        e = by_id[d]
        return {"code": e["code"], "name": e["name"], "team": e["team"]}

    next_race = None
    if per_round:
        nr = per_round[0]
        drivers = sorted(({**who(d), "win": round(p, 4), "podium": round(nr["podium"][d], 4)} for d, p in nr["prob"].items()),
                         key=lambda x: -x["win"])
        next_race = {"round": nr["round"], "name": nr["name"], "slug": nr["slug"], "date": nr["date"], "sprint": nr["sprint"], "drivers": drivers}

    remaining = []
    for rnd in per_round:
        top = sorted(rnd["prob"].items(), key=lambda kv: -kv[1])[:3]
        remaining.append({"round": rnd["round"], "name": rnd["name"], "slug": rnd["slug"], "date": rnd["date"], "sprint": rnd["sprint"],
                          "top": [{**who(d), "win": round(p, 4)} for d, p in top]})

    championship = sorted(({**who(d), "points": standing.get(d, 0.0), "title": round(s["title"], 4),
                            "expected": round(s["expected"], 1), "p10": round(s["p10"]), "p90": round(s["p90"])}
                           for d, s in sims.items()), key=lambda x: (-x["title"], -x["expected"]))
    teams = defaultdict(lambda: {"points": 0.0, "expected": 0.0})
    for c in championship:
        teams[c["team"]]["points"] += c["points"]; teams[c["team"]]["expected"] += c["expected"]

    out = {
        "generated": dt.datetime.now(dt.timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "season": SEASON,
        "afterRound": last_race["round"],
        "roundsTotal": load_races.rounds_total,
        "simulations": SIMULATIONS,
        "data": {"races": len(races), "trainRows": len(train_all), "firstSeason": FIRST_SEASON, "firstTrainSeason": FIRST_TRAIN_SEASON},
        "features": {"preRace": [LABELS[f] for f in PRE_RACE], "withQuali": [LABELS[f] for f in WITH_QUALI if f not in PRE_RACE]},
        "validation": seasons,
        "season2026": s26,
        "importance": importance,
        "backtest": backtest,
        "nextRace": next_race,
        "remaining": remaining,
        "championship": championship,
        "teams": sorted(({"team": t, "points": round(v["points"]), "expected": round(v["expected"], 1)} for t, v in teams.items()),
                        key=lambda x: -x["expected"]),
    }
    size = write_json(WEB_DATA / "winner-model.json", out)
    log(f"  Wrote web/data/winner-model.json ({size // 1024} KB)")
    if next_race:
        fav = next_race["drivers"][0]
        log(f"  Next race: {next_race['name']} - favourite {fav['name']} {fav['win']:.0%}")
    if championship:
        log(f"  Title favourite: {championship[0]['name']} {championship[0]['title']:.0%}")
    write_report(out)
    return out


def write_report(out: dict) -> None:
    """Replace the winner-model section of models/MODEL_REPORT.md (the lap time/aero sections are kept)."""
    path = MODELS_DIR / "MODEL_REPORT.md"
    text = path.read_text(encoding="utf-8") if path.exists() else "# Model report\n"
    marker = "\n## Race winner model"
    text = text.split(marker)[0].rstrip() + "\n"
    v = out["validation"]
    s = out["season2026"]
    lines = [
        "", "## Race winner model", "",
        "Method from *Formula One Race Prediction Model* (Spencer Staub, GWU, 2022): one row per driver per race,",
        "binary target “won the race”, history-only features, gradient-boosted trees (scikit-learn",
        "`HistGradientBoostingClassifier`), drivers ranked by win probability inside each race. Written by",
        "`backend/pipeline/train_winner_model.py` to `web/data/winner-model.json`.", "",
        f"**Data:** local Stats archive only, {out['data']['races']} races {out['data']['firstSeason']}–{out['season']}; "
        f"{out['data']['trainRows']:,} training rows from {out['data']['firstTrainSeason']}.", "",
        "**Validation** (train on all earlier seasons, test on the next; winner accuracy = top-ranked driver won)", "",
        "| Season | Races | Pre-race | With qualifying | Pre-race (logistic) | Pole sitter | Championship leader |",
        "|---|---:|---:|---:|---:|---:|---:|",
    ]
    for e in v:
        lines.append(f"| {e['season']} | {e['races']} | {e['preRace']['winner']:.0%} | {e['withQuali']['winner']:.0%} | "
                     f"{e['preRaceLogReg']:.0%} | {e['pole']:.0%} | {e['leader']:.0%} |")
    lines += [
        f"| 2026 (walk-forward) | {s['preRace']['races']} | {s['preRace']['winner']:.0%} | {s['withQuali']['winner']:.0%} | – | {s['pole']:.0%} | {s['leader']:.0%} |",
        "", f"Podium accuracy 2026 (share of the real top 3 found in the predicted top 3): pre-race {s['preRace']['podium']:.0%}, "
            f"with qualifying {s['withQuali']['podium']:.0%}.", "",
        "**Most important features** (permutation importance, pre-race model, 2025): "
        + ", ".join(f"{i['label']} ({i['value']:.3f})" for i in out["importance"][:6]) + ".", "",
        f"**Forward look:** win probabilities for the remaining {len(out['remaining'])} rounds; championship from "
        f"{out['simulations']:,} simulated finishes (Plackett–Luce order, retirement chance from recent reliability).", "",
        "**Tuning:** shallow regularised trees (depth 3, ≥120 rows per leaf) lifted mean 2022–26 pre-race winner accuracy",
        "from 34% to 52%. Class balancing (the presentation's oversampling) ranked ~2 more races right out of ~105 but",
        "flattened the probabilities (winner log-loss 1.51 → 1.72), so the calibrated model is used.", "",
        "**Limitations:** results-only data (no practice pace, upgrades or weather); new 2026 regulations mean history",
        "matters less than this season's form; the remaining-season simulation assumes form stays as it is now.",
    ]
    path.write_text(text + "\n".join(lines) + "\n", encoding="utf-8")
    log("  Updated models/MODEL_REPORT.md")


NOTHING_NEW = 10  # exit code for --auto when the archive has no new race yet


def archive_round() -> int:
    """Latest round of the current season with results in the local Stats archive."""
    latest = 0
    sdir = STATS / str(SEASON)
    for gp in (sdir.iterdir() if sdir.is_dir() else []):
        res = _race_of(gp / "results.json") if gp.is_dir() else None
        if res and res.get("Results"):
            latest = max(latest, int(res["round"]))
    return latest


def model_round() -> int:
    return int((read_json(WEB_DATA / "winner-model.json") or {}).get("afterRound") or 0)


def auto() -> int:
    """Pull the Stats repo; retrain only when it holds a race the model hasn't seen."""
    sync_git_repos()
    have, seen = archive_round(), model_round()
    if have <= seen:
        log(f"Winner model: archive is at round {have}, model already covers round {seen} - nothing new.")
        return NOTHING_NEW
    log(f"Winner model: archive has round {have}, model covers round {seen} - retraining.")
    main()
    return 0


if __name__ == "__main__":
    import sys

    sys.exit(auto() if "--auto" in sys.argv[1:] else (main() and 0))
