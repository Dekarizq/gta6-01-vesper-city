// vehicles.js — cars: the player's car, traffic AI, and stealing.
// Cars live on the 2D ground plane (x,z,angle,speed); the engine draws them
// as 3D boxes. Traffic follows the road grid and turns at intersections.
import { CAR_TYPES } from './config.js';
import { clamp, dist2, angleLerp } from './random.js';
import { nearestRoadCoord, roadLines, citySize } from './city.js';

export function makeCar(type, x, z, angle, opts = {}) {
  return {
    type, x, z, angle, speed: 0, color: opts.color || type.color,
    police: !!opts.police, taxi: type.id === 'taxi', driver: opts.driver !== false,
    targetSpeed: opts.targetSpeed ?? 9, turnAt: 0, stuck: 0,
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
  const fx = Math.sin(car.angle), fz = Math.cos(car.angle);
  const onXRoad = Math.abs(car.z - nearestRoadCoord(car.z)) < 1.2;
  const onZRoad = Math.abs(car.x - nearestRoadCoord(car.x)) < 1.2;
  if ((onXRoad || onZRoad) && rng.next() < dt * 0.35) {
    const choices = [0, Math.PI / 2, Math.PI, -Math.PI / 2];
    car.angle = choices[rng.int(0, 3)];
  }
  // Snap gently back onto the road centre.
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

// Player driving: arcade handling — steer harder at low speed, handbrake drifts.
export function stepPlayerCar(car, input, dt) {
  const fwd = input.forward();
  const steer = input.steer();
  if (fwd > 0) car.speed += car.type.accel * dt;
  else if (fwd < 0) car.speed -= (car.speed > 0.5 ? car.type.brake : car.type.accel * 0.6) * dt;
  else car.speed -= Math.sign(car.speed) * Math.min(Math.abs(car.speed), 6 * dt);
  if (input.handbrake()) car.speed -= Math.sign(car.speed) * Math.min(Math.abs(car.speed), 18 * dt);
  car.speed = clamp(car.speed, -car.type.top * 0.45, car.type.top);
  const turn = steer * car.type.grip * dt * clamp(Math.abs(car.speed) / 8, 0, 1) * (car.speed < 0 ? -1 : 1);
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
    const d = dist2(c.x, c.z, x, z);
    if (d < bestD) { bestD = d; best = c; }
  }
  return best;
}

// Boxes the engine draws for a car (body + cabin + headlights glow).
export function carBoxes(car) {
  const c = car.police ? [0.25, 0.3, 0.48] : car.color;
  const boxes = [
    { x: car.x, y: 0.55, z: car.z, w: 2.0, h: 0.75, d: 4.4, color: c, yaw: car.angle },
    { x: car.x, y: 1.15, z: car.z - 0.2, w: 1.7, h: 0.6, d: 2.2, color: [0.08, 0.1, 0.16], yaw: car.angle },
  ];
  if (car.police) {
    boxes.push({ x: car.x, y: 1.65, z: car.z - 0.2, w: 0.95, h: 0.45, d: 0.9, color: [0.95, 0.1, 0.2], yaw: car.angle });
    boxes.push({ x: car.x, y: 1.65, z: car.z + 0.5, w: 0.95, h: 0.45, d: 0.5, color: [0.15, 0.4, 1], yaw: car.angle });
    boxes.push({ x: car.x, y: 0.95, z: car.z, w: 2.1, h: 0.2, d: 4.5, color: [0.85, 0.85, 0.9], yaw: car.angle });
  } else if (car.taxi) {
    boxes.push({ x: car.x, y: 1.55, z: car.z, w: 0.9, h: 0.25, d: 0.5, color: [0.95, 0.85, 0.1], yaw: car.angle });
  }
  return boxes;
}
export { angleLerp };
