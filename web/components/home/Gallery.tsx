"use client";

import Image from "next/image";
import { useCallback, useEffect, useState } from "react";
import Media from "../Media";
import SectionHeader from "./SectionHeader";
import { GALLERY } from "@/data/site";

/** Six-image grid. Clicking a photo opens a simple lightbox. */
export default function Gallery() {
  const [missing, setMissing] = useState<Set<number>>(new Set());
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  // Step through photos that actually loaded (skips missing ones)
  const step = useCallback((dir: number) => {
    setOpenIndex((current) => {
      const available = GALLERY.map((_, i) => i).filter((i) => !missing.has(i));
      if (current === null || !available.length) return current;
      const pos = available.indexOf(current);
      return available[(pos + dir + available.length) % available.length];
    });
  }, [missing]);

  // Keyboard controls + lock page scroll while the lightbox is open
  useEffect(() => {
    if (openIndex === null) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpenIndex(null);
      if (e.key === "ArrowLeft") step(-1);
      if (e.key === "ArrowRight") step(1);
    };
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [openIndex, step]);

  const close = () => setOpenIndex(null);

  return (
    <section className="section" id="gallery">
      <div className="container">
        <SectionHeader eyebrow="Gallery" title="From the paddock" subtitle="Placeholder text. Click any photo to view it larger." />

        <div className="gallery">
          {GALLERY.map((img, i) => (
            <button
              key={img.src}
              className={`gallery__item ${missing.has(i) ? "is-missing" : ""}`}
              aria-label={`Open image ${i + 1}`}
              onClick={() => !missing.has(i) && setOpenIndex(i)}
            >
              <Media
                src={img.src}
                alt={img.alt}
                label="gallery image"
                sizes="(max-width: 900px) 50vw, 400px"
                onMissing={() => setMissing((prev) => new Set(prev).add(i))}
              />
            </button>
          ))}
        </div>
      </div>

      {openIndex !== null && (
        <div
          className="lightbox"
          role="dialog"
          aria-modal="true"
          aria-label="Image viewer"
          onClick={(e) => e.target === e.currentTarget && close()}
        >
          <button className="lightbox__close" aria-label="Close" autoFocus onClick={close}>&times;</button>
          <button className="lightbox__nav lightbox__nav--prev" aria-label="Previous image" onClick={() => step(-1)}>&#8249;</button>
          <div className="lightbox__frame" onClick={(e) => e.target === e.currentTarget && close()}>
            <Image src={GALLERY[openIndex].src} alt={GALLERY[openIndex].alt} fill sizes="100vw" />
          </div>
          <button className="lightbox__nav lightbox__nav--next" aria-label="Next image" onClick={() => step(1)}>&#8250;</button>
        </div>
      )}
    </section>
  );
}
