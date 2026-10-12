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
        text="Predict drag and downforce from speed, rear wing angle and DRS, using the trained neural network."
      />
      <section className="page-body">
        <div className="container">
          <AeroCalculator />
        </div>
      </section>
    </>
  );
}
