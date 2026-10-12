/* =========================================================
   Editable site content.
   Change the text, numbers and image paths here and every
   page picks them up. Images live in /public/images.
   A missing image shows a grey placeholder box automatically.
   ========================================================= */

export const SITE_NAME = "Fan Hub";
export const LOGO = "/images/logo.png";

export type NavLink = { label: string; href: string };

/** Links in the top navbar (anchors point to sections on the home page). */
export const NAV_LINKS: NavLink[] = [
  { label: "Home", href: "/#home" },
  { label: "About", href: "/#about" },
  { label: "Teams", href: "/#teams" },
  { label: "Drivers", href: "/#drivers" },
  { label: "Calendar", href: "/#calendar" },
  { label: "Gallery", href: "/#gallery" },
  { label: "Live Data", href: "/live" },
  { label: "Predictor", href: "/predictor" },
  { label: "Contact", href: "/#contact" },
];

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
