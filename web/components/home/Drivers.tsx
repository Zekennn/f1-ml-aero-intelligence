import Media from "../Media";
import SectionHeader from "./SectionHeader";
import { DRIVERS } from "@/data/drivers";

export default function Drivers() {
  return (
    <section className="section" id="drivers">
      <div className="container">
        <SectionHeader eyebrow="Drivers" title="This season's line-up" subtitle="Placeholder intro text about the driver line-up." />
        <div className="card-grid card-grid--drivers">
          {DRIVERS.map((d) => (
            <article key={d.name} className="card driver-card">
              {/* Photos are full-length cut-outs, so anchor to the top to show head and shoulders */}
              <Media src={d.image} alt={d.name} label="driver photo" className="card__media" objectPosition="center top" sizes="(max-width: 600px) 50vw, 240px" />
              <div className="card__body">
                <div>
                  <h3 className="card__title">{d.name}</h3>
                  <p className="card__meta">{d.team}</p>
                </div>
                <span className="driver-card__number" aria-label="Car number">{d.number}</span>
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
