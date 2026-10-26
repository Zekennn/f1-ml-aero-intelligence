# Model report

Generated 2026-10-26T05:33:29Z by `backend/pipeline/train_models.py`.

## Lap time model

Gradient-boosted regression trees (scikit-learn `HistGradientBoostingRegressor`, absolute-error loss), exported to
`web/public/data/models/laptime.json` and evaluated in the browser by `web/lib/lapTimeModel.ts`.

**Data**
- 36,147 green-flag dry race laps from the TracingInsights 2025 and 2026 telemetry repos (compound, tyre life, track temperature).
- 139,413 race laps from the Stats repo, 2018–2024 (tyre age from pit stops; compound and track temperature unknown).
- Removed: lap 1, in/out laps, safety car / VSC / flag laps (telemetry), deleted laps, wet compounds, laps slower than 107% of the race median.

**Features:** circuit, season, compound, tyre_age, track_temp, fuel_kg, team, team_form, grid, est_km, anchor. Fuel load is a fuel-corrected lap number (start fuel × share of the race left).
The model predicts lap time as a ratio of the anchor: the median of the circuit's fastest race laps 2004–2025
(or lap length × 17.6 s/km for new circuits), so returning and new tracks still get a sensible baseline.
Tyre age and fuel load are constrained so they can only make a lap slower.

**Accuracy** (trained without, then tested on, the most recent 2026 races: rounds 15, 16, 17)

| | MAE |
|---|---:|
| New model, all test laps | 1.681 s |
| Before: old live-page formula (average lap + 0.04 s × tyre age − 0.015 s × lap), same laps | 1.802 s |
| New model on those same laps | 1.305 s |

Per test race: Azerbaijan Grand Prix 0.770 s, Bahrain Grand Prix 2.733 s, Singapore Grand Prix 1.743 s

Learned tyre degradation (average, seconds per lap of tyre age): Soft +0.016, Medium +0.015, Hard +0.017

**Limitations:** no traffic, dirty air or driver effects; one model for all cars; tracks not raced since 2018 (or new tracks)
rely on the estimated lap length; 2018–2024 laps have no compound or track temperature; 2026 has only part of a season.

## Aero model

Physics, not a neural network: q = ½ρv², D = q·CdA, L = q·ClA with the estimated 2026 coefficients in `web/lib/car2026.ts`.
Calibrated against real 2026 top speeds (fastest race lap, 18 circuits, air density from each race's weather):
effective power at top speed **291 kW** (2026 cars run out of electrical deployment on long straights).
Top speed error 10.4 km/h MAE, compared with 115.5 km/h using the nominal 750 kW.

| Circuit | Setup | ρ (kg/m³) | Real (km/h) | Predicted (km/h) |
|---|---|---:|---:|---:|
| australian | medium | 1.186 | 323 | 312 |
| austrian | medium | 1.066 | 321 | 324 |
| azerbaijan | low | 1.190 | 326 | 329 |
| bahrain | medium | 1.169 | 306 | 314 |
| barcelona | medium | 1.148 | 327 | 316 |
| belgian | low | 1.164 | 326 | 332 |
| british | medium | 1.177 | 302 | 313 |
| canadian | low | 1.248 | 327 | 324 |
| chinese | medium | 1.236 | 321 | 308 |
| dutch | high | 1.224 | 319 | 295 |
| hungarian | high | 1.123 | 286 | 304 |
| italian | low | 1.141 | 330 | 334 |
| japanese | medium | 1.208 | 322 | 311 |
| miami | medium | 1.178 | 331 | 313 |
| monaco | high | 1.199 | 278 | 297 |
| singapore | high | 1.160 | 291 | 300 |
| spanish | medium | 1.084 | 330 | 322 |
| united-states | medium | 1.166 | 322 | 314 |

**Limitations:** coefficients are estimates (teams do not publish them); one effective power for every track; slipstream ignored.

## Tyre temperature model

The data repos contain **no tyre temperature data**. `web/lib/tyreModel.ts` is a physics-based *estimate* driven by
speed, lateral and longitudinal G, braking, compound and track temperature. It is labelled "Estimated" everywhere.

## Strategy helper

`web/lib/strategy.ts` sums predicted lap times over the race for every 1-stop and 2-stop plan (at least two dry compounds),
adding the circuit's real pit lane loss (in-lap + out-lap vs normal laps, telemetry repos) and the team's average
2026 stationary time (DHL, PitStops repo). No safety cars, traffic or tyre warm-up.

## Race winner model

Method from *Formula One Race Prediction Model* (Spencer Staub, GWU, 2022): one row per driver per race,
binary target “won the race”, history-only features, gradient-boosted trees (scikit-learn
`HistGradientBoostingClassifier`), drivers ranked by win probability inside each race. Written by
`backend/pipeline/train_winner_model.py` to `web/data/winner-model.json`.

**Data:** local Stats archive only, 521 races 2000–2026; 8,726 training rows from 2006.

**Validation** (train on all earlier seasons, test on the next; winner accuracy = top-ranked driver won)

| Season | Races | Pre-race | With qualifying | Pre-race (logistic) | Pole sitter | Championship leader |
|---|---:|---:|---:|---:|---:|---:|
| 2022 | 22 | 59% | 41% | 64% | 45% | 55% |
| 2023 | 22 | 86% | 86% | 86% | 64% | 86% |
| 2024 | 24 | 38% | 46% | 38% | 46% | 38% |
| 2025 | 24 | 33% | 67% | 25% | 71% | 25% |
| 2026 (walk-forward) | 18 | 39% | 72% | – | 72% | 39% |

Podium accuracy 2026 (share of the real top 3 found in the predicted top 3): pre-race 52%, with qualifying 67%.

**Most important features** (permutation importance, pre-race model, 2025): Avg finish, last 10 (0.005), Last year's points (share of champion) (0.005), Last grid position (0.003), Last year's position (0.002), Avg finish at this circuit (0.002), Podiums, last 10 (0.001).

**Forward look:** win probabilities for the remaining 5 rounds; championship from 20,000 simulated finishes (Plackett–Luce order, retirement chance from recent reliability).

**Tuning:** shallow regularised trees (depth 3, ≥120 rows per leaf) lifted mean 2022–26 pre-race winner accuracy
from 34% to 52%. Class balancing (the presentation's oversampling) ranked ~2 more races right out of ~105 but
flattened the probabilities (winner log-loss 1.51 → 1.72), so the calibrated model is used.

**Limitations:** results-only data (no practice pace, upgrades or weather); new 2026 regulations mean history
matters less than this season's form; the remaining-season simulation assumes form stays as it is now.
