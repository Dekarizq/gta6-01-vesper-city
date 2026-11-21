// combat.js — on-foot combat for Sunset Kings (v4): FISTS (infinite),
// VESPER 9MM (72 rounds), MAKO SMG (150 rounds) and the new GOLDEN
// 12-GAUGE shotgun (40 shells), switched with 1/2/3/4 or the weapon
// wheel (hold Q). The shotgun is a close-range spread gun: a wide
// firing cone, heavy damage per hit, and a slow pump between shots.
// Shots cost ammo and can hit pedestrians, police, and — new in v3 —
// cars: put enough rounds into a cruiser and it catches fire, then
// explodes. Killing a cop raises the wanted level and pays respect.
// Police shoot back when close. Armour absorbs damage first; health
// regenerates slowly out of combat.
import { dist2, clamp } from './random.js';
import { WEAPONS } from './config.js';
import { damageCar } from './vehicles.js';

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

// v5: the muzzle flash colour belongs to the weapon — gold for the
// shotgun, white-hot for the pistol, blue-white for the SMG.
export function muzzleColor(weaponId) {
  if (weaponId === 'shotgun') return [1, 0.72, 0.2];
  if (weaponId === 'smg') return [0.75, 0.9, 1];
  if (weaponId === 'pistol') return [1, 0.95, 0.8];
  return [1, 0.9, 0.4];
}

export function switchWeapon(combat, index) {
  if (index < 0 || index >= WEAPONS.length) return false;
  combat.weapon = index;
  return true;
}

// Damage per hit, by weapon. The shotgun hits twice as hard as the
// pistol — two shells light a cruiser up, where the pistol needs three.
export function weaponDamage(weapon) {
  if (weapon.id === 'shotgun') return 60;
  if (weapon.id === 'smg') return 26;
  if (weapon.id === 'pistol') return 34;
  return 12; // fists, via punch(), not here
}

// Firing-cone half-width, in world units at the target: the shotgun
// sprays wide, the pistol and SMG stay tight. v6: heavy rain widens
// every cone by up to 40% — wet hands, wet sights, and the storm does
// the rest.
export function weaponSpread(weapon, rain = 0) {
  const base = weapon.id === 'shotgun' ? 4.6 : 2.2;
  return base * (1 + clamp(rain, 0, 1) * 0.4);
}

// Top up ammo — the garage sells shells and SMG rounds, and side jobs
// sometimes pay in ammo instead of cash. Never exceeds 2x the weapon's
// starting load, so the player cannot stockpile forever.
export function giveAmmo(combat, index, amount) {
  if (index < 1 || index >= WEAPONS.length) return 0;
  const cap = WEAPONS[index].ammo * 2;
  const before = combat.ammo[index];
  combat.ammo[index] = Math.min(cap, before + amount);
  return combat.ammo[index] - before;
}

// Fire the current weapon in the player's facing direction. Returns a hit
// description, { kind: 'dry' } when out of ammo, or null on cooldown.
// Cars take 34 damage per pistol hit — three pistol hits light a
// cruiser up; the shotgun does 60, so two shells do the same job.
export function shoot(combat, player, peds, cops, time, cars = [], rain = 0) {
  const weapon = WEAPONS[combat.weapon];
  if (combat.cooldown > 0 || time - combat.lastShot < weapon.cooldown) return null;
  if (combat.weapon > 0) {
    if (combat.ammo[combat.weapon] <= 0) return { kind: 'dry' };
    combat.ammo[combat.weapon] -= 1;
  }
  combat.cooldown = weapon.cooldown;
  combat.lastShot = time;
  combat.shotsFired += 1;
  combat.muzzle = weapon.id === 'shotgun' ? 0.22 : 0.12;
  combat.lastWeapon = weapon.id;
  const fx = Math.sin(player.angle), fz = Math.cos(player.angle);
  let best = null, bestD = weapon.range;
  const spread = weaponSpread(weapon, rain);
  const consider = (x, z, kind, ref) => {
    const dx = x - player.x, dz = z - player.z;
    const along = dx * fx + dz * fz;
    if (along < 1 || along > bestD) return;
    const side = Math.abs(dx * fz - dz * fx);
    if (side < spread) { bestD = along; best = { kind, ref, dist: along }; }
  };
  for (const p of peds) if (!p.dead) consider(p.x, p.z, 'ped', p);
  for (const c of cops) if (!c.wreck) consider(c.x, c.z, 'cop', c);
  for (const car of cars) if (!car.wreck && !car.police) consider(car.x, car.z, 'car', car);
  if (!best) return { kind: 'miss', dist: weapon.range, weapon: weapon.id };
  const dmg = weaponDamage(weapon);
  if (best.kind === 'ped') {
    best.ref.dead = true;
    combat.kills += 1;
    return { ...best, weapon: weapon.id, damage: dmg };
  }
  if (best.kind === 'car') {
    const result = damageCar(best.ref, dmg);
    return { kind: 'car', ref: best.ref, dist: best.dist, damage: result, weapon: weapon.id };
  }
  // A cop car hit: the officer is hit and the cruiser takes the damage too.
  const result = damageCar(best.ref, dmg);
  combat.kills += 1;
  return { kind: 'cop', ref: best.ref, dist: best.dist, damage: result, weapon: weapon.id };
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

// Blast damage from an exploding car: hurts the player on foot nearby,
// and hurts any car caught in the blast so chain explosions can happen.
export function applyBlast(player, cars, x, z, radius = 14) {
  let hurt = false;
  if (!player.inCar && dist2(player.x, player.z, x, z) < radius * radius) {
    applyDamage(player, 35);
    hurt = true;
  }
  for (const car of cars) {
    if (car.wreck || car.exploded) continue;
    if (dist2(car.x, car.z, x, z) < radius * radius) damageCar(car, 60);
  }
  return hurt;
}

export function stepCombat(combat, dt, player, police) {
  if (combat.cooldown > 0) combat.cooldown -= dt;
  if (combat.muzzle > 0) combat.muzzle -= dt;
  let incoming = 0;
  for (const cop of police.cops) {
    if (cop.shooting && !player.inCar && dist2(cop.x, cop.z, player.x, player.z) < 400) {
      incoming += 1;
    }
  }
  if (incoming > 0) applyDamage(player, incoming * 6 * dt);
  if (player.health < 100 && (player.hurtFlash || 0) <= 0) {
    player.health = clamp(player.health + 2.5 * dt, 0, 100);
  }
  if (player.armour < 100 && (player.hurtFlash || 0) <= 0) {
    player.armour = clamp(player.armour + 1.5 * dt, 0, 100);
  }
  if (player.hurtFlash > 0) player.hurtFlash -= dt;
}
