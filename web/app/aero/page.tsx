import type { Metadata } from "next";
import PageHead from "@/components/PageHead";
import AeroCalculator from "@/components/AeroCalculator";

export const metadata: Metadata = { title: "Aero Calculator" };

export default function AeroPage() {
  return (
    <>
      <PageHead
        eyebrow="Data & insights"
        title="Aero calculator"
        text="Drag and downforce for a 2026 Formula 1 car from real aerodynamic equations: pick a speed, active aero mode, track setup and air conditions."
      />
      <section className="page-body">
        <div className="container">
          <AeroCalculator />
        </div>
      </section>
    </>
  );
}
