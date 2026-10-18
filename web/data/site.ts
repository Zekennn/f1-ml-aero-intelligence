/* =========================================================
   Editable site content.
   Change the text, numbers and image paths here and every
   page picks them up. Images live in /public/images.
   A missing image shows a grey placeholder box automatically.
   ========================================================= */

export const SITE_NAME = "Fan Hub";
export const LOGO = "/images/logo.png";           // full "Fan Hub" wordmark (white + red wing), for dark backgrounds
export const LOGO_ICON = "/images/logo-icon.png"; // wing mark on its own, shown next to the site name

export type NavIcon = "teams" | "drivers" | "calendar" | "gallery" | "live" | "trophy" | "wind" | "standings" | "pit";
export type NavItem = { label: string; href: string; description: string; icon: NavIcon; featured?: boolean };
export type NavMenu = { label: string; items: NavItem[] };
export type NavLink = { label: string; href: string };

/** Dropdown menus in the navbar. A "featured" item shows as a tall tile. */
export const NAV_MENUS: NavMenu[] = [
  {
    label: "Season",
    items: [
      { label: "Teams", href: "/#teams", icon: "teams", description: "All eleven constructors and their 2026 cars" },
      { label: "Drivers", href: "/#drivers", icon: "drivers", description: "The full grid with numbers and teams" },
      { label: "Calendar", href: "/#calendar", icon: "calendar", description: "Every round, results and track history" },
      { label: "Standings", href: "/standings", icon: "standings", description: "2026 driver and constructor tables and the points race" },
      { label: "Gallery", href: "/#gallery", icon: "gallery", description: "Moments from around the paddock" },
    ],
  },
  {
    label: "Data",
    items: [
      { label: "Live telemetry", href: "/live", icon: "live", featured: true, description: "Race any 2026 team on real reference laps, with pit stops and strategy" },
      { label: "2026 predictor", href: "/predictor", icon: "trophy", description: "Next-race winner odds and title chances" },
      { label: "Aero calculator", href: "/aero", icon: "wind", description: "2026 drag and downforce with active aero modes and a wind tunnel" },
      { label: "Pit stops", href: "/pitstops", icon: "pit", description: "Fastest stops and team averages, 2018–2026" },
    ],
  },
];

/** Plain links shown after the dropdowns. */
export const NAV_LINKS: NavLink[] = [{ label: "About", href: "/#about" }];

/** Right-hand side of the navbar. */
export const NAV_SECONDARY: NavLink = { label: "Contact", href: "/#contact" };
export const NAV_CTA: NavLink = { label: "Get Updates", href: "/#contact" };


/* Gallery photos: every image in /public/img appears in the home page gallery (lib/gallery.ts). */

/* ---------- Footer ---------- */
type FooterColumn = { title: string; links: NavLink[] };

/** Footer text, photo and extra link columns (Season + Data columns come from NAV_MENUS). */
export const FOOTER: {
  heading: string;
  summary: string;
  note: string;
  credit: string;
  image: string;
  columns: FooterColumn[];
} = {
  heading: "Every lap, one place",
  summary:
    "Placeholder text: team profiles, the driver line-up, the race calendar and machine-learning tools for fans who want to go deeper.",
  note: "Unofficial fan site. Not affiliated with any racing series, team or driver.",
  credit: "Data: TracingInsights (Apache-2.0 / MIT). Tyre temperatures are estimated.",
  image: "/images/footer.jpg",
  columns: [
    {
      title: "Site",
      links: [
        { label: "About", href: "/#about" },
        { label: "Contact", href: "/#contact" },
        { label: "Back to top", href: "#top" },
      ],
    },
    {
      // Replace "#" with your own profile links
      title: "Follow",
      links: [
        { label: "X / Twitter", href: "#" },
        { label: "Instagram", href: "#" },
        { label: "YouTube", href: "#" },
        { label: "Facebook", href: "#" },
      ],
    },
  ],
};
