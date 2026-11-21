// pedestrians.js — people on the sidewalks: walkers, runners, and the
// occasional victim of the player's crimes. They flee from gunfire and cars,
// and building collision keeps them out of towers just like the player.
// v4 adds beachgoers on the coast: sunbathers on towels, walkers on the
// sand, and surfers paddling out to sea — the coast module owns their
// look, this module owns the shared walker behaviour they build on.
import { clamp, dist2, gauss } from './random.js';
import { citySize, nearestRoadCoord, resolveBuildingCollision } from './city.js';

const SHIRTS = [
  [0.9, 0.3, 0.4], [0.3, 0.7, 0.95], [0.95, 0.8, 0.3], [0.4, 0.85, 0.5],
  [0.75, 0.5, 0.95], [0.95, 0.55, 0.2], [0.9, 0.9, 0.9], [0.2, 0.85, 0.85],
];

export function spawnPedestrians(rng, count, cx, cz) {
  const peds = [];
  const size = citySize();
  for (let i = 0; i < count; i += 1) {
    const x = clamp(cx + rng.range(-80, 80), -size / 2 + 6, size / 2 - 6);
    const z = clamp(cz + rng.range(-80, 80), -size / 2 + 6, size / 2 - 6);
    // v5: the crowd has kinds — most walk, some run (faster, cap),
    // some are tourists (hat + camera, slow, they stop and look).
    const roll = rng.next();
    const kind = roll < 0.2 ? 'runner' : roll < 0.35 ? 'tourist' : 'walker';
    peds.push({
      x, z, angle: rng.range(0, Math.PI * 2),
      speed: kind === 'runner' ? rng.range(3.2, 4.2) : kind === 'tourist' ? rng.range(0.8, 1.2) : clamp(1.8 + gauss(rng) * 0.45, 1.2, 2.4),
      shirt: SHIRTS[rng.int(0, SHIRTS.length - 1)], flee: 0, dead: false, bob: rng.range(0, 6),
      crew: null, kind,
    });
  }
  return peds;
}

// The Sunset Kings crew on foot: Lena, Rook and Dario stand near the
// garage yard and the mission starts, so the crew is visible in the
// world instead of only named in a panel. Crew members never flee from
// Mara and never count as bystanders for crimes.
export function spawnCrew(rng, garage) {
  if (!garage) return [];
  const crew = [
    { name: 'Lena Voss', shirt: [0.9, 0.3, 0.4], dx: -6, dz: 0 },
    { name: 'Rook', shirt: [0.3, 0.7, 0.95], dx: 6, dz: 2 },
    { name: 'Dario Kess', shirt: [0.95, 0.8, 0.3], dx: 0, dz: -6 },
  ];
  return crew.map((c) => ({
    x: garage.x + c.dx, z: garage.z + c.dz, angle: rng.range(0, Math.PI * 2),
    speed: 0, shirt: c.shirt, flee: 0, dead: false, bob: rng.range(0, 6),
    crew: c.name,
  }));
}

export function stepPedestrians(peds, dt, player, cars, gunshot, buildings, weather) {
  // v6: in a storm, everyone hurries — the crowd moves almost twice
  // as fast, running for cover instead of strolling the boulevard.
  const hurry = weather && weather.phase === 'storm' ? 1.8 : 1;
  for (const p of peds) {
    if (p.dead) continue;
    // Flee from the player when they are armed/dangerous, from gunfire, or from a fast car.
    let threat = null;
    if (gunshot) threat = player;
    else if (dist2(p.x, p.z, player.x, player.z) < 25 && player.armed) threat = player;
    else {
      for (const c of cars) {
        if (Math.abs(c.speed) > 6 && dist2(p.x, p.z, c.x, c.z) < 30) { threat = c; break; }
      }
    }
    if (threat) {
      p.flee = 2.5;
      const dx = p.x - threat.x, dz = p.z - threat.z;
      p.angle = Math.atan2(dx, dz);
      p.speed = 5.5;
    } else if (p.flee > 0) {
      p.flee -= dt;
      // v5: a runner goes back to running, a tourist back to strolling.
      if (p.flee <= 0) p.speed = p.kind === 'runner' ? 3.6 : p.kind === 'tourist' ? 1.0 : 1.6;
    }
    // Wander: drift along sidewalks, turn at random.
    if (p.flee <= 0 && Math.random() < dt * 0.2) p.angle += (Math.random() - 0.5) * 2.4;
    p.x += Math.sin(p.angle) * p.speed * hurry * dt;
    p.z += Math.cos(p.angle) * p.speed * hurry * dt;
    if (buildings) {
      const fixed = resolveBuildingCollision(p.x, p.z, 0.6, buildings);
      p.x = fixed.x; p.z = fixed.z;
    }
    p.bob += dt * 6;
    const half = citySize() / 2 - 3;
    if (Math.abs(p.x) > half || Math.abs(p.z) > half) p.angle += Math.PI;
    // Keep off the middle of roads when strolling.
    if (p.flee <= 0) {
      const rx = nearestRoadCoord(p.x), rz = nearestRoadCoord(p.z);
      if (Math.abs(p.x - rx) < 2 && Math.abs(p.z - rz) > 2) p.x += (p.x < rx ? -1 : 1) * dt * 2;
      if (Math.abs(p.z - rz) < 2 && Math.abs(p.x - rx) > 2) p.z += (p.z < rz ? -1 : 1) * dt * 2;
    }
  }
}

// Beachgoers for the coast: the same walker shape, but they spawn on
// the sand with beach shirts and a beach kind ('sunbathe', 'walk' or
// 'surf'), so the coast can place a crowd without duplicating the
// pedestrian code. The coast module steps them; this is the spawner.
export function spawnBeachgoers(rng, count, beachZ, size) {
  const towels = [
    [1, 0.45, 0.3], [0.3, 0.7, 0.95], [0.95, 0.8, 0.3],
    [0.75, 0.5, 0.95], [0.4, 0.85, 0.5], [0.95, 0.55, 0.2],
  ];
  const out = [];
  for (let i = 0; i < count; i += 1) {
    out.push({
      x: clamp(-size / 2 + 30 + rng.range(0, size - 60), -size / 2 + 6, size / 2 - 6),
      z: beachZ + rng.range(-8, 10),
      angle: rng.range(0, Math.PI * 2),
      speed: rng.range(1.0, 1.8),
      shirt: towels[rng.int(0, towels.length - 1)],
      flee: 0, dead: false, bob: rng.range(0, 6),
      crew: null, beach: i % 3 === 0 ? 'sunbathe' : 'walk',
    });
  }
  return out;
}

// A beachgoer who hears a gunshot or sees a fast car runs for the
// boardwalk, not into the sea — fleeing toward the city, away from
// the water, is the only sane direction on a beach.
export function stepBeachgoer(p, dt, player, gunshot) {
  if (p.dead) return;
  if (gunshot || dist2(p.x, p.z, player.x, player.z) < 25) {
    p.flee = 2;
    p.angle = Math.atan2(p.x - player.x, (p.z - player.z) - 20);
    p.speed = 5;
    p.x += Math.sin(p.angle) * p.speed * dt;
    p.z += Math.cos(p.angle) * p.speed * dt;
  }
  if (p.flee > 0) p.flee -= dt;
}

export function pedBoxes(p) {
  if (p.dead) {
    return [{ x: p.x, y: 0.3, z: p.z, w: 0.6, h: 0.5, d: 1.8, color: p.shirt, yaw: p.angle }];
  }
  const bob = Math.sin(p.bob) * 0.06;
  const boxes = [
    { x: p.x, y: 0.45 + bob, z: p.z, w: 0.6, h: 0.9, d: 0.45, color: p.shirt, yaw: p.angle },
    { x: p.x, y: 1.1 + bob, z: p.z, w: 0.45, h: 0.45, d: 0.45, color: [0.85, 0.7, 0.55], yaw: p.angle },
    { x: p.x, y: 0.2, z: p.z, w: 0.5, h: 0.4, d: 0.4, color: [0.12, 0.12, 0.18], yaw: p.angle },
  ];
  // v5 kinds read at a glance: runners wear a cap and lean forward,
  // tourists wear a wide sun hat and carry a camera box.
  if (p.kind === 'runner') {
    boxes.push({ x: p.x, y: 1.38 + bob, z: p.z, w: 0.5, h: 0.14, d: 0.5, color: [0.9, 0.2, 0.25], yaw: p.angle });
  } else if (p.kind === 'tourist') {
    boxes.push({ x: p.x, y: 1.36 + bob, z: p.z, w: 0.7, h: 0.12, d: 0.7, color: [0.95, 0.85, 0.5], yaw: p.angle });
    boxes.push({ x: p.x + Math.sin(p.angle) * 0.4, y: 0.9 + bob, z: p.z + Math.cos(p.angle) * 0.4, w: 0.3, h: 0.25, d: 0.2, color: [0.15, 0.15, 0.18], yaw: p.angle });
  }
  return boxes;
}
