import Link from "next/link";
import Brand from "./Brand";
import { SITE_NAME } from "@/data/site";

const QUICK_LINKS = [
  { label: "About", href: "/#about" },
  { label: "Teams", href: "/#teams" },
  { label: "Drivers", href: "/#drivers" },
  { label: "Calendar", href: "/#calendar" },
  { label: "Gallery", href: "/#gallery" },
];

const DATA_LINKS = [
  { label: "Live Telemetry", href: "/live" },
  { label: "2026 Predictor", href: "/predictor" },
  { label: "Aero Calculator", href: "/aero" },
];

/** Replace "#" with your own profile links. */
const SOCIAL = [
  { label: "X / Twitter", href: "#", icon: <path d="M4 4l16 16M20 4L4 20" /> },
  { label: "Instagram", href: "#", icon: <><rect x="3" y="3" width="18" height="18" rx="5" /><circle cx="12" cy="12" r="4" /><circle cx="17.5" cy="6.5" r="0.8" /></> },
  { label: "YouTube", href: "#", icon: <><rect x="2" y="5" width="20" height="14" rx="4" /><path d="M10 9l5 3-5 3z" /></> },
  { label: "Facebook", href: "#", icon: <path d="M14 8h3V4h-3a4 4 0 0 0-4 4v3H7v4h3v6h4v-6h3l1-4h-4V8z" /> },
];

export default function Footer() {
  return (
    <footer className="footer">
      <div className="container footer__grid">
        <div className="footer__brand">
          <Brand />
          <p className="footer__tagline">An unofficial fan site. Not affiliated with any racing series, team or driver.</p>
          <div className="social">
            {SOCIAL.map((s) => (
              <a key={s.label} href={s.href} aria-label={s.label}>
                <svg viewBox="0 0 24 24" aria-hidden="true">{s.icon}</svg>
              </a>
            ))}
          </div>
        </div>

        <div className="footer__links">
          <h3 className="footer__heading">Quick links</h3>
          <ul>
            {QUICK_LINKS.map((l) => <li key={l.href}><Link href={l.href}>{l.label}</Link></li>)}
          </ul>
        </div>

        <div className="footer__links">
          <h3 className="footer__heading">Data &amp; insights</h3>
          <ul>
            {DATA_LINKS.map((l) => <li key={l.href}><Link href={l.href}>{l.label}</Link></li>)}
          </ul>
        </div>
      </div>

      <div className="container footer__bottom">
        <p>&copy; {new Date().getFullYear()} {SITE_NAME}. All rights reserved.</p>
        <a href="#top" className="footer__top">Back to top &uarr;</a>
      </div>
    </footer>
  );
}
