import Link from "next/link";
import SectionHeader from "./SectionHeader";

/** Links from the fan pages into the machine-learning tools. */
const TOOLS = [
  {
    title: "Live telemetry",
    text: "Animated circuit map with speed, gear, DRS, throttle and brake, tyre temperatures and ML aero predictions.",
    href: "/live",
    cta: "Open dashboard",
    icon: <path d="M3 12h4l3-8 4 16 3-8h4" />,
  },
  {
    title: "2026 championship predictor",
    text: "Win probability for every driver, from a model trained on 2021–2025 results.",
    href: "/predictor",
    cta: "View predictions",
    icon: <><path d="M8 21h8M12 17v4M7 4h10v5a5 5 0 0 1-10 0V4z" /><path d="M17 5h3v2a3 3 0 0 1-3 3M7 5H4v2a3 3 0 0 0 3 3" /></>,
  },
  {
    title: "Aero calculator",
    text: "Pick a speed, 2026 active aero mode and track setup to get drag and downforce from real aerodynamic equations, with a live wind tunnel.",
    href: "/aero",
    cta: "Try it",
    icon: <path d="M2 12c4-4 8-4 12 0s6 4 8 2M2 7c4-3 8-3 12 0M2 17c4-3 8-3 12 0" />,
  },
];

export default function Insights() {
  return (
    <section className="section section--tinted" id="insights">
      <div className="container">
        <SectionHeader eyebrow="Data & insights" title="Under the hood" subtitle="Our machine-learning tools, built on real 2026 timing data." />
        <div className="card-grid card-grid--insights">
          {TOOLS.map((t) => (
            <Link key={t.href} href={t.href} className="card insight-card">
              <span className="insight-card__icon"><svg viewBox="0 0 24 24" aria-hidden="true">{t.icon}</svg></span>
              <h3 className="card__title">{t.title}</h3>
              <p className="card__meta">{t.text}</p>
              <span className="insight-card__link">{t.cta} &rarr;</span>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
