"use client";

import { useEffect, useRef, useState } from "react";

/** A number that eases to its new value instead of jumping. */
export default function AnimatedNumber({ value, decimals = 0, instant = false }: { value: number; decimals?: number; instant?: boolean }) {
  const [shown, setShown] = useState(value);
  const current = useRef(value);

  useEffect(() => {
    if (instant || !Number.isFinite(value)) {
      current.current = value;
      setShown(value);
      return;
    }
    const from = current.current;
    const start = performance.now();
    let raf = 0;
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / 450);
      const v = from + (value - from) * (1 - Math.pow(1 - t, 3));
      current.current = v;
      setShown(v);
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value, instant]);

  if (!Number.isFinite(shown)) return <>–</>;
  return <>{shown.toLocaleString(undefined, { minimumFractionDigits: decimals, maximumFractionDigits: decimals })}</>;
}
