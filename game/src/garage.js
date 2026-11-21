// garage.js — Sunset Garage: the upgrade shop that makes Vesper City v3
// different from every top-10 entry that only promises a garage in its
// title. Upgrades are bought with real cash, saved with the game, and they
// change how the car actually drives: engine raises top speed and
// acceleration, armour raises the damage the car can take before it burns,
// tyres raise grip so the car turns harder at speed, and v4 NITRO adds a
// launch boost that fires when you floor it from a standstill — the
// street-race job was built for it. Rook the mechanic knocks 15% off
// every price once he joins the crew, and any visit to the yard also
// patches a flat tyre from a spike strip, free. Pure logic, no DOM,
// no network — the world loop calls buyUpgrade when Mara stands in the
// garage yard and presses G, and applyUpgrades whenever she gets in a car.
import { clamp } from './random.js';

export const GARAGE_NAME = 'Sunset Garage';
export const GARAGE_UPGRADES = [
  {
    id: 'engine', name: 'ENGINE', blurb: 'Tuned V8 — faster top speed, harder pull',
    costs: [400, 900, 1600],
    topBonus: [4, 9, 15], accelBonus: [3, 7, 12],
  },
  {
    id: 'armour', name: 'ARMOUR', blurb: 'Plated panels — the car burns later, dents less',
    costs: [350, 800, 1400],
    armourBonus: [40, 90, 150],
  },
  {
    id: 'tires', name: 'TYRES', blurb: 'Golden-hour slicks — sharper turns at speed',
    costs: [300, 700, 1200],
    gripBonus: [0.4, 0.9, 1.5],
  },
  {
    id: 'nitro', name: 'NITRO', blurb: 'Launch boost — floor it from a standstill and fly',
    costs: [500, 1100, 2000],
    topBonus: [2, 5, 8], accelBonus: [4, 9, 14],
  },
  // v5: CHROME — a gold-trim paint job for the show car in the yard.
  // Cosmetic only (it changes no driving stat), but the yard shows
  // it: a chrome car gets a gold roof box on the show car.
  {
    id: 'chrome', name: 'CHROME', blurb: 'Gold-trim paint — the show car shines like the sunset',
    costs: [600, 1200, 2200],
    chromeBonus: [1, 2, 3],
  },
];

export function createGarage() {
  return {
    owned: ['sedan'],
    upgrades: { engine: 0, armour: 0, tires: 0, nitro: 0, chrome: 0 },
    car: 'sedan',
    lastBought: null,
  };
}

// The price of the next level of an upgrade, with Rook's crew discount.
export function garageCost(garage, id, crewDiscount = 0) {
  const def = GARAGE_UPGRADES.find((u) => u.id === id);
  if (!def) return null;
  const level = garage.upgrades[id] || 0;
  if (level >= def.costs.length) return null;
  return Math.round(def.costs[level] * (1 - crewDiscount));
}

// Buy the next level. Returns {ok, cost, level, msg} and never spends
// cash the player does not have.
export function buyUpgrade(garage, cash, id, crewDiscount = 0) {
  const def = GARAGE_UPGRADES.find((u) => u.id === id);
  if (!def) return { ok: false, cost: 0, level: 0, msg: 'No such upgrade.' };
  const level = garage.upgrades[id] || 0;
  if (level >= def.costs.length) {
    return { ok: false, cost: 0, level, msg: `${def.name} is already maxed out.` };
  }
  const cost = garageCost(garage, id, crewDiscount);
  if (cash < cost) {
    return { ok: false, cost, level, msg: `${def.name} level ${level + 1} costs $${cost} — you have $${Math.floor(cash)}.` };
  }
  garage.upgrades[id] = level + 1;
  garage.lastBought = id;
  return { ok: true, cost, level: level + 1, msg: `${def.name} upgraded to level ${level + 1}!` };
}

// Effective driving stats for a car type with the garage upgrades applied.
// NITRO stacks on top of the engine: its top bonus adds to the engine's,
// and its launch bonus is strongest from a standstill (the vehicle code
// applies it when speed is near zero).
export function applyUpgrades(carType, upgrades) {
  const u = upgrades || { engine: 0, armour: 0, tires: 0, nitro: 0, chrome: 0 };
  const eng = GARAGE_UPGRADES[0];
  const arm = GARAGE_UPGRADES[1];
  const tir = GARAGE_UPGRADES[2];
  const nit = GARAGE_UPGRADES[3];
  const e = clamp(u.engine || 0, 0, 3);
  const a = clamp(u.armour || 0, 0, 3);
  const t = clamp(u.tires || 0, 0, 3);
  const n = clamp(u.nitro || 0, 0, 3);
  return {
    top: carType.top + (e > 0 ? eng.topBonus[e - 1] : 0) + (n > 0 ? nit.topBonus[n - 1] : 0),
    accel: carType.accel + (e > 0 ? eng.accelBonus[e - 1] : 0),
    brake: carType.brake,
    grip: carType.grip + (t > 0 ? tir.gripBonus[t - 1] : 0),
    armourBonus: a > 0 ? arm.armourBonus[a - 1] : 0,
    nitro: n,
    nitroLaunch: n > 0 ? nit.accelBonus[n - 1] : 0,
    chrome: clamp(u.chrome || 0, 0, 3),
  };
}

export function garageSave(garage) {
  return {
    owned: [...garage.owned],
    upgrades: { ...garage.upgrades },
    car: garage.car,
  };
}

export function garageLoad(data) {
  const g = createGarage();
  if (!data) return g;
  if (Array.isArray(data.owned) && data.owned.length > 0) g.owned = [...data.owned];
  if (data.upgrades) {
    for (const id of ['engine', 'armour', 'tires', 'nitro', 'chrome']) {
      const v = data.upgrades[id];
      if (Number.isInteger(v)) g.upgrades[id] = clamp(v, 0, 3);
    }
  }
  if (typeof data.car === 'string') g.car = data.car;
  return g;
}

// The garage yard marker: a gold sign slab over the garage landmark so the
// player can find it from down the street, plus a parked show car — and
// in v4 a second show car, the Coast Cruiser convertible, with a NITRO
// flame box over it when the nitro is fitted.
export function garageBoxes(landmark, time, upgrades) {
  if (!landmark) return [];
  const pulse = 1 + Math.sin(time * 2) * 0.08;
  const boxes = [
    { x: landmark.x, y: 6, z: landmark.z, w: 10 * pulse, h: 1.6, d: 0.6, color: [1, 0.72, 0.2], yaw: 0 },
    { x: landmark.x, y: 2.4, z: landmark.z, w: 2.0, h: 0.75, d: 4.4, color: [0.95, 0.68, 0.18], yaw: 0.4 },
    { x: landmark.x, y: 3.0, z: landmark.z - 0.2, w: 1.7, h: 0.6, d: 2.2, color: [0.08, 0.1, 0.16], yaw: 0.4 },
    { x: landmark.x + 7, y: 2.4, z: landmark.z + 3, w: 2.0, h: 0.7, d: 4.2, color: [0.2, 0.7, 0.9], yaw: -0.3 },
  ];
  if (upgrades && (upgrades.nitro || 0) > 0) {
    const flick = 0.7 + Math.sin(time * 18) * 0.3;
    boxes.push({ x: landmark.x + 7, y: 1.4, z: landmark.z + 5.2, w: 0.9, h: 0.9, d: 0.9, color: [1, 0.5 * flick, 0.1], yaw: 0 });
  }
  // v5: a chrome car shows a gold roof box on the show car.
  if (upgrades && (upgrades.chrome || 0) > 0) {
    boxes.push({ x: landmark.x, y: 3.4, z: landmark.z, w: 1.8, h: 0.25, d: 2.4, color: [0.95, 0.8, 0.35], yaw: 0.4 });
  }
  return boxes;
}

