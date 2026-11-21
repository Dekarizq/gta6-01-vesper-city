// business.js — own the city: buyable businesses for v6.
// Mara has spent five versions stealing cars and running jobs for
// other people. v6 lets her buy the city itself: six properties across
// the Marina, Old Town, the beach and downtown. A business costs cash
// up front, then pays passive income every in-game day, and each one
// upgrades to level 3 for more income. The finale of the new story arc
// needs a level-2 business and 2,000 respect — a king who only steals
// never holds a city, so the game makes Mara prove she can hold one.
// Pure logic plus render boxes; the world loop buys, upgrades and
// collects, the HUD shows the portfolio, the save keeps it.
import { roadCross } from './city.js';
import { clamp } from './random.js';

// The six properties. cost is the buy price, income is the daily take
// at level 1 (level 2 pays 2x, level 3 pays 3x), upgrade is the price
// of one level. Positions are road intersections, so the GPS and the
// player can always reach them.
export const BUSINESS_DEFS = [
  { id: 'surf-shop', name: 'Pier Surf Shop', district: 'Sunset Beach', cost: 4000, income: 100, upgrade: 3000, blurb: 'Boards, wax and sunset lessons — the beach pays.' },
  { id: 'fish-market', name: 'Marina Fish Market', district: 'Marina District', cost: 5000, income: 120, upgrade: 4000, blurb: 'The morning catch, sold before the gulls wake.' },
  { id: 'night-bar', name: 'The Lantern Bar', district: 'Old Town', cost: 8000, income: 200, upgrade: 6000, blurb: 'Old Town drinks till dawn. The till never sleeps.' },
  { id: 'cafe', name: 'Glass Quarter Cafe', district: 'Glass Quarter', cost: 3500, income: 90, upgrade: 2500, blurb: 'Espresso for the downtown crowd, all day long.' },
  { id: 'warehouse', name: 'Harbor Warehouse', district: 'Harbor Docks', cost: 6000, income: 150, upgrade: 4500, blurb: 'Crates in, crates out — the docks always move.' },
  { id: 'market-stall', name: 'Night Market Stall', district: 'Old Town', cost: 2500, income: 70, upgrade: 2000, blurb: 'Awnings, lamps and fried everything. Small but steady.' },
];

// Where each business sits on the map, as road intersections plus a
// small offset so the sign box never sits in the middle of traffic.
const BUSINESS_SPOTS = {
  'surf-shop': { ix: 5, iz: 9, dx: 6, dz: 0 },
  'fish-market': { ix: 9, iz: 9, dx: -6, dz: 0 },
  'night-bar': { ix: 3, iz: 1, dx: 0, dz: 6 },
  cafe: { ix: 5, iz: 5, dx: 6, dz: 0 },
  warehouse: { ix: 2, iz: 9, dx: 0, dz: -6 },
  'market-stall': { ix: 6, iz: 1, dx: 0, dz: 6 },
};

export const BUSINESS_MAX_LEVEL = 3;

export function businessDef(id) {
  return BUSINESS_DEFS.find((d) => d.id === id) || null;
}

export function createBusiness() {
  return {
    owned: {},       // id -> { level, invested }
    earned: 0,       // total passive income collected so far
    bought: 0,       // businesses bought so far
    upgraded: 0,     // upgrades bought so far
    lastDay: 1,      // the last day income was collected for
  };
}

// Positions for every business, resolved against the live city.
export function businessPositions() {
  const out = {};
  for (const def of BUSINESS_DEFS) {
    const spot = BUSINESS_SPOTS[def.id];
    const p = roadCross(spot.ix, spot.iz);
    out[def.id] = { x: p.x + spot.dx, z: p.z + spot.dz, ...def };
  }
  return out;
}

export function ownsBusiness(state, id) {
  return !!state.owned[id];
}

export function businessLevel(state, id) {
  return state.owned[id] ? state.owned[id].level : 0;
}

// The highest level of any business Mara owns — the arc finale
// needs this at 2 or better.
export function maxBusinessLevel(state) {
  let best = 0;
  for (const id of Object.keys(state.owned)) {
    best = Math.max(best, state.owned[id].level);
  }
  return best;
}

export function businessCount(state) {
  return Object.keys(state.owned).length;
}

// Daily take across the whole portfolio, at current levels.
export function businessIncomePerDay(state) {
  let total = 0;
  for (const id of Object.keys(state.owned)) {
    const def = businessDef(id);
    if (def) total += def.income * state.owned[id].level;
  }
  return total;
}

// Buy a business: cash up front, level 1, and it starts paying from
// the next day. Returns {ok, cost, msg} — the world loop spends the
// cash and shows the message.
export function buyBusiness(state, id, cash) {
  const def = businessDef(id);
  if (!def) return { ok: false, cost: 0, msg: 'No such business.' };
  if (state.owned[id]) return { ok: false, cost: 0, msg: `You already own the ${def.name} — press B again to upgrade it.` };
  if (cash < def.cost) return { ok: false, cost: def.cost, msg: `The ${def.name} costs $${def.cost.toLocaleString()} — you have $${Math.floor(cash).toLocaleString()}.` };
  state.owned[id] = { level: 1, invested: def.cost };
  state.bought += 1;
  return { ok: true, cost: def.cost, msg: `You bought the ${def.name} for $${def.cost.toLocaleString()}! It pays $${def.income}/day.` };
}

// Upgrade an owned business one level, up to level 3. Each level
// costs the upgrade price and adds one more daily income.
export function upgradeBusiness(state, id, cash) {
  const def = businessDef(id);
  if (!def) return { ok: false, cost: 0, msg: 'No such business.' };
  const owned = state.owned[id];
  if (!owned) return buyBusiness(state, id, cash);
  if (owned.level >= BUSINESS_MAX_LEVEL) return { ok: false, cost: 0, msg: `The ${def.name} is already max level ${BUSINESS_MAX_LEVEL}.` };
  if (cash < def.upgrade) return { ok: false, cost: def.upgrade, msg: `Upgrading the ${def.name} costs $${def.upgrade.toLocaleString()} — you have $${Math.floor(cash).toLocaleString()}.` };
  owned.level += 1;
  owned.invested += def.upgrade;
  state.upgraded += 1;
  return { ok: true, cost: def.upgrade, msg: `The ${def.name} is now level ${owned.level} — it pays $${def.income * owned.level}/day.` };
}

// Collect the income for every day that has passed since the last
// collection. Returns the cash paid out (0 when no day has passed).
export function collectIncome(state, day) {
  const days = clamp(day - state.lastDay, 0, 7);
  if (days <= 0) return 0;
  const pay = businessIncomePerDay(state) * days;
  state.lastDay = day;
  if (pay > 0) state.earned += pay;
  return pay;
}

// The nearest business to a point, with its distance and what it
// would cost to buy or upgrade — the B key uses this.
export function nearestBusiness(state, x, z) {
  const positions = businessPositions();
  let best = null, bestD = Infinity;
  for (const id of Object.keys(positions)) {
    const p = positions[id];
    const dx = x - p.x, dz = z - p.z;
    const d = dx * dx + dz * dz;
    if (d < bestD) { bestD = d; best = p; }
  }
  if (!best) return null;
  const owned = state.owned[best.id];
  return {
    ...best,
    dist: Math.sqrt(bestD),
    level: owned ? owned.level : 0,
    cost: owned
      ? (owned.level >= BUSINESS_MAX_LEVEL ? null : best.upgrade)
      : best.cost,
    action: owned ? (owned.level >= BUSINESS_MAX_LEVEL ? 'max' : 'upgrade') : 'buy',
  };
}

// Render boxes: a gold sign over every owned business, with one small
// level pip per level above it, and a pale "FOR SALE" board over the
// ones still on the market.
export function businessBoxes(state, time) {
  const boxes = [];
  const positions = businessPositions();
  for (const id of Object.keys(positions)) {
    const p = positions[id];
    const owned = state.owned[id];
    if (owned) {
      const pulse = 1 + Math.sin(time * 2 + p.x) * 0.08;
      // A real shop sign, not a floating bar: a dark post from the
      // pavement, a dark backing board, the gold name bar on it, and
      // one orange pip per level above — readable from a block away.
      boxes.push({ x: p.x, y: 3.2, z: p.z, w: 0.6, h: 6.4, d: 0.6, color: [0.16, 0.12, 0.1], yaw: 0 });
      boxes.push({ x: p.x, y: 6.5, z: p.z, w: 8.4 * pulse, h: 1.8, d: 0.5, color: [0.12, 0.1, 0.08], yaw: 0 });
      boxes.push({ x: p.x, y: 6.5, z: p.z, w: 7.6 * pulse, h: 1.2, d: 0.6, color: [1.0, 0.84, 0.3], yaw: 0 });
      for (let l = 0; l < owned.level; l += 1) {
        boxes.push({ x: p.x - 2 + l * 2, y: 8.2, z: p.z, w: 1.4, h: 1.4, d: 0.5, color: [1.0, 0.55, 0.2], yaw: 0 });
      }
    } else {
      boxes.push({ x: p.x, y: 2.8, z: p.z, w: 0.6, h: 5.6, d: 0.6, color: [0.16, 0.12, 0.1], yaw: 0 });
      boxes.push({ x: p.x, y: 5.5, z: p.z, w: 7, h: 1.6, d: 0.5, color: [0.12, 0.1, 0.08], yaw: 0 });
      boxes.push({ x: p.x, y: 5.5, z: p.z, w: 6, h: 1.0, d: 0.6, color: [0.75, 0.8, 0.85], yaw: 0 });
    }
  }
  return boxes;
}

// One-line portfolio summary for the HUD business panel.
export function businessSummary(state) {
  return {
    owned: businessCount(state),
    total: BUSINESS_DEFS.length,
    incomePerDay: businessIncomePerDay(state),
    earned: state.earned,
    maxLevel: maxBusinessLevel(state),
    list: Object.keys(state.owned).map((id) => {
      const def = businessDef(id);
      return { id, name: def.name, level: state.owned[id].level, income: def.income * state.owned[id].level };
    }),
  };
}

export function businessLabel(state) {
  const s = businessSummary(state);
  if (s.owned === 0) return 'No businesses yet — press B near a FOR SALE board to buy in.';
  return `${s.owned}/${s.total} businesses · $${s.incomePerDay}/day · $${s.earned.toLocaleString()} earned`;
}

// What the next upgrade of a property costs, by its current level:
// the first upgrade is the def's price, the second costs half again,
// so levelling a bar to 3 costs more than buying it did.
export function nextUpgradeCost(id, level) {
  const def = businessDef(id);
  if (!def) return 0;
  if (level >= BUSINESS_MAX_LEVEL) return 0;
  return level <= 0 ? def.cost : Math.round(def.upgrade * (level === 1 ? 1 : 1.5));
}

// Total cash Mara has sunk into her properties — the buy prices plus
// every upgrade — so the save file and the HUD can say what the
// empire is worth, not just what it pays.
export function businessTotalInvested(state) {
  let total = 0;
  for (const id of Object.keys(state.owned || {})) {
    total += state.owned[id].invested || 0;
  }
  return total;
}

// The full daily report: one row per owned property with its level,
// its daily income, what the next upgrade costs, and whether it is
// maxed — the HUD business panel renders these rows, and the save
// slot summary counts them.
export function businessReport(state) {
  const rows = [];
  for (const id of Object.keys(state.owned || {})) {
    const def = businessDef(id);
    if (!def) continue;
    const level = state.owned[id].level;
    rows.push({
      id,
      name: def.name,
      level,
      income: def.income * level,
      invested: state.owned[id].invested || 0,
      nextCost: nextUpgradeCost(id, level),
      maxed: level >= BUSINESS_MAX_LEVEL,
    });
  }
  // Richest first, so the panel reads like a portfolio, not a list.
  rows.sort((a, b) => b.income - a.income);
  return rows;
}

// The cheapest next upgrade in the portfolio, for the HUD hint line:
// "Next upgrade: Fish Market Lv2 — $4,000". Empty when nothing is
// owned or everything is maxed.
export function nextUpgradeHint(state) {
  const rows = businessReport(state).filter((r) => !r.maxed);
  if (rows.length === 0) return '';
  rows.sort((a, b) => a.nextCost - b.nextCost);
  const r = rows[0];
  return `Next upgrade: ${r.name} Lv${r.level + 1} — $${r.nextCost.toLocaleString()}`;
}

export function businessSave(state) {
  return { owned: state.owned, earned: state.earned, bought: state.bought, upgraded: state.upgraded, lastDay: state.lastDay };
}

export function businessLoad(data) {
  const s = createBusiness();
  if (!data) return s;
  if (data.owned && typeof data.owned === 'object') {
    for (const id of Object.keys(data.owned)) {
      const def = businessDef(id);
      const lvl = data.owned[id] && data.owned[id].level;
      if (def && Number.isInteger(lvl)) {
        s.owned[id] = { level: clamp(lvl, 1, BUSINESS_MAX_LEVEL), invested: data.owned[id].invested || 0 };
      }
    }
  }
  if (Number.isFinite(data.earned)) s.earned = Math.max(0, Math.floor(data.earned));
  if (Number.isInteger(data.bought)) s.bought = data.bought;
  if (Number.isInteger(data.upgraded)) s.upgraded = data.upgraded;
  if (Number.isInteger(data.lastDay)) s.lastDay = clamp(data.lastDay, 1, 7);
  return s;
}
