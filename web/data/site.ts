/* =========================================================
   Editable site content.
   Change the text, numbers and image paths here and every
   page picks them up. Images live in /public/images.
   A missing image shows a grey placeholder box automatically.
   ========================================================= */

export const SITE_NAME = "Fan Hub";
export const LOGO = "/images/logo.png";          // white logo, for dark backgrounds (footer)
export const LOGO_DARK = "/images/logo-red.png"; // red logo, for the light floating navbar

export type NavIcon = "teams" | "drivers" | "calendar" | "gallery" | "live" | "trophy" | "wind";
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
      { label: "Gallery", href: "/#gallery", icon: "gallery", description: "Moments from around the paddock" },
    ],
  },
  {
    label: "Data",
    items: [
      { label: "Live telemetry", href: "/live", icon: "live", featured: true, description: "Simulated lap with speed, gear, DRS, tyre temps and ML aero predictions" },
      { label: "2026 predictor", href: "/predictor", icon: "trophy", description: "Championship win probability for every driver" },
      { label: "Aero calculator", href: "/aero", icon: "wind", description: "Drag and downforce from speed, wing angle and DRS" },
    ],
  },
];

/** Plain links shown after the dropdowns. */
export const NAV_LINKS: NavLink[] = [{ label: "About", href: "/#about" }];

/** Right-hand side of the navbar. */
export const NAV_SECONDARY: NavLink = { label: "Contact", href: "/#contact" };
export const NAV_CTA: NavLink = { label: "Get Updates", href: "/#contact" };

export const STATS = [
  { value: "23", label: "Races in 2026" },
  { value: "11", label: "Teams" },
  { value: "22", label: "Drivers" },
  { value: "20", label: "Countries" },
];

/** Gallery photos. Add a file named 6.png to /public/images to fill the last slot. */
export const GALLERY = [
  { src: "/images/1.png", alt: "Close-up of a driver's eyes through the helmet visor" },
  { src: "/images/2.png", alt: "Driver in the cockpit in the garage" },
  { src: "/images/3.png", alt: "Driver celebrating on the grid with a trophy" },
  { src: "/images/4.png", alt: "Team member celebrating under a water spray" },
  { src: "/images/5.png", alt: "Driver spraying champagne on the podium" },
  { src: "/images/6.png", alt: "Gallery image 6" },
];

/* ---------- Footer ---------- */
type FooterColumn = { title: string; links: NavLink[] };

/** Footer text, photo and extra link columns (Season + Data columns come from NAV_MENUS). */
export const FOOTER: {
  heading: string;
  summary: string;
  note: string;
  image: string;
  columns: FooterColumn[];
} = {
  heading: "Every lap, one place",
  summary:
    "Placeholder text: team profiles, the driver line-up, the race calendar and machine-learning tools for fans who want to go deeper.",
  note: "Unofficial fan site. Not affiliated with any racing series, team or driver.",
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
