// city.js — procedural Vesper City: a rain-soaked neon night metropolis.
// Grid of blocks separated by roads, a harbor with a bridge on the south edge,
// a tall Glass Quarter downtown, and neon signs on building faces. Pure data:
// the engine turns it into geometry, the minimap turns it into a map.
import { WORLD, DISTRICTS, NEON } from './config.js';

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
  if (fz > 0.82) return DISTRICTS[1]; // Harbor Docks (south)
  if (fx > 0.36 && fx < 0.64 && fz > 0.3 && fz < 0.7) return DISTRICTS[3]; // Glass Quarter downtown
  if (fx < 0.3 && fz < 0.4) return DISTRICTS[0]; // Neon Mile NW
  if (fx > 0.7) return DISTRICTS[4]; // Rainmarket east
  return DISTRICTS[2]; // Old Vesper
}

export function generateCity(rng) {
  const size = citySize();
  const lines = roadLines();
  const buildings = [];
  const signs = []; // neon sign boxes: {x,y,z,w,h,d,color}
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
        const shade = rng.range(0.9, 1.5);
        const base = [0.10 * shade + 0.08, 0.12 * shade + 0.09, 0.22 * shade + 0.12];
        // Glass Quarter towers glow bluer; Neon Mile warmer.
        const dist = districtAt(cx, cz);
        if (dist === DISTRICTS[3]) { base[0] = 0.12; base[1] = 0.22; base[2] = 0.42; }
        if (dist === DISTRICTS[0]) { base[0] = 0.30; base[1] = 0.10; base[2] = 0.28; }
        buildings.push({ x: cx + ox, z: cz + oz, w, d, h, color: base, district: dist.name });
        // Neon sign on the tallest face of some buildings.
        if (rng.next() < 0.55 && h > 10) {
          const c = rng.pick(NEON);
          signs.push({
            x: cx + ox, y: rng.range(h * 0.45, h * 0.85), z: cz + oz + d / 2 + 0.25,
            w: rng.range(3, 8), h: rng.range(0.8, 1.6), d: 0.4, color: c,
          });
        }
        // Rooftop beacon on tall towers.
        if (h > 40) {
          signs.push({ x: cx + ox, y: h + 0.4, z: cz + oz, w: 0.7, h: 0.7, d: 0.7, color: '#ff3355' });
        }
      }
    }
  }
  // Landmarks: the Storm Spire (tallest tower, downtown) and the Harbor Bridge.
  buildings.push({ x: 0, z: 0, w: 26, d: 26, h: 78, color: [0.14, 0.24, 0.5], district: 'Glass Quarter', spire: true });
  signs.push({ x: 0, y: 79, z: 0, w: 1.2, h: 1.2, d: 1.2, color: '#ff3355' });
  const landmarks = [
    { id: 'spire', name: 'Storm Spire', x: 0, z: 0 },
    { id: 'harbor', name: 'Harbor Docks', x: 0, z: size / 2 - 14 },
    { id: 'neonmile', name: 'Neon Mile', x: -size / 2 + 30, z: -size / 2 + 30 },
    { id: 'rainmarket', name: 'Rainmarket', x: size / 2 - 30, z: -size / 2 + 60 },
    { id: 'hospital', name: 'St. Mara Hospital', x: -size / 2 + 60, z: size / 2 - 60 },
    { id: 'garage', name: 'Vesper Garage', x: size / 2 - 60, z: size / 2 - 60 },
  ];
  return { size, lines, buildings, signs, landmarks };
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
