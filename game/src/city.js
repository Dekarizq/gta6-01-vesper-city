// city.js — procedural Vesper City at golden hour, rewritten for v6.
// Warm sand, cream, terracotta and gold towers; a sunset beach with
// palms and umbrellas on the south shore; a low sun down the west
// boulevard. Pure data: the engine turns it into geometry, the minimap
// turns it into a map. It also owns building collision (circle vs
// tower footprint) and the sun-visibility ray check.
// Districts, each with its own palette: Sunset Mile, Harbor Docks, Old
// Vesper, the Glass Quarter, Sunset Shore, Sunset Beach, and since v5
// the Marina District (white/teal, south-east) and Old Town (brick and
// cream, north band). v6 adds hurricane prep to the map itself: storm
// drains on the harbour roads and sandbag stacks by the garage and the
// docks, placed on fixed coordinates so the seeded layout never moves.
// NOTE on determinism: generateCity consumes the seeded rng in one
// fixed order (tower size, offset, height, palette, shade, strip,
// signs). The v6 rewrite keeps that exact order, so the same seed
// still builds the same city and every staged screenshot still works.
import { WORLD, DISTRICTS, GOLD, WINDOW_STRIP, SUN } from './config.js';

// ------------------------------------------------------------------ layout
export function citySize() {
  return WORLD.blocks * (WORLD.block + WORLD.road) + WORLD.road;
}

// Road centre lines (world coords, city centred on 0,0).
export function roadLines() {
  const size = citySize();
  const lines = [];
  for (let i = 0; i <= WORLD.blocks; i += 1) {
    const c = -size / 2 + WORLD.road / 2 + i * (WORLD.block + WORLD.road);
    lines.push(c);
  }
  return lines;
}

// An intersection of two road lines, by line index (0..blocks).
export function roadCross(ix, iz) {
  const lines = roadLines();
  return { x: lines[ix], z: lines[iz] };
}

export function nearestRoadCoord(v) {
  const lines = roadLines();
  let best = lines[0];
  for (const c of lines) if (Math.abs(c - v) < Math.abs(best - v)) best = c;
  return best;
}

export function isOnRoad(x, z) {
  const lines = roadLines();
  const half = WORLD.road / 2 + 0.4;
  for (const c of lines) {
    if (Math.abs(x - c) < half || Math.abs(z - c) < half) return true;
  }
  return false;
}

// ---------------------------------------------------------------- districts
// Which district a point belongs to. The Marina District is checked
// BEFORE the beach: the marina quay sits on the same south strip as
// the sand, and its x-range is what tells them apart (east of fx 0.72
// is quay, west of it is beach). Old Town is the north band.
export function districtAt(x, z) {
  const size = citySize();
  const fx = (x + size / 2) / size;
  const fz = (z + size / 2) / size;
  if (fz > 0.82 && fx > 0.72) return DISTRICTS[6]; // Marina District
  if (fz > 0.94) return DISTRICTS[5]; // Sunset Beach (sand, pier, sea)
  if (fz < 0.2 && fx > 0.25 && fx < 0.75) return DISTRICTS[7]; // Old Town
  if (fz > 0.82) return DISTRICTS[1]; // Harbor Docks (south)
  if (fx > 0.36 && fx < 0.64 && fz > 0.3 && fz < 0.7) return DISTRICTS[3]; // Glass Quarter downtown
  if (fx < 0.3 && fz < 0.4) return DISTRICTS[0]; // Sunset Mile NW
  if (fx > 0.7) return DISTRICTS[4]; // Sunset Shore east
  return DISTRICTS[2]; // Old Vesper
}

// The palette a district paints its towers with: warm golds for the
// old city, white and teal for the marina, brick and cream for Old
// Town. Each entry is [base colours...] the generator picks from.
export const DISTRICT_BASES = {
  'Marina District': [[0.92, 0.9, 0.84], [0.75, 0.85, 0.85], [0.55, 0.7, 0.75]],
  'Old Town': [[0.58, 0.3, 0.22], [0.7, 0.52, 0.34], [0.8, 0.68, 0.5]],
};

const WARM_BASES = [GOLD.sand, GOLD.cream, GOLD.terracotta, GOLD.gold, GOLD.rose];
const SIGN_COLORS = ['#ff9a3d', '#ffd166', '#fda4af', '#7dd3fc', '#ff5c5c', '#a5f3fc'];

// The coast band: the z where the city ends and the beach begins.
export function coastLineZ() {
  return citySize() / 2 + 4;
}

// Nearest named landmark to a point, for the HUD and the GPS.
export function nearestLandmark(x, z, landmarks) {
  let best = null, bestD = Infinity;
  for (const l of landmarks || []) {
    const dx = x - l.x, dz = z - l.z;
    const d = dx * dx + dz * dz;
    if (d < bestD) { bestD = d; best = l; }
  }
  return best;
}

// --------------------------------------------------------------- collision
// Circle (x,z,r) vs a building footprint: the building hit, or null.
export function hitsBuilding(x, z, r, buildings) {
  for (const b of buildings) {
    const dx = Math.max(Math.abs(x - b.x) - b.w / 2, 0);
    const dz = Math.max(Math.abs(z - b.z) - b.d / 2, 0);
    if (dx * dx + dz * dz < r * r) return b;
  }
  return null;
}

// Push a circle out of any building it overlaps; returns the corrected
// point. The push lands 0.05 past the edge: pushing to the exact
// boundary leaves the circle grazing the footprint in floating point,
// and the same building would report a hit again forever.
export function resolveBuildingCollision(x, z, r, buildings) {
  const MARGIN = 0.05;
  for (let guard = 0; guard < 8; guard += 1) {
    const b = hitsBuilding(x, z, r, buildings);
    if (!b) break;
    const dx = x - b.x, dz = z - b.z;
    const px = b.w / 2 + r - Math.abs(dx);
    const pz = b.d / 2 + r - Math.abs(dz);
    if (px < pz) x = b.x + (dx >= 0 ? 1 : -1) * (b.w / 2 + r + MARGIN);
    else z = b.z + (dz >= 0 ? 1 : -1) * (b.d / 2 + r + MARGIN);
  }
  return { x, z };
}

// Is the low sun visible from (x,z)? Walk the ray toward the sun in
// small steps; any building box taller than the ray at that step hides
// it.
export function sunVisibleFrom(x, z, buildings) {
  const steps = 60;
  for (let i = 1; i <= steps; i += 1) {
    const t = i / steps;
    const rx = x + (SUN.x - x) * t;
    const rz = z + (SUN.z - z) * t;
    const ry = 2 + (SUN.y - 2) * t;
    for (const b of buildings) {
      if (ry < b.h && Math.abs(rx - b.x) < b.w / 2 && Math.abs(rz - b.z) < b.d / 2) return false;
    }
  }
  return true;
}

// -------------------------------------------------------------- generation
// Pick a tower's base colour. The rng order matters: the warm palette
// pick and the shade are drawn first, then — only for the two new
// districts — a district base is drawn instead. Every other district
// keeps the warm colour, darkened or lightened by the shade.
function towerBaseColor(rng, districtName) {
  const palette = WARM_BASES[rng.int(0, WARM_BASES.length - 1)];
  const shade = rng.range(0.9, 1.15);
  const bases = DISTRICT_BASES[districtName];
  if (bases) return bases[rng.int(0, bases.length - 1)];
  return [palette[0] * shade, palette[1] * shade, palette[2] * shade];
}

// Neon signs on a tower's south face: one big sign on most tall
// towers, a second smaller one low down on the tallest, and a red
// rooftop beacon on anything over 40 units. The neon is what makes
// the golden hour read as a city that is awake, not a model.
function placeSigns(rng, signs, cx, cz, w, d, h) {
  if (rng.next() < 0.62 && h > 10) {
    signs.push({
      x: cx, y: rng.range(h * 0.45, h * 0.85), z: cz + d / 2 + 0.25,
      w: rng.range(3, 8), h: rng.range(0.8, 1.6), d: 0.4,
      color: rng.pick(SIGN_COLORS),
    });
    if (h > 34 && rng.next() < 0.5) {
      signs.push({
        x: cx, y: rng.range(4, h * 0.3), z: cz + d / 2 + 0.25,
        w: rng.range(2, 5), h: rng.range(0.6, 1.1), d: 0.4,
        color: rng.pick(['#ffd166', '#7dd3fc', '#fda4af']),
      });
    }
  }
  if (h > 40) {
    signs.push({ x: cx, y: h + 0.4, z: cz, w: 0.7, h: 0.7, d: 0.7, color: '#ff3355' });
  }
}

export function generateCity(rng) {
  const size = citySize();
  const lines = roadLines();
  const buildings = [];
  const signs = []; // bright sign boxes: {x,y,z,w,h,d,color}
  const palms = []; // beach palms: {x,z,h,lean}
  const umbrellas = []; // beach umbrellas: {x,z,color}
  const pitch = WORLD.block + WORLD.road;
  for (let bx = 0; bx < WORLD.blocks; bx += 1) {
    for (let bz = 0; bz < WORLD.blocks; bz += 1) {
      const cx = -size / 2 + WORLD.road + bx * pitch + WORLD.block / 2;
      const cz = -size / 2 + WORLD.road + bz * pitch + WORLD.block / 2;
      const downtown = Math.abs(bx - 4) <= 1 && Math.abs(bz - 4) <= 1;
      const harbor = bz >= WORLD.blocks - 1;
      // 1-4 towers per block, or a low warehouse near the harbor.
      const count = harbor ? 1 : downtown ? rng.int(2, 4) : rng.int(1, 3);
      for (let k = 0; k < count; k += 1) {
        const w = rng.range(10, 20);
        const d = rng.range(10, 20);
        const ox = rng.range(-8, 8);
        const oz = rng.range(-8, 8);
        const h = harbor ? rng.range(6, 12)
          : downtown ? rng.range(28, 62)
          : rng.range(9, 30);
        const districtName = districtAt(cx, cz).name;
        const base = towerBaseColor(rng, districtName);
        const strip = WINDOW_STRIP[rng.int(0, WINDOW_STRIP.length - 1)];
        buildings.push({ x: cx + ox, z: cz + oz, w, d, h, color: base, district: districtName, strip });
        placeSigns(rng, signs, cx + ox, cz + oz, w, d, h);
      }
    }
  }
  // Landmarks: the Storm Spire (tallest tower, downtown) and the
  // Harbor Bridge.
  buildings.push({ x: 0, z: 0, w: 26, d: 26, h: 78, color: [0.55, 0.42, 0.3], district: 'Glass Quarter', spire: true, strip: '#ffd166' });
  signs.push({ x: 0, y: 79, z: 0, w: 1.2, h: 1.2, d: 1.2, color: '#ff3355' });
  // Sunset beach along the south shore: palms and umbrellas on the sand.
  const beachZ = size / 2 + 18;
  for (let i = 0; i < 35; i += 1) {
    palms.push({ x: -size / 2 + 12 + rng.range(0, size - 24), z: beachZ + rng.range(-14, 14), h: rng.range(7, 11), lean: rng.range(-0.4, 0.4) });
  }
  for (let i = 0; i < 10; i += 1) {
    umbrellas.push({ x: -size / 2 + 30 + i * (size - 60) / 9 + rng.range(-8, 8), z: beachZ + rng.range(-8, 10), color: rng.pick(['#ff5c5c', '#ffd166', '#7dd3fc', '#fda4af']) });
  }
  // The Sunset Garage yard: Rook's shop sits on the south-east corner,
  // a low gold-roofed building with its own sign, so the player can
  // drive to it, park in the yard, and press G to buy upgrades.
  const garageX = size / 2 - 60, garageZ = size / 2 - 60;
  buildings.push({ x: garageX, z: garageZ, w: 30, d: 18, h: 10, color: [0.85, 0.62, 0.28], district: 'Harbor Docks', strip: '#ffd166' });
  signs.push({ x: garageX, y: 11.5, z: garageZ + 9.4, w: 16, h: 1.8, d: 0.4, color: '#ffd166' });
  const landmarks = [
    { id: 'spire', name: 'Storm Spire', x: 0, z: 0 },
    { id: 'harbor', name: 'Harbor Docks', x: 0, z: size / 2 - 14 },
    { id: 'neonmile', name: 'Sunset Mile', x: -size / 2 + 30, z: -size / 2 + 30 },
    { id: 'rainmarket', name: 'Sunset Shore', x: size / 2 - 30, z: -size / 2 + 60 },
    { id: 'hospital', name: 'St. Mara Hospital', x: -size / 2 + 60, z: size / 2 - 60 },
    { id: 'garage', name: 'Sunset Garage', x: garageX, z: garageZ },
    { id: 'pier', name: 'Sunset Pier', x: -20, z: size / 2 + 82 },
    { id: 'boardwalk', name: 'Sunset Boardwalk', x: 60, z: size / 2 + 20 },
    { id: 'boatdock', name: 'Boat Dock', x: 110, z: size / 2 + 56 },
    { id: 'beach', name: 'Sunset Beach', x: 0, z: size / 2 + 18 },
    { id: 'marina', name: 'Marina District', x: 180, z: size / 2 - 10 },
    { id: 'oldtown', name: 'Old Town', x: 0, z: -size / 2 + 50 },
  ];
  // v6 hurricane prep, on fixed coordinates (no rng, so the seeded
  // layout never moves): storm drains along the harbour roads and
  // sandbag stacks guarding the garage yard and the docks.
  const drains = [];
  for (const c of lines) {
    drains.push({ x: c - 3.5, z: size / 2 - 14 });
    drains.push({ x: c + 3.5, z: -size / 2 + 14 });
  }
  const sandbags = [
    { x: garageX - 18, z: garageZ - 12 }, { x: garageX + 18, z: garageZ - 12 },
    { x: -40, z: size / 2 - 14 }, { x: 40, z: size / 2 - 14 },
    { x: -80, z: size / 2 - 60 }, { x: 120, z: size / 2 - 30 },
  ];
  return { size, lines, buildings, signs, palms, umbrellas, landmarks, drains, sandbags };
}

// Pick a point on a road near (x,z) — used for spawns and mission targets.
export function roadPointNear(rng, x, z, radius) {
  const lines = roadLines();
  const c = lines[rng.int(0, lines.length - 1)];
  const along = (rng.next() < 0.5 ? x : z) + rng.range(-radius, radius);
  const size = citySize();
  const cl = (v) => Math.max(-size / 2 + 8, Math.min(size / 2 - 8, v));
  return rng.next() < 0.5 ? { x: cl(along), z: c } : { x: c, z: cl(along) };
}
