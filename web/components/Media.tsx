"use client";

import Image from "next/image";
import { useState } from "react";

type MediaProps = {
  src: string;
  alt: string;
  /** Text shown inside the grey placeholder if the image is missing */
  label?: string;
  className?: string;
  /** Responsive size hint for next/image, e.g. "(max-width: 600px) 100vw, 33vw" */
  sizes?: string;
  priority?: boolean;
  objectPosition?: string;
  onMissing?: () => void;
};

/**
 * An image that fills its wrapper (object-fit: cover, lazy loaded).
 * If the file can't be loaded, the image is removed and the wrapper
 * shows a neutral ash-coloured placeholder box instead.
 */
export default function Media({
  src, alt, label = "", className = "", sizes = "100vw", priority = false, objectPosition, onMissing,
}: MediaProps) {
  const [missing, setMissing] = useState(false);

  return (
    <div className={`media ${className} ${missing ? "is-missing" : ""}`} data-label={label}>
      {!missing && (
        <Image
          src={src}
          alt={alt}
          fill
          sizes={sizes}
          priority={priority}
          style={objectPosition ? { objectPosition } : undefined}
          onError={() => {
            setMissing(true);
            onMissing?.();
          }}
        />
      )}
    </div>
  );
}
