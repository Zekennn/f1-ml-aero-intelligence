"use client";

import { useEffect, useRef, useState } from "react";

const KEY = "fh-intro-seen";

// Runs before first paint: skip the intro on repeat visits and for reduced motion.
const BOOT = `try{var d=document.documentElement;d.dataset.intro=(sessionStorage.getItem("${KEY}")||matchMedia("(prefers-reduced-motion: reduce)").matches)?"skip":"playing"}catch(e){document.documentElement.dataset.intro="skip"}`;

type Phase = "idle" | "counting" | "out" | "split" | "gone";

/**
 * Start-gantry intro: five pairs of red lights come on one by one, hold for a random
 * moment like a real start, then go out and the screen splits open onto the hero.
 * Plays once per browser session. Click, Escape or "Skip" to jump ahead.
 */
export default function LightsOut() {
  const [phase, setPhase] = useState<Phase>("idle");
  const [lit, setLit] = useState(0);
  const timers = useRef<number[]>([]);

  useEffect(() => {
    const root = document.documentElement;
    if (root.dataset.intro !== "playing") {
      root.dataset.intro = "skip";
      setPhase("gone");
      return;
    }
    root.style.overflow = "hidden";
    const at = (ms: number, fn: () => void) => timers.current.push(window.setTimeout(fn, ms));

    setPhase("counting");
    for (let i = 1; i <= 5; i++) at(250 + i * 520, () => setLit(i));
    const out = 250 + 5 * 520 + 500 + Math.random() * 600; // random hold, like a real start
    at(out, () => setPhase("out"));
    at(out + 750, () => finish());

    const onKey = (e: KeyboardEvent) => e.key === "Escape" && finish();
    window.addEventListener("keydown", onKey);
    return () => {
      timers.current.forEach(clearTimeout);
      window.removeEventListener("keydown", onKey);
      root.style.overflow = "";
    };
  }, []);

  function finish() {
    timers.current.forEach(clearTimeout);
    timers.current = [];
    try {
      sessionStorage.setItem(KEY, "1");
    } catch {}
    const root = document.documentElement;
    root.dataset.intro = "done";
    root.style.overflow = "";
    setPhase("split");
    timers.current.push(window.setTimeout(() => setPhase("gone"), 1100));
  }

  return (
    <>
      <script dangerouslySetInnerHTML={{ __html: BOOT }} />
      {phase !== "gone" && (
        <div className={`intro intro--${phase}`} onClick={finish}>
          <div className="intro__panel intro__panel--top" />
          <div className="intro__panel intro__panel--bottom" />
          <div className="intro__stage" aria-hidden="true">
            <div className="intro__gantry">
              {[1, 2, 3, 4, 5].map((n) => (
                <div key={n} className={`intro__pod ${lit >= n && phase === "counting" ? "is-lit" : ""}`}>
                  <span /><span /><span className="red" /><span className="red" />
                </div>
              ))}
            </div>
            <p className="intro__caption">
              <span className="intro__count">{phase === "counting" ? `0${lit}` : "GO"}</span>
              <span className="intro__label">{phase === "out" || phase === "split" ? "Lights out and away we go" : "Formation complete · stand by"}</span>
            </p>
          </div>
          <button type="button" className="intro__skip" onClick={(e) => { e.stopPropagation(); finish(); }}>
            Skip intro
          </button>
        </div>
      )}
    </>
  );
}
