"use client";

import { CSSProperties, ElementType, Fragment, ReactNode, useEffect, useRef } from "react";
import { useInView } from "./engine";

/** Adds `is-in` once the element scrolls into view; CSS in motion.css does the animating. */
export function Reveal({
  as: Tag = "div",
  className = "",
  children,
  threshold = 0.2,
  style,
  id,
}: {
  as?: ElementType;
  className?: string;
  children: ReactNode;
  threshold?: number;
  style?: CSSProperties;
  id?: string;
}) {
  const ref = useRef<HTMLElement>(null);
  const inView = useInView(ref, { threshold });
  return (
    <Tag ref={ref} id={id} style={style} className={`${className} ${inView ? "is-in" : ""}`}>
      {children}
    </Tag>
  );
}

/**
 * Splits text into per-character spans (grouped by word so lines still wrap naturally).
 * Each character gets --i for staggered CSS animations. Screen readers get the plain text.
 */
export function SplitText({ text, className = "", offset = 0 }: { text: string; className?: string; offset?: number }) {
  let i = offset;
  return (
    <span className={`split ${className}`} aria-label={text} role="text">
      {text.split(" ").map((word, w, words) => (
        <Fragment key={w}>
          <span className="split__word" aria-hidden="true">
            {[...word].map((ch, c) => (
              <span className="split__char" style={{ "--i": i++ } as CSSProperties} key={c}>
                {ch}
              </span>
            ))}
          </span>
          {w < words.length - 1 && " "}
        </Fragment>
      ))}
    </span>
  );
}

/** Pulls its child gently towards the pointer while hovered (desktop pointers only). */
export function Magnetic({ children, strength = 0.35, className = "" }: { children: ReactNode; strength?: number; className?: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el || !window.matchMedia("(pointer: fine)").matches) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const move = (e: PointerEvent) => {
      const r = el.getBoundingClientRect();
      const x = (e.clientX - (r.left + r.width / 2)) * strength;
      const y = (e.clientY - (r.top + r.height / 2)) * strength;
      el.style.transform = `translate3d(${x}px, ${y}px, 0)`;
    };
    const leave = () => (el.style.transform = "");
    el.addEventListener("pointermove", move);
    el.addEventListener("pointerleave", leave);
    return () => {
      el.removeEventListener("pointermove", move);
      el.removeEventListener("pointerleave", leave);
    };
  }, [strength]);
  return (
    <span ref={ref} className={`magnetic ${className}`}>
      {children}
    </span>
  );
}
