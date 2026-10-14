"use client";

import Link from "next/link";
import { useRef } from "react";
import { useViewProgress } from "./engine";
import { Magnetic } from "./primitives";

/** Closing statement: two giant lines slide past each other as you scroll through. */
export default function Finale() {
  const ref = useRef<HTMLElement>(null);
  const a = useRef<HTMLDivElement>(null);
  const b = useRef<HTMLDivElement>(null);

  useViewProgress(ref, (p) => {
    const shift = (p - 0.5) * 60;
    if (a.current) a.current.style.transform = `translate3d(${-shift}vw,0,0)`;
    if (b.current) b.current.style.transform = `translate3d(${shift}vw,0,0)`;
    ref.current?.style.setProperty("--p", p.toFixed(3));
  });

  return (
    <section className="fin" ref={ref} aria-label="Lights out and away we go">
      <div className="fin__line fin__line--a" ref={a} aria-hidden="true">
        Lights out <span>Lights out</span> Lights out
      </div>
      <div className="fin__line fin__line--b" ref={b} aria-hidden="true">
        and away we go <span>and away we go</span>
      </div>
      <div className="container fin__cta">
        <p>Race week, in your inbox. Or straight onto the grid.</p>
        <div className="fin__actions">
          <Magnetic>
            <a href="#contact" className="mbtn mbtn--hot"><span>Get race-week updates</span></a>
          </Magnetic>
          <Magnetic>
            <Link href="/live" className="mbtn mbtn--ghost"><span>Start a live session</span></Link>
          </Magnetic>
        </div>
      </div>
    </section>
  );
}
