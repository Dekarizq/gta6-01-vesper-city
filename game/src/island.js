// island.js — Ember Isle, the volcanic island across the water from
// Vesper City, new in Sunset Kings v7. The Sunset Kings outgrew one
// city: across the ferry from the Sunset Pier lies a second map, a
// black-sand volcanic island with its own town, its own police, its
// own jobs and businesses, and five more story missions. Mara reaches
// it on the ferry (see ferry.js) and comes back the same way — the
// island is a real second world, not a backdrop: it has its own road
// grid, its own buildings with collision, its own traffic, its own
// wanted heat, and its own sunset over black sand.
//   Ember Isle in one breath: a live volcano with a lava glow on the
// north ridge, a fishing village on the west dock, a black-sand beach
// on the south shore, a lighthouse on the north-east point, a resort
// and a dive shop for the tourists, and a volcano bar where the
// island's own crew — the Ember Kings — drink. The island is smaller
// than Vesper City and wilder: fewer towers, more palms, more lava.
//   Coordinates: the island lives east of the city, centred at
// (700, 0), 420 units across. Its roads are a 6x6 grid of their own,
// so nothing on the island ever collides with a Vesper City road.
//   Determinism: generateIsland consumes the game rng in a fixed
// order, so the same seed always builds the same island — the dossier
// build and the screenshots can rely on it.
import { clamp } from './random.js';

// The island, in world coordinates. The ferry crosses the open water
// between the Sunset Pier and the west dock — about 520 units of sea.
export const ISLAND = {
  cx: 700, cz: 0, size: 420, half: 210,
  // Road lines on the island grid (world coordinates).
  xLines: [560, 620, 680, 740, 800, 860],
  zLines: [-150, -90, -30, 30, 90, 150],
  // The volcano, the island's heart and its warning.
  volcano: { x: 710, z: -120, radius: 46, height: 64 },
  // The west dock, where the ferry ties up.
  dock: { x: 500, z: 0, name: 'Ember Dock' },
  // The lighthouse on the north-east point.
  lighthouse: { x: 880, z: -180, name: 'Ember Light' },
  // The black-sand beach on the south shore.
  blackBeach: { x: 700, z: 185, name: 'Black Sand Beach' },
  // The fishing village around the dock.
  village: { x: 560, z: 30, name: 'Fisher Village' },
  // The resort on the south-east shore.
  resort: { x: 800, z: 120, name: 'Ember Resort' },
  // The dive shop on the south road.
  diveShop: { x: 620, z: 150, name: 'Ember Dive Shop' },
  // The volcano bar, up the north road.
  volcanoBar: { x: 680, z: -90, name: 'The Magma Bar' },
  // The night market in the middle of town.
  nightMarket: { x: 680, z: 30, name: 'Ember Night Market' },
  // The old church on the hill road.
  church: { x: 740, z: -30, name: 'St. Ember Church' },
  // The ferry terminal on the Vesper City side (the Sunset Pier end).
  ferryTerminal: { x: -20, z: 330, name: 'Sunset Pier Ferry' },
};

// Island palettes — whitewashed walls, teal shutters, black volcanic
// stone, terracotta roofs, and the lava orange that glows at dusk.
export const ISLAND_PALETTES = {
  walls: [
    [0.92, 0.88, 0.8], [0.85, 0.82, 0.72], [0.95, 0.9, 0.82],
    [0.78, 0.7, 0.6], [0.88, 0.8, 0.68],
  ],
  roofs: [
    [0.75, 0.3, 0.16], [0.9, 0.55, 0.2], [0.35, 0.25, 0.2],
    [0.2, 0.45, 0.5], [0.85, 0.65, 0.25],
  ],
  shutters: [
    [0.15, 0.5, 0.55], [0.2, 0.4, 0.65], [0.85, 0.5, 0.15],
    [0.6, 0.2, 0.25],
  ],
  lava: [1.0, 0.35, 0.08],
  blackSand: [0.16, 0.14, 0.13],
  sea: [0.1, 0.35, 0.5],
};

// The island districts, each with its own name, blurb and palette, so
// the HUD can say where Mara is instead of just giving coordinates.
export const ISLAND_DISTRICTS = [
  { id: 'dock', name: 'Ember Dock', blurb: 'The ferry ties up here. Salt, diesel and fish.' },
  { id: 'village', name: 'Fisher Village', blurb: 'White walls, blue shutters, nets drying in the sun.' },
  { id: 'town', name: 'Ember Town', blurb: 'The island market, the church and the narrow lanes.' },
  { id: 'volcano', name: 'Volcano Ridge', blurb: 'Black rock and lava glow. Do not climb it drunk.' },
  { id: 'beach', name: 'Black Sand Beach', blurb: 'Sand like ground obsidian, warm as a stove at noon.' },
  { id: 'resort', name: 'Ember Resort', blurb: 'Pools, palms and tourists who never read the news.' },
  { id: 'lighthouse', name: 'Ember Light', blurb: 'The beam that keeps the ferries off the rocks.' },
];

// Which district a point on the island belongs to. The volcano wins
// on the north ridge, the beach wins on the south shore, the dock wins
// on the west edge, and the town fills the middle.
export function islandDistrictAt(x, z) {
  const dx = x - ISLAND.volcano.x, dz = z - ISLAND.volcano.z;
  if (dx * dx + dz * dz < 70 * 70) return ISLAND_DISTRICTS[3];
  if (z > 160) return ISLAND_DISTRICTS[4];
  if (x < 540) return ISLAND_DISTRICTS[0];
  if (x > 840 && z < -140) return ISLAND_DISTRICTS[6];
  if (x > 780 && z > 90) return ISLAND_DISTRICTS[5];
  if (x < 620 && z > -30 && z < 90) return ISLAND_DISTRICTS[1];
  return ISLAND_DISTRICTS[2];
}

// Is a world point on Ember Isle at all (inside the island bounds)?
export function isOnIsland(x, z) {
  return x >= ISLAND.cx - ISLAND.half && x <= ISLAND.cx + ISLAND.half
    && z >= ISLAND.cz - ISLAND.half && z <= ISLAND.cz + ISLAND.half;
}

// The island's named points, for missions, jobs, GPS and screenshots.
// Every point sits on an island road or in an open plaza — never inside
// a building, never in the lava, never out in the sea.
export function islandPoints() {
  return {
    ferryDock: { x: 500, z: 0, name: 'Ember Dock — ferry berth' },
    dockPlaza: { x: 540, z: 0, name: 'Ember Dock plaza' },
    villageSquare: { x: 560, z: 30, name: 'Fisher Village square' },
    fishStalls: { x: 590, z: 30, name: 'Fish stalls' },
    townCross: { x: 680, z: 30, name: 'Ember Town crossroads' },
    nightMarket: { x: 680, z: 30, name: 'Ember Night Market' },
    church: { x: 740, z: -30, name: 'St. Ember Church' },
    volcanoBase: { x: 710, z: -60, name: 'Volcano base trail' },
    volcanoRim: { x: 710, z: -100, name: 'Volcano rim' },
    volcanoBar: { x: 680, z: -90, name: 'The Magma Bar' },
    lighthouse: { x: 880, z: -180, name: 'Ember Light' },
    lighthouseGate: { x: 860, z: -150, name: 'Lighthouse gate' },
    blackBeach: { x: 700, z: 185, name: 'Black Sand Beach' },
    beachBar: { x: 740, z: 150, name: 'Black Sand bar' },
    resort: { x: 800, z: 120, name: 'Ember Resort' },
    resortPool: { x: 800, z: 90, name: 'Resort pool' },
    diveShop: { x: 620, z: 150, name: 'Ember Dive Shop' },
    smugglerCove: { x: 560, z: 150, name: "Smuggler's Cove" },
    palmGrove: { x: 860, z: 90, name: 'Palm grove' },
    northRoad: { x: 680, z: -150, name: 'North road' },
    eastRoad: { x: 860, z: 30, name: 'East road' },
    southRoad: { x: 740, z: 150, name: 'South road' },
  };
}

// The island's road grid, as centre lines — the same shape as the
// city grid, so mission steps, GPS and traffic can reuse the same
// "nearest road" thinking without knowing the island is separate.
export function islandRoadLines() {
  return { x: [...ISLAND.xLines], z: [...ISLAND.zLines] };
}

export function islandNearestRoadCoord(v, axis) {
  const lines = axis === 'x' ? ISLAND.xLines : ISLAND.zLines;
  let best = lines[0];
  for (const c of lines) if (Math.abs(c - v) < Math.abs(best - v)) best = c;
  return best;
}

export function islandIsOnRoad(x, z) {
  const half = 5 + 0.4;
  for (const c of ISLAND.xLines) if (Math.abs(x - c) < half) return true;
  for (const c of ISLAND.zLines) if (Math.abs(z - c) < half) return true;
  return false;
}

// Build the island: roads, buildings, palms, lava, boats at the dock
// and the landmarks the story walks through. Consumes the rng in a
// fixed order — same seed, same island, every run.
export function generateIsland(rng) {
  const buildings = [];
  const palms = [];
  const stalls = [];
  const boats = [];
  const signs = [];
  const pitch = 60;
  // Town blocks: one or two low buildings per block, white walls with
  // terracotta or teal roofs, shutters in island colours. The volcano
  // blocks (north, around the cone) stay empty — nobody builds on lava.
  for (let bx = 0; bx < 5; bx += 1) {
    for (let bz = 0; bz < 5; bz += 1) {
      const cx = ISLAND.xLines[0] + 30 + bx * pitch;
      const cz = ISLAND.zLines[0] + 30 + bz * pitch;
      const dv = (cx - ISLAND.volcano.x) ** 2 + (cz - ISLAND.volcano.z) ** 2;
      if (dv < 80 * 80) continue; // lava field — no buildings, ever.
      const count = rng.int(1, 2);
      for (let k = 0; k < count; k += 1) {
        const w = rng.range(9, 16);
        const d = rng.range(9, 16);
        const ox = rng.range(-7, 7);
        const oz = rng.range(-7, 7);
        const h = rng.range(6, 14);
        const wall = ISLAND_PALETTES.walls[rng.int(0, ISLAND_PALETTES.walls.length - 1)];
        const shade = rng.range(0.9, 1.1);
        const base = [wall[0] * shade, wall[1] * shade, wall[2] * shade];
        const roof = ISLAND_PALETTES.roofs[rng.int(0, ISLAND_PALETTES.roofs.length - 1)];
        const shutter = ISLAND_PALETTES.shutters[rng.int(0, ISLAND_PALETTES.shutters.length - 1)];
        buildings.push({
          x: cx + ox, z: cz + oz, w, d, h, color: base,
          roof, shutter, district: islandDistrictAt(cx, cz).name,
          strip: '#ffd166',
        });
        // A warm window strip on some houses — the island glows at dusk
        // like the city does, but lower and warmer.
        if (rng.next() < 0.5 && h > 7) {
          signs.push({
            x: cx + ox, y: rng.range(h * 0.4, h * 0.7), z: cz + oz + d / 2 + 0.2,
            w: rng.range(2, 5), h: rng.range(0.7, 1.2), d: 0.3,
            color: rng.pick([[1, 0.82, 0.4], [1, 0.6, 0.24], [0.99, 0.64, 0.69], [0.49, 0.83, 0.99]]),
          });
        }
      }
    }
  }
  // The resort hotel — the tallest building on the island, white with
  // a teal roof, pool terrace on the south side.
  buildings.push({
    x: 800, z: 120, w: 30, d: 18, h: 26,
    color: [0.94, 0.9, 0.82], roof: [0.2, 0.45, 0.5],
    shutter: [0.15, 0.5, 0.55], district: 'Ember Resort', strip: '#7dd3fc',
    resort: true,
  });
  // The dive shop — low, bright, surfboards on the wall.
  buildings.push({
    x: 620, z: 150, w: 16, d: 12, h: 8,
    color: [0.9, 0.75, 0.4], roof: [0.2, 0.45, 0.5],
    shutter: [0.85, 0.5, 0.15], district: 'Black Sand Beach', strip: '#7dd3fc',
    diveShop: true,
  });
  // The Magma Bar — black volcanic stone, lava-orange sign.
  buildings.push({
    x: 680, z: -90, w: 18, d: 12, h: 9,
    color: [0.22, 0.18, 0.17], roof: [0.75, 0.3, 0.16],
    shutter: [1.0, 0.35, 0.08], district: 'Volcano Ridge', strip: '#ff5c1a',
    magmaBar: true,
  });
  // The church on the hill road — white, one bell tower.
  buildings.push({
    x: 740, z: -30, w: 14, d: 20, h: 18,
    color: [0.95, 0.93, 0.86], roof: [0.35, 0.25, 0.2],
    shutter: [0.85, 0.65, 0.25], district: 'Ember Town', strip: '#ffd166',
    church: true,
  });
  // The lighthouse — a striped tower on the north-east point, beam
  // included in the boxes so the screenshots can catch it sweeping.
  buildings.push({
    x: 880, z: -180, w: 8, d: 8, h: 34,
    color: [0.95, 0.93, 0.88], roof: [0.9, 0.2, 0.2],
    shutter: [0.2, 0.4, 0.65], district: 'Ember Light', strip: '#ff3355',
    lighthouse: true,
  });
  // Palms: a grove on the east road, a line along the black beach,
  // and a few lone palms by the village.
  for (let i = 0; i < 26; i += 1) {
    palms.push({
      x: 830 + rng.range(0, 50), z: 60 + rng.range(0, 90),
      h: rng.range(7, 11), lean: rng.range(-0.4, 0.4),
    });
  }
  for (let i = 0; i < 18; i += 1) {
    palms.push({
      x: 520 + i * 22 + rng.range(-6, 6), z: 168 + rng.range(-6, 8),
      h: rng.range(7, 10), lean: rng.range(-0.3, 0.3),
    });
  }
  for (let i = 0; i < 8; i += 1) {
    palms.push({
      x: 540 + rng.range(0, 60), z: 10 + rng.range(0, 40),
      h: rng.range(6, 10), lean: rng.range(-0.4, 0.4),
    });
  }
  // Night-market stalls in the town crossroads — striped awnings,
  // warm lamps, the smell of grilled fish in the air.
  const stallColors = [[1, 0.36, 0.36], [1, 0.82, 0.4], [0.49, 0.83, 0.99], [0.65, 0.95, 0.99], [0.99, 0.64, 0.69], [1, 0.6, 0.24]];
  for (let i = 0; i < 6; i += 1) {
    stalls.push({
      x: 660 + (i % 3) * 18, z: 18 + Math.floor(i / 3) * 22,
      color: stallColors[i % stallColors.length], angle: rng.range(-0.2, 0.2),
    });
  }
  // Fishing boats at the west dock, bobbing on the same tide as the
  // city boats — small hulls, bright paint, one with a sail up.
  const hulls = [
    [0.9, 0.4, 0.2], [0.2, 0.55, 0.75], [0.95, 0.8, 0.3],
    [0.55, 0.35, 0.65], [0.75, 0.45, 0.25],
  ];
  for (let i = 0; i < 5; i += 1) {
    boats.push({
      x: 492 + (i % 2) * 10, z: -24 + i * 12,
      angle: (i % 2 === 0 ? 0.3 : -0.25) + i * 0.1,
      phase: i * 1.4, hull: hulls[i], sail: i === 2,
    });
  }
  // Lava flows: three glowing streams running down the volcano cone
  // toward the north road, and the lava pool at the crater itself.
  const lavaFlows = [
    { x: 700, z: -100, w: 6, len: 34, angle: 0.15 },
    { x: 724, z: -104, w: 5, len: 26, angle: -0.3 },
    { x: 690, z: -98, w: 4, len: 22, angle: 0.5 },
  ];
  const landmarks = [
    { id: 'ferry-dock', name: 'Ember Dock', x: 500, z: 0 },
    { id: 'village', name: 'Fisher Village', x: 560, z: 30 },
    { id: 'market', name: 'Ember Night Market', x: 680, z: 30 },
    { id: 'volcano', name: 'Ember Volcano', x: 710, z: -120 },
    { id: 'lighthouse', name: 'Ember Light', x: 880, z: -180 },
    { id: 'beach', name: 'Black Sand Beach', x: 700, z: 185 },
    { id: 'resort', name: 'Ember Resort', x: 800, z: 120 },
    { id: 'church', name: 'St. Ember Church', x: 740, z: -30 },
  ];
  return {
    buildings, palms, stalls, boats, signs, lavaFlows, landmarks,
    points: islandPoints(),
  };
}

// The live island state: the generated island plus the clock the
// world loop steps (lava pulse, lighthouse beam, boat bob) and the
// flag that says whether Mara is on the island right now.
export function createIsland(rng) {
  const gen = generateIsland(rng);
  return {
    ...gen,
    onIsland: false,
    time: 0,
    trips: 0,
    visits: 0,
    lavaPulse: 0,
    beamAngle: 0,
    // Islanders: villagers, fishermen and tourists who walk the
    // island roads. They are stepped by stepIsland, not by the city
    // pedestrian system — the city system never leaves Vesper City.
    islanders: spawnIslanders(rng),
  };
}

// Islanders — the people who make Ember Isle feel lived in: fishermen
// by the dock, market sellers in town, tourists at the resort, and a
// couple of surfers walking to the black beach with boards.
export function spawnIslanders(rng) {
  const kinds = [
    { kind: 'fisherman', color: [0.2, 0.45, 0.55], speed: 1.2 },
    { kind: 'seller', color: [0.9, 0.6, 0.2], speed: 1.0 },
    { kind: 'tourist', color: [0.95, 0.85, 0.5], speed: 1.4 },
    { kind: 'surfer', color: [0.3, 0.7, 0.9], speed: 1.8 },
    { kind: 'villager', color: [0.7, 0.5, 0.35], speed: 1.1 },
  ];
  const spots = [
    { x: 540, z: 0 }, { x: 560, z: 30 }, { x: 680, z: 30 },
    { x: 800, z: 120 }, { x: 700, z: 185 }, { x: 620, z: 150 },
    { x: 740, z: -30 }, { x: 680, z: -90 }, { x: 860, z: 90 },
  ];
  const out = [];
  for (let i = 0; i < 18; i += 1) {
    const spot = spots[i % spots.length];
    const kind = kinds[i % kinds.length];
    out.push({
      x: spot.x + rng.range(-12, 12), z: spot.z + rng.range(-12, 12),
      angle: rng.range(0, Math.PI * 2), speed: kind.speed,
      kind: kind.kind, color: kind.color, phase: rng.range(0, 6),
      // Walk a small loop around their home spot — never into the
      // volcano, never into the sea.
      homeX: spot.x, homeZ: spot.z, roam: 14 + rng.range(0, 10),
    });
  }
  return out;
}

// Step the island clock: the lava pulses, the lighthouse beam sweeps,
// the boats bob, and the islanders walk their loops. Cheap — the
// island only steps when Mara is on it or the ferry is coming.
export function stepIsland(island, dt) {
  island.time += dt;
  island.lavaPulse = 0.5 + 0.5 * Math.sin(island.time * 1.4);
  island.beamAngle = (island.time * 0.35) % (Math.PI * 2);
  for (const p of island.islanders) {
    p.phase += dt * p.speed * 0.5;
    const tx = p.homeX + Math.sin(p.phase) * p.roam;
    const tz = p.homeZ + Math.cos(p.phase * 0.7) * p.roam;
    const dx = tx - p.x, dz = tz - p.z;
    const d = Math.hypot(dx, dz) || 1;
    p.x += (dx / d) * p.speed * dt;
    p.z += (dz / d) * p.speed * dt;
    p.angle = Math.atan2(dx, dz);
  }
}

// The island's buildings as collision circles: the world loop uses
// these instead of the city buildings while Mara is on the island.
// The volcano cone itself is solid too — nobody drives through lava.
export function islandBuildings(island) {
  const out = island.buildings.map((b) => ({ x: b.x, z: b.z, w: b.w, d: b.d, h: b.h }));
  out.push({ x: ISLAND.volcano.x, z: ISLAND.volcano.z, w: 56, d: 56, h: 64 });
  return out;
}

// Circle vs an island building footprint — the same shape as the
// city helper, kept here so the island never imports the city module
// just to ask one collision question.
export function islandHitsBuilding(x, z, r, island) {
  for (const b of island.buildings) {
    const dx = Math.max(Math.abs(x - b.x) - b.w / 2, 0);
    const dz = Math.max(Math.abs(z - b.z) - b.d / 2, 0);
    if (dx * dx + dz * dz < r * r) return b;
  }
  const vx = x - ISLAND.volcano.x, vz = z - ISLAND.volcano.z;
  if (vx * vx + vz * vz < (28 + r) * (28 + r)) return { x: ISLAND.volcano.x, z: ISLAND.volcano.z, w: 56, d: 56, h: 64 };
  return null;
}

export function islandResolveCollision(x, z, r, island) {
  for (let guard = 0; guard < 8; guard += 1) {
    const b = islandHitsBuilding(x, z, r, island);
    if (!b) break;
    const dx = x - b.x, dz = z - b.z;
    const px = b.w / 2 + r - Math.abs(dx);
    const pz = b.d / 2 + r - Math.abs(dz);
    if (px < pz) x = b.x + (dx >= 0 ? 1 : -1) * (b.w / 2 + r + 0.05);
    else z = b.z + (dz >= 0 ? 1 : -1) * (b.d / 2 + r + 0.05);
  }
  return { x, z };
}

// The island's boxes for the renderer: buildings with roofs and
// shutters, the volcano cone with its lava glow, the lighthouse with
// its sweeping beam, palms, stalls, boats, and the black-sand beach
// itself as a flat dark slab the renderer can stand on.
export function islandBoxes(island, time) {
  const boxes = [];
  const t = time || 0;
  // The island ground: a dark volcanic slab under the town and a
  // black-sand slab on the south shore, so the island reads as land
  // from the ferry instead of floating boxes on water.
  boxes.push(
    { x: ISLAND.cx, y: -0.4, z: ISLAND.cz, w: ISLAND.size, h: 0.8, d: ISLAND.size, color: [0.32, 0.28, 0.24], yaw: 0 },
    { x: 700, y: -0.3, z: 185, w: 360, h: 0.6, d: 46, color: [0.07, 0.07, 0.09], yaw: 0 },
  );
  // The island roads: dark asphalt strips on the 6x6 grid, so the
  // island reads as a town with streets instead of a bare dirt slab.
  // They sit just proud of the ground slab and run under the volcano
  // cone, the way a real island road runs up to the crater.
  for (const x of ISLAND.xLines) {
    boxes.push({ x, y: 0.05, z: ISLAND.cz, w: 8, h: 0.2, d: ISLAND.size, color: [0.16, 0.16, 0.18], yaw: 0 });
  }
  for (const z of ISLAND.zLines) {
    boxes.push({ x: ISLAND.cx, y: 0.05, z, w: ISLAND.size, h: 0.2, d: 8, color: [0.16, 0.16, 0.18], yaw: 0 });
  }
  // The volcano cone: stacked dark slabs narrowing to the crater,
  // with a lava pool on top that pulses with the island clock.
  const cone = ISLAND.volcano;
  const glow = 0.55 + island.lavaPulse * 0.45;
  boxes.push(
    { x: cone.x, y: 12, z: cone.z, w: 84, h: 24, d: 84, color: [0.2, 0.16, 0.15], yaw: 0 },
    { x: cone.x, y: 30, z: cone.z, w: 58, h: 20, d: 58, color: [0.24, 0.18, 0.16], yaw: 0.2 },
    { x: cone.x, y: 46, z: cone.z, w: 34, h: 16, d: 34, color: [0.28, 0.2, 0.17], yaw: -0.2 },
    { x: cone.x, y: 58, z: cone.z, w: 20, h: 8, d: 20, color: [glow, 0.3 * glow, 0.06], yaw: 0 },
  );
  // Lava flows down the cone — glowing orange slabs that follow the
  // flow lines the generator laid down.
  for (const f of island.lavaFlows) {
    boxes.push({
      x: f.x, y: 2.2, z: f.z, w: f.w, h: 1.6, d: f.len,
      color: [0.95 * glow + 0.05, 0.32, 0.06], yaw: f.angle,
    });
  }
  // Buildings: the house, its coloured roof, and its shutters, so
  // every island house reads as a house from every angle.
  for (const b of island.buildings) {
    boxes.push({ x: b.x, y: b.h / 2, z: b.z, w: b.w, h: b.h, d: b.d, color: b.color, yaw: 0 });
    boxes.push({ x: b.x, y: b.h + 0.5, z: b.z, w: b.w + 1, h: 1.0, d: b.d + 1, color: b.roof, yaw: 0 });
    boxes.push({ x: b.x, y: b.h * 0.55, z: b.z + b.d / 2 + 0.15, w: b.w * 0.6, h: 1.2, d: 0.3, color: b.shutter, yaw: 0 });
    if (b.lighthouse) {
      // The lamp room and the sweeping beam — a long thin gold box
      // that rotates with the island clock.
      boxes.push({ x: b.x, y: b.h + 2, z: b.z, w: 3.2, h: 2.4, d: 3.2, color: [1, 0.9, 0.4], yaw: 0 });
      const bx = b.x + Math.sin(island.beamAngle) * 26;
      const bz = b.z + Math.cos(island.beamAngle) * 26;
      boxes.push({ x: bx, y: b.h + 2, z: bz, w: 2.2, h: 1.4, d: 52, color: [1, 0.95, 0.6], yaw: island.beamAngle });
    }
    if (b.resort) {
      // The pool terrace: a turquoise slab beside the hotel.
      boxes.push({ x: b.x, y: 0.6, z: b.z - 16, w: 20, h: 1.2, d: 10, color: [0.25, 0.75, 0.85], yaw: 0 });
    }
  }
  // Warm window strips — the island glows at dusk.
  for (const s of island.signs) {
    boxes.push({ x: s.x, y: s.y, z: s.z, w: s.w, h: s.h, d: s.d, color: s.color, yaw: 0 });
  }
  // Palms: trunk and a flat green crown that leans with the tree.
  for (const p of island.palms) {
    boxes.push({ x: p.x, y: p.h / 2, z: p.z, w: 0.7, h: p.h, d: 0.7, color: [0.5, 0.38, 0.22], yaw: p.lean });
    boxes.push({ x: p.x + p.lean * 2, y: p.h + 0.8, z: p.z, w: 5.2, h: 0.9, d: 5.2, color: [0.25, 0.55, 0.25], yaw: p.lean });
  }
  // Night-market stalls: striped awning, counter, warm lamp.
  for (const s of island.stalls) {
    boxes.push({ x: s.x, y: 1.0, z: s.z, w: 4.5, h: 2.0, d: 3.2, color: [0.55, 0.4, 0.25], yaw: s.angle });
    boxes.push({ x: s.x, y: 2.6, z: s.z, w: 5.0, h: 0.5, d: 3.8, color: s.color, yaw: s.angle });
    boxes.push({ x: s.x, y: 3.4, z: s.z, w: 0.8, h: 0.8, d: 0.8, color: [1, 0.85, 0.4], yaw: 0 });
  }
  // Fishing boats at the dock, bobbing on the tide.
  for (const b of island.boats) {
    const bob = Math.sin(t * 1.2 + b.phase) * 0.25;
    boxes.push({ x: b.x, y: 0.8 + bob, z: b.z, w: 3.2, h: 1.4, d: 7, color: b.hull, yaw: b.angle });
    if (b.sail) {
      boxes.push({ x: b.x, y: 3.4 + bob, z: b.z, w: 0.3, h: 3.4, d: 4.5, color: [0.95, 0.93, 0.85], yaw: b.angle });
    }
  }
  // Islanders: a body box and a head box, walking their loops.
  for (const p of island.islanders) {
    const bob = Math.sin(t * 8 + p.phase) * 0.05;
    boxes.push({ x: p.x, y: 0.5 + bob, z: p.z, w: 0.65, h: 1.0, d: 0.5, color: p.color, yaw: p.angle });
    boxes.push({ x: p.x, y: 1.2 + bob, z: p.z, w: 0.5, h: 0.5, d: 0.5, color: [0.9, 0.75, 0.6], yaw: p.angle });
  }
  return boxes;
}

// What the HUD shows about the island: where Mara is, how many trips
// she has made, and whether the volcano is behaving itself.
export function islandLabel(island, x, z) {
  const d = islandDistrictAt(x, z);
  return `${d.name} · Ember Isle`;
}

export function islandSummary(island) {
  return {
    onIsland: island.onIsland,
    trips: island.trips,
    visits: island.visits,
    buildings: island.buildings.length,
    palms: island.palms.length,
    islanders: island.islanders.length,
    lavaPulse: Math.round(island.lavaPulse * 100) / 100,
  };
}

// Save/load: the island keeps its visit count and its trips, and
// whether Mara was standing on it — a save made on Ember Isle loads
// back on Ember Isle, not at the city hospital.
export function islandSave(island) {
  return {
    onIsland: island.onIsland, trips: island.trips, visits: island.visits,
    time: Math.round(island.time * 100) / 100,
  };
}

export function islandLoad(data) {
  if (!data || typeof data !== 'object') return null;
  return {
    onIsland: !!data.onIsland, trips: data.trips || 0,
    visits: data.visits || 0, time: data.time || 0,
  };
}

// The ferry dock sign the player reads: departures, the fare, and the
// one rule of the island — the volcano does not take reservations.
export function islandFerryNotice() {
  return 'FERRY TO EMBER ISLE — $50 · departs when you stand on the dock · the volcano does not take reservations.';
}

// Distance from a point to the nearest island road line — used by the
// GPS and by the traffic spawner to keep cars on the tarmac.
export function islandRoadDistance(x, z) {
  let best = Infinity;
  for (const c of ISLAND.xLines) best = Math.min(best, Math.abs(x - c));
  for (const c of ISLAND.zLines) best = Math.min(best, Math.abs(z - c));
  return best;
}

// A point on the island grid, snapped to the nearest intersection —
// mission steps and job targets use this so nothing ever lands in a
// building or in the lava field.
export function islandRoadPoint(ix, iz) {
  const x = ISLAND.xLines[clamp(ix, 0, ISLAND.xLines.length - 1)];
  const z = ISLAND.zLines[clamp(iz, 0, ISLAND.zLines.length - 1)];
  return { x, z };
}

// The volcano's mood for the HUD: calm, restless, or erupting, from
// the lava pulse — pure flavour, but the islanders take it seriously.
export function volcanoMood(island) {
  if (island.lavaPulse > 0.85) return 'ERUPTING';
  if (island.lavaPulse > 0.6) return 'RESTLESS';
  return 'CALM';
}
