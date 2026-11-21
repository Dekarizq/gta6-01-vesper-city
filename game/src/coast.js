// coast.js — the Sunset Beach coast for Sunset Kings v6. Vesper City
// always had a beach on its south shore, but v3 never let you play on
// it: the sand was scenery. V4 turns it into a place: a wooden pier
// running out over the sunset water, a boardwalk with stalls, a boat
// dock with bobbing boats, a lifeguard tower, surfers and sunbathers,
// and the tide itself breathing in and out. Missions 11 and 12 run
// here, the new side jobs start here, and the coast is a district of
// its own on the HUD and the map. v6: the storm surge swells the tide
// and the boats pitch harder when the hurricane front arrives, and the
// surfers get out of the water when it does. Pure logic plus render
// boxes; the engine draws the static sand and water, this module adds
// everything that moves or stands on it.
import { citySize } from './city.js';
import { clamp, dist2 } from './random.js';

// The coast band: everything south of this z is sand, pier and sea.
export function coastBandZ(city) {
  return city.size / 2 + 4;
}

export function createCoast(city) {
  const size = city.size;
  const beachZ = size / 2 + 18;
  const seaZ = size / 2 + 60;
  // Named places on the coast, all reachable on foot or by car on the
  // beach road. The pier runs south from the boardwalk into the sea.
  const points = {
    pierEnd: { x: -20, z: seaZ + 22, name: 'End of the Pier' },
    pierMid: { x: -20, z: beachZ + 26, name: 'Pier Midway' },
    boardwalk: { x: 60, z: beachZ + 2, name: 'Sunset Boardwalk' },
    boatDock: { x: 110, z: beachZ + 38, name: 'Boat Dock' },
    surfShack: { x: -90, z: beachZ - 2, name: 'Surf Shack' },
    lifeguard: { x: 10, z: beachZ + 4, name: 'Lifeguard Tower' },
    beachBar: { x: 140, z: beachZ - 4, name: 'Tide Bar' },
  };
  // Five boats at the dock, each with its own bob phase and heading.
  const boats = [];
  for (let i = 0; i < 5; i += 1) {
    boats.push({
      x: 96 + i * 8,
      z: beachZ + 44 + (i % 2) * 7,
      angle: (i % 2 === 0 ? 0.25 : -0.2) + i * 0.12,
      phase: i * 1.3,
      hull: [
        [0.75, 0.45, 0.25],
        [0.9, 0.65, 0.3],
        [0.25, 0.55, 0.75],
        [0.95, 0.8, 0.35],
        [0.55, 0.35, 0.65],
      ][i],
      sail: i % 2 === 0,
    });
  }
  // Beachgoers: sunbathers lying on towels, walkers on the sand, and
  // two surfers who paddle out and back on a slow loop.
  const beachgoers = [];
  const towels = [
    [1, 0.45, 0.3], [0.3, 0.7, 0.95], [0.95, 0.8, 0.3],
    [0.75, 0.5, 0.95], [0.4, 0.85, 0.5], [0.95, 0.55, 0.2],
  ];
  for (let i = 0; i < 10; i += 1) {
    beachgoers.push({
      x: -size / 2 + 40 + i * 26 + (i % 3) * 5,
      z: beachZ + (i % 4) * 5 - 4,
      angle: (i * 0.7) % (Math.PI * 2),
      shirt: towels[i % towels.length],
      kind: i < 5 ? 'sunbathe' : 'walk',
      bob: i * 0.9,
      speed: 0,
    });
  }
  for (let i = 0; i < 2; i += 1) {
    beachgoers.push({
      x: -60 + i * 90,
      z: seaZ - 8,
      angle: Math.PI,
      shirt: [0.2, 0.85, 0.85],
      kind: 'surf',
      bob: i * 2.1,
      speed: 2.2,
      surfT: i * 14,
    });
  }
  return {
    city, size, beachZ, seaZ, points, boats, beachgoers,
    tide: 0, time: 0,
    // v5: two sailboats that actually sail across the sea, east to
    // west, on a slow loop — the only moving traffic on the water.
    sailboats: [
      { x: -160, z: seaZ + 34, speed: 3.0, phase: 0, hull: [0.9, 0.9, 0.92] },
      { x: 40, z: seaZ + 52, speed: 2.4, phase: 30, hull: [0.95, 0.75, 0.3] },
    ],
    // Surfboards leaning on the lifeguard tower and the shack.
    surfboards: [
      { x: 12, z: beachZ + 6, color: [1, 0.45, 0.3], lean: 0.3 },
      { x: -88, z: beachZ, color: [0.3, 0.7, 0.95], lean: -0.25 },
      { x: -86, z: beachZ + 3, color: [0.95, 0.8, 0.3], lean: 0.2 },
    ],
  };
}

// The tide breathes: -1 (low) to +1 (high) on a slow 90-second cycle.
// The water boxes rise and fall a little with it, and the surf line
// moves — a small thing, but it makes the sea feel alive instead of
// painted on.
export function tideLevel(coast, time) {
  const t = Math.sin(time * (Math.PI * 2 / 90));
  coast.tide = t;
  return t;
}

// Storm surge: how much higher the tide runs in the hurricane front
// (0 in gold weather, up to +1 when the storm is overhead). The water
// boxes and the boat bob read this through the tide.
export function stormSurge(weather) {
  if (!weather) return 0;
  return weather.phase === 'storm' ? 1 : weather.stormFront > 0.8 ? 0.5 : 0;
}

export function stepCoast(coast, dt, player, weather) {
  coast.time += dt;
  coast.surge = stormSurge(weather);
  tideLevel(coast, coast.time);
  // v5: the sailboats cross the sea, east to west, and wrap around.
  // v6: in a storm they reef and slow — nobody sails into a hurricane.
  const sailFactor = weather && weather.phase === 'storm' ? 0.4 : 1;
  for (const s of coast.sailboats || []) {
    s.x += s.speed * sailFactor * dt;
    if (s.x > 260) s.x = -260;
  }
  // Surfers paddle out to sea and drift back, on a 40-second loop.
  for (const s of coast.beachgoers) {
    if (s.kind !== 'surf') continue;
    s.surfT = (s.surfT || 0) + dt;
    const cyc = (s.surfT % 40) / 40;
    // Out for the first half, back for the second half.
    const dir = cyc < 0.5 ? 1 : -1;
    s.z += dir * s.speed * dt;
    s.z = clamp(s.z, coast.seaZ - 30, coast.seaZ + 12);
    s.x += Math.sin(coast.time * 0.5 + s.bob) * dt * 0.8;
    s.bob += dt;
  }
  // Walkers stroll along the sand; sunbathers stay put and tan.
  for (const b of coast.beachgoers) {
    if (b.kind !== 'walk') continue;
    b.bob += dt;
    if (Math.random() < dt * 0.1) b.angle += (Math.random() - 0.5) * 1.6;
    b.x += Math.sin(b.angle) * 1.4 * dt;
    b.z += Math.cos(b.angle) * 1.4 * dt;
    b.x = clamp(b.x, -coast.size / 2 + 8, coast.size / 2 - 8);
    b.z = clamp(b.z, coast.beachZ - 12, coast.beachZ + 14);
    // A walker who wanders into the player steps aside, fast.
    if (player && dist2(b.x, b.z, player.x, player.z) < 9) {
      b.angle = Math.atan2(b.x - player.x, b.z - player.z);
      b.x += Math.sin(b.angle) * 3 * dt;
      b.z += Math.cos(b.angle) * 3 * dt;
    }
  }
  return coast;
}

export function isOnCoast(coast, x, z) {
  return z > coastBandZ(coast.city) - 6;
}

export function coastNameAt(coast, x, z) {
  if (!isOnCoast(coast, x, z)) return null;
  if (z > coast.seaZ - 10) return 'Sunset Sea';
  if (Math.abs(x - coast.points.pierEnd.x) < 14 && z > coast.beachZ + 10) return 'Sunset Pier';
  if (Math.abs(x - coast.points.boardwalk.x) < 40) return 'Sunset Boardwalk';
  if (Math.abs(x - coast.points.boatDock.x) < 30) return 'Boat Dock';
  return 'Sunset Beach';
}

// The nearest named coast place to (x,z), for mission text and the HUD.
export function nearestCoastPoint(coast, x, z) {
  let best = null;
  let bestD = Infinity;
  for (const key of Object.keys(coast.points)) {
    const p = coast.points[key];
    const d = dist2(x, z, p.x, p.z);
    if (d < bestD) { bestD = d; best = { key, ...p, dist: Math.sqrt(d) }; }
  }
  return best;
}

// Render boxes for the coast: the pier deck on stilts, the boardwalk
// stalls, the boats with masts and sails, the lifeguard tower, the
// surfboards, and the beachgoers themselves. The sea gets a bright
// sun-lane that slides with the tide.
export function coastBoxes(coast, time) {
  const out = [];
  const tide = coast.tide || 0;
  // Pier deck: planks running south from the beach into the sea, on
  // stilts so the water shows underneath.
  for (let i = 0; i < 12; i += 1) {
    const z = coast.beachZ + 8 + i * 5;
    out.push({
      x: coast.points.pierEnd.x, y: 1.1, z, w: 7, h: 0.4, d: 4.6,
      color: i % 2 === 0 ? [0.55, 0.38, 0.22] : [0.5, 0.34, 0.2], yaw: 0,
    });
  }
  for (let i = 0; i < 6; i += 1) {
    const z = coast.beachZ + 10 + i * 10;
    out.push({ x: coast.points.pierEnd.x - 3.2, y: 0.4, z, w: 0.5, h: 1.0, d: 0.5, color: [0.4, 0.28, 0.16], yaw: 0 });
    out.push({ x: coast.points.pierEnd.x + 3.2, y: 0.4, z, w: 0.5, h: 1.0, d: 0.5, color: [0.4, 0.28, 0.16], yaw: 0 });
  }
  // Pier end platform + lamp posts with warm bulbs.
  out.push({ x: coast.points.pierEnd.x, y: 1.1, z: coast.points.pierEnd.z, w: 12, h: 0.4, d: 10, color: [0.58, 0.4, 0.24], yaw: 0 });
  out.push({ x: coast.points.pierEnd.x - 5, y: 3.4, z: coast.points.pierEnd.z - 4, w: 0.3, h: 3.4, d: 0.3, color: [0.2, 0.2, 0.22], yaw: 0 });
  out.push({ x: coast.points.pierEnd.x - 5, y: 5.2, z: coast.points.pierEnd.z - 4, w: 0.9, h: 0.9, d: 0.9, color: [1, 0.9, 0.5], yaw: 0 });
  out.push({ x: coast.points.pierEnd.x + 5, y: 3.4, z: coast.points.pierEnd.z - 4, w: 0.3, h: 3.4, d: 0.3, color: [0.2, 0.2, 0.22], yaw: 0 });
  out.push({ x: coast.points.pierEnd.x + 5, y: 5.2, z: coast.points.pierEnd.z - 4, w: 0.9, h: 0.9, d: 0.9, color: [1, 0.9, 0.5], yaw: 0 });
  // Boardwalk: a long deck with three stalls (striped awnings).
  const bw = coast.points.boardwalk;
  out.push({ x: bw.x, y: 0.7, z: bw.z, w: 70, h: 0.5, d: 10, color: [0.62, 0.44, 0.26], yaw: 0 });
  const stallColors = [[1, 0.45, 0.3], [0.3, 0.7, 0.95], [0.95, 0.8, 0.3]];
  for (let i = 0; i < 3; i += 1) {
    const sx = bw.x - 24 + i * 24;
    out.push({ x: sx, y: 2.2, z: bw.z, w: 9, h: 2.6, d: 6, color: [0.5, 0.36, 0.22], yaw: 0 });
    out.push({ x: sx, y: 3.8, z: bw.z, w: 10, h: 0.5, d: 7, color: stallColors[i], yaw: 0 });
  }
  // Lifeguard tower: legs, cabin, roof.
  const lg = coast.points.lifeguard;
  out.push({ x: lg.x, y: 1.6, z: lg.z, w: 0.4, h: 3.2, d: 0.4, color: [0.85, 0.85, 0.88], yaw: 0 });
  out.push({ x: lg.x + 2.4, y: 1.6, z: lg.z, w: 0.4, h: 3.2, d: 0.4, color: [0.85, 0.85, 0.88], yaw: 0 });
  out.push({ x: lg.x + 1.2, y: 3.6, z: lg.z, w: 3.4, h: 1.8, d: 3.0, color: [0.95, 0.95, 0.96], yaw: 0 });
  out.push({ x: lg.x + 1.2, y: 4.8, z: lg.z, w: 4.2, h: 0.3, d: 3.8, color: [1, 0.45, 0.3], yaw: 0 });
  // Boats: hull, mast, sail where rigged, bobbing with the tide.
  for (const boat of coast.boats) {
    const bob = Math.sin(time * 1.2 + boat.phase) * 0.25 + tide * 0.2;
    out.push({ x: boat.x, y: 0.5 + bob, z: boat.z, w: 3.2, h: 1.1, d: 7.5, color: boat.hull, yaw: boat.angle });
    out.push({ x: boat.x, y: 1.4 + bob, z: boat.z, w: 2.2, h: 0.8, d: 5.5, color: [0.92, 0.88, 0.8], yaw: boat.angle });
    if (boat.sail) {
      out.push({ x: boat.x, y: 4.2 + bob, z: boat.z - 0.5, w: 0.25, h: 6.5, d: 0.25, color: [0.4, 0.3, 0.2], yaw: 0 });
      out.push({ x: boat.x, y: 4.6 + bob, z: boat.z - 0.5, w: 3.6, h: 4.4, d: 0.2, color: [0.98, 0.94, 0.86], yaw: boat.angle });
    } else {
      out.push({ x: boat.x, y: 3.4 + bob, z: boat.z, w: 0.25, h: 4.5, d: 0.25, color: [0.4, 0.3, 0.2], yaw: 0 });
    }
  }
  // Sun lane on the water, sliding with the tide.
  out.push({
    x: -40 + tide * 6, y: 0.15, z: coast.seaZ + 6, w: 46, h: 0.08, d: 60,
    color: [1, 0.72, 0.32], yaw: 0,
  });
  // v5: the sailing boats, hull + mast + sail, bobbing as they cross.
  for (const sb of coast.sailboats || []) {
    const bob = Math.sin(time * 1.3 + sb.phase) * 0.3;
    out.push({ x: sb.x, y: 0.6 + bob, z: sb.z, w: 3.4, h: 1.2, d: 8, color: sb.hull, yaw: 0.1 });
    out.push({ x: sb.x, y: 4.4 + bob, z: sb.z - 0.5, w: 0.25, h: 6.5, d: 0.25, color: [0.4, 0.3, 0.2], yaw: 0 });
    out.push({ x: sb.x, y: 4.8 + bob, z: sb.z - 0.5, w: 3.8, h: 4.6, d: 0.2, color: [0.98, 0.94, 0.86], yaw: 0.1 });
  }
  // Surfboards leaning by the tower and the shack.
  for (const sb of coast.surfboards) {
    out.push({ x: sb.x, y: 1.6, z: sb.z, w: 0.7, h: 3.4, d: 0.18, color: sb.color, yaw: sb.lean });
  }
  // Beachgoers: sunbathers flat on towels, walkers upright, surfers
  // standing on their boards out at sea.
  for (const b of coast.beachgoers) {
    if (b.kind === 'sunbathe') {
      out.push({ x: b.x, y: 0.35, z: b.z, w: 0.7, h: 0.5, d: 1.9, color: b.shirt, yaw: b.angle });
      out.push({ x: b.x, y: 0.75, z: b.z - 0.7, w: 0.45, h: 0.45, d: 0.45, color: [0.85, 0.7, 0.55], yaw: 0 });
    } else if (b.kind === 'surf') {
      out.push({ x: b.x, y: 0.4, z: b.z, w: 0.8, h: 0.2, d: 2.6, color: [1, 0.85, 0.3], yaw: b.angle });
      out.push({ x: b.x, y: 1.0, z: b.z, w: 0.55, h: 0.9, d: 0.45, color: b.shirt, yaw: b.angle });
    } else {
      const bob = Math.sin(b.bob * 6) * 0.05;
      out.push({ x: b.x, y: 0.5 + bob, z: b.z, w: 0.6, h: 0.9, d: 0.45, color: b.shirt, yaw: b.angle });
      out.push({ x: b.x, y: 1.15 + bob, z: b.z, w: 0.45, h: 0.45, d: 0.45, color: [0.85, 0.7, 0.55], yaw: b.angle });
    }
  }
  return out;
}

export function coastSave(coast) {
  return { tide: coast.tide, time: coast.time };
}

export function coastLoad(coast, data) {
  if (!data) return coast;
  if (Number.isFinite(data.tide)) coast.tide = clamp(data.tide, -1, 1);
  if (Number.isFinite(data.time)) coast.time = Math.max(0, data.time);
  return coast;
}
