/* Teams shown in the "Teams" section. Edit freely.
   Add team photos to /public/images/teams/ using the file names below. */

export type Team = { name: string; colour: string; image: string; text: string };

export const TEAMS: Team[] = [
  { name: "McLaren",      colour: "#FF8000", image: "/images/teams/mclaren.jpg",      text: "Placeholder: Woking-based team with a long racing history." },
  { name: "Ferrari",      colour: "#DC0000", image: "/images/teams/ferrari.jpg",      text: "Placeholder: the sport's oldest and most successful team." },
  { name: "Red Bull",     colour: "#1E3A8A", image: "/images/teams/red-bull.jpg",     text: "Placeholder: Milton Keynes outfit known for bold engineering." },
  { name: "Mercedes",     colour: "#00A19C", image: "/images/teams/mercedes.jpg",     text: "Placeholder: Brackley squad with multiple constructors' titles." },
  { name: "Aston Martin", colour: "#00594F", image: "/images/teams/aston-martin.jpg", text: "Placeholder: Silverstone team with a brand-new factory." },
  { name: "Alpine",       colour: "#2173B8", image: "/images/teams/alpine.jpg",       text: "Placeholder: Enstone-based team with French roots." },
  { name: "Williams",     colour: "#005AFF", image: "/images/teams/williams.jpg",     text: "Placeholder: one of the sport's great independent names." },
  { name: "Racing Bulls", colour: "#6692FF", image: "/images/teams/racing-bulls.jpg", text: "Placeholder: Faenza team that brings through young talent." },
  { name: "Haas",         colour: "#9CA3AF", image: "/images/teams/haas.jpg",         text: "Placeholder: American-owned team based in Kannapolis and Banbury." },
  { name: "Audi",         colour: "#B91C1C", image: "/images/teams/audi.jpg",         text: "Placeholder: German manufacturer's works team, new for 2026." },
  { name: "Cadillac",     colour: "#4B5563", image: "/images/teams/cadillac.jpg",     text: "Placeholder: the grid's newest team, joining in 2026." },
];
