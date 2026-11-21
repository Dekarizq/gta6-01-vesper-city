// vehicles.js — cars for Sunset Kings (v3): the player's car, traffic AI,
// stealing, and the new damage model. Every car has health: shoot it,
// ram it, or slam it into a tower and it starts to burn; keep hurting it
// and it explodes, leaving a smoking wreck that stays on the road. Police
// cruisers are white with a red/blue light bar so they read clearly
// against warm golden-hour roads, and each carries a named VCPD unit.
// Garage upgrades change the player's car for real: engine raises top
// speed and pull, tyres raise grip — stepPlayerCar takes the effective
// stats the garage computed, never the base type alone.
import { CAR_TYPES } from './config.js';
import { clamp, dist2, angleLerp, wrapAngle } from './random.js';
import { nearestRoadCoord, roadLines, citySize } from './city.js';

export function makeCar(type, x, z, angle, opts = {}) {
  return {
    type, x, z, angle, speed: 0, color: opts.color || type.color,
    police: !!opts.police, taxi: type.id === 'taxi', driver: opts.driver !== false,
    targetSpeed: opts.targetSpeed ?? 9, turnAt: 0, stuck: 0,
    callsign: opts.callsign || null, unit: opts.unit || null,
    condition: 100, health: 100, burning: false, fire: 0,
    wreck: false, explodeTimer: 0, exploded: false, smoke: 0,
  };
}

export function spawnTraffic(rng, count, cx, cz) {
  const cars = [];
  const lines = roadLines();
  const size = citySize();
  for (let i = 0; i < count; i += 1) {
    const type = rng.pick(CAR_TYPES);
    const alongRoad = rng.next() < 0.5;
    const line = lines[rng.int(0, lines.length - 1)];
    const along = clamp((alongRoad ? cx : cz) + rng.range(-90, 90), -size / 2 + 8, size / 2 - 8);
    const x = alongRoad ? along : line;
    const z = alongRoad ? line : along;
    const angle = alongRoad ? (rng.next() < 0.5 ? 0 : Math.PI) : (rng.next() < 0.5 ? Math.PI / 2 : -Math.PI / 2);
    cars.push(makeCar(type, x, z, angle, { targetSpeed: rng.range(7, 12) }));
  }
  return cars;
}

// Traffic: drive along the current road axis, pick a new axis at intersections.
export function stepTraffic(car, dt, rng) {
  if (car.wreck || car.burning) return; // wrecks and burning cars stay put
  const fx = Math.sin(car.angle), fz = Math.cos(car.angle);
  const onXRoad = Math.abs(car.z - nearestRoadCoord(car.z)) < 1.2;
  const onZRoad = Math.abs(car.x - nearestRoadCoord(car.x)) < 1.2;
  if ((onXRoad || onZRoad) && rng.next() < dt * 0.35) {
    const choices = [0, Math.PI / 2, Math.PI, -Math.PI / 2];
    car.angle = choices[rng.int(0, 3)];
  }
  const targetZ = nearestRoadCoord(car.z);
  const targetX = nearestRoadCoord(car.x);
  if (Math.abs(fz) > 0.7) car.x += clamp(targetX - car.x, -dt * 3, dt * 3);
  else car.z += clamp(targetZ - car.z, -dt * 3, dt * 3);
  car.speed = clamp(car.speed + (car.targetSpeed - car.speed) * dt, 0, 14);
  car.x += Math.sin(car.angle) * car.speed * dt;
  car.z += Math.cos(car.angle) * car.speed * dt;
  const half = citySize() / 2 - 4;
  if (Math.abs(car.x) > half || Math.abs(car.z) > half) {
    car.angle += Math.PI;
    car.x = clamp(car.x, -half, half);
    car.z = clamp(car.z, -half, half);
  }
}

// Hurt a car. Returns 'burning' the first time it catches fire, 'exploded'
// when the fire finishes it, or null while it still holds together.
export function damageCar(car, amount) {
  if (!car || car.wreck || car.exploded) return null;
  car.health -= amount;
  car.condition = Math.max(0, car.health);
  if (car.health <= 0 && !car.burning) {
    car.burning = true;
    car.fire = 1;
    car.explodeTimer = 2.5;
    return 'burning';
  }
  if (car.health <= -40 && car.burning) {
    car.exploded = true;
    car.wreck = true;
    car.burning = false;
    car.speed = 0;
    return 'exploded';
  }
  return null;
}

// Advance fire and explosions. Burning cars count down to a blast that
// leaves a smoking wreck; the blast is the event the world loop turns
// into respect, a message, and a bang.
export function stepBurning(cars, dt) {
  const events = [];
  for (const car of cars) {
    if (!car.burning) continue;
    car.fire = Math.max(0, car.fire - dt * 0.15);
    car.explodeTimer -= dt;
    car.health -= dt * 8;
    if (car.explodeTimer <= 0) {
      car.burning = false;
      car.exploded = true;
      car.wreck = true;
      car.speed = 0;
      car.smoke = 1;
      events.push({ type: 'explode', car });
    }
  }
  for (const car of cars) {
    if (car.wreck && car.smoke > 0) car.smoke = Math.max(0, car.smoke - dt * 0.05);
  }
  return events;
}

// Player driving: arcade handling — steer harder at low speed, handbrake drifts.
// stats is the garage-effective stat block (top/accel/brake/grip); when the
// caller passes nothing, the car's base type is used unchanged.
export function stepPlayerCar(car, input, dt, stats) {
  const s = stats || car.type;
  const fwd = input.forward();
  const steer = input.steer();
  if (fwd > 0) car.speed += s.accel * dt;
  else if (fwd < 0) car.speed -= (car.speed > 0.5 ? s.brake : s.accel * 0.6) * dt;
  else car.speed -= Math.sign(car.speed) * Math.min(Math.abs(car.speed), 6 * dt);
  if (input.handbrake()) car.speed -= Math.sign(car.speed) * Math.min(Math.abs(car.speed), 18 * dt);
  car.speed = clamp(car.speed, -s.top * 0.45, s.top);
  const turn = steer * s.grip * dt * clamp(Math.abs(car.speed) / 8, 0, 1) * (car.speed < 0 ? -1 : 1);
  car.angle += turn * (input.handbrake() ? 1.6 : 1);
  car.x += Math.sin(car.angle) * car.speed * dt;
  car.z += Math.cos(car.angle) * car.speed * dt;
  const half = citySize() / 2 + 30;
  car.x = clamp(car.x, -half, half);
  car.z = clamp(car.z, -half, half);
}

export function nearestCar(cars, x, z, maxDist) {
  let best = null, bestD = maxDist * maxDist;
  for (const c of cars) {
    if (c.wreck) continue;
    const d = dist2(c.x, c.z, x, z);
    if (d < bestD) { bestD = d; best = c; }
  }
  return best;
}

// Boxes the engine draws for a car (body + cabin + headlights glow).
// A wreck is a charred, smoking shell; a burning car flickers orange.
export function carBoxes(car, time = 0) {
  if (car.wreck) {
    return [
      { x: car.x, y: 0.45, z: car.z, w: 2.0, h: 0.6, d: 4.4, color: [0.12, 0.1, 0.1], yaw: car.angle },
      { x: car.x, y: 1.0, z: car.z - 0.2, w: 1.7, h: 0.5, d: 2.2, color: [0.08, 0.08, 0.09], yaw: car.angle },
      { x: car.x, y: 2.2 + Math.sin(time * 2) * 0.2, z: car.z, w: 1.4, h: 1.6, d: 1.4, color: [0.25, 0.25, 0.28], yaw: 0 },
      { x: car.x + 0.8, y: 3.6, z: car.z + 0.5, w: 2.0, h: 1.8, d: 2.0, color: [0.35, 0.35, 0.38], yaw: 0 },
    ];
  }
  const c = car.police ? [0.93, 0.93, 0.96] : car.color;
  const boxes = [
    { x: car.x, y: 0.55, z: car.z, w: 2.0, h: 0.75, d: 4.4, color: c, yaw: car.angle },
    { x: car.x, y: 1.15, z: car.z - 0.2, w: 1.7, h: 0.6, d: 2.2, color: [0.08, 0.1, 0.16], yaw: car.angle },
  ];
  if (car.burning) {
    const flick = 0.7 + Math.sin(time * 18) * 0.3;
    boxes.push({ x: car.x, y: 1.6, z: car.z, w: 1.8, h: 1.2, d: 3.6, color: [1, 0.45 * flick, 0.08], yaw: car.angle });
    boxes.push({ x: car.x, y: 2.6, z: car.z, w: 1.0, h: 1.4, d: 1.0, color: [1, 0.75, 0.2], yaw: 0 });
  }
  if (car.police) {
    boxes.push({ x: car.x, y: 1.65, z: car.z - 0.2, w: 0.95, h: 0.45, d: 0.9, color: [0.95, 0.1, 0.2], yaw: car.angle });
    boxes.push({ x: car.x, y: 1.65, z: car.z + 0.5, w: 0.95, h: 0.45, d: 0.5, color: [0.15, 0.4, 1], yaw: car.angle });
    boxes.push({ x: car.x, y: 0.95, z: car.z, w: 2.1, h: 0.2, d: 4.5, color: [0.85, 0.85, 0.9], yaw: car.angle });
  } else if (car.taxi) {
    boxes.push({ x: car.x, y: 1.55, z: car.z, w: 0.9, h: 0.25, d: 0.5, color: [0.95, 0.85, 0.1], yaw: car.angle });
  }
  return boxes;
}
export { angleLerp, wrapAngle };
