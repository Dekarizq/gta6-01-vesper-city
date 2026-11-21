// city.js — procedural Vesper City at golden hour: warm sand, cream,
// terracotta and gold towers, a sunset beach with palms and umbrellas on the
// south shore, and a low sun down the west boulevard. Pure data: the engine
// turns it into geometry, the minimap turns it into a map. Also owns building
// collision (circle vs tower footprint) and the sun-visibility ray check.
// v4: the south shore is a real district now — Sunset Beach, with the pier,
// the boardwalk and the boat dock as landmarks the GPS and the coast
// missions navigate to, and more neon signs on the towers so the city
// glows harder at golden hour. v5: two more districts with their own
// palettes — the Marina District (white/teal, south-east) and Old Town
// (brick/cream, north band) — plus marina and old-town landmarks.
import { WORLD, DISTRICTS, GOLD, WINDOW_STRIP, SUN } from './config.js';

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

export function districtAt(x, z) {
  const size = citySize();
  const fx = (x + size / 2) / size;
  const fz = (z + size / 2) / size;
  // v4: past the south road line is the beach, not the docks.
  // v5: the south-east corner by the sea is the Marina District, and
  // the north band is Old Town — both win over the grid districts.
  // Marina is checked BEFORE the beach: the marina quay sits on the
  // same south strip as the sand, and its x-range is what tells them
  // apart (east of fx 0.72 is quay, west of it is beach).
  if (fz > 0.82 && fx > 0.72) return DISTRICTS[6]; // Marina District
  if (fz > 0.94) return DISTRICTS[5]; // Sunset Beach (sand, pier, sea)
  if (fz < 0.2 && fx > 0.25 && fx < 0.75) return DISTRICTS[7]; // Old Town
  if (fz > 0.82) return DISTRICTS[1]; // Harbor Docks (south)
  if (fx > 0.36 && fx < 0.64 && fz > 0.3 && fz < 0.7) return DISTRICTS[3]; // Glass Quarter downtown
  if (fx < 0.3 && fz < 0.4) return DISTRICTS[0]; // Sunset Mile NW
  if (fx > 0.7) return DISTRICTS[4]; // Sunset Shore east
  return DISTRICTS[2]; // Old Vesper
}

// The coast band: the z where the city ends and the beach begins.
export function coastLineZ() {
  return citySize() / 2 + 4;
}

// Circle (x,z,r) vs a building footprint: true when they overlap.
export function hitsBuilding(x, z, r, buildings) {
  for (const b of buildings) {
    const dx = Math.max(Math.abs(x - b.x) - b.w / 2, 0);
    const dz = Math.max(Math.abs(z - b.z) - b.d / 2, 0);
    if (dx * dx + dz * dz < r * r) return b;
  }
  return null;
}

// Push a circle out of any building it overlaps; returns the corrected point.
// The push lands 0.05 past the edge: pushing to the exact boundary leaves
// the circle grazing the footprint in floating point, and the same building
// would report a hit again forever.
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

// Is the low sun visible from (x,z)? Walk the ray toward the sun in small
// steps; any building box taller than the ray at that step hides it.
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

const PALETTES = [GOLD.sand, GOLD.cream, GOLD.terracotta, GOLD.gold, GOLD.rose];

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
        const palette = PALETTES[rng.int(0, PALETTES.length - 1)];
        const shade = rng.range(0.9, 1.15);
        // v5: Marina towers are white and teal, Old Town towers are
        // brick and cream — the district palettes from textures.js
        // would be the source of truth, but the city generator only
        // carries the warm GOLD set, so the two new districts pick
        // their own bases here instead of a random warm one.
        const districtName = districtAt(cx, cz).name;
        const base = districtName === 'Marina District'
          ? [[0.92, 0.9, 0.84], [0.75, 0.85, 0.85], [0.55, 0.7, 0.75]][rng.int(0, 2)]
          : districtName === 'Old Town'
            ? [[0.58, 0.3, 0.22], [0.7, 0.52, 0.34], [0.8, 0.68, 0.5]][rng.int(0, 2)]
            : [palette[0] * shade, palette[1] * shade, palette[2] * shade];
        const strip = WINDOW_STRIP[rng.int(0, WINDOW_STRIP.length - 1)];
        buildings.push({ x: cx + ox, z: cz + oz, w, d, h, color: base, district: districtAt(cx, cz).name, strip });
        // A bright sign on the tallest face of some buildings. v4: more
        // signs, and a second, smaller sign lower down on the tallest
        // towers — the neon is what makes the golden hour read as a city
        // that is awake, not a model.
        if (rng.next() < 0.62 && h > 10) {
          const c = rng.pick(['#ff9a3d', '#ffd166', '#fda4af', '#7dd3fc', '#ff5c5c', '#a5f3fc']);
          signs.push({
            x: cx + ox, y: rng.range(h * 0.45, h * 0.85), z: cz + oz + d / 2 + 0.25,
            w: rng.range(3, 8), h: rng.range(0.8, 1.6), d: 0.4, color: c,
          });
          if (h > 34 && rng.next() < 0.5) {
            signs.push({
              x: cx + ox, y: rng.range(4, h * 0.3), z: cz + oz + d / 2 + 0.25,
              w: rng.range(2, 5), h: rng.range(0.6, 1.1), d: 0.4,
              color: rng.pick(['#ffd166', '#7dd3fc', '#fda4af']),
            });
          }
        }
        // Rooftop beacon on tall towers.
        if (h > 40) {
          signs.push({ x: cx + ox, y: h + 0.4, z: cz + oz, w: 0.7, h: 0.7, d: 0.7, color: '#ff3355' });
        }
      }
    }
  }
  // Landmarks: the Storm Spire (tallest tower, downtown) and the Harbor Bridge.
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
  // The Sunset Garage yard (v3): Rook's shop sits on the south-east
  // corner, a low gold-roofed building with its own sign, so the player
  // can drive to it, park in the yard, and press G to buy upgrades.
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
    // v4 coast landmarks: the pier, the boardwalk and the boat dock.
    { id: 'pier', name: 'Sunset Pier', x: -20, z: size / 2 + 82 },
    { id: 'boardwalk', name: 'Sunset Boardwalk', x: 60, z: size / 2 + 20 },
    { id: 'boatdock', name: 'Boat Dock', x: 110, z: size / 2 + 56 },
    { id: 'beach', name: 'Sunset Beach', x: 0, z: size / 2 + 18 },
    // v5: the two new districts get landmarks the GPS can name.
    { id: 'marina', name: 'Marina District', x: 180, z: size / 2 - 10 },
    { id: 'oldtown', name: 'Old Town', x: 0, z: -size / 2 + 50 },
  ];
  return { size, lines, buildings, signs, palms, umbrellas, landmarks };
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
