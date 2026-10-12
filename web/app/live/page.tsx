import type { Metadata } from "next";
import PageHead from "@/components/PageHead";
import LiveDashboard from "@/components/LiveDashboard";

export const metadata: Metadata = { title: "Live Telemetry" };

export default function LivePage() {
  return (
    <>
      <PageHead
        eyebrow="Data & insights"
        title="Live telemetry"
        text="A simulated lap with real circuit data: speed, gear, DRS, pedals, tyre temperatures and machine-learning aero predictions."
      />
      <section className="page-body">
        <div className="container">
          <LiveDashboard />
        </div>
      </section>
    </>
  );
}
