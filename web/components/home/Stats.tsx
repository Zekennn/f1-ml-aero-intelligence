import { STATS } from "@/data/site";

export default function Stats() {
  return (
    <section className="stats" aria-label="Season at a glance">
      <div className="container stats__grid">
        {STATS.map((s) => (
          <div className="stat" key={s.label}>
            <span className="stat__value">{s.value}</span>
            <span className="stat__label">{s.label}</span>
          </div>
        ))}
      </div>
    </section>
  );
}
