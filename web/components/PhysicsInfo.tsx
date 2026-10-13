import { AERO_BALANCE_FRONT, AERO_MEDIUM, AIR, CAR, POWER, SETUPS } from "@/lib/car2026";

/** Expandable "Physics" section listing the formulas and the estimated inputs behind the calculator. */
export default function PhysicsInfo() {
  return (
    <details className="physics">
      <summary>Physics: the formulas used</summary>
      <div className="physics__body">
        <dl className="physics__list">
          <div><dt>Dynamic pressure</dt><dd>q = ½ × ρ × v² <span>(v in m/s)</span></dd></div>
          <div><dt>Drag</dt><dd>D = q × CdA</dd></div>
          <div><dt>Downforce</dt><dd>L = q × ClA</dd></div>
          <div><dt>Front / rear split</dt><dd>L<sub>front</sub> = L × aero balance, L<sub>rear</sub> = L − L<sub>front</sub></dd></div>
          <div><dt>Drag power</dt><dd>P = D × v</dd></div>
          <div><dt>Downforce as car weights</dt><dd>L ÷ (m × 9.81) <span>(m = {CAR.massKg} kg)</span></dd></div>
          <div><dt>Aero efficiency</dt><dd>L ÷ D</dd></div>
          <div><dt>Top speed (simplified)</dt><dd>v = (2P ÷ (ρ × CdA))<sup>1/3</sup> <span>(P = {POWER.topSpeedKw} kW effective power at top speed, calibrated to real 2026 top speeds; ignores rolling resistance)</span></dd></div>
          <div><dt>Air density</dt><dd>p = {AIR.seaLevelPressurePa.toLocaleString()} × (1 − 2.25577×10⁻⁵ × h)<sup>5.25588</sup>, ρ = p ÷ ({AIR.gasConstant} × T) <span>(standard atmosphere + ideal gas law, T in kelvin)</span></dd></div>
        </dl>
        <p className="physics__note">
          Estimated coefficients (Medium setup): Corner Mode CdA {AERO_MEDIUM.corner.CdA} m², ClA {AERO_MEDIUM.corner.ClA} m²,
          {" "}{Math.round(AERO_BALANCE_FRONT.corner * 100)}% front · Straight Mode CdA {AERO_MEDIUM.straight.CdA} m², ClA{" "}
          {AERO_MEDIUM.straight.ClA} m², {Math.round(AERO_BALANCE_FRONT.straight * 100)}% front. Low and High setups scale both by
          ×{SETUPS.low.scale} and ×{SETUPS.high.scale}. These are estimates: teams do not publish real values.
        </p>
      </div>
    </details>
  );
}
