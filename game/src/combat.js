// combat.js — on-foot combat with three real weapons: FISTS (infinite),
// VESPER 9MM (72 rounds) and MAKO SMG (150 rounds). Switch with keys 1/2/3.
// Shots cost ammo and can hit pedestrians and police; killing a cop raises
// the wanted level. Police shoot back when close. Armour absorbs damage
// first; health regenerates slowly out of combat.
import { dist2, clamp } from './random.js';
import { WEAPONS } from './config.js';

export function createCombat() {
  return {
    cooldown: 0, muzzle: 0, lastShot: -10, kills: 0, shotsFired: 0,
    weapon: 1, // start on the pistol
    ammo: WEAPONS.map((w) => w.ammo),
  };
}

export function currentWeapon(combat) {
  return WEAPONS[combat.weapon];
}

export function switchWeapon(combat, index) {
  if (index < 0 || index >= WEAPONS.length) return false;
  combat.weapon = index;
  return true;
}

// Fire the current weapon in the player's facing direction.
// Returns a hit description, { kind: 'dry' } when out of ammo, or null on cooldown.
export function shoot(combat, player, peds, cops, time) {
  const weapon = WEAPONS[combat.weapon];
  if (combat.cooldown > 0 || time - combat.lastShot < weapon.cooldown) return null;
  if (combat.weapon > 0) {
    if (combat.ammo[combat.weapon] <= 0) return { kind: 'dry' };
    combat.ammo[combat.weapon] -= 1;
  }
  combat.cooldown = weapon.cooldown;
  combat.lastShot = time;
  combat.shotsFired += 1;
  combat.muzzle = 0.12;
  const fx = Math.sin(player.angle), fz = Math.cos(player.angle);
  let best = null, bestD = weapon.range;
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
  return { kind: 'miss', dist: weapon.range };
}

// Melee: punch the nearest pedestrian within 2.5 units (FISTS).
export function punch(player, peds) {
  for (const p of peds) {
    if (!p.dead && dist2(p.x, p.z, player.x, player.z) < 6.25) {
      p.dead = true;
      return p;
    }
  }
  return null;
}

// Damage first eats armour, then health. Returns the health actually lost.
export function applyDamage(player, amount) {
  let left = amount;
  if (player.armour > 0) {
    const absorbed = Math.min(player.armour, left);
    player.armour -= absorbed;
    left -= absorbed;
  }
  player.health -= left;
  player.hurtFlash = Math.max(player.hurtFlash || 0, 0.15);
  return left;
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
  if (incoming > 0) applyDamage(player, incoming * 6 * dt);
  // Slow regen when not recently hurt.
  if (player.health < 100 && (player.hurtFlash || 0) <= 0) {
    player.health = clamp(player.health + 2.5 * dt, 0, 100);
  }
  if (player.armour < 100 && (player.hurtFlash || 0) <= 0) {
    player.armour = clamp(player.armour + 1.5 * dt, 0, 100);
  }
  if (player.hurtFlash > 0) player.hurtFlash -= dt;
}
