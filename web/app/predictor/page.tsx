import type { Metadata } from "next";
import PageHead from "@/components/PageHead";
import WinnerPredictor from "@/components/insights/WinnerPredictor";
import { getDrivers } from "@/lib/drivers";
import { getWinnerModel } from "@/lib/siteData";

export const metadata: Metadata = { title: "2026 Winner Predictor" };

// Re-read the model file on each request so a retrain shows up without a rebuild
export const dynamic = "force-dynamic";

export default async function PredictorPage() {
  const [model, { drivers }] = await Promise.all([getWinnerModel(), getDrivers()]);
  const images = Object.fromEntries(drivers.filter((d) => d.code).map((d) => [d.code as string, d.image]));

  return (
    <>
      <PageHead
        eyebrow="Data & insights"
        title="2026 winner predictor"
        text={
          model
            ? `Who wins the next race, and the title: a race-by-race model trained on ${model.data.races} races of our own results data, after round ${model.afterRound} of ${model.roundsTotal}.`
            : "Race-by-race win probabilities and title odds, from a model trained on our own results data."
        }
      />
      <section className="page-body">
        <div className="container">
          {model ? (
            <WinnerPredictor model={model} images={images} />
          ) : (
            <p className="notice">
              No predictions yet. Run <code>venv\Scripts\python.exe backend\pipeline\train_winner_model.py</code> (or <code>.\update.ps1</code>), then refresh.
            </p>
          )}
        </div>
      </section>
    </>
  );
}
