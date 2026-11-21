// spikestrip.js — VCPD spike strips for Sunset Kings v4. At wanted
// 4 and above, the new SPIKE unit (VCPD-52, Ofc. Duarte) stops chasing
// and lays a strip across the road ahead of Mara instead. Drive over
// it and the tyres go: top speed and grip collapse, the car pulls to
// one side, and the HUD warns you to limp to the garage — a flat tyre
// is repaired free at the Sunset Garage, or by buying any upgrade.
// Strips are a real tactic, not scenery: they sit on the road the
// player is actually driving down, they expire after a while, and the
// police only carry three at a time. Pure logic plus render boxes.
import { dist2, clamp } from './random.js';

export const SPIKE_MAX_ACTIVE = 3;
export const SPIKE_LIFETIME = 25; // seconds before a laid strip is collected
export const SPIKE_FLAT_TIME = 20; // seconds a flat tyre lasts without repair
export const SPIKE_HIT_RADIUS = 3.2;

export function createSpikeStrips() {
  return {
    strips: [], // {x, z, angle, unit, laidAt, used}
    laid: 0, // total strips laid this game
    hits: 0, // total cars spiked
    escapes: 0, // times the player drove past a strip without hitting it
  };
}

// Lay a strip across the road ahead of the player, at the point the
// SPIKE unit chose. Returns the strip, or null when the road is
// already full of strips.
export function deployStrip(strips, x, z, angle, unit, now) {
  const live = strips.strips.filter((s) => !s.used && now - s.laidAt < SPIKE_LIFETIME);
  if (live.length >= SPIKE_MAX_ACTIVE) return null;
  const strip = { x, z, angle, unit: unit || 'VCPD-52', laidAt: now, used: false };
  strips.strips.push(strip);
  strips.laid += 1;
  return strip;
}

// Step the strips: expire old ones, and check every car (player and
// traffic) against every live strip. A hit bursts the car's tyres —
// the car keeps rolling, but slow and wobbling — and the strip is
// spent. Returns the hit events, in order.
export function updateStrips(strips, cars, now, dt, weather) {
  const events = [];
  // Expire strips that have sat too long. v6: a storm washes them
  // away twice as fast — the flood lifts the spikes off the road.
  const lifetime = weather && weather.phase === 'storm' ? SPIKE_LIFETIME / 2 : SPIKE_LIFETIME;
  for (const s of strips.strips) {
    if (!s.used && now - s.laidAt > lifetime) s.used = true;
  }
  strips.strips = strips.strips.filter((s) => !s.used || now - s.laidAt < lifetime + 2);
  for (const strip of strips.strips) {
    if (strip.used) continue;
    for (const car of cars) {
      if (!car || car.wreck || car.flatTyre) continue;
      if (dist2(car.x, car.z, strip.x, strip.z) < SPIKE_HIT_RADIUS * SPIKE_HIT_RADIUS) {
        strip.used = true;
        car.flatTyre = true;
        car.flatTimer = SPIKE_FLAT_TIME;
        car.tyreSide = Math.random() < 0.5 ? -1 : 1;
        strips.hits += 1;
        events.push({ type: 'spiked', car, strip });
        break; // one car per strip
      }
    }
  }
  return events;
}

// Tick flat-tyre timers down. A repaired tyre (garage) or an expired
// timer clears the flat — the timer is the limp-home window.
export function stepFlatTyres(cars, dt) {
  for (const car of cars) {
    if (!car.flatTyre) continue;
    car.flatTimer = (car.flatTimer || 0) - dt;
    if (car.flatTimer <= 0) {
      car.flatTyre = false;
      car.flatTimer = 0;
      car.tyreSide = 0;
    }
  }
}

// Repair a flat tyre — free at the Sunset Garage, where Rook patches
// it while he tunes the car.
export function repairTyre(car) {
  if (!car || !car.flatTyre) return false;
  car.flatTyre = false;
  car.flatTimer = 0;
  car.tyreSide = 0;
  return true;
}

// The driving penalty of a flat tyre: top speed and grip multipliers.
// A spiked car is not dead — it is slow, and the police know it.
export function tyrePenalty(car) {
  if (!car || !car.flatTyre) return { top: 1, grip: 1, pull: 0 };
  return { top: 0.55, grip: 0.6, pull: car.tyreSide || 1 };
}

// The nearest live strip to the player, for the HUD warning ("SPIKE
// STRIP AHEAD") and the GPS.
export function nearestStrip(strips, x, z, now) {
  let best = null;
  let bestD = Infinity;
  for (const s of strips.strips) {
    if (s.used || now - s.laidAt > SPIKE_LIFETIME) continue;
    const d = dist2(x, z, s.x, s.z);
    if (d < bestD) { bestD = d; best = s; }
  }
  return best ? { ...best, dist: Math.sqrt(bestD) } : null;
}

// Render boxes: a dark strip across the road with bright spike teeth,
// plus a small warning triangle that bobs above it so the player can
// see it coming at speed.
export function stripBoxes(strips, time, now) {
  const out = [];
  for (const s of strips.strips) {
    if (s.used || now - s.laidAt > SPIKE_LIFETIME) continue;
    const blink = 0.7 + Math.sin(time * 6) * 0.3;
    out.push({ x: s.x, y: 0.25, z: s.z, w: 4.6, h: 0.25, d: 1.1, color: [0.12, 0.12, 0.14], yaw: s.angle });
    for (let i = -2; i <= 2; i += 1) {
      out.push({
        x: s.x + Math.cos(s.angle) * i * 0.9,
        y: 0.55, z: s.z - Math.sin(s.angle) * i * 0.9,
        w: 0.28, h: 0.6, d: 0.28, color: [0.95 * blink, 0.9 * blink, 0.7], yaw: 0,
      });
    }
    out.push({
      x: s.x, y: 2.0 + Math.sin(time * 3) * 0.25, z: s.z,
      w: 1.1, h: 1.1, d: 1.1, color: [1, 0.75, 0.1], yaw: time,
    });
    // v5: red end lights, blinking in turn, so the strip reads as a
    // police trap from down the road instead of a dark bar.
    const alt = Math.sin(time * 6) > 0;
    out.push({ x: s.x + Math.cos(s.angle) * 2.6, y: 0.5, z: s.z - Math.sin(s.angle) * 2.6, w: 0.4, h: 0.5, d: 0.4, color: alt ? [1, 0.1, 0.15] : [0.4, 0.05, 0.08], yaw: 0 });
    out.push({ x: s.x - Math.cos(s.angle) * 2.6, y: 0.5, z: s.z + Math.sin(s.angle) * 2.6, w: 0.4, h: 0.5, d: 0.4, color: alt ? [0.4, 0.05, 0.08] : [1, 0.1, 0.15], yaw: 0 });
  }
  return out;
}

export function spikesSave(strips) {
  return { laid: strips.laid, hits: strips.hits, escapes: strips.escapes };
}

export function spikesLoad(strips, data) {
  if (!data) return strips;
  if (Number.isInteger(data.laid)) strips.laid = Math.max(0, data.laid);
  if (Number.isInteger(data.hits)) strips.hits = Math.max(0, data.hits);
  if (Number.isInteger(data.escapes)) strips.escapes = Math.max(0, data.escapes);
  return strips;
}
