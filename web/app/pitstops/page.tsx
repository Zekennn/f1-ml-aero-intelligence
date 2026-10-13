import type { Metadata } from "next";
import PageHead from "@/components/PageHead";
import PitStopsView from "@/components/insights/PitStopsView";
import { getPitStops } from "@/lib/siteData";

export const metadata: Metadata = { title: "Pit Stops" };

export default async function PitStopsPage() {
  const data = await getPitStops();
  return (
    <>
      <PageHead
        eyebrow="Data & insights"
        title="Pit stops"
        text="Every timed pit stop from 2018 to 2026: the fastest stops and each team's average, from the TracingInsights PitStops repo (DHL timing)."
      />
      <section className="page-body">
        <div className="container ins">
          {data ? <PitStopsView data={data} /> : <p className="notice">No pit stop data yet. Run the data update (see README) to build it.</p>}
          <p className="ins-source">Source: TracingInsights PitStops (MIT), DHL Fastest Pit Stop Award timing.</p>
        </div>
      </section>
    </>
  );
}
