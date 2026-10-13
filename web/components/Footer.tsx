import Image from "next/image";
import Link from "next/link";
import { FOOTER, LOGO_DARK, NAV_CTA, NAV_MENUS, SITE_NAME } from "@/data/site";

/**
 * Site footer.
 * Top: brand column + link columns on a light background.
 * Bottom: a full-width photo that fades in from the background,
 * with a giant wordmark sitting across it.
 */
export default function Footer() {
  // Season + Data columns reuse the navbar menus so the two always match
  const columns = [
    ...NAV_MENUS.map((menu) => ({ title: menu.label, links: menu.items.map(({ label, href }) => ({ label, href })) })),
    ...FOOTER.columns,
  ];

  return (
    <footer className="site-footer">
      <div className="container site-footer__content">
        {/* Brand column */}
        <section className="site-footer__brand" aria-labelledby="footer-brand-heading">
          <Link href="/#home" className="site-footer__logo" aria-label={`${SITE_NAME} home`}>
            <span className="site-footer__logo-mark"><Image src={LOGO_DARK} alt="" fill sizes="44px" /></span>
            {SITE_NAME}
          </Link>
          <h2 id="footer-brand-heading" className="site-footer__heading">{FOOTER.heading}</h2>
          <p className="site-footer__summary">{FOOTER.summary}</p>
          <Link href={NAV_CTA.href} className="site-footer__cta">{NAV_CTA.label}</Link>
          <p className="site-footer__copyright">&copy; {new Date().getFullYear()} {SITE_NAME}. All rights reserved.</p>
          <p className="site-footer__note">{FOOTER.note}</p>
          <p className="site-footer__note">
            {FOOTER.credit.split("TracingInsights")[0]}
            <a href="https://github.com/TracingInsights" rel="noopener noreferrer" target="_blank">TracingInsights</a>
            {FOOTER.credit.split("TracingInsights")[1]}
          </p>
        </section>

        {/* Link columns */}
        {columns.map((col) => (
          <section key={col.title} className="site-footer__col" aria-label={col.title}>
            <h2 className="site-footer__col-title">{col.title}</h2>
            <ul>
              {col.links.map((link) => (
                <li key={link.label}>
                  {link.href.startsWith("http") || link.href === "#" ? (
                    <a href={link.href}>{link.label}</a>
                  ) : (
                    <Link href={link.href}>{link.label}</Link>
                  )}
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>

      {/* Decorative scene: photo + fades + giant wordmark */}
      <div className="site-footer__scene" aria-hidden="true">
        <Image src={FOOTER.image} alt="" fill sizes="100vw" className="site-footer__photo" />
        <span className="site-footer__fade site-footer__fade--top" />
        <span className="site-footer__fade site-footer__fade--bottom" />
        {/* SVG text stretches to exactly fill the width at any screen size */}
        <svg className="site-footer__wordmark" viewBox="0 0 1000 190" preserveAspectRatio="xMidYMax meet">
          <text x="500" y="182" textAnchor="middle" textLength="980" lengthAdjust="spacingAndGlyphs">
            {SITE_NAME}
          </text>
        </svg>
      </div>
    </footer>
  );
}
