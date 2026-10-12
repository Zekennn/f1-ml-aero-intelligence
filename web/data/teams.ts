/* Teams shown in the "Teams" section. Edit freely.
   Each team has two images in /public/images/teams/:
     <slug>-car.webp   side view of the car (transparent background)
     <slug>-logo.webp  white team logo
   ergastId links a team to the live FastF1 data (driver standings). */

export type Team = { name: string; slug: string; ergastId: string; colour: string; text: string };

export const teamCar = (t: Team) => `/images/teams/${t.slug}-car.webp`;
export const teamLogo = (t: Team) => `/images/teams/${t.slug}-logo.webp`;

export const TEAMS: Team[] = [
  { name: "McLaren",      slug: "mclaren",       ergastId: "mclaren", colour: "#FF8000", text: "Placeholder: Woking-based team with a long racing history." },
  { name: "Ferrari",      slug: "ferrari",       ergastId: "ferrari", colour: "#DC0000", text: "Placeholder: the sport's oldest and most successful team." },
  { name: "Red Bull",     slug: "red-bull",      ergastId: "red_bull", colour: "#1E3A8A", text: "Placeholder: Milton Keynes outfit known for bold engineering." },
  { name: "Mercedes",     slug: "mercedes",      ergastId: "mercedes", colour: "#00A19C", text: "Placeholder: Brackley squad with multiple constructors' titles." },
  { name: "Aston Martin", slug: "aston-martin",  ergastId: "aston_martin", colour: "#00594F", text: "Placeholder: Silverstone team with a brand-new factory." },
  { name: "Alpine",       slug: "alpine",        ergastId: "alpine", colour: "#2173B8", text: "Placeholder: Enstone-based team with French roots." },
  { name: "Williams",     slug: "williams",      ergastId: "williams", colour: "#005AFF", text: "Placeholder: one of the sport's great independent names." },
  { name: "Racing Bulls", slug: "racing-bulls",  ergastId: "rb", colour: "#6692FF", text: "Placeholder: Faenza team that brings through young talent." },
  { name: "Haas",         slug: "haas",          ergastId: "haas", colour: "#9CA3AF", text: "Placeholder: American-owned team based in Kannapolis and Banbury." },
  { name: "Audi",         slug: "audi",          ergastId: "audi", colour: "#B91C1C", text: "Placeholder: German manufacturer's works team, new for 2026." },
  { name: "Cadillac",     slug: "cadillac",      ergastId: "cadillac", colour: "#4B5563", text: "Placeholder: the grid's newest team, joining in 2026." },
];
