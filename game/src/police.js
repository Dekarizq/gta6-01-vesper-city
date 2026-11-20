// police.js — the wanted system: 0-5 stars, patrol cars that chase and ram,
// roadblocks at 3+, and a search helicopter at 4+. Wanted decays when the
// player stays out of sight; committing crimes raises it.
import { WANTED_MAX } from './config.js';
import { clamp, dist2 } from './random.js';
import { makeCar } from './vehicles.js';

export function createPolice() {
  return {
    wanted: 0, heat: 0, quietTimer: 0, spawnTimer: 0,
    cops: [], heli: null, roadblock: null, searchlight: 0,
  };
}

export function addWanted(police, amount) {
  police.wanted = clamp(police.wanted + amount, 0, WANTED_MAX);
  police.heat = 1;
  police.quietTimer = 0;
}

export function stepPolice(police, dt, player, rng) {
  const w = police.wanted;
  // Quiet decay: no crime for 18s and no cop close by sheds a star.
  if (w > 0) {
    police.quietTimer += dt;
    const near = police.cops.some((c) => dist2(c.x, c.z, player.x, player.z) < 900);
    if (police.quietTimer > 18 && !near) {
      police.wanted -= 1;
      police.quietTimer = 0;
    }
  } else {
    police.quietTimer = 0;
  }
  // Spawn cops up to the wanted level's count.
  const wantCops = w === 0 ? 0 : w <= 1 ? 1 : w <= 2 ? 2 : w <= 3 ? 3 : 4;
  police.spawnTimer -= dt;
  if (police.cops.length < wantCops && police.spawnTimer <= 0) {
    police.spawnTimer = 2.5;
    const a = rng.range(0, Math.PI * 2);
    const d = rng.range(45, 70);
    const car = makeCar(
      { id: 'police', name: 'VCPD Interceptor', color: [0.08, 0.12, 0.2], top: 30, accel: 20, brake: 34, grip: 3.0 },
      player.x + Math.sin(a) * d, player.z + Math.cos(a) * d,
      Math.atan2(player.x - (player.x + Math.sin(a) * d), player.z - (player.z + Math.cos(a) * d)),
      { police: true, targetSpeed: 13 + w * 2 },
    );
    police.cops.push(car);
  }
  // Chase: steer toward the player, ram on contact, shoot when on foot nearby.
  // Frozen cops (staged for screenshots) hold their position.
  for (const cop of police.cops) {
    if (cop.frozen) { cop.shooting = false; continue; }
    const dx = player.x - cop.x, dz = player.z - cop.z;
    const wantAngle = Math.atan2(dx, dz);
    let diff = wantAngle - cop.angle;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    cop.angle += clamp(diff, -2.4 * dt, 2.4 * dt);
    const target = 12 + w * 2.2;
    cop.speed = clamp(cop.speed + (target - cop.speed) * dt * 0.8, 0, 32);
    cop.x += Math.sin(cop.angle) * cop.speed * dt;
    cop.z += Math.cos(cop.angle) * cop.speed * dt;
    cop.shootTimer = (cop.shootTimer || 0) - dt;
    if (!player.inCar && dist2(cop.x, cop.z, player.x, player.z) < 400 && cop.shootTimer <= 0) {
      cop.shootTimer = 1.4;
      cop.shooting = true;
    } else cop.shooting = false;
  }
  // Remove cops that fell far behind when wanted drops.
  if (police.cops.length > wantCops) police.cops = police.cops.slice(0, wantCops);
  // Helicopter at 4+ stars: circles above the player, spotlight on them.
  if (w >= 4) {
    if (!police.heli) police.heli = { angle: 0, x: player.x, z: player.z, y: 42 };
    police.heli.angle += dt * 0.5;
    police.heli.x = player.x + Math.sin(police.heli.angle) * 16;
    police.heli.z = player.z + Math.cos(police.heli.angle) * 16;
    police.heli.y = 42 + Math.sin(police.heli.angle * 2) * 2;
  } else police.heli = null;
  // Roadblock at 3+: two parked cop cars ahead of the player's heading.
  if (w >= 3 && !police.roadblock) {
    const fx = Math.sin(player.angle), fz = Math.cos(player.angle);
    police.roadblock = {
      x: player.x + fx * 55, z: player.z + fz * 55, angle: player.angle + Math.PI / 2,
    };
  } else if (w < 3) police.roadblock = null;
  return police;
}

export function heliBoxes(heli, time) {
  if (!heli) return [];
  const rotor = Math.sin(time * 40) * 0.2;
  return [
    { x: heli.x, y: heli.y, z: heli.z, w: 2.4, h: 1.4, d: 5, color: [0.1, 0.12, 0.18], yaw: heli.angle },
    { x: heli.x, y: heli.y + 1, z: heli.z, w: 7, h: 0.12, d: 0.5, color: [0.6, 0.6, 0.65], yaw: heli.angle + rotor },
    { x: heli.x, y: heli.y - 0.8, z: heli.z, w: 0.5, h: 0.5, d: 0.5, color: [1, 0.95, 0.6], yaw: 0 },
  ];
}
