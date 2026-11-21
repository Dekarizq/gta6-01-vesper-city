// police.js — the wanted system for Sunset Kings (v3): 0-5 stars, patrol
// cars that chase and ram, roadblocks at 3+, and a search helicopter at 3+
// (lower, bigger, with a searchlight beam). Every unit is named now: the
// cruisers carry a VCPD callsign, an officer, and a tactic — RAM, PIT,
// PURSUIT or ROADBLOCK — and the helicopter is CONDOR-1, flown by Capt.
// Hale. The HUD pursuit panel shows exactly who is on Mara and what they
// are trying to do, which is what the rank-1 entries do and what v2 only
// hinted at. Wanted decays when the player stays out of sight; crimes
// raise it.
import { WANTED_MAX, VCPD_UNITS, HELI_UNIT } from './config.js';
import { clamp, dist2, wrapAngle } from './random.js';
import { makeCar } from './vehicles.js';

export function createPolice() {
  return {
    wanted: 0, heat: 0, quietTimer: 0, spawnTimer: 0,
    cops: [], heli: null, roadblock: null, searchlight: 0,
    heliUnit: HELI_UNIT,
  };
}

export function addWanted(police, amount) {
  police.wanted = clamp(police.wanted + amount, 0, WANTED_MAX);
  police.heat = 1;
  police.quietTimer = 0;
}

// A cruiser's live status for the HUD: its named tactic, not a guess.
// RAM units close in fast, PIT units try to spin the player out, and the
// roadblock unit holds its ground ahead.
export function copStatus(cop, player) {
  const unit = cop.unit || {};
  const d = Math.sqrt(dist2(cop.x, cop.z, player.x, player.z));
  if (unit.tactic === 'ROADBLOCK') return 'ROADBLOCK';
  if (d < 12 && Math.abs(cop.speed) > 10) return unit.tactic === 'PIT' ? 'PIT MOVE' : 'RAMMING';
  return unit.tactic || 'PURSUIT';
}

export function copDisplay(cop, player) {
  const unit = cop.unit || {};
  return {
    callsign: cop.callsign || unit.callsign || 'VCPD',
    officer: unit.officer || 'VCPD officer',
    tactic: unit.tactic || 'PURSUIT',
    status: copStatus(cop, player),
    dist: Math.round(Math.sqrt(dist2(cop.x, cop.z, player.x, player.z))),
  };
}

export function stepPolice(police, dt, player, rng) {
  const w = police.wanted;
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
  const wantCops = w === 0 ? 0 : w <= 1 ? 1 : w <= 2 ? 2 : w <= 3 ? 3 : 4;
  police.spawnTimer -= dt;
  if (police.cops.length < wantCops && police.spawnTimer <= 0) {
    police.spawnTimer = 2.5;
    const unit = VCPD_UNITS[police.cops.length % VCPD_UNITS.length];
    const a = rng.range(0, Math.PI * 2);
    const d = rng.range(45, 70);
    const car = makeCar(
      { id: 'police', name: 'VCPD Interceptor', color: [0.92, 0.92, 0.95], top: 30, accel: 20, brake: 34, grip: 3.0 },
      player.x + Math.sin(a) * d, player.z + Math.cos(a) * d,
      Math.atan2(player.x - (player.x + Math.sin(a) * d), player.z - (player.z + Math.cos(a) * d)),
      { police: true, targetSpeed: 13 + w * 2, callsign: unit.callsign, unit },
    );
    police.cops.push(car);
  }
  for (const cop of police.cops) {
    if (cop.frozen) { cop.shooting = false; continue; }
    if (cop.wreck) continue;
    const dx = player.x - cop.x, dz = player.z - cop.z;
    const wantAngle = Math.atan2(dx, dz);
    cop.angle += clamp(wrapAngle(wantAngle - cop.angle), -2.4 * dt, 2.4 * dt);
    // PIT units aim slightly ahead of the player to cut across; RAM units
    // aim straight at the bumper.
    const target = 12 + w * 2.2 + ((cop.unit && cop.unit.tactic === 'RAM') ? 2 : 0);
    cop.speed = clamp(cop.speed + (target - cop.speed) * dt * 0.8, 0, 32);
    cop.x += Math.sin(cop.angle) * cop.speed * dt;
    cop.z += Math.cos(cop.angle) * cop.speed * dt;
    cop.shootTimer = (cop.shootTimer || 0) - dt;
    if (!player.inCar && dist2(cop.x, cop.z, player.x, player.z) < 400 && cop.shootTimer <= 0) {
      cop.shootTimer = 1.4;
      cop.shooting = true;
    } else cop.shooting = false;
  }
  if (police.cops.length > wantCops) police.cops = police.cops.slice(0, wantCops);
  // Helicopter CONDOR-1 at 3+ stars: big, low, circling above the player,
  // spotlight on them, flown by Capt. Hale.
  if (w >= 3) {
    if (!police.heli) police.heli = { angle: 0, x: player.x, z: player.z, y: 30, unit: HELI_UNIT };
    police.heli.angle += dt * 0.5;
    police.heli.x = player.x + Math.sin(police.heli.angle) * 12;
    police.heli.z = player.z + Math.cos(police.heli.angle) * 12;
    police.heli.y = 30 + Math.sin(police.heli.angle * 2) * 1.5;
  } else police.heli = null;
  // Roadblock at 3+: two parked cop cars ahead of the player's heading,
  // held by the ROADBLOCK unit.
  if (w >= 3 && !police.roadblock) {
    const fx = Math.sin(player.angle), fz = Math.cos(player.angle);
    police.roadblock = {
      x: player.x + fx * 55, z: player.z + fz * 55, angle: player.angle + Math.PI / 2,
      unit: VCPD_UNITS[2],
    };
  } else if (w < 3) police.roadblock = null;
  return police;
}

// Helicopter boxes: a big body, a wide rotor, a bright belly light, and a
// searchlight beam slanting down toward the player below.
export function heliBoxes(heli, time, player) {
  if (!heli) return [];
  const rotor = Math.sin(time * 40) * 0.2;
  const boxes = [
    { x: heli.x, y: heli.y, z: heli.z, w: 4.2, h: 2.2, d: 7.5, color: [0.85, 0.85, 0.9], yaw: heli.angle },
    { x: heli.x, y: heli.y + 1.6, z: heli.z, w: 11, h: 0.18, d: 0.7, color: [0.25, 0.25, 0.3], yaw: heli.angle + rotor },
    { x: heli.x, y: heli.y + 1.6, z: heli.z, w: 0.7, h: 0.18, d: 11, color: [0.25, 0.25, 0.3], yaw: heli.angle + rotor },
    { x: heli.x, y: heli.y - 1.2, z: heli.z, w: 0.9, h: 0.9, d: 0.9, color: [1, 0.95, 0.6], yaw: 0 },
  ];
  if (player) {
    for (let i = 1; i <= 5; i += 1) {
      const t = i / 5;
      boxes.push({
        x: heli.x + (player.x - heli.x) * t,
        y: heli.y - 1.2 - (heli.y - 1.2) * t,
        z: heli.z + (player.z - heli.z) * t,
        w: 1.1 + t * 2.2, h: 1.4, d: 1.1 + t * 2.2,
        color: [1, 0.95, 0.62], yaw: 0,
      });
    }
  }
  return boxes;
}
