import Link from "next/link";
import Media from "../Media";

export default function Hero() {
  return (
    <section className="hero" id="home">
      <Media
        src="/images/3.png"
        alt="Driver sitting on the grid with a trophy after a street race"
        className="hero__media"
        objectPosition="center 35%"
        priority
      />
      <div className="hero__overlay" />

      <div className="container hero__content">
        <p className="eyebrow eyebrow--light">2026 Season</p>
        <h1 className="hero__title">Every lap. Every team.<br />One place for fans.</h1>
        <p className="hero__text">Your independent guide to the teams, drivers and races shaping this season.</p>
        <div className="hero__actions">
          <Link href="/#calendar" className="btn btn--primary">View Calendar</Link>
          <Link href="/#about" className="btn btn--outline-light">Learn More</Link>
        </div>
      </div>
    </section>
  );
}
