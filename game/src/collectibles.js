// collectibles.js — Sun Coins: 42 golden coins hidden across Vesper City.
// A free-roam side hunt for the golden hour: each coin is a spinning gold
// slab at a named crossing, worth a chime and a HUD count. Grab all 42 in
// one in-game day and Dario pays a $500 bonus. At dawn the coins come back —
// the city re-hides them every morning, so the hunt never truly ends.
// Pure logic: no DOM, no network, no randomness at runtime. The coin spots
// sit on road intersections (roadCross), so every coin is reachable on foot
// or by car, and the save file remembers which ones today already took.
// v4 adds six coast coins along the south beach road (the iz=9 line):
// the hunt now runs from Sunset Mile all the way to the pier. v6 adds
// six storm coins by the harbour warehouses and the storm drains, for
// the drivers who hunt while the front comes in.

import { roadCross } from './city.js';

export const SUN_COIN_COUNT = 42;
export const SUN_COIN_BONUS = 500;
// v3: every Sun Coin also pays respect — the hunt feeds the Sunset Kings
// ladder, and a chained streak pays respect on top of cash.
export const SUN_COIN_RESPECT = 8;
export const SUN_STREAK_RESPECT = 30;
export const SUN_COIN_RADIUS = 3.4;
export const SUN_COIN_DAY_SECONDS = 240;
// Sun Streak: coins grabbed quickly chain together. Every 6th coin in one
// chain pays a $50 streak bonus on top — Dario loves a driver on a roll.
// The chain breaks if Mara goes longer than this without a coin.
export const SUN_STREAK_WINDOW = 45;
export const SUN_STREAK_EVERY = 6;
export const SUN_STREAK_BONUS = 50;

// One row per coin: grid indices into the road lines (0..9) plus the name
// Mara hears when she gets close. The names are the city's own folklore —
// cabbies, kids and fixers all call the crossings by these names.
const SPOTS = [
  { ix: 5, iz: 6, name: 'Sunset Mile crossing' },
  { ix: 4, iz: 6, name: 'Marina Steps' },
  { ix: 6, iz: 6, name: 'Glass Quarter gate' },
  { ix: 5, iz: 5, name: 'Storm Spire plaza' },
  { ix: 3, iz: 6, name: 'Harbor Docks turn' },
  { ix: 7, iz: 6, name: 'Lighthouse bend' },
  { ix: 5, iz: 7, name: 'Palm Row' },
  { ix: 2, iz: 6, name: 'Old Ferry corner' },
  { ix: 8, iz: 6, name: 'East Pier' },
  { ix: 5, iz: 4, name: 'Vesper Square' },
  { ix: 4, iz: 5, name: 'Copper Lane' },
  { ix: 6, iz: 5, name: 'Amber Arcade' },
  { ix: 3, iz: 5, name: 'Fishmarket cross' },
  { ix: 7, iz: 5, name: 'Gull Street' },
  { ix: 5, iz: 3, name: 'North Gate' },
  { ix: 4, iz: 4, name: 'Jacaranda Court' },
  { ix: 6, iz: 4, name: 'Brassworks yard' },
  { ix: 2, iz: 5, name: 'Saltworks corner' },
  { ix: 8, iz: 5, name: 'Tidepool steps' },
  { ix: 5, iz: 8, name: 'Beachfront promenade' },
  { ix: 4, iz: 7, name: 'Umbrella Row' },
  { ix: 6, iz: 7, name: 'Boardwalk end' },
  { ix: 3, iz: 7, name: 'Dune Path' },
  { ix: 7, iz: 7, name: 'Surfer\'s corner' },
  // v4 coast coins, on the south beach road by the pier and boardwalk.
  { ix: 2, iz: 9, name: 'Pier gate' },
  { ix: 4, iz: 9, name: 'Boardwalk steps' },
  { ix: 6, iz: 9, name: 'Tide Bar corner' },
  { ix: 8, iz: 9, name: 'Boat Dock turn' },
  { ix: 3, iz: 9, name: 'Lifeguard crossing' },
  { ix: 7, iz: 9, name: 'Sunset Pier approach' },
  // v5 district coins: three on the marina quay, three in Old Town.
  { ix: 9, iz: 9, name: 'Marina quay' },
  { ix: 9, iz: 8, name: 'Lighthouse steps' },
  { ix: 8, iz: 9, name: 'Fish market corner' },
  { ix: 1, iz: 0, name: 'Old Town gate' },
  { ix: 2, iz: 0, name: 'Night market lane' },
  { ix: 3, iz: 0, name: 'Church square' },
  // v6 storm coins: by the harbour warehouses and the storm drains.
  { ix: 1, iz: 9, name: 'Warehouse gate' },
  { ix: 2, iz: 8, name: 'Storm drain corner' },
  { ix: 9, iz: 7, name: 'Crane yard' },
  { ix: 0, iz: 5, name: 'North storm drain' },
  { ix: 9, iz: 5, name: 'East warehouse' },
  { ix: 0, iz: 9, name: 'Flood wall' },
];

function dist2(ax, az, bx, bz) {
  const dx = ax - bx;
  const dz = az - bz;
  return dx * dx + dz * dz;
}

export function createCollectibles() {
  const coins = SPOTS.map((spot) => {
    const at = roadCross(spot.ix, spot.iz);
    return { x: at.x, z: at.z, name: spot.name, taken: false };
  });
  let spin = 0;
  let day = 1;
  let collectedToday = 0;
  let collectedTotal = 0;
  let streak = 0;
  let lastPickupAt = -Infinity;

  function respawnAll() {
    for (const coin of coins) coin.taken = false;
    collectedToday = 0;
    streak = 0;
    lastPickupAt = -Infinity;
  }

  return {
    // How many coins are on the map in total (36 in v5: 24 city + 6 coast + 6 districts).
    total: coins.length,
    // How many Mara has pocketed today.
    count() { return collectedToday; },
    // The live Sun Streak: chained pickups inside the window.
    streak() { return streak; },
    // How many are still out there today.
    remaining() { return coins.length - collectedToday; },
    // Lifetime haul across every day played.
    lifetime() { return collectedTotal; },
    // The current in-game day (1..7), derived from elapsed seconds.
    currentDay() { return day; },

    // Advance the spin, respawn at dawn, and pick up any coin Mara is
    // standing on. Returns the events that happened this tick, in order,
    // so the game loop can chime, pay and announce them.
    update(dt, px, pz, elapsed) {
      const events = [];
      spin += dt;
      const nowDay = 1 + Math.floor(elapsed / SUN_COIN_DAY_SECONDS);
      if (nowDay !== day) {
        day = nowDay;
        respawnAll();
        events.push({ type: 'respawn', day: nowDay });
      }
      const reach = SUN_COIN_RADIUS * SUN_COIN_RADIUS;
      for (let i = 0; i < coins.length; i += 1) {
        const coin = coins[i];
        if (coin.taken) continue;
        if (dist2(px, pz, coin.x, coin.z) > reach) continue;
        coin.taken = true;
        collectedToday += 1;
        collectedTotal += 1;
        // Chain the streak: a coin within the window extends it, a slow
        // gap restarts it from one. Every sixth chained coin pays extra.
        streak = (elapsed - lastPickupAt <= SUN_STREAK_WINDOW) ? streak + 1 : 1;
        lastPickupAt = elapsed;
        events.push({
          type: 'pickup', index: i, name: coin.name,
          collected: collectedToday, total: coins.length, streak,
        });
        if (streak % SUN_STREAK_EVERY === 0) {
          events.push({ type: 'streak', bonus: SUN_STREAK_BONUS, streak });
        }
        if (collectedToday === coins.length) {
          events.push({ type: 'complete', bonus: SUN_COIN_BONUS });
        }
        break; // one coin per tick: the chime stays readable.
      }
      return events;
    },

    // The render boxes for every coin still on the map: a spinning gold
    // slab floating at chest height, with a small bright core above it
    // so it catches the eye from down the street.
    boxes(time) {
      const out = [];
      for (let i = 0; i < coins.length; i += 1) {
        const coin = coins[i];
        if (coin.taken) continue;
        const bob = Math.sin(time * 2 + i * 1.7) * 0.18;
        const yaw = time * 2 + i * 0.9;
        out.push(
          { x: coin.x, y: 1.05 + bob, z: coin.z, w: 1.3, h: 0.14, d: 1.3, color: [1, 0.78, 0.2], yaw },
          { x: coin.x, y: 1.55 + bob, z: coin.z, w: 0.5, h: 0.5, d: 0.5, color: [1, 0.95, 0.6], yaw: -yaw },
        );
      }
      return out;
    },

    // The nearest coin Mara has not taken yet, for the HUD hint line.
    nearest(px, pz) {
      let best = null;
      let bestD = Infinity;
      for (const coin of coins) {
        if (coin.taken) continue;
        const d = dist2(px, pz, coin.x, coin.z);
        if (d < bestD) { bestD = d; best = coin; }
      }
      if (!best) return null;
      return { name: best.name, dist: Math.sqrt(bestD) };
    },

    // A fresh hunt: every coin back on the map, today and lifetime kept
    // separate so a new game starts clean but the save remembers the haul.
    reset() {
      respawnAll();
      collectedTotal = 0;
      day = 1;
      spin = 0;
      streak = 0;
      lastPickupAt = -Infinity;
    },

    // Save shape: which coins today already took, the lifetime haul, and
    // the day the save was written on, so a load never double-pays.
    save() {
      const taken = [];
      for (let i = 0; i < coins.length; i += 1) {
        if (coins[i].taken) taken.push(i);
      }
      return { taken, total: collectedTotal, day };
    },

    // Restore a save. A taken list holding a non-integer entry is corrupt
    // and the whole load is refused, keeping the current hunt intact;
    // integer indices outside the table are simply skipped, so an older
    // save can never corrupt a newer coin table.
    load(data) {
      if (!data || !Array.isArray(data.taken)) return;
      for (const i of data.taken) if (!Number.isInteger(i)) return;
      respawnAll();
      for (const i of data.taken) {
        if (i >= 0 && i < coins.length && !coins[i].taken) {
          coins[i].taken = true;
          collectedToday += 1;
        }
      }
      collectedTotal = Number.isInteger(data.total) ? data.total : collectedToday;
      day = Number.isInteger(data.day) && data.day >= 1 ? data.day : 1;
    },
  };
}
