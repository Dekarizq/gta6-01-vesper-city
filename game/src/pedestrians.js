// pedestrians.js — people on the sidewalks: walkers, runners, and the
// occasional victim of the player's crimes. They flee from gunfire and cars.
import { clamp, dist2 } from './random.js';
import { citySize, nearestRoadCoord } from './city.js';

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
    peds.push({
      x, z, angle: rng.range(0, Math.PI * 2), speed: rng.range(1.2, 2.4),
      shirt: SHIRTS[rng.int(0, SHIRTS.length - 1)], flee: 0, dead: false, bob: rng.range(0, 6),
    });
  }
  return peds;
}

export function stepPedestrians(peds, dt, player, cars, gunshot) {
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
      if (p.flee <= 0) p.speed = 1.6;
    }
    // Wander: drift along sidewalks, turn at random.
    if (p.flee <= 0 && Math.random() < dt * 0.2) p.angle += (Math.random() - 0.5) * 2.4;
    p.x += Math.sin(p.angle) * p.speed * dt;
    p.z += Math.cos(p.angle) * p.speed * dt;
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

export function pedBoxes(p) {
  if (p.dead) {
    return [{ x: p.x, y: 0.3, z: p.z, w: 0.6, h: 0.5, d: 1.8, color: p.shirt, yaw: p.angle }];
  }
  const bob = Math.sin(p.bob) * 0.06;
  return [
    { x: p.x, y: 0.45 + bob, z: p.z, w: 0.6, h: 0.9, d: 0.45, color: p.shirt, yaw: p.angle },
    { x: p.x, y: 1.1 + bob, z: p.z, w: 0.45, h: 0.45, d: 0.45, color: [0.85, 0.7, 0.55], yaw: p.angle },
    { x: p.x, y: 0.2, z: p.z, w: 0.5, h: 0.4, d: 0.4, color: [0.12, 0.12, 0.18], yaw: p.angle },
  ];
}
