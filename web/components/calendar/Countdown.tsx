"use client";

import { useEffect, useState } from "react";

/** Live countdown to lights out, ticking once a second. */
export default function Countdown({ target }: { target: string }) {
  // Starts empty so the server and browser render the same thing
  const [now, setNow] = useState<number | null>(null);

  useEffect(() => {
    setNow(Date.now());
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const start = Date.parse(target);
  if (now === null || Number.isNaN(start)) return <div className="countdown countdown--loading" />;

  const left = start - now;
  if (left <= 0) {
    return <p className="countdown__done">Lights out. The race is under way or has just finished.</p>;
  }

  const parts = [
    { value: Math.floor(left / 86_400_000), label: "Days" },
    { value: Math.floor(left / 3_600_000) % 24, label: "Hours" },
    { value: Math.floor(left / 60_000) % 60, label: "Minutes" },
    { value: Math.floor(left / 1000) % 60, label: "Seconds" },
  ];

  return (
    <>
      <div className="countdown" role="timer" aria-label={`${parts[0].value} days ${parts[1].value} hours until the race`}>
        {parts.map((p) => (
          <div key={p.label} className="countdown__part">
            <span className="countdown__value">{String(p.value).padStart(2, "0")}</span>
            <span className="countdown__label">{p.label}</span>
          </div>
        ))}
      </div>
      <p className="countdown__local">
        Lights out:{" "}
        {new Date(start).toLocaleString(undefined, { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}{" "}
        your time
      </p>
    </>
  );
}
