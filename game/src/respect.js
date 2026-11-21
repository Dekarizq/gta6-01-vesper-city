// respect.js — the Sunset Kings respect system. Respect is earned by
// doing real things, never by standing still: finishing a mission pays
// the most, stealing a car pays a little, a Sun Coin streak pays for
// flair, and blowing up a police car pays for nerve. Each rank is a
// visible title on the HUD, and the crew grows as Mara climbs: Lena Voss
// drives getaway, Rook the mechanic cuts garage prices, and Dario Kess
// the fixer doubles Sun Coin streak bonuses. Pure logic, no DOM.
export const RESPECT_RANKS = [
  { name: 'STREET ROOKIE', min: 0, blurb: 'Nobody on Sunset Mile knows your name yet.' },
  { name: 'SUNSET RUNNER', min: 150, blurb: 'Cabbies nod when you pass. Lena joins the crew.' },
  { name: 'COAST DRIVER', min: 400, blurb: 'The docks talk about the gold car. Rook joins the crew.' },
  { name: 'GOLDEN HOUR LEGEND', min: 800, blurb: 'Every district knows the Sunset Kings. Dario backs you.' },
  { name: 'SUNSET KING', min: 1500, blurb: 'Vesper City is yours. The storm can come.' },
];

export const CREW = [
  { name: 'Lena Voss', role: 'Getaway driver', bonus: '+10% mission cash', atRank: 1 },
  { name: 'Rook', role: 'Mechanic', bonus: '-15% garage prices', atRank: 2 },
  { name: 'Dario Kess', role: 'Fixer', bonus: 'Sun Coin streaks pay double', atRank: 3 },
];

export const RESPECT_POINTS = {
  mission: 120,
  carStolen: 25,
  sunCoin: 8,
  sunStreak: 30,
  explosion: 60,
  copDown: 40,
};

export function createRespect() {
  return { points: 0, rank: 0 };
}

export function respectRankIndex(points) {
  let idx = 0;
  for (let i = 0; i < RESPECT_RANKS.length; i += 1) {
    if (points >= RESPECT_RANKS[i].min) idx = i;
  }
  return idx;
}

export function respectRank(points) {
  return RESPECT_RANKS[respectRankIndex(points)];
}

export function nextRank(points) {
  const idx = respectRankIndex(points);
  return idx + 1 < RESPECT_RANKS.length ? RESPECT_RANKS[idx + 1] : null;
}

// Add respect and report whether a new rank (and crew member) was earned.
export function addRespect(state, pts) {
  const before = respectRankIndex(state.points);
  state.points += pts;
  const after = respectRankIndex(state.points);
  state.rank = after;
  const joined = [];
  for (let r = before + 1; r <= after; r += 1) {
    for (const c of CREW) if (c.atRank === r) joined.push(c);
  }
  return { rankUp: after > before, rank: RESPECT_RANKS[after], joined };
}

// Crew members who have joined at the current respect rank.
export function crewJoined(points) {
  const idx = respectRankIndex(points);
  return CREW.filter((c) => c.atRank <= idx);
}

export function hasCrew(points, name) {
  return crewJoined(points).some((c) => c.name === name);
}

// Rook's garage discount: 0.15 once he has joined, otherwise 0.
export function garageDiscount(points) {
  return hasCrew(points, 'Rook') ? 0.15 : 0;
}

// Dario doubles Sun Coin streak bonuses once he has joined.
export function streakMultiplier(points) {
  return hasCrew(points, 'Dario Kess') ? 2 : 1;
}

// Lena's mission-cash bonus: 1.10 once she has joined, otherwise 1.
export function missionCashMultiplier(points) {
  return hasCrew(points, 'Lena Voss') ? 1.1 : 1;
}

export function respectSave(state) {
  return { points: state.points };
}

export function respectLoad(data) {
  const s = createRespect();
  if (data && Number.isFinite(data.points)) {
    s.points = Math.max(0, Math.floor(data.points));
    s.rank = respectRankIndex(s.points);
  }
  return s;
}
