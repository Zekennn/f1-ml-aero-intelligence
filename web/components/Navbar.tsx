"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import NavIcon from "./NavIcon";
import { LOGO_DARK, NAV_CTA, NAV_LINKS, NAV_MENUS, NAV_SECONDARY, SITE_NAME } from "@/data/site";

/** Small down-arrow shown next to dropdown triggers. */
function Chevron() {
  return (
    <svg className="site-nav__chevron" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path d="M4 6l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/**
 * Floating navbar.
 * - Desktop: a compact bar centred at the top. Hovering (or clicking) a
 *   dropdown trigger opens a panel of links underneath it.
 * - Mobile: a full-width card whose menu expands inside the card.
 * Menu content comes from data/site.ts.
 */
export default function Navbar() {
  const pathname = usePathname();
  const headerRef = useRef<HTMLElement>(null);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [activeMenu, setActiveMenu] = useState<string | null>(null); // desktop dropdown
  const [mobileOpen, setMobileOpen] = useState(false);

  /* ---------- Desktop dropdown helpers ---------- */
  const cancelClose = () => {
    if (closeTimer.current) clearTimeout(closeTimer.current);
  };
  const openMenu = (label: string) => {
    cancelClose();
    setActiveMenu(label);
  };
  // Small delay so the panel doesn't flicker shut while the mouse moves down to it
  const scheduleClose = () => {
    cancelClose();
    closeTimer.current = setTimeout(() => setActiveMenu(null), 150);
  };
  const closeAll = () => {
    cancelClose();
    setActiveMenu(null);
    setMobileOpen(false);
  };

  // Close menus after navigating to another page
  useEffect(closeAll, [pathname]);

  // Escape closes; clicking anywhere outside the navbar closes
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && closeAll();
    const onPointer = (e: PointerEvent) => {
      if (headerRef.current && !headerRef.current.contains(e.target as Node)) closeAll();
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onPointer);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onPointer);
    };
  }, []);

  // Lock page scroll while the mobile menu is open
  useEffect(() => {
    document.body.style.overflow = mobileOpen ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [mobileOpen]);

  return (
    <header className="site-nav" id="top" ref={headerRef}>
      {/* ================= Desktop ================= */}
      <div className="site-nav__desktop" onMouseLeave={scheduleClose} onMouseEnter={cancelClose}>
        <nav className="site-nav__bar" aria-label="Primary">
          <div className="site-nav__left">
            <Link href="/#home" className="site-nav__logo" aria-label={`${SITE_NAME} home`} onClick={closeAll}>
              <Image src={LOGO_DARK} alt="" fill sizes="44px" priority />
            </Link>

            <div className="site-nav__links">
              {NAV_MENUS.map((menu) => (
                <button
                  key={menu.label}
                  type="button"
                  className="site-nav__link"
                  aria-expanded={activeMenu === menu.label}
                  aria-controls="site-nav-popup"
                  onMouseEnter={() => openMenu(menu.label)}
                  onClick={() => (activeMenu === menu.label ? setActiveMenu(null) : openMenu(menu.label))}
                >
                  {menu.label}
                  <Chevron />
                </button>
              ))}
              {NAV_LINKS.map((link) => (
                <Link key={link.href} href={link.href} className="site-nav__link" onMouseEnter={scheduleClose} onClick={closeAll}>
                  {link.label}
                </Link>
              ))}
            </div>
          </div>

          <div className="site-nav__right">
            <Link
              href={NAV_SECONDARY.href}
              className="site-nav__link"
              onMouseEnter={scheduleClose}
              onClick={closeAll}
            >
              {NAV_SECONDARY.label}
            </Link>
            <Link href={NAV_CTA.href} className="site-nav__cta" onMouseEnter={scheduleClose} onClick={closeAll}>
              {NAV_CTA.label}
            </Link>
          </div>
        </nav>

        {/* Dropdown panel: one grid per menu, stacked; only the active one is visible */}
        <div id="site-nav-popup" className="site-nav__popup" data-active={activeMenu !== null}>
          <div className="site-nav__popup-frame">
            <div className="site-nav__popup-card">
              {NAV_MENUS.map((menu) => (
                <div key={menu.label} className="site-nav__panel" data-active={activeMenu === menu.label}>
                  {menu.items.map((item) => (
                    <Link
                      key={item.href}
                      href={item.href}
                      className={`nav-item ${item.featured ? "nav-item--featured" : ""}`}
                      onClick={closeAll}
                    >
                      <span className="nav-item__icon"><NavIcon name={item.icon} /></span>
                      <span className="nav-item__title">{item.label}</span>
                      <span className="nav-item__desc">{item.description}</span>
                    </Link>
                  ))}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ================= Mobile ================= */}
      <div className="site-nav__mobile">
        <div className="site-nav__m-card">
          <div className="site-nav__m-bar">
            <Link href="/#home" className="site-nav__m-brand" onClick={closeAll}>
              <span className="site-nav__logo"><Image src={LOGO_DARK} alt="" fill sizes="44px" /></span>
              {SITE_NAME}
            </Link>
            <button
              type="button"
              className="site-nav__toggle"
              aria-label={mobileOpen ? "Close menu" : "Open menu"}
              aria-expanded={mobileOpen}
              aria-controls="site-nav-mobile-menu"
              onClick={() => setMobileOpen(!mobileOpen)}
            >
              <span /><span />
            </button>
          </div>

          {mobileOpen && (
            <nav id="site-nav-mobile-menu" className="site-nav__m-menu" aria-label="Mobile">
              {NAV_MENUS.map((menu) => (
                <div key={menu.label} className="site-nav__m-group">
                  <p className="site-nav__m-label">{menu.label}</p>
                  {menu.items.map((item) => (
                    <Link key={item.href} href={item.href} className="site-nav__m-item" onClick={closeAll}>
                      <NavIcon name={item.icon} />
                      {item.label}
                    </Link>
                  ))}
                </div>
              ))}
              <div className="site-nav__m-group">
                <p className="site-nav__m-label">More</p>
                {NAV_LINKS.map((link) => (
                  <Link key={link.href} href={link.href} className="site-nav__m-item" onClick={closeAll}>
                    {link.label}
                  </Link>
                ))}
              </div>

              <div className="site-nav__m-divider" />

              <div className="site-nav__m-actions">
                <Link href={NAV_SECONDARY.href} className="site-nav__m-secondary" onClick={closeAll}>{NAV_SECONDARY.label}</Link>
                <Link href={NAV_CTA.href} className="site-nav__m-primary" onClick={closeAll}>{NAV_CTA.label}</Link>
              </div>
            </nav>
          )}
        </div>
      </div>
    </header>
  );
}
