/**
 * 2026 season calendar.
 * Dates are race-weekend start/end (YYYY-MM-DD). Confirm before you travel.
 * Track photos live in /public/images/tracks/<slug>.jpg
 */
export type Race = {
  round: number;
  slug: string;
  name: string;
  circuit: string;
  location: string;
  start: string;
  end: string;
};

export const RACES: Race[] = [
  { round: 1, slug: "australia", name: "Australian Grand Prix", circuit: "Albert Park", location: "Melbourne, Australia", start: "2026-03-06", end: "2026-03-08" },
  { round: 2, slug: "china", name: "Chinese Grand Prix", circuit: "Shanghai International Circuit", location: "Shanghai, China", start: "2026-03-13", end: "2026-03-15" },
  { round: 3, slug: "japan", name: "Japanese Grand Prix", circuit: "Suzuka Circuit", location: "Suzuka, Japan", start: "2026-03-27", end: "2026-03-29" },
  { round: 4, slug: "bahrain", name: "Bahrain Grand Prix", circuit: "Bahrain International Circuit", location: "Sakhir, Bahrain", start: "2026-04-10", end: "2026-04-12" },
  { round: 5, slug: "saudi-arabia", name: "Saudi Arabian Grand Prix", circuit: "Jeddah Corniche Circuit", location: "Jeddah, Saudi Arabia", start: "2026-04-17", end: "2026-04-19" },
  { round: 6, slug: "miami", name: "Miami Grand Prix", circuit: "Miami International Autodrome", location: "Miami, USA", start: "2026-05-01", end: "2026-05-03" },
  { round: 7, slug: "canada", name: "Canadian Grand Prix", circuit: "Circuit Gilles Villeneuve", location: "Montréal, Canada", start: "2026-05-22", end: "2026-05-24" },
  { round: 8, slug: "monaco", name: "Monaco Grand Prix", circuit: "Circuit de Monaco", location: "Monte Carlo, Monaco", start: "2026-06-05", end: "2026-06-07" },
  { round: 9, slug: "barcelona", name: "Barcelona-Catalunya Grand Prix", circuit: "Circuit de Barcelona-Catalunya", location: "Barcelona, Spain", start: "2026-06-12", end: "2026-06-14" },
  { round: 10, slug: "austria", name: "Austrian Grand Prix", circuit: "Red Bull Ring", location: "Spielberg, Austria", start: "2026-06-26", end: "2026-06-28" },
  { round: 11, slug: "britain", name: "British Grand Prix", circuit: "Silverstone Circuit", location: "Silverstone, UK", start: "2026-07-03", end: "2026-07-05" },
  { round: 12, slug: "belgium", name: "Belgian Grand Prix", circuit: "Circuit de Spa-Francorchamps", location: "Spa, Belgium", start: "2026-07-17", end: "2026-07-19" },
  { round: 13, slug: "hungary", name: "Hungarian Grand Prix", circuit: "Hungaroring", location: "Budapest, Hungary", start: "2026-07-24", end: "2026-07-26" },
  { round: 14, slug: "netherlands", name: "Dutch Grand Prix", circuit: "Circuit Zandvoort", location: "Zandvoort, Netherlands", start: "2026-08-21", end: "2026-08-23" },
  { round: 15, slug: "italy", name: "Italian Grand Prix", circuit: "Autodromo Nazionale Monza", location: "Monza, Italy", start: "2026-09-04", end: "2026-09-06" },
  { round: 16, slug: "madrid", name: "Spanish Grand Prix", circuit: "Madring", location: "Madrid, Spain", start: "2026-09-11", end: "2026-09-13" },
  { round: 17, slug: "azerbaijan", name: "Azerbaijan Grand Prix", circuit: "Baku City Circuit", location: "Baku, Azerbaijan", start: "2026-09-24", end: "2026-09-26" },
  { round: 18, slug: "singapore", name: "Singapore Grand Prix", circuit: "Marina Bay Street Circuit", location: "Singapore", start: "2026-10-09", end: "2026-10-11" },
  { round: 19, slug: "united-states", name: "United States Grand Prix", circuit: "Circuit of the Americas", location: "Austin, USA", start: "2026-10-23", end: "2026-10-25" },
  { round: 20, slug: "mexico", name: "Mexico City Grand Prix", circuit: "Autódromo Hermanos Rodríguez", location: "Mexico City, Mexico", start: "2026-10-30", end: "2026-11-01" },
  { round: 21, slug: "brazil", name: "São Paulo Grand Prix", circuit: "Interlagos", location: "São Paulo, Brazil", start: "2026-11-06", end: "2026-11-08" },
  { round: 22, slug: "las-vegas", name: "Las Vegas Grand Prix", circuit: "Las Vegas Strip Circuit", location: "Las Vegas, USA", start: "2026-11-19", end: "2026-11-21" },
  { round: 23, slug: "qatar", name: "Qatar Grand Prix", circuit: "Lusail International Circuit", location: "Lusail, Qatar", start: "2026-11-27", end: "2026-11-29" },
  { round: 24, slug: "abu-dhabi", name: "Abu Dhabi Grand Prix", circuit: "Yas Marina Circuit", location: "Abu Dhabi, UAE", start: "2026-12-04", end: "2026-12-06" },
];

export const trackImage = (race: Race) => `/images/tracks/${race.slug}.jpg`;

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** "23 – 25 Oct 2026" or "30 Oct – 1 Nov 2026" */
export function raceDates(race: Race) {
  const [y, m1, d1] = race.start.split("-").map(Number);
  const [, m2, d2] = race.end.split("-").map(Number);
  return m1 === m2
    ? `${d1} – ${d2} ${MONTHS[m2 - 1]} ${y}`
    : `${d1} ${MONTHS[m1 - 1]} – ${d2} ${MONTHS[m2 - 1]} ${y}`;
}

/** Today as YYYY-MM-DD, so it compares directly with start/end. */
const today = () => new Date().toISOString().slice(0, 10);

export const isFinished = (race: Race) => race.end < today();
export const isRaceWeek = (race: Race) => race.start <= today() && !isFinished(race);

/** The next `count` races that haven't finished (the last ones once the season is over). */
export function upcomingRaces(count = 3) {
  const next = RACES.filter((race) => !isFinished(race));
  return next.length ? next.slice(0, count) : RACES.slice(-count);
}
