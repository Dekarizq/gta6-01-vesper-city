// combat.js — on-foot combat: punch up close, shoot with F / mouse click.
// Shots can hit pedestrians and police cars; killing a cop raises the wanted
// level. Police shoot back when close. Health regenerates slowly out of combat.
import { dist2, clamp } from './random.js';

export function createCombat() {
  return { cooldown: 0, muzzle: 0, lastShot: -10, kills: 0, shotsFired: 0 };
}

// Fire one shot in the player's facing direction. Returns a hit description or null.
export function shoot(combat, player, peds, cops, time) {
  if (combat.cooldown > 0 || time - combat.lastShot < 0.28) return null;
  combat.cooldown = 0.28;
  combat.lastShot = time;
  combat.shotsFired += 1;
  combat.muzzle = 0.12;
  const fx = Math.sin(player.angle), fz = Math.cos(player.angle);
  let best = null, bestD = 60;
  const consider = (x, z, kind, ref) => {
    const dx = x - player.x, dz = z - player.z;
    const along = dx * fx + dz * fz;
    if (along < 1 || along > bestD) return;
    const side = Math.abs(dx * fz - dz * fx);
    if (side < 2.2) { bestD = along; best = { kind, ref, dist: along }; }
  };
  for (const p of peds) if (!p.dead) consider(p.x, p.z, 'ped', p);
  for (const c of cops) consider(c.x, c.z, 'cop', c);
  if (best) {
    if (best.kind === 'ped') best.ref.dead = true;
    combat.kills += 1;
    return best;
  }
  return { kind: 'miss', dist: 60 };
}

// Melee: punch the nearest pedestrian within 2.5 units.
export function punch(player, peds) {
  for (const p of peds) {
    if (!p.dead && dist2(p.x, p.z, player.x, player.z) < 6.25) {
      p.dead = true;
      return p;
    }
  }
  return null;
}

export function stepCombat(combat, dt, player, police) {
  if (combat.cooldown > 0) combat.cooldown -= dt;
  if (combat.muzzle > 0) combat.muzzle -= dt;
  // Police return fire when the player is on foot and close.
  let incoming = 0;
  for (const cop of police.cops) {
    if (cop.shooting && !player.inCar && dist2(cop.x, cop.z, player.x, player.z) < 400) {
      incoming += 1;
    }
  }
  if (incoming > 0) {
    player.health -= incoming * 6 * dt;
    player.hurtFlash = Math.max(player.hurtFlash || 0, 0.15);
  }
  // Slow regen when not recently hurt.
  if (player.health < 100 && (player.hurtFlash || 0) <= 0) {
    player.health = clamp(player.health + 2.5 * dt, 0, 100);
  }
  if (player.hurtFlash > 0) player.hurtFlash -= dt;
}
