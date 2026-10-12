import type { Metadata } from "next";
import PageHead from "@/components/PageHead";
import Predictor from "@/components/Predictor";

export const metadata: Metadata = { title: "2026 Championship Predictor" };

export default function PredictorPage() {
  return (
    <>
      <PageHead
        eyebrow="Data & insights"
        title="2026 championship predictor"
        text="Each driver's chance of winning the title, from a model trained on 2021–2025 points and a technical index."
      />
      <section className="page-body">
        <div className="container">
          <Predictor />
        </div>
      </section>
    </>
  );
}
