import type { Metadata } from "next";
import PageHead from "@/components/PageHead";
import TelemetrySimulator, { CircuitOption } from "@/components/telemetry/TelemetrySimulator";
import { getAeroCalibration, getCircuitIndex, getPitStops } from "@/lib/siteData";

export const metadata: Metadata = { title: "Live Telemetry" };

export default async function LivePage() {
  const [index, pit, aero] = await Promise.all([getCircuitIndex(), getPitStops(), getAeroCalibration()]);

  const circuits: CircuitOption[] = Object.entries(index.circuits)
    .filter(([, c]) => c.hasTelemetry && c.laps)
    .map(([slug, c]) => ({
      slug,
      name: c.name,
      round: c.round,
      laps: c.laps as number,
      compounds: c.compounds,
      dataSeason: c.dataSeason,
      pitLoss: c.pitLoss,
      pitLossEstimated: c.pitLossEstimated,
      setup: aero.setupBySlug[slug] ?? "medium",
    }))
    .sort((a, b) => a.round - b.round);

  const stationary = pit?.teamStationary ?? {};
  const times = Object.values(stationary).map((s) => s.seconds).sort((a, b) => a - b);
  const medianStationary = times.length ? times[Math.floor(times.length / 2)] : 2.8;

  return (
    <>
      <PageHead
        eyebrow="Data & insights"
        title="Live telemetry"
        text="Race a 2026 team around any circuit on its real reference lap. Lap times come from a model trained on real race laps; tyre temperatures are estimated."
      />
      <section className="page-body">
        <div className="container">
          <TelemetrySimulator circuits={circuits} stationary={stationary} medianStationary={medianStationary} />
        </div>
      </section>
    </>
  );
}
