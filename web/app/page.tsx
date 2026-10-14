import Calendar from "@/components/home/Calendar";
import Newsletter from "@/components/home/Newsletter";
import LiveRefresh from "@/components/LiveRefresh";
import AeroHero from "@/components/motion/AeroHero";
import AeroStory from "@/components/motion/AeroStory";
import ChampionshipRace from "@/components/motion/ChampionshipRace";
import InfiniteGallery from "@/components/motion/InfiniteGallery";
import Finale from "@/components/motion/Finale";
import LightsOut from "@/components/motion/LightsOut";
import NextRace from "@/components/motion/NextRace";
import { Reveal } from "@/components/motion/primitives";
import SeasonStats from "@/components/motion/SeasonStats";
import TeamRail from "@/components/motion/TeamRail";
import Ticker from "@/components/motion/Ticker";
import ToolCards from "@/components/motion/ToolCards";
import { getGalleryPhotos } from "@/lib/gallery";
import { getLandingData } from "@/lib/landing";
import "./motion.css";

// Render on every request so the calendar always reflects today's date and the latest data
export const dynamic = "force-dynamic";

/** Home page: the motion landing. Sections appear in this order. */
export default async function HomePage() {
  const [data, photos] = await Promise.all([getLandingData(), getGalleryPhotos()]);
  const leader = data.drivers[0];

  return (
    <div className="landing">
      <LiveRefresh />
      <LightsOut />

      <AeroHero
        season={data.season}
        completed={data.completedRounds}
        total={data.totalRounds}
      />
      <Ticker
        drivers={data.drivers}
        phrases={["Lights out", `${data.season} season`, "Active aero", "50/50 power", `${data.totalRounds} rounds`, "Machine learning"]}
      />
      <SeasonStats
        completed={data.completedRounds}
        total={data.totalRounds}
        teams={data.teams.length}
        countries={data.countries}
        leaderPoints={leader?.points ?? 0}
        leader={leader?.code ?? "Leader"}
      />
      <AeroStory />
      <TeamRail teams={data.teams} season={data.season} />
      <ChampionshipRace drivers={data.drivers} rounds={data.rounds} season={data.season} />
      {data.nextRace && <NextRace race={data.nextRace} />}

      <Reveal className="reveal-up">
        <Calendar />
      </Reveal>
      <ToolCards drivers={data.drivers} />
      {photos.length > 0 && <InfiniteGallery photos={photos} />}
      <Finale />
      <Newsletter />
    </div>
  );
}
