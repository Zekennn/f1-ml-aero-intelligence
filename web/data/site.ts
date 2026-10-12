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
      { label: "Calendar", href: "/#calendar", icon: "calendar", description: "Upcoming rounds, venues and dates" },
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
  { value: "24", label: "Races per season" },
  { value: "11", label: "Teams" },
  { value: "22", label: "Drivers" },
  { value: "21", label: "Countries" },
];

export type Race = { round: number; name: string; location: string; date: string; image: string };

/** Next three races shown on the home page. Dates are placeholders. */
export const UPCOMING_RACES: Race[] = [
  { round: 19, name: "United States Grand Prix", location: "Austin, USA", date: "23 – 25 Oct 2026", image: "/images/circuits/austin.jpg" },
  { round: 20, name: "Mexico City Grand Prix", location: "Mexico City, Mexico", date: "30 Oct – 1 Nov 2026", image: "/images/circuits/mexico.jpg" },
  { round: 21, name: "São Paulo Grand Prix", location: "São Paulo, Brazil", date: "6 – 8 Nov 2026", image: "/images/circuits/brazil.jpg" },
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
