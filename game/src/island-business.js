// island-business.js — buyable businesses on Ember Isle, new in
// Sunset Kings v7. Vesper City has six businesses; the island has
// four of its own, and they are the reason to cross the water twice:
// a resort that pays like a hotel, a volcano bar that pays like a
// secret, a dive shop that pays like a tide, and a fish warung that
// pays like breakfast. Mara buys them with B near their FOR SALE
// boards, upgrades them to level 3, and collects their income every
// morning — and the island finale (mission 20) only opens when one
// of them is at level 2, because a ruler who cannot hold the
// island's shops cannot hold the island.
//   The four island businesses: the Ember Resort (the big one), the
// Magma Bar (the loud one), the Dive Shop (the wet one), and the Fish
// Warung (the early one). Each one has a cost, a daily income, an
// upgrade cost, a blurb the islanders say about it, and a spot on the
// island map where its gold sign stands.
//   The module mirrors the city business system on purpose: the world
// loop already knows how to buy, upgrade, collect and render a
// business, so the island businesses speak the same language —
// create, buy, upgrade, income, nearest, boxes, save, load.
import { islandPoints } from './island.js';

// The four island businesses, in the order the islanders recommend
// them: the warung first (cheap, steady), the dive shop second, the
// bar third, and the resort last (expensive, and worth every cent).
export const ISLAND_BUSINESS_DEFS = [
  {
    id: 'fish-warung', name: 'Fish Warung', district: 'Fisher Village',
    cost: 3000, income: 85, upgrade: 2200,
    blurb: 'Breakfast for the fishermen, all day long. Small but steady.',
  },
  {
    id: 'dive-shop', name: 'Ember Dive Shop', district: 'Black Sand Beach',
    cost: 4500, income: 130, upgrade: 3500,
    blurb: 'Tanks, fins and sunset dives — the tide pays.',
  },
  {
    id: 'magma-bar', name: 'The Magma Bar', district: 'Volcano Ridge',
    cost: 7500, income: 210, upgrade: 5500,
    blurb: 'Drinks at the foot of the volcano. The till never sleeps.',
  },
  {
    id: 'ember-resort', name: 'Ember Resort', district: 'Ember Resort',
    cost: 12000, income: 320, upgrade: 9000,
    blurb: 'Pools, palms and tourists who never read the news. The big one.',
  },
];

// Where each island business sits, as named island points — never on
// a road, never in the lava, always where its sign can be seen.
const ISLAND_BUSINESS_SPOTS = {
  'fish-warung': { point: 'villageSquare', dx: 8, dz: 0 },
  'dive-shop': { point: 'diveShop', dx: 0, dz: -6 },
  'magma-bar': { point: 'volcanoBar', dx: -8, dz: 0 },
  'ember-resort': { point: 'resort', dx: 0, dz: 8 },
};

export const ISLAND_BUSINESS_MAX_LEVEL = 3;

export function islandBusinessDef(id) {
  return ISLAND_BUSINESS_DEFS.find((d) => d.id === id) || null;
}

// Positions for every island business, resolved against the live
// island points.
export function islandBusinessPositions() {
  const pts = islandPoints();
  const out = {};
  for (const def of ISLAND_BUSINESS_DEFS) {
    const spot = ISLAND_BUSINESS_SPOTS[def.id];
    const p = pts[spot.point] || { x: 700, z: 0 };
    out[def.id] = { x: p.x + spot.dx, z: p.z + spot.dz, ...def };
  }
  return out;
}

// The live island business state: what Mara owns, what she has
// earned, and the last day income was collected for.
export function createIslandBusiness() {
  return {
    owned: {},       // id -> { level, invested }
    earned: 0,       // total passive income collected so far
    bought: 0,       // island businesses bought so far
    upgraded: 0,     // upgrades bought so far
    lastDay: 1,      // the last day income was collected for
  };
}

export function ownsIslandBusiness(state, id) {
  return !!(state.owned && state.owned[id]);
}

export function islandBusinessLevel(state, id) {
  return (state.owned && state.owned[id] && state.owned[id].level) || 0;
}

export function maxIslandBusinessLevel(state) {
  let best = 0;
  for (const id of Object.keys(state.owned || {})) {
    best = Math.max(best, islandBusinessLevel(state, id));
  }
  return best;
}

export function islandBusinessCount(state) {
  return Object.keys(state.owned || {}).length;
}

// The daily income of the whole island portfolio: every owned
// business pays its income times its level, every morning.
export function islandBusinessIncomePerDay(state) {
  let total = 0;
  for (const id of Object.keys(state.owned || {})) {
    const def = islandBusinessDef(id);
    if (!def) continue;
    total += def.income * islandBusinessLevel(state, id);
  }
  return total;
}

// Buy an island business: the cash leaves in the world loop, never
// here — this function only decides whether the sale can happen, and
// says why not when it cannot.
export function buyIslandBusiness(state, id, cash) {
  const def = islandBusinessDef(id);
  if (!def) return { ok: false, cost: 0, msg: 'No such business on the island.' };
  if (ownsIslandBusiness(state, id)) {
    return { ok: false, cost: 0, msg: `You already own the ${def.name} — press B near it to upgrade.` };
  }
  if (cash < def.cost) {
    return { ok: false, cost: def.cost, msg: `The ${def.name} costs $${def.cost} — you have $${cash}.` };
  }
  state.owned[id] = { level: 1, invested: def.cost };
  state.bought += 1;
  return { ok: true, cost: def.cost, msg: `You bought the ${def.name}! It pays $${def.income}/day.` };
}

// Upgrade an island business one level, up to level 3. Each level
// pays its income again on top — a level-3 resort pays three times
// a level-1 resort, and the island notices who owns it.
export function upgradeIslandBusiness(state, id, cash) {
  const def = islandBusinessDef(id);
  if (!def) return { ok: false, cost: 0, msg: 'No such business on the island.' };
  const level = islandBusinessLevel(state, id);
  if (level === 0) return { ok: false, cost: 0, msg: `You do not own the ${def.name} yet.` };
  if (level >= ISLAND_BUSINESS_MAX_LEVEL) {
    return { ok: false, cost: 0, msg: `The ${def.name} is already at level ${ISLAND_BUSINESS_MAX_LEVEL}.` };
  }
  const cost = def.upgrade * level;
  if (cash < cost) {
    return { ok: false, cost, msg: `Level ${level + 1} of the ${def.name} costs $${cost} — you have $${cash}.` };
  }
  state.owned[id].level = level + 1;
  state.owned[id].invested += cost;
  state.upgraded += 1;
  return { ok: true, cost, msg: `The ${def.name} is now level ${level + 1} — $${def.income * (level + 1)}/day.` };
}

// Collect the island income for a new day: every owned business pays
// once per day, and the world loop adds the money to Mara's cash.
export function collectIslandIncome(state, day) {
  if (!day || day <= state.lastDay) return 0;
  const perDay = islandBusinessIncomePerDay(state);
  const days = day - state.lastDay;
  state.lastDay = day;
  const pay = perDay * days;
  state.earned += pay;
  return pay;
}

// The nearest island business to a point, with its distance and what
// B would do there — buy it, upgrade it, or walk closer first.
export function nearestIslandBusiness(state, x, z) {
  const positions = islandBusinessPositions();
  let best = null;
  let bestDist = Infinity;
  for (const id of Object.keys(positions)) {
    const p = positions[id];
    const d = Math.hypot(p.x - x, p.z - z);
    if (d < bestDist) {
      bestDist = d;
      best = { ...p, dist: d, action: ownsIslandBusiness(state, id) ? 'upgrade' : 'buy' };
    }
  }
  return best;
}

// The island businesses' boxes for the renderer: a gold sign over
// every owned business with level pips underneath, and a FOR SALE
// board over every business still for sale, so the player can see
// the whole portfolio from the road.
export function islandBusinessBoxes(state, time) {
  const boxes = [];
  const positions = islandBusinessPositions();
  for (const id of Object.keys(positions)) {
    const p = positions[id];
    const level = islandBusinessLevel(state, id);
    if (level > 0) {
      // Gold sign over the door, with one pip per level.
      boxes.push({ x: p.x, y: 6.5, z: p.z, w: 8, h: 1.4, d: 0.4, color: [1, 0.8, 0.25], yaw: 0 });
      for (let i = 0; i < level; i += 1) {
        boxes.push({ x: p.x - 2.4 + i * 2.4, y: 5.2, z: p.z, w: 1.2, h: 1.2, d: 0.3, color: [1, 0.6, 0.1], yaw: 0 });
      }
    } else {
      // FOR SALE board: white, with a red stripe, waving gently.
      const sway = Math.sin((time || 0) * 1.5 + p.x) * 0.15;
      boxes.push({ x: p.x, y: 3.2, z: p.z, w: 3.4, h: 2.2, d: 0.3, color: [0.95, 0.95, 0.9], yaw: sway });
      boxes.push({ x: p.x, y: 3.9, z: p.z, w: 3.4, h: 0.5, d: 0.32, color: [0.9, 0.2, 0.2], yaw: sway });
    }
  }
  return boxes;
}

// The island portfolio summary for the HUD: how many owned, the
// daily take, what has been earned, and the list with levels.
export function islandBusinessSummary(state) {
  const list = [];
  for (const def of ISLAND_BUSINESS_DEFS) {
    const level = islandBusinessLevel(state, def.id);
    if (level > 0) {
      list.push({ id: def.id, name: def.name, level, income: def.income * level });
    }
  }
  return {
    owned: islandBusinessCount(state),
    total: ISLAND_BUSINESS_DEFS.length,
    incomePerDay: islandBusinessIncomePerDay(state),
    earned: state.earned,
    list,
  };
}

// The cheapest upgrade Mara can still buy, for the HUD hint — the
// island always tells her the next step, because the next step is
// the one that pays.
export function nextIslandUpgradeHint(state) {
  let best = null;
  for (const def of ISLAND_BUSINESS_DEFS) {
    const level = islandBusinessLevel(state, def.id);
    if (level === 0) continue;
    if (level >= ISLAND_BUSINESS_MAX_LEVEL) continue;
    const cost = def.upgrade * level;
    if (!best || cost < best.cost) {
      best = { id: def.id, name: def.name, level, cost, nextLevel: level + 1 };
    }
  }
  if (!best) {
    const unowned = ISLAND_BUSINESS_DEFS.find((d) => !ownsIslandBusiness(state, d.id));
    if (unowned) return `Next: buy the ${unowned.name} — $${unowned.cost}.`;
    return 'All island businesses owned and maxed. The island is yours.';
  }
  return `Next upgrade: ${best.name} Lv${best.nextLevel} — $${best.cost}.`;
}

// The label for the HUD panel: the portfolio in one line.
export function islandBusinessLabel(state) {
  const s = islandBusinessSummary(state);
  return `🏝 ISLAND BUSINESSES ${s.owned}/${s.total} · $${s.incomePerDay}/day`;
}

// The cost of the next upgrade of a business, for the garage-style
// price list the HUD can show.
export function nextIslandUpgradeCost(id, level) {
  const def = islandBusinessDef(id);
  if (!def) return 0;
  if (level >= ISLAND_BUSINESS_MAX_LEVEL) return 0;
  return def.upgrade * Math.max(1, level);
}

// How much Mara has invested in the island in total — the number
// the islanders whisper about when she walks past.
export function islandBusinessTotalInvested(state) {
  let total = 0;
  for (const id of Object.keys(state.owned || {})) {
    total += state.owned[id].invested || 0;
  }
  return total;
}

// The full island business report, for tests and the end screen: the
// portfolio, the income, the investment, and the hint.
export function islandBusinessReport(state) {
  return {
    ...islandBusinessSummary(state),
    invested: islandBusinessTotalInvested(state),
    bought: state.bought,
    upgraded: state.upgraded,
    hint: nextIslandUpgradeHint(state),
  };
}

// Save/load: the island portfolio keeps what Mara owns, what she
// has earned, and the last day income was collected for — a resort
// never vanishes between sessions.
export function islandBusinessSave(state) {
  return {
    owned: JSON.parse(JSON.stringify(state.owned || {})),
    earned: state.earned, bought: state.bought,
    upgraded: state.upgraded, lastDay: state.lastDay,
  };
}

export function islandBusinessLoad(data) {
  const state = createIslandBusiness();
  if (!data || typeof data !== 'object') return state;
  state.owned = data.owned || {};
  state.earned = data.earned || 0;
  state.bought = data.bought || 0;
  state.upgraded = data.upgraded || 0;
  state.lastDay = data.lastDay || 1;
  return state;
}
