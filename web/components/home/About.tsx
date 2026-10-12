import Link from "next/link";
import Media from "../Media";

export default function About() {
  return (
    <section className="section" id="about">
      <div className="container about">
        <Media
          src="/images/2.png"
          alt="Driver seated in the cockpit in the garage"
          label="about image"
          className="about__media"
          sizes="(max-width: 900px) 100vw, 50vw"
        />
        <div className="about__text">
          <p className="eyebrow">About</p>
          <h2 className="section-title">Built by fans, for fans</h2>
          <p>
            Placeholder text: Fan Hub is an independent space for people who love the sport. We bring
            together team profiles, driver line-ups and the race calendar in one simple, easy-to-read place.
          </p>
          <p>
            Placeholder text: alongside the fan content you will find our data tools: a live telemetry
            simulation, a championship predictor and an aerodynamics calculator powered by machine learning.
          </p>
          <Link href="/#teams" className="text-link">Meet the teams &rarr;</Link>
        </div>
      </div>
    </section>
  );
}
