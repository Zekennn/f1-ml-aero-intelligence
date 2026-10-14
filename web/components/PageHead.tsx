import Link from "next/link";
import { CSSProperties } from "react";
import { SplitText } from "./motion/primitives";

/**
 * Cinematic title band at the top of every inner page: breadcrumb, kinetic title,
 * a giant outlined echo of the title behind it and streaking speed lines.
 * Pure CSS motion, so it works in server components.
 */
export default function PageHead({ eyebrow, title, text }: { eyebrow: string; title: string; text: string }) {
  return (
    <section className="ph">
      <div className="ph__bg" aria-hidden="true">
        <span className="ph__glow" />
        <span className="ph__grid" />
        {Array.from({ length: 9 }, (_, i) => (
          <i key={i} className="ph__streak" style={{ "--i": i } as CSSProperties} />
        ))}
        <span className="ph__echo">{title}</span>
      </div>

      <div className="container ph__inner">
        <nav className="ph__crumbs" aria-label="Breadcrumb">
          <span className="live-dot" aria-hidden="true" />
          <Link href="/">Home</Link>
          <span aria-hidden="true">/</span>
          <span>{eyebrow}</span>
          <span aria-hidden="true">/</span>
          <span aria-current="page">{title}</span>
        </nav>
        <h1 className="ph__title">
          <SplitText text={title} />
        </h1>
        <p className="ph__text ph-in" style={{ "--d": 6 } as CSSProperties}>{text}</p>
      </div>
      <span className="ph__rule" aria-hidden="true" />
    </section>
  );
}
