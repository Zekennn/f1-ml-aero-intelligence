import Calendar from "@/components/home/Calendar";
import Gallery from "@/components/home/Gallery";
import Newsletter from "@/components/home/Newsletter";
import LiveRefresh from "@/components/LiveRefresh";
import AeroHero from "@/components/motion/AeroHero";
import AeroStory from "@/components/motion/AeroStory";
import ChampionshipRace from "@/components/motion/ChampionshipRace";
import Chrome from "@/components/motion/Chrome";
import Finale from "@/components/motion/Finale";
import { display, mono } from "@/components/motion/fonts";
import LightsOut from "@/components/motion/LightsOut";
import NextRace from "@/components/motion/NextRace";
import { Reveal } from "@/components/motion/primitives";
import SeasonStats from "@/components/motion/SeasonStats";
import TeamRail from "@/components/motion/TeamRail";
import Ticker from "@/components/motion/Ticker";
import ToolCards from "@/components/motion/ToolCards";
import { getLandingData } from "@/lib/landing";
import "./motion.css";

// Render on every request so the calendar always reflects today's date and the latest data
export const dynamic = "force-dynamic";

/** Home page: the motion landing. Sections appear in this order. */
export default async function HomePage() {
  const data = await getLandingData();
  const leaderTeam = data.teams[0];
  const leader = data.drivers[0];

  return (
    <div className={`landing ${display.variable} ${mono.variable}`}>
      <LiveRefresh />
      <LightsOut />
      <Chrome />

      <AeroHero
        season={data.season}
        completed={data.completedRounds}
        total={data.totalRounds}
        carSrc={`/images/teams/${leaderTeam?.slug ?? "mercedes"}-car.webp`}
        teamName={leaderTeam?.name ?? "Mercedes"}
        leader={leader?.code ?? null}
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
      <Reveal className="reveal-up">
        <Gallery />
      </Reveal>
      <Finale />
      <Newsletter />
    </div>
  );
}
