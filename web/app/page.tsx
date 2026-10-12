import Hero from "@/components/home/Hero";
import Stats from "@/components/home/Stats";
import About from "@/components/home/About";
import Teams from "@/components/home/Teams";
import Drivers from "@/components/home/Drivers";
import Calendar from "@/components/home/Calendar";
import Gallery from "@/components/home/Gallery";
import Insights from "@/components/home/Insights";
import Newsletter from "@/components/home/Newsletter";
import LiveRefresh from "@/components/LiveRefresh";

// Render on every request so the calendar always reflects today's date and the latest data
export const dynamic = "force-dynamic";

/** Home page – sections appear in this order. */
export default function HomePage() {
  return (
    <>
      <LiveRefresh />
      <Hero />
      <Stats />
      <About />
      <Teams />
      <Drivers />
      <Calendar />
      <Gallery />
      <Insights />
      <Newsletter />
    </>
  );
}
