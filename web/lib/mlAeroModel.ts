import { API } from "./backend";

/**
 * DISCONNECTED — not used by any page.
 *
 * Client for the old neural-network endpoint `GET /predict` (backend/main.py, trained by
 * backend/train_model.py into models/aero_model.pkl). Its inputs are the pre-2026
 * rear wing angle and DRS, so the Aero Calculator now uses the physics model in
 * lib/aeroPhysics.ts instead. Kept so the model can be retrained (for example on data
 * generated from the 2026 physics) and plugged back in later.
 */
export async function predictWithModel(speedKmh: number, wingAngle: number, drsOpen: boolean) {
  const qs = new URLSearchParams({ speed: String(speedKmh), wing_angle: String(wingAngle), drs: drsOpen ? "1" : "0" });
  const res = await fetch(`${API}/predict?${qs}`);
  if (!res.ok) throw new Error(String(res.status));
  const json: { predicted_drag: number; predicted_downforce: number } = await res.json();
  return { drag: json.predicted_drag, downforce: json.predicted_downforce };
}
