// police.js — the wanted system for Sunset Kings (v4): 0-6 stars, patrol
// cars that chase and ram, roadblocks at 3+, a search helicopter at 3+
// (lower, bigger, with a searchlight beam), and — new in v4 — spike
// strips at 4+ stars, laid by the SPIKE unit (VCPD-52, Ofc. Duarte)
// across the road ahead of Mara. Every unit is named now: the cruisers
// carry a VCPD callsign, an officer, and a tactic — RAM, PIT, PURSUIT,
// ROADBLOCK, SPIKE or BLOCKADE — and the helicopter is CONDOR-1, flown
// by Capt. Hale. The HUD pursuit panel shows exactly who is on Mara and
// what they are trying to do, which is what the rank-1 entries do and
// what v2 only hinted at. Wanted decays when the player stays out of
// sight; crimes raise it.
import { WANTED_MAX, VCPD_UNITS, HELI_UNIT } from './config.js';
import { clamp, dist2, wrapAngle } from './random.js';
import { makeCar } from './vehicles.js';
import { createSpikeStrips, deployStrip, updateStrips } from './spikestrip.js';

export function createPolice() {
  return {
    wanted: 0, heat: 0, quietTimer: 0, spawnTimer: 0,
    cops: [], heli: null, roadblock: null, searchlight: 0,
    heliUnit: HELI_UNIT,
    // v4: spike strips laid by the SPIKE unit, and the timer that
    // spaces out new strips so the road never becomes a minefield.
    spikes: createSpikeStrips(),
    spikeTimer: 0,
  };
}

export function addWanted(police, amount) {
  police.wanted = clamp(police.wanted + amount, 0, WANTED_MAX);
  police.heat = 1;
  police.quietTimer = 0;
}

// A cruiser's live status for the HUD: its named tactic, not a guess.
// RAM units close in fast, PIT units try to spin the player out, the
// roadblock unit holds its ground ahead, and the SPIKE unit hangs back
// to lay its strips.
export function copStatus(cop, player) {
  const unit = cop.unit || {};
  const d = Math.sqrt(dist2(cop.x, cop.z, player.x, player.z));
  if (unit.tactic === 'ROADBLOCK') return 'ROADBLOCK';
  if (unit.tactic === 'BLOCKADE') return 'BLOCKADE';
  if (unit.tactic === 'SPIKE') return 'LAYING SPIKES';
  // v5: the marina patrol (VCPD-77, Ofc. Marisol) works the quay.
  if (unit.tactic === 'MARINA') return 'MARINA PATROL';
  // v6: the storm unit (VCPD-88, Ofc. Storm) works the flooded roads.
  if (unit.tactic === 'STORM') return 'STORM UNIT';
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

export function stepPolice(police, dt, player, rng, now = 0) {
  police.elapsed = now;
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
  // v4: six stars means five cruisers on the road at once.
  const wantCops = w === 0 ? 0 : w <= 1 ? 1 : w <= 2 ? 2 : w <= 3 ? 3 : w <= 4 ? 4 : 5;
  police.spawnTimer -= dt;
  if (police.cops.length < wantCops && police.spawnTimer <= 0) {
    police.spawnTimer = 2.5;
    // At 4+ stars the SPIKE unit joins the rotation instead of a plain
    // interceptor: it hangs back and lays strips, it does not ram.
    const pool = w >= 4
      ? [VCPD_UNITS[0], VCPD_UNITS[1], VCPD_UNITS[6], VCPD_UNITS[3], VCPD_UNITS[7]]
      : VCPD_UNITS;
    const unit = pool[police.cops.length % pool.length];
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
  // v4 spike strips: at 4+ stars the SPIKE unit lays a strip across
  // the road ahead of the player every 12 seconds (at most three live).
  // The strip check runs here, against the player car and traffic, so
  // a strip can catch a cruiser too — the VCPD sometimes spikes itself.
  police.spikeTimer -= dt;
  if (w >= 4 && police.spikeTimer <= 0) {
    police.spikeTimer = 12;
    const fx = Math.sin(player.angle), fz = Math.cos(player.angle);
    const spikeUnit = VCPD_UNITS.find((u) => u.tactic === 'SPIKE') || VCPD_UNITS[6];
    deployStrip(
      police.spikes,
      player.x + fx * 42, player.z + fz * 42,
      player.angle + Math.PI / 2, spikeUnit.callsign, now,
    );
  }
  // Spike hits are checked in the world loop (it owns the car list),
  // but the strips also tick down here so a strip laid and never hit
  // still expires on its own lifetime.
  updateStrips(police.spikes, police.cops, now, dt);
  // Helicopter CONDOR-1 at 3+ stars: big, low, circling above the player,
  // spotlight on them, flown by Capt. Hale. v4: lower and bigger, with
  // a wider searchlight — it should be impossible to miss in the sky.
  if (w >= 3) {
    if (!police.heli) police.heli = { angle: 0, x: player.x, z: player.z, y: 26, unit: HELI_UNIT };
    police.heli.angle += dt * 0.5;
    police.heli.x = player.x + Math.sin(police.heli.angle) * 12;
    police.heli.z = player.z + Math.cos(police.heli.angle) * 12;
    police.heli.y = 26 + Math.sin(police.heli.angle * 2) * 1.5;
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
// searchlight beam slanting down toward the player below. v4: CONDOR-1 is
// bigger and lower (y 26), with a red cheatline, a white belly, a wider
// rotor and a fatter searchlight cone — the v3 complaint was that the
// helicopter body went faint against the bright sky, so now it is the
// biggest thing in the air and it carries its own contrast.
export function heliBoxes(heli, time, player) {
  if (!heli) return [];
  const rotor = Math.sin(time * 40) * 0.2;
  const boxes = [
    { x: heli.x, y: heli.y, z: heli.z, w: 5.4, h: 2.8, d: 9.2, color: [0.85, 0.85, 0.9], yaw: heli.angle },
    { x: heli.x, y: heli.y - 0.4, z: heli.z, w: 5.6, h: 0.9, d: 9.4, color: [0.9, 0.15, 0.2], yaw: heli.angle },
    { x: heli.x, y: heli.y - 1.4, z: heli.z, w: 4.2, h: 0.7, d: 7.0, color: [0.96, 0.96, 0.98], yaw: heli.angle },
    { x: heli.x, y: heli.y + 2.0, z: heli.z, w: 13.5, h: 0.22, d: 0.9, color: [0.25, 0.25, 0.3], yaw: heli.angle + rotor },
    { x: heli.x, y: heli.y + 2.0, z: heli.z, w: 0.9, h: 0.22, d: 13.5, color: [0.25, 0.25, 0.3], yaw: heli.angle + rotor },
    { x: heli.x, y: heli.y + 2.3, z: heli.z, w: 1.2, h: 0.5, d: 1.2, color: [0.4, 0.4, 0.45], yaw: 0 },
    { x: heli.x, y: heli.y - 1.2, z: heli.z, w: 1.2, h: 1.2, d: 1.2, color: [1, 0.95, 0.6], yaw: 0 },
    // Tail boom and tail rotor, so the silhouette reads as a helicopter
    // from every angle, not a white box.
    { x: heli.x - Math.sin(heli.angle) * 6.5, y: heli.y + 0.4, z: heli.z - Math.cos(heli.angle) * 6.5, w: 1.0, h: 1.0, d: 4.5, color: [0.85, 0.85, 0.9], yaw: heli.angle },
    { x: heli.x - Math.sin(heli.angle) * 8.5, y: heli.y + 0.8, z: heli.z - Math.cos(heli.angle) * 8.5, w: 0.3, h: 2.4, d: 0.3, color: [0.9, 0.15, 0.2], yaw: 0 },
  ];
  if (player) {
    for (let i = 1; i <= 6; i += 1) {
      const t = i / 6;
      boxes.push({
        x: heli.x + (player.x - heli.x) * t,
        y: heli.y - 1.2 - (heli.y - 1.2) * t,
        z: heli.z + (player.z - heli.z) * t,
        w: 1.4 + t * 3.0, h: 1.6, d: 1.4 + t * 3.0,
        color: [1, 0.95, 0.62], yaw: 0,
      });
    }
    // The lit ground where the searchlight lands.
    boxes.push({ x: player.x, y: 0.15, z: player.z, w: 5, h: 0.2, d: 5, color: [1, 0.95, 0.65], yaw: 0 });
  }
  return boxes;
}
