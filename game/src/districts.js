// districts.js — the two new districts for Vesper City v5. V4's map
// had six districts on paper, but on screen they all looked the same:
// warm boxes, same signs, same streets. V5 makes two of them places
// you can tell apart at a glance. The Marina District (south-east,
// past the Boat Dock) is white and teal: big yachts, harbour cranes,
// container stacks, a lighthouse with a rotating beam, and a fish
// market whose lamps glow at dusk. Old Town (the north band) is brick
// and cream: a night market with striped awnings and warm lamps,
// chimneys with drifting smoke, a church tower, and clotheslines
// strung across the alleys. Both are pure logic plus render boxes;
// the engine draws them, the world loop steps them (boats bob, the
// lighthouse beam turns, smoke rises, sailboats cross the sea).
import { marketColor, neonColor, hexToRgb } from './textures.js';
import { clamp } from './random.js';

// Bounds are world coordinates: Marina is the south-east corner by
// the sea, Old Town is the north band above Sunset Mile.
export const MARINA_BOUNDS = { x0: 110, x1: 248, z0: 190, z1: 295 };
export const OLD_TOWN_BOUNDS = { x0: -110, x1: 110, z0: -248, z1: -148 };

export function createDistricts(city) {
  const size = city.size;
  // Marina yachts: three big boats at the docks, each with a hull, a
  // cabin, a mast and a sail, bobbing on their own phase.
  const yachts = [];
  const yachtHulls = [[0.92, 0.9, 0.84], [0.25, 0.55, 0.75], [0.95, 0.8, 0.35]];
  for (let i = 0; i < 3; i += 1) {
    yachts.push({
      x: 150 + i * 32, z: 268 + (i % 2) * 10,
      angle: (i % 2 === 0 ? 0.15 : -0.12),
      phase: i * 1.7, hull: yachtHulls[i],
    });
  }
  // Harbour cranes: two towers with a long arm over the containers.
  const cranes = [
    { x: 128, z: 210, arm: 26, angle: 0.4 },
    { x: 216, z: 206, arm: 22, angle: -0.5 },
  ];
  // Container stacks in harbour colours, three high at most.
  const containers = [];
  const contColors = [[0.9, 0.3, 0.25], [0.25, 0.55, 0.85], [0.95, 0.75, 0.2], [0.35, 0.7, 0.4]];
  for (let i = 0; i < 9; i += 1) {
    containers.push({
      x: 140 + (i % 3) * 14, z: 222 + Math.floor(i / 3) * 9,
      stack: 1 + (i % 3), color: contColors[i % contColors.length],
    });
  }
  // Fish-market stalls along the marina quay, lamps included.
  const market = [];
  for (let i = 0; i < 5; i += 1) {
    market.push({ x: 124 + i * 22, z: 246, awning: marketColor(i), lamp: i % 2 === 0 });
  }
  // Old Town night market: six stalls with striped awnings and warm
  // lamps, down the middle of the north band.
  const stalls = [];
  for (let i = 0; i < 6; i += 1) {
    stalls.push({
      x: -75 + i * 30, z: -198 + (i % 2) * 8,
      awning: marketColor(i + 2), neon: neonColor(i),
    });
  }
  // Chimneys on the old-town roofs, each with a smoke puff that rises
  // and fades on its own cycle.
  const chimneys = [];
  for (let i = 0; i < 6; i += 1) {
    chimneys.push({ x: -90 + i * 36, z: -216 + (i % 3) * 10, h: 8 + (i % 3) * 2, phase: i * 1.1 });
  }
  // Two sailboats that actually sail: they cross the sea east to west
  // on a slow loop, the only traffic on the water.
  const sailboats = [
    { x: -140, z: 320, speed: 3.2, phase: 0, hull: [0.9, 0.9, 0.92] },
    { x: 60, z: 335, speed: 2.6, phase: 40, hull: [0.95, 0.75, 0.3] },
  ];
  return {
    city, size, time: 0,
    marina: { yachts, cranes, containers, market, lighthouse: { x: 238, z: 288, h: 26 } },
    oldtown: {
      stalls, chimneys,
      church: { x: 0, z: -232, h: 22 },
      clotheslines: [
        { x: -40, z: -180 }, { x: 20, z: -186 }, { x: 70, z: -176 },
      ],
    },
    sailboats,
  };
}

export function stepDistricts(districts, dt) {
  districts.time += dt;
  for (const b of districts.sailboats) {
    b.x += b.speed * dt;
    if (b.x > 260) b.x = -260;
  }
  return districts;
}

function inBounds(b, x, z) {
  return x >= b.x0 && x <= b.x1 && z >= b.z0 && z <= b.z1;
}

export function isInMarina(districts, x, z) {
  return inBounds(MARINA_BOUNDS, x, z);
}

export function isInOldTown(districts, x, z) {
  return inBounds(OLD_TOWN_BOUNDS, x, z);
}

// District name at a point: the two new districts win over the grid
// district, so the HUD reads "Marina District" on the quay and
// "Old Town" in the market, not "Harbor Docks" and "Old Vesper".
export function districtNameAt(districts, x, z) {
  if (isInMarina(districts, x, z)) return 'Marina District';
  if (isInOldTown(districts, x, z)) return 'Old Town';
  return null;
}

export function districtPalette(name) {
  if (name === 'Marina District') return { base: '#e8e4d8', accent: '#2dd4bf', lamp: '#7dd3fc' };
  if (name === 'Old Town') return { base: '#b98a5e', accent: '#fbbf24', lamp: '#ffd166' };
  return { base: '#c98f4e', accent: '#ff9a3d', lamp: '#ffd166' };
}

export function districtBlurb(name) {
  if (name === 'Marina District') return 'White yachts, cranes and the lighthouse — the rich end of the storm.';
  if (name === 'Old Town') return 'Brick lanes, the night market, and the church bell over the stalls.';
  return 'Vesper City at golden hour.';
}

// Render boxes for both districts. The lighthouse beam is a long thin
// box that rotates with time; chimney smoke is three grey puffs that
// rise and fade on a cycle; sailboats bob and sail; market lamps glow.
export function districtBoxes(districts, time) {
  const out = [];
  const t = districts.time || time || 0;
  // --- Marina ---
  for (const y of districts.marina.yachts) {
    const bob = Math.sin(time * 1.1 + y.phase) * 0.3;
    out.push({ x: y.x, y: 0.7 + bob, z: y.z, w: 5.5, h: 1.6, d: 13, color: y.hull, yaw: y.angle });
    out.push({ x: y.x, y: 2.0 + bob, z: y.z, w: 3.6, h: 1.4, d: 7, color: [0.95, 0.93, 0.88], yaw: y.angle });
    out.push({ x: y.x, y: 5.2 + bob, z: y.z - 1, w: 0.3, h: 7, d: 0.3, color: [0.35, 0.3, 0.25], yaw: 0 });
    out.push({ x: y.x, y: 5.6 + bob, z: y.z - 1, w: 4.2, h: 5, d: 0.25, color: [0.98, 0.95, 0.88], yaw: y.angle });
  }
  for (const c of districts.marina.cranes) {
    out.push({ x: c.x, y: 11, z: c.z, w: 2.4, h: 22, d: 2.4, color: [0.85, 0.55, 0.15], yaw: 0 });
    out.push({ x: c.x + Math.sin(c.angle) * c.arm / 2, y: 21, z: c.z + Math.cos(c.angle) * c.arm / 2, w: 1.4, h: 1.4, d: c.arm, color: [0.9, 0.6, 0.2], yaw: c.angle });
    out.push({ x: c.x + Math.sin(c.angle) * c.arm, y: 18, z: c.z + Math.cos(c.angle) * c.arm, w: 2.2, h: 2.2, d: 2.2, color: [0.3, 0.3, 0.34], yaw: 0 });
  }
  for (const c of districts.marina.containers) {
    for (let s = 0; s < c.stack; s += 1) {
      out.push({ x: c.x, y: 1.3 + s * 2.6, z: c.z, w: 6, h: 2.4, d: 6, color: c.color, yaw: 0 });
    }
  }
  for (const m of districts.marina.market) {
    out.push({ x: m.x, y: 1.6, z: m.z, w: 7, h: 2.2, d: 5, color: [0.5, 0.38, 0.24], yaw: 0 });
    out.push({ x: m.x, y: 3.0, z: m.z, w: 8, h: 0.5, d: 6, color: m.awning, yaw: 0 });
    if (m.lamp) out.push({ x: m.x, y: 3.8, z: m.z, w: 0.8, h: 0.8, d: 0.8, color: [1, 0.9, 0.55], yaw: 0 });
  }
  // Lighthouse: striped tower, lamp room, and a rotating beam.
  const lh = districts.marina.lighthouse;
  out.push({ x: lh.x, y: lh.h / 2, z: lh.z, w: 5, h: lh.h, d: 5, color: [0.93, 0.9, 0.84], yaw: 0 });
  out.push({ x: lh.x, y: lh.h * 0.55, z: lh.z, w: 5.4, h: 2.4, d: 5.4, color: [0.9, 0.25, 0.25], yaw: 0 });
  out.push({ x: lh.x, y: lh.h + 1.2, z: lh.z, w: 3.2, h: 2.2, d: 3.2, color: [1, 0.95, 0.6], yaw: 0 });
  const beamAngle = t * 0.5;
  const beamLen = 34;
  out.push({
    x: lh.x + Math.sin(beamAngle) * beamLen / 2, y: lh.h + 1, z: lh.z + Math.cos(beamAngle) * beamLen / 2,
    w: 2.2, h: 1.1, d: beamLen, color: [1, 0.95, 0.7], yaw: beamAngle,
  });
  // Sailboats crossing the sea.
  for (const b of districts.sailboats) {
    const bob = Math.sin(time * 1.3 + b.phase) * 0.3;
    out.push({ x: b.x, y: 0.6 + bob, z: b.z, w: 3.4, h: 1.2, d: 8, color: b.hull, yaw: 0.1 });
    out.push({ x: b.x, y: 4.4 + bob, z: b.z - 0.5, w: 0.25, h: 6.5, d: 0.25, color: [0.4, 0.3, 0.2], yaw: 0 });
    out.push({ x: b.x, y: 4.8 + bob, z: b.z - 0.5, w: 3.8, h: 4.6, d: 0.2, color: [0.98, 0.94, 0.86], yaw: 0.1 });
  }
  // --- Old Town ---
  for (const s of districts.oldtown.stalls) {
    out.push({ x: s.x, y: 1.7, z: s.z, w: 8, h: 2.4, d: 5.5, color: [0.52, 0.38, 0.24], yaw: 0 });
    out.push({ x: s.x, y: 3.2, z: s.z, w: 9, h: 0.5, d: 6.5, color: s.awning, yaw: 0 });
    out.push({ x: s.x - 3.4, y: 2.2, z: s.z + 2.6, w: 0.5, h: 1.2, d: 0.5, color: hexToRgb(s.neon), yaw: 0 });
    out.push({ x: s.x + 3.4, y: 2.2, z: s.z + 2.6, w: 0.5, h: 1.2, d: 0.5, color: [1, 0.9, 0.55], yaw: 0 });
    out.push({ x: s.x, y: 4.0, z: s.z, w: 0.9, h: 0.9, d: 0.9, color: [1, 0.85, 0.45], yaw: 0 });
  }
  for (const ch of districts.oldtown.chimneys) {
    out.push({ x: ch.x, y: ch.h / 2, z: ch.z, w: 1.4, h: ch.h, d: 1.4, color: [0.45, 0.32, 0.26], yaw: 0 });
    const cyc = (t * 0.25 + ch.phase) % 1;
    const fade = 1 - cyc;
    out.push({ x: ch.x, y: ch.h + cyc * 6, z: ch.z, w: 1.6, h: 1.6, d: 1.6, color: [0.55 * fade + 0.2, 0.55 * fade + 0.2, 0.58 * fade + 0.2], yaw: 0 });
    out.push({ x: ch.x + 0.8, y: ch.h + cyc * 6 + 1.6, z: ch.z, w: 2.2, h: 1.4, d: 2.2, color: [0.5 * fade + 0.2, 0.5 * fade + 0.2, 0.53 * fade + 0.2], yaw: 0 });
  }
  // Church tower with a spire, the old town's skyline marker.
  const ch = districts.oldtown.church;
  out.push({ x: ch.x, y: ch.h / 2, z: ch.z, w: 7, h: ch.h, d: 7, color: [0.8, 0.68, 0.5], yaw: 0 });
  out.push({ x: ch.x, y: ch.h + 2.4, z: ch.z, w: 3.4, h: 4.8, d: 3.4, color: [0.72, 0.55, 0.38], yaw: 0 });
  out.push({ x: ch.x, y: ch.h + 5.6, z: ch.z, w: 1.2, h: 1.2, d: 1.2, color: [1, 0.85, 0.4], yaw: 0 });
  // Clotheslines across the alleys: a line and three coloured cloths.
  const clothColors = [[1, 0.45, 0.3], [0.3, 0.7, 0.95], [0.95, 0.8, 0.3]];
  districts.oldtown.clotheslines.forEach((cl, i) => {
    out.push({ x: cl.x, y: 3.4, z: cl.z, w: 10, h: 0.15, d: 0.15, color: [0.2, 0.2, 0.22], yaw: 0 });
    clothColors.forEach((col, j) => {
      out.push({ x: cl.x - 3 + j * 3, y: 2.9 + Math.sin(time * 2 + i + j) * 0.15, z: cl.z, w: 1.4, h: 1.0, d: 0.12, color: col, yaw: 0 });
    });
  });
  return out;
}

export function districtsSave(districts) {
  return { time: districts.time };
}

export function districtsLoad(districts, data) {
  if (!data) return districts;
  if (Number.isFinite(data.time)) districts.time = Math.max(0, data.time);
  return districts;
}

// Counts for tests: how many render boxes the districts add, and
// whether both districts exist with their landmarks.
export function districtCounts(districts) {
  return {
    yachts: districts.marina.yachts.length,
    cranes: districts.marina.cranes.length,
    containers: districts.marina.containers.length,
    marketStalls: districts.marina.market.length,
    oldTownStalls: districts.oldtown.stalls.length,
    chimneys: districts.oldtown.chimneys.length,
    sailboats: districts.sailboats.length,
    boxes: districtBoxes(districts, 1).length,
  };
}
