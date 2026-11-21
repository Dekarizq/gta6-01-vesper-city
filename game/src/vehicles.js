// vehicles.js — cars for Sunset Kings (v4): the player's car, traffic AI,
// stealing, and the new damage model. Every car has health: shoot it,
// ram it, or slam it into a tower and it starts to burn; keep hurting it
// and it explodes, leaving a smoking wreck that stays on the road. Police
// cruisers are white with a red/blue light bar so they read clearly
// against warm golden-hour roads, and each carries a named VCPD unit.
// Garage upgrades change the player's car for real: engine raises top
// speed and pull, tyres raise grip, NITRO fires a launch boost from a
// standstill — stepPlayerCar takes the effective stats the garage
// computed, never the base type alone. v4 also adds flat tyres from
// spike strips (top speed and grip collapse until Rook patches them),
// the Coast Cruiser convertible (open top, no cabin box), and real car
// detail: wheels, headlights, taillights and a long sunset shadow.
import { CAR_TYPES } from './config.js';
import { clamp, dist2, angleLerp, wrapAngle } from './random.js';
import { nearestRoadCoord, roadLines, citySize } from './city.js';
import { tyrePenalty } from './spikestrip.js';
import { carPaint } from './textures.js';

export function makeCar(type, x, z, angle, opts = {}) {
  return {
    type, x, z, angle, speed: 0, color: opts.color || type.color,
    police: !!opts.police, taxi: type.id === 'taxi', driver: opts.driver !== false,
    targetSpeed: opts.targetSpeed ?? 9, turnAt: 0, stuck: 0,
    callsign: opts.callsign || null, unit: opts.unit || null,
    condition: 100, health: 100, burning: false, fire: 0,
    wreck: false, explodeTimer: 0, exploded: false, smoke: 0,
    // v4: flat tyre state from spike strips, and the nitro launch timer.
    flatTyre: false, flatTimer: 0, tyreSide: 0, nitroBoost: 0,
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
// v4: a flat tyre (spike strip) cuts top speed to 55% and grip to 60%
// and pulls the car to one side; NITRO fires a launch boost while the
// car is near standstill and the driver floors it.
export function stepPlayerCar(car, input, dt, stats) {
  const s = stats || car.type;
  const pen = tyrePenalty(car);
  const fwd = input.forward();
  const steer = input.steer();
  // NITRO launch: from a standstill, flooring it adds the launch bonus
  // for the first second of the run, then fades.
  let accel = s.accel;
  if ((s.nitroLaunch || 0) > 0 && fwd > 0 && Math.abs(car.speed) < 6) {
    car.nitroBoost = Math.min(1, (car.nitroBoost || 0) + dt * 2);
    accel += s.nitroLaunch * car.nitroBoost;
  } else {
    car.nitroBoost = Math.max(0, (car.nitroBoost || 0) - dt * 1.5);
  }
  if (fwd > 0) car.speed += accel * dt;
  else if (fwd < 0) car.speed -= (car.speed > 0.5 ? s.brake : accel * 0.6) * dt;
  else car.speed -= Math.sign(car.speed) * Math.min(Math.abs(car.speed), 6 * dt);
  if (input.handbrake()) car.speed -= Math.sign(car.speed) * Math.min(Math.abs(car.speed), 18 * dt);
  const top = s.top * pen.top;
  car.speed = clamp(car.speed, -top * 0.45, top);
  const grip = (s.grip || car.type.grip) * pen.grip;
  const turn = steer * grip * dt * clamp(Math.abs(car.speed) / 8, 0, 1) * (car.speed < 0 ? -1 : 1);
  car.angle += turn * (input.handbrake() ? 1.6 : 1);
  // A flat tyre pulls the car sideways, toward the burst side.
  if (car.flatTyre && Math.abs(car.speed) > 4) car.angle += pen.pull * 0.12 * dt * Math.abs(car.speed) / 10;
  car.x += Math.sin(car.angle) * car.speed * dt;
  car.z += Math.cos(car.angle) * car.speed * dt;
  // v4 coast driving: cars can drive onto the beach as far as the boat
  // dock (beachZ + 40) — beach driving is a GTA tradition — but not out
  // to the pier end, which is a foot walkway (mission 11's finale).
  const half = citySize() / 2 + 30;
  const beachEdge = citySize() / 2 + 18 + 40;
  car.x = clamp(car.x, -half, half);
  car.z = clamp(car.z, -half, beachEdge);
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
// v4 detail: four wheels with bright rims, two headlights and two red
// taillights, a long sunset shadow stretched east, and the Coast
// Cruiser convertible shows an open top (no cabin box) with two seats.
// A flat tyre leans the car to the burst side and puffs grey smoke.
// v5: every type has a real length (the limo is long, the bus is very
// long, the hatch is short), metallic paint from textures.js, and
// type-specific trim — a spoiler on the sports car, a roof rack on
// the pickup, a gold stripe on the limo, big windows on the bus.
export function carBoxes(car, time = 0) {
  if (car.wreck) {
    return [
      { x: car.x, y: 0.45, z: car.z, w: 2.0, h: 0.6, d: 4.4, color: [0.12, 0.1, 0.1], yaw: car.angle },
      { x: car.x, y: 1.0, z: car.z - 0.2, w: 1.7, h: 0.5, d: 2.2, color: [0.08, 0.08, 0.09], yaw: car.angle },
      { x: car.x, y: 2.2 + Math.sin(time * 2) * 0.2, z: car.z, w: 1.4, h: 1.6, d: 1.4, color: [0.25, 0.25, 0.28], yaw: 0 },
      { x: car.x + 0.8, y: 3.6, z: car.z + 0.5, w: 2.0, h: 1.8, d: 2.0, color: [0.35, 0.35, 0.38], yaw: 0 },
    ];
  }
  const len = (car.type && car.type.len) || 4.4;
  const half = len / 2;
  const paint = carPaint(car.type ? car.type.id : 'sedan');
  const c = car.police ? [0.93, 0.93, 0.96] : (car.color || paint.body);
  const fx = Math.sin(car.angle), fz = Math.cos(car.angle);
  const rx = Math.cos(car.angle), rz = -Math.sin(car.angle);
  const lean = car.flatTyre ? (car.tyreSide || 1) * 0.06 : 0;
  const boxes = [
    // Long sunset shadow, stretched east away from the low sun.
    { x: car.x + 1.6, y: 0.06, z: car.z + 0.35, w: 2.6, h: 0.08, d: len + 0.8, color: [0.14, 0.1, 0.08], yaw: car.angle },
    { x: car.x, y: 0.55, z: car.z, w: 2.0, h: 0.75, d: len, color: c, yaw: car.angle + lean },
    // Metallic trim stripe along the side, so the body is not one
    // flat colour — the paint's trim colour at the belt line.
    { x: car.x, y: 0.85, z: car.z, w: 2.06, h: 0.16, d: len * 0.8, color: paint.trim, yaw: car.angle },
  ];
  // Convertible: open top with two seats, no cabin box.
  if (car.type && car.type.id === 'convertible') {
    boxes.push({ x: car.x, y: 1.0, z: car.z - 0.5, w: 0.7, h: 0.5, d: 0.7, color: [0.9, 0.85, 0.8], yaw: car.angle });
    boxes.push({ x: car.x, y: 1.0, z: car.z + 0.5, w: 0.7, h: 0.5, d: 0.7, color: [0.9, 0.85, 0.8], yaw: car.angle });
    boxes.push({ x: car.x, y: 1.05, z: car.z, w: 1.6, h: 0.35, d: 3.6, color: [0.15, 0.12, 0.14], yaw: car.angle });
  } else {
    boxes.push({ x: car.x, y: 1.15, z: car.z - 0.2, w: 1.7, h: 0.6, d: Math.min(2.4, len * 0.55), color: paint.glass, yaw: car.angle });
  }
  // v5 type trim: spoiler on the sports car, roof rack on the pickup,
  // gold stripe on the limo, big side windows on the bus.
  if (car.type && car.type.id === 'sports') {
    boxes.push({ x: car.x - fx * (half + 0.1), y: 1.25, z: car.z - fz * (half + 0.1), w: 1.9, h: 0.16, d: 0.5, color: [0.08, 0.08, 0.1], yaw: car.angle });
  }
  if (car.type && car.type.id === 'pickup') {
    boxes.push({ x: car.x, y: 1.35, z: car.z - 0.6, w: 1.7, h: 0.18, d: 1.8, color: [0.2, 0.2, 0.22], yaw: car.angle });
  }
  if (car.type && car.type.id === 'limo') {
    boxes.push({ x: car.x, y: 0.95, z: car.z, w: 2.06, h: 0.14, d: len * 0.9, color: [0.85, 0.7, 0.3], yaw: car.angle });
  }
  if (car.type && car.type.id === 'bus') {
    boxes.push({ x: car.x, y: 1.25, z: car.z, w: 1.9, h: 0.7, d: len * 0.7, color: paint.glass, yaw: car.angle });
  }
  // v6: the Storm Chaser 4x4 wears a roof rack, a snorkel, and an
  // amber light bar — the truck that works the flooded harbour roads.
  if (car.type && car.type.id === 'storm4x4') {
    boxes.push({ x: car.x, y: 1.45, z: car.z - 0.4, w: 1.7, h: 0.16, d: 1.9, color: [0.2, 0.2, 0.22], yaw: car.angle });
    boxes.push({ x: car.x + 0.7, y: 1.1, z: car.z + 0.8, w: 0.18, h: 0.9, d: 0.18, color: [0.15, 0.15, 0.18], yaw: car.angle });
    boxes.push({ x: car.x, y: 1.62, z: car.z - 0.2, w: 1.2, h: 0.3, d: 0.4, color: [1, 0.65, 0.15], yaw: car.angle });
  }
  // Four wheels with bright rims, two headlights, two taillights.
  for (const [wx, wz] of [[-0.95, half - 0.7], [0.95, half - 0.7], [-0.95, -(half - 0.7)], [0.95, -(half - 0.7)]]) {
    boxes.push({
      x: car.x + rx * wx + fx * wz, y: 0.32, z: car.z + rz * wx + fz * wz,
      w: 0.28, h: 0.64, d: 0.64, color: [0.08, 0.08, 0.1], yaw: car.angle,
    });
    boxes.push({
      x: car.x + rx * wx * 1.12 + fx * wz, y: 0.32, z: car.z + rz * wx * 1.12 + fz * wz,
      w: 0.1, h: 0.4, d: 0.4, color: paint.rim, yaw: car.angle,
    });
  }
  boxes.push({ x: car.x - rx * 0.6 + fx * (half + 0.05), y: 0.6, z: car.z - rz * 0.6 + fz * (half + 0.05), w: 0.5, h: 0.3, d: 0.15, color: [1, 0.95, 0.7], yaw: car.angle });
  boxes.push({ x: car.x + rx * 0.6 + fx * (half + 0.05), y: 0.6, z: car.z + rz * 0.6 + fz * (half + 0.05), w: 0.5, h: 0.3, d: 0.15, color: [1, 0.95, 0.7], yaw: car.angle });
  boxes.push({ x: car.x - rx * 0.6 - fx * (half + 0.05), y: 0.65, z: car.z - rz * 0.6 - fz * (half + 0.05), w: 0.5, h: 0.28, d: 0.15, color: [0.9, 0.1, 0.15], yaw: car.angle });
  boxes.push({ x: car.x + rx * 0.6 - fx * (half + 0.05), y: 0.65, z: car.z + rz * 0.6 - fz * (half + 0.05), w: 0.5, h: 0.28, d: 0.15, color: [0.9, 0.1, 0.15], yaw: car.angle });
  // Nitro flame when the launch boost is firing.
  if ((car.nitroBoost || 0) > 0.3) {
    boxes.push({ x: car.x - fx * 2.6, y: 0.7, z: car.z - fz * 2.6, w: 0.8, h: 0.8, d: 0.8, color: [1, 0.55, 0.1], yaw: 0 });
  }
  // Flat tyre: grey smoke puff from the burst corner.
  if (car.flatTyre) {
    boxes.push({ x: car.x + rx * (car.tyreSide || 1) * 1.1, y: 1.2 + Math.sin(time * 5) * 0.2, z: car.z, w: 1.0, h: 1.0, d: 1.0, color: [0.5, 0.5, 0.52], yaw: 0 });
  }
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
