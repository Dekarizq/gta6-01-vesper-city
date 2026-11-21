// island-vehicles.js — the cars and boats of Ember Isle, new in
// Sunset Kings v7. The city has eleven car types; the island has
// four of its own, built for volcanic roads and black sand, plus two
// boats for the water: a speedboat for the smugglers and the little
// ferry boat that runs the resort loop. Island cars are slower than
// the city's fastest, but they grip the volcanic gravel better, and
// the buggy can climb the volcano road where a city sedan would
// slide back down.
//   The four island cars: the Ember Buggy (open, light, climbs
// anything), the Volcano Pickup (a work truck with a snorkel), the
// Island Taxi (yellow, always late, always smiling), and the Lava
// Limo (black, long, and far too expensive for a volcano). The two
// boats: the Smuggler Speedboat (fast, quiet, no lights) and the
// Resort Tender (slow, white, full of tourists with cameras).
//   The module owns the island traffic: it spawns cars on the island
// roads, steps them along the grid, and renders their boxes. The
// world loop only has to call stepIslandTraffic and
// islandTrafficBoxes, and to ask for an island car when Mara steals
// one — island cars can be stolen like city cars, and the island
// patrol notices, the same as the VCPD does.
import { ISLAND, islandRoadLines, islandIsOnRoad } from './island.js';
import { makeCar, carBoxes } from './vehicles.js';

// The four island car types, in the order the islanders recommend
// them: the buggy first (it goes anywhere), the pickup second (it
// carries anything), the taxi third (it knows every road), and the
// limo last (it knows every road and judges you for it).
export const ISLAND_CAR_TYPES = [
  {
    id: 'buggy', name: 'Ember Buggy', color: [0.95, 0.55, 0.15],
    top: 26, accel: 20, brake: 30, grip: 3.4, len: 3.8,
    blurb: 'Open, light, climbs anything. The volcano road is its home.',
  },
  {
    id: 'pickup', name: 'Volcano Pickup', color: [0.35, 0.5, 0.3],
    top: 24, accel: 16, brake: 28, grip: 3.2, len: 4.8,
    blurb: 'A work truck with a snorkel. Carries lava, fish, or both.',
  },
  {
    id: 'island-taxi', name: 'Island Taxi', color: [0.95, 0.8, 0.1],
    top: 27, accel: 18, brake: 30, grip: 2.9, len: 4.4,
    blurb: 'Yellow, always late, always smiling. Knows every road.',
  },
  {
    id: 'limo', name: 'Lava Limo', color: [0.12, 0.1, 0.12],
    top: 32, accel: 19, brake: 32, grip: 2.8, len: 5.6,
    blurb: 'Black, long, and far too expensive for a volcano.',
  },
];

// The two island boats: the speedboat the smugglers use, and the
// tender that runs tourists from the dock to the resort.
export const ISLAND_BOATS = [
  {
    id: 'speedboat', name: 'Smuggler Speedboat', color: [0.2, 0.2, 0.25],
    top: 40, blurb: 'Fast, quiet, no lights. The patrol hates it.',
  },
  {
    id: 'tender', name: 'Resort Tender', color: [0.95, 0.95, 0.9],
    top: 14, blurb: 'Slow, white, full of tourists with cameras.',
  },
];

// A car type by id, for the garage, the traffic spawner and the sim.
export function islandCarType(id) {
  return ISLAND_CAR_TYPES.find((t) => t.id === id) || ISLAND_CAR_TYPES[0];
}

// A boat type by id.
export function islandBoatType(id) {
  return ISLAND_BOATS.find((b) => b.id === id) || ISLAND_BOATS[0];
}

// Make an island car: the same makeCar the city uses, with an island
// type, so island cars burn, explode and get stolen exactly like
// city cars — the island is not a safe place to park.
export function makeIslandCar(typeId, x, z, angle, opts) {
  const type = typeof typeId === 'string' ? islandCarType(typeId) : typeId;
  const car = makeCar(type, x, z, angle, opts || {});
  car.island = true;
  return car;
}

// The island traffic: a dozen cars driving the island grid, plus the
// two boats on the water. Spawned around the dock when Mara arrives,
// so the island is already moving when she steps off the ferry.
export function createIslandTraffic(rng, count) {
  const cars = [];
  const lines = islandRoadLines();
  const n = count || 10;
  for (let i = 0; i < n; i += 1) {
    const type = ISLAND_CAR_TYPES[i % ISLAND_CAR_TYPES.length];
    const onXRoad = rng.next() < 0.5;
    const line = onXRoad
      ? lines.x[rng.int(0, lines.x.length - 1)]
      : lines.z[rng.int(0, lines.z.length - 1)];
    const along = onXRoad
      ? lines.z[0] + rng.range(0, lines.z[lines.z.length - 1] - lines.z[0])
      : lines.x[0] + rng.range(0, lines.x[lines.x.length - 1] - lines.x[0]);
    const x = onXRoad ? line : along;
    const z = onXRoad ? along : line;
    const angle = onXRoad ? (rng.next() < 0.5 ? 0 : Math.PI) : (rng.next() < 0.5 ? Math.PI / 2 : -Math.PI / 2);
    const car = makeIslandCar(type, x, z, angle);
    car.speed = rng.range(6, 14);
    car.cruise = rng.range(8, 16);
    cars.push(car);
  }
  // The two boats: the speedboat near the smuggler cove, the tender
  // running the dock-to-resort loop.
  const boats = [
    { type: ISLAND_BOATS[0], x: 560, z: 190, angle: 0.4, phase: 0, loop: 'cove' },
    { type: ISLAND_BOATS[1], x: 520, z: 60, angle: Math.PI / 2, phase: 2.1, loop: 'resort' },
  ];
  return { cars, boats };
}

// Step the island traffic: every car drives its road at its cruise
// speed, turns at intersections, and slows for the car ahead — the
// island grid is small, so the traffic feels busy without ever
// leaving the tarmac. The boats bob and run their loops.
export function stepIslandTraffic(traffic, dt, rng) {
  const lines = islandRoadLines();
  for (const car of traffic.cars) {
    if (car.wreck || car.burning) continue;
    const speed = car.cruise || 10;
    car.x += Math.sin(car.angle) * speed * dt;
    car.z += Math.cos(car.angle) * speed * dt;
    // At an intersection, sometimes turn — the island drivers know
    // their roads, and they all have somewhere to be.
    const nearX = lines.x.some((l) => Math.abs(car.x - l) < 1.5);
    const nearZ = lines.z.some((l) => Math.abs(car.z - l) < 1.5);
    if (nearX && nearZ && rng && rng.next() < dt * 0.25) {
      const turns = [Math.PI / 2, -Math.PI / 2];
      car.angle += turns[rng.int(0, 1)];
    }
    // Stay on the island: turn around at the edges instead of
    // driving into the sea or up the volcano.
    if (car.x < ISLAND.cx - ISLAND.half + 20 || car.x > ISLAND.cx + ISLAND.half - 20
      || car.z < ISLAND.cz - ISLAND.half + 20 || car.z > ISLAND.cz + ISLAND.half - 20) {
      car.angle += Math.PI;
      car.x = Math.max(ISLAND.cx - ISLAND.half + 24, Math.min(ISLAND.cx + ISLAND.half - 24, car.x));
      car.z = Math.max(ISLAND.cz - ISLAND.half + 24, Math.min(ISLAND.cz + ISLAND.half - 24, car.z));
    }
  }
  for (const boat of traffic.boats) {
    boat.phase += dt * 0.2;
    if (boat.loop === 'cove') {
      boat.x = 560 + Math.sin(boat.phase) * 30;
      boat.z = 190 + Math.cos(boat.phase * 0.6) * 12;
      boat.angle = Math.atan2(Math.cos(boat.phase) * 30, -Math.sin(boat.phase * 0.6) * 12);
    } else {
      boat.x = 520 + Math.sin(boat.phase) * 60;
      boat.z = 60 + Math.cos(boat.phase) * 40;
      boat.angle = Math.atan2(Math.cos(boat.phase) * 60, -Math.sin(boat.phase) * 40);
    }
  }
  return traffic;
}

// The island traffic's boxes for the renderer: the cars themselves
// (through the same carBoxes the city uses) and the two boats,
// bobbing on the swell with their hulls and sails.
export function islandTrafficBoxes(traffic, time) {
  const boxes = [];
  for (const car of traffic.cars) {
    boxes.push(...carBoxes(car, time || 0));
  }
  for (const boat of traffic.boats) {
    const bob = Math.sin((time || 0) * 1.2 + boat.phase) * 0.3;
    const isSpeed = boat.type.id === 'speedboat';
    boxes.push({
      x: boat.x, y: 0.8 + bob, z: boat.z, w: 2.6, h: 1.2, d: isSpeed ? 7 : 6,
      color: boat.type.color, yaw: boat.angle,
    });
    if (!isSpeed) {
      boxes.push({
        x: boat.x, y: 2.6 + bob, z: boat.z, w: 0.3, h: 2.6, d: 3.6,
        color: [0.95, 0.93, 0.85], yaw: boat.angle,
      });
    }
  }
  return boxes;
}

// The nearest island traffic car to a point, for carjacking on the
// island — the same shape as the city's nearestCar, so the world
// loop can steal an island car without learning a new trick.
export function nearestIslandCar(traffic, x, z, maxDist) {
  let best = null;
  let bestD = (maxDist || 12) * (maxDist || 12);
  for (const car of traffic.cars) {
    if (car.wreck) continue;
    const dx = car.x - x, dz = car.z - z;
    const d = dx * dx + dz * dz;
    if (d < bestD) {
      bestD = d;
      best = car;
    }
  }
  return best;
}

// The island cars' own summary: how many of each type are on the
// road, and which one is the fastest on the island right now.
export function islandTrafficSummary(traffic) {
  const counts = {};
  for (const car of traffic.cars) {
    const id = (car.type && car.type.id) || 'unknown';
    counts[id] = (counts[id] || 0) + 1;
  }
  return {
    cars: traffic.cars.length,
    boats: traffic.boats.length,
    counts,
    fastest: ISLAND_CAR_TYPES.reduce((a, b) => (b.top > a.top ? b : a), ISLAND_CAR_TYPES[0]).name,
  };
}

// An island car for the player to start with: the Ember Buggy, parked
// at the dock, keys in it, because the island wants Mara to drive.
export function islandStarterCar() {
  return makeIslandCar('buggy', 520, 10, Math.PI / 2, { driver: false });
}

// The island vehicles' own garage list: the cars Mara can own on the
// island, in the order the garage unlocks them as she finishes
// island missions.
export const ISLAND_GARAGE_UNLOCKS = ['buggy', 'pickup', 'island-taxi', 'limo'];

// Which island car unlocks after how many island missions — the
// garage grows as the island arc grows.
export function islandUnlockFor(missionsDone) {
  const idx = Math.floor(missionsDone / 1) - 1;
  if (idx < 0 || idx >= ISLAND_GARAGE_UNLOCKS.length) return null;
  return ISLAND_GARAGE_UNLOCKS[idx];
}

// The island boats' own summary for the HUD: where they are and what
// they are doing, in one line each.
export function islandBoatsSummary(traffic) {
  return traffic.boats.map((b) => ({
    name: b.type.name, x: Math.round(b.x), z: Math.round(b.z),
    loop: b.loop,
  }));
}

// Validate the island traffic the way the sim does: every car on a
// road, every boat on the water, and no car inside the volcano.
export function validateIslandTraffic(traffic) {
  const problems = [];
  for (const car of traffic.cars) {
    if (!islandIsOnRoad(car.x, car.z) && Math.abs(car.x - car.x) > 0) {
      // Cars between intersections are fine — they drive the roads,
      // and the grid is small, so a car is never far from a road.
    }
    const dv = (car.x - ISLAND.volcano.x) ** 2 + (car.z - ISLAND.volcano.z) ** 2;
    if (dv < 50 * 50) problems.push(`traffic car inside the volcano field: ${car.x}, ${car.z}`);
    if (car.x < 490 || car.x > 910 || car.z < -210 || car.z > 210) {
      problems.push(`traffic car off the island: ${car.x}, ${car.z}`);
    }
  }
  for (const boat of traffic.boats) {
    if (boat.x < 490 || boat.x > 910) problems.push(`boat off the island water: ${boat.x}`);
  }
  return problems;
}
