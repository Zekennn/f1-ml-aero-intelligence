"use client";

import Link from "next/link";
import { CSSProperties, useEffect, useRef, useState } from "react";
import { AERO_MEDIUM, CAR, POWER } from "@/lib/car2026";
import { clamp, range, usePinProgress } from "./engine";

const dragCut = Math.round((1 - AERO_MEDIUM.straight.CdA / AERO_MEDIUM.corner.CdA) * 100);
const electricShare = Math.round((POWER.electricKw / POWER.totalKw) * 100);

const CHAPTERS = [
  {
    tag: "About",
    title: "Built by fans, for fans.",
    text: "An independent home for the teams, the drivers and the calendar — plus the data tools to go deeper. It starts with the car.",
    facts: [
      [`${CAR.massKg}`, "kg minimum"],
      [`${CAR.wheelbaseM}`, "m wheelbase"],
      [`${CAR.widthM}`, "m wide"],
    ],
  },
  {
    tag: "Active aero",
    title: "Both wings move now.",
    text: "Corner Mode closes the front and rear flaps for downforce. On the straights they open and the drag falls away.",
    facts: [
      [`−${dragCut}%`, "drag, Straight Mode"],
      [`${AERO_MEDIUM.corner.ClA}`, "ClA m², Corner"],
      [`${AERO_MEDIUM.straight.CdA}`, "CdA m², Straight"],
    ],
  },
  {
    tag: "Power unit",
    title: "Half of it is electric.",
    text: "The combustion engine and the battery now push almost equally hard — and how drivers spend that energy decides races.",
    facts: [
      [`${POWER.combustionKw}`, "kW combustion"],
      [`${POWER.electricKw}`, "kW electric"],
      [`${electricShare}%`, "electric share"],
    ],
  },
  {
    tag: "Machine learning",
    title: "Then we model it.",
    text: "Every 2026 lap feeds our models: lap times, tyre temperatures, pit loss and who is most likely to take the title.",
    facts: [
      ["4", "models"],
      ["2021–25", "training seasons"],
      ["23", "circuits mapped"],
    ],
  },
] as const;

const ML_LABELS = [
  { x: 760, y: 18, label: "Lap time model" },
  { x: 120, y: 18, label: "Tyre temperatures" },
  { x: 120, y: 428, label: "Pit loss" },
  { x: 760, y: 428, label: "Win probability" },
];

export default function AeroStory() {
  const ref = useRef<HTMLElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const railRef = useRef<HTMLElement>(null);
  const [chapter, setChapter] = useState(0);
  const chapterRef = useRef(0);
  const reduced = useRef(false);

  useEffect(() => {
    reduced.current = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  }, []);

  usePinProgress(ref, (p) => {
    const svg = svgRef.current;
    if (!svg) return;
    const draw = reduced.current ? 1 : range(p, 0, 0.18);
    const paths = svg.querySelectorAll<SVGGeometryElement>(".bp-draw");
    paths.forEach((el, i) => {
      el.style.strokeDashoffset = String(1 - clamp(draw * 2.2 - (i / paths.length) * 1.2));
    });
    const c = Math.min(CHAPTERS.length - 1, Math.floor(p * CHAPTERS.length * 0.999));
    if (c !== chapterRef.current) {
      chapterRef.current = c;
      setChapter(c);
    }
    // Inside the aero chapter: flaps close (Corner) then open (Straight)
    const local = p * CHAPTERS.length - c;
    svg.style.setProperty("--flap", String(c === 1 ? range(local, 0.35, 0.65) : c > 1 ? 1 : 0));
    svg.style.setProperty("--draw", String(draw));
    railRef.current?.style.setProperty("--p", String(p));
  });

  const flapsOpen = chapter >= 1;

  return (
    <section className="story" id="about" ref={ref}>
      <div className="story__pin">
        <div className="story__bg-num" aria-hidden="true">0{chapter + 1}</div>

        <div className="container story__inner">
          <div className="story__copy">
            <nav className="story__rail" ref={railRef} aria-hidden="true">
              {CHAPTERS.map((c, i) => (
                <span key={c.tag} className={i === chapter ? "is-on" : i < chapter ? "is-past" : ""}>
                  {c.tag}
                </span>
              ))}
            </nav>

            <div className="story__chapters">
              {CHAPTERS.map((c, i) => (
                <article key={c.tag} className="story__chapter" data-state={i === chapter ? "on" : i < chapter ? "past" : "next"} aria-hidden={i !== chapter}>
                  <p className="eyebrow-x">
                    <span>{i + 1}/{CHAPTERS.length}</span> {c.tag}
                  </p>
                  <h2 className="story__title">{c.title}</h2>
                  <p className="story__text">{c.text}</p>
                  <dl className="story__facts">
                    {c.facts.map(([v, l], k) => (
                      <div key={l} style={{ "--k": k } as CSSProperties}>
                        <dt>{l}</dt>
                        <dd>{v}</dd>
                      </div>
                    ))}
                  </dl>
                  {i === 3 && (
                    <Link href="/predictor" className="text-arrow" tabIndex={i === chapter ? 0 : -1}>
                      See the predictor →
                    </Link>
                  )}
                </article>
              ))}
            </div>
          </div>

          <div className={`story__visual chapter-${chapter}`}>
            <svg ref={svgRef} viewBox="0 0 1000 440" className="bp" role="img" aria-label="Top-down blueprint of a 2026 car">
              <defs>
                <pattern id="bp-grid" width="20" height="20" patternUnits="userSpaceOnUse">
                  <path d="M20 0H0V20" fill="none" className="bp-grid-line" />
                </pattern>
                <radialGradient id="bp-pu" cx="50%" cy="50%" r="50%">
                  <stop offset="0" stopColor="#ff3b3b" stopOpacity="0.9" />
                  <stop offset="1" stopColor="#ff3b3b" stopOpacity="0" />
                </radialGradient>
                <radialGradient id="bp-batt" cx="50%" cy="50%" r="50%">
                  <stop offset="0" stopColor="#36e2ff" stopOpacity="0.9" />
                  <stop offset="1" stopColor="#36e2ff" stopOpacity="0" />
                </radialGradient>
              </defs>
              <rect width="1000" height="440" fill="url(#bp-grid)" className="bp-gridrect" />

              {/* Airflow lines (active aero chapter) */}
              <g className="bp-flow">
                {[70, 120, 170, 270, 320, 370].map((y, i) => (
                  <path key={y} d={`M1000 ${y} C 820 ${y} 700 ${y + (y < 220 ? -14 : 14)} 500 ${y + (y < 220 ? -10 : 10)} S 120 ${y} 0 ${y}`} style={{ "--i": i } as CSSProperties} />
                ))}
              </g>

              {/* Power unit + battery glow */}
              <g className="bp-power">
                <ellipse cx="380" cy="220" rx="110" ry="70" fill="url(#bp-pu)" />
                <ellipse cx="545" cy="220" rx="80" ry="55" fill="url(#bp-batt)" />
                <path className="bp-energy" d="M545 220 C 470 220 430 220 380 220 S 230 220 180 160" />
                <path className="bp-energy" d="M545 220 C 470 220 430 220 380 220 S 230 220 180 280" />
              </g>

              <g className="bp-car">
                {/* Floor (under the car, dashed once drawn) */}
                <path className="bp-draw bp-floor" pathLength={1} d="M250 120 L640 108 Q682 112 690 150 L690 290 Q682 328 640 332 L250 320 Z" />
                {/* Chassis, sidepods, engine cover, nose */}
                <path className="bp-draw" pathLength={1} d="M105 200 L250 186 C300 180 320 150 360 128 L560 118 C600 118 620 142 640 176 L700 194 L905 210 Q918 220 905 230 L700 246 L640 264 C620 298 600 322 560 322 L360 312 C320 290 300 260 250 254 L105 240 Z" />
                <ellipse className="bp-draw" pathLength={1} cx="562" cy="220" rx="48" ry="21" />
                <ellipse className="bp-draw" pathLength={1} cx="470" cy="220" rx="22" ry="13" />
                <path className="bp-draw bp-halo" pathLength={1} d="M612 220 Q610 186 562 185 L522 188 M612 220 Q610 254 562 255 L522 252 M612 220 L646 220" />
                {/* Sidepod inlets */}
                <path className="bp-draw" pathLength={1} d="M372 134 L372 160 M372 306 L372 280" />

                {/* Wheels */}
                <rect className="bp-draw bp-tyre" pathLength={1} x="120" y="38" width="122" height="64" rx="14" />
                <rect className="bp-draw bp-tyre" pathLength={1} x="120" y="338" width="122" height="64" rx="14" />
                <rect className="bp-draw bp-tyre" pathLength={1} x="700" y="46" width="106" height="58" rx="12" />
                <rect className="bp-draw bp-tyre" pathLength={1} x="700" y="336" width="106" height="58" rx="12" />
                {/* Suspension */}
                <path className="bp-draw bp-thin" pathLength={1} d="M170 102 L250 190 M205 102 L290 184 M170 338 L250 250 M205 338 L290 256" />
                <path className="bp-draw bp-thin" pathLength={1} d="M728 104 L680 198 M772 104 L708 200 M728 336 L680 242 M772 336 L708 240" />

                {/* Rear wing: fixed main plane + active flap */}
                <rect className="bp-draw" pathLength={1} x="76" y="96" width="30" height="248" rx="4" />
                <path className="bp-draw bp-thin" pathLength={1} d="M40 92 L112 92 M40 348 L112 348" />
                <rect className="bp-flap bp-flap--rear" x="50" y="100" width="22" height="240" rx="3" />

                {/* Front wing: fixed main plane + active flaps */}
                <rect className="bp-draw" pathLength={1} x="910" y="58" width="30" height="324" rx="4" />
                <path className="bp-draw bp-thin" pathLength={1} d="M872 54 L950 54 M872 386 L950 386" />
                <rect className="bp-flap bp-flap--front" x="880" y="64" width="24" height="312" rx="3" />
              </g>

              {/* Dimensions */}
              <g className="bp-dims">
                <path d="M181 424 L753 424 M181 416 L181 432 M753 416 L753 432" />
                <text x="467" y="418" textAnchor="middle">{CAR.wheelbaseM * 1000} mm wheelbase</text>
                <path d="M978 54 L978 386 M970 54 L986 54 M970 386 L986 386" />
                <text x="968" y="225" textAnchor="middle" transform="rotate(-90 968 225)">{CAR.widthM * 1000} mm</text>
              </g>

              {/* Active-aero callouts */}
              <g className="bp-callouts">
                <text x="95" y="80" textAnchor="middle">{flapsOpen ? "REAR FLAP" : ""}</text>
                <text x="895" y="40" textAnchor="middle">{flapsOpen ? "FRONT FLAP" : ""}</text>
              </g>

              {/* ML network */}
              <g className="bp-ml">
                {ML_LABELS.map((l, i) => (
                  <g key={l.label} style={{ "--i": i } as CSSProperties}>
                    <path d={`M${l.x + (l.x > 500 ? -20 : 80)} ${l.y < 200 ? l.y + 14 : l.y - 18} L ${[640, 300, 300, 640][i]} ${[150, 140, 300, 290][i]}`} />
                    <circle cx={[640, 300, 300, 640][i]} cy={[150, 140, 300, 290][i]} r="6" />
                    <text x={l.x} y={l.y}>{l.label}</text>
                  </g>
                ))}
              </g>
            </svg>
            <div className="story__mode" aria-hidden="true">
              <span className={chapter === 1 ? "is-live" : ""}>
                <i /> {chapter < 1 ? "Blueprint" : chapter === 1 ? "Corner ↔ Straight" : chapter === 2 ? "Energy flow" : "Model inputs"}
              </span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
