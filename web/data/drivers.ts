/* Drivers shown in the "Drivers" section. Edit names, teams and numbers here.
   Photos live in /public/images/drivers/. */

export type Driver = { name: string; team: string; number: number; image: string };

export const DRIVERS: Driver[] = [
  { name: "Lando Norris",      team: "McLaren",      number: 1,  image: "/images/drivers/LN.png" },
  { name: "Oscar Piastri",     team: "McLaren",      number: 81, image: "/images/drivers/OP.png" },
  { name: "Charles Leclerc",   team: "Ferrari",      number: 16, image: "/images/drivers/CL.png" },
  { name: "Lewis Hamilton",    team: "Ferrari",      number: 44, image: "/images/drivers/LH.png" },
  { name: "Max Verstappen",    team: "Red Bull",     number: 3,  image: "/images/drivers/MV.png" },
  { name: "Isack Hadjar",      team: "Red Bull",     number: 6,  image: "/images/drivers/IH.png" },
  { name: "George Russell",    team: "Mercedes",     number: 63, image: "/images/drivers/GR.png" },
  { name: "Kimi Antonelli",    team: "Mercedes",     number: 12, image: "/images/drivers/KA.png" },
  { name: "Fernando Alonso",   team: "Aston Martin", number: 14, image: "/images/drivers/FA.png" },
  { name: "Lance Stroll",      team: "Aston Martin", number: 18, image: "/images/drivers/LS.png" },
  { name: "Pierre Gasly",      team: "Alpine",       number: 10, image: "/images/drivers/PG.png" },
  { name: "Franco Colapinto",  team: "Alpine",       number: 43, image: "/images/drivers/FC.png" },
  { name: "Alex Albon",        team: "Williams",     number: 23, image: "/images/drivers/AL.webp" },
  { name: "Carlos Sainz",      team: "Williams",     number: 55, image: "/images/drivers/CS.webp" },
  { name: "Liam Lawson",       team: "Racing Bulls", number: 30, image: "/images/drivers/LL.png" },
  { name: "Arvid Lindblad",    team: "Racing Bulls", number: 41, image: "/images/drivers/AVL.webp" },
  { name: "Esteban Ocon",      team: "Haas",         number: 31, image: "/images/drivers/AO.webp" },
  { name: "Oliver Bearman",    team: "Haas",         number: 87, image: "/images/drivers/OB.webp" },
  { name: "Nico Hülkenberg",   team: "Audi",         number: 27, image: "/images/drivers/NH.webp" },
  { name: "Gabriel Bortoleto", team: "Audi",         number: 5,  image: "/images/drivers/GB.webp" },
  { name: "Sergio Pérez",      team: "Cadillac",     number: 11, image: "/images/drivers/CP.png" },
  { name: "Valtteri Bottas",   team: "Cadillac",     number: 77, image: "/images/drivers/VB.png" },
];
