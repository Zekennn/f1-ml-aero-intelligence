import type { NavIcon as IconName } from "@/data/site";

/** Simple stroke icons for the navbar menus (styled by .nav-icon). */
const PATHS: Record<IconName, React.ReactNode> = {
  teams: <><path d="M3 21V8l9-5 9 5v13" /><path d="M9 21v-6h6v6" /></>,
  drivers: <><circle cx="12" cy="8" r="4" /><path d="M4 21a8 8 0 0 1 16 0" /></>,
  calendar: <><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M3 10h18M8 3v4M16 3v4" /></>,
  gallery: <><rect x="3" y="4" width="18" height="16" rx="2" /><circle cx="9" cy="10" r="2" /><path d="M21 16l-5-5-9 9" /></>,
  live: <path d="M3 12h4l3-8 4 16 3-8h4" />,
  trophy: <><path d="M8 21h8M12 17v4M7 4h10v5a5 5 0 0 1-10 0V4z" /><path d="M17 5h3v2a3 3 0 0 1-3 3M7 5H4v2a3 3 0 0 0 3 3" /></>,
  wind: <path d="M3 8h11a3 3 0 1 0-3-3M3 12h16a3 3 0 1 1-3 3M3 16h8" />,
};

export default function NavIcon({ name }: { name: IconName }) {
  return <svg className="nav-icon" viewBox="0 0 24 24" aria-hidden="true">{PATHS[name]}</svg>;
}
