// gps.js — the GPS route line for Sunset Kings v4. The minimap always
// showed a pink dot for the mission target; v4 draws the road to it.
// The route is a Manhattan path on the road grid: drive along your
// street to the target's street, turn, drive to the target. No
// pathfinding library, no graph — the city is a perfect grid, so the
// route is two straight road runs and one turn, recomputed whenever
// the target moves. The minimap and the big map both draw the route as
// a gold polyline, and the HUD chip reads out the next turn and the
// distance. Pure logic, no DOM.
import { nearestRoadCoord, roadLines } from './city.js';
import { dist2, clamp } from './random.js';

export function createGps() {
  return {
    enabled: true,
    route: [], // [{x, z}] waypoints, first = player, last = target
    target: null, // {x, z, text}
    targetKey: '',
    // How far along the route the player is (waypoint index).
    leg: 0,
    // Recompute the route at most this often while driving.
    recomputeIn: 0,
  };
}

// Build a Manhattan route from (fx, fz) to (tx, tz) on the road grid:
// run along the nearest east-west road to the target's north-south
// road, turn, run to the target. When both points already share a
// road, the route is a single straight run.
export function computeRoute(fx, fz, tx, tz) {
  const roadX = nearestRoadCoord(fx);
  const roadZ = nearestRoadCoord(fz);
  const targetRoadX = nearestRoadCoord(tx);
  const targetRoadZ = nearestRoadCoord(tz);
  const points = [{ x: fx, z: fz }];
  // Already on the target's street: straight there.
  if (Math.abs(fx - tx) < 6) {
    points.push({ x: tx, z: tz });
    return points;
  }
  if (Math.abs(fz - tz) < 6) {
    points.push({ x: tx, z: tz });
    return points;
  }
  // Turn at the intersection of our road and the target's road. Pick
  // the turn that keeps the drive shortest: try both orders and keep
  // the one with the shorter total run.
  const viaA = [
    { x: targetRoadX, z: roadZ },
    { x: targetRoadX, z: tz },
    { x: tx, z: tz },
  ];
  const viaB = [
    { x: roadX, z: targetRoadZ },
    { x: tx, z: targetRoadZ },
    { x: tx, z: tz },
  ];
  const len = (pts) => {
    let total = 0;
    let px = fx, pz = fz;
    for (const p of pts) { total += Math.hypot(p.x - px, p.z - pz); px = p.x; pz = p.z; }
    return total;
  };
  const chosen = len(viaA) <= len(viaB) ? viaA : viaB;
  // Drop waypoints that sit on top of the previous one.
  for (const p of chosen) {
    const last = points[points.length - 1];
    if (Math.hypot(p.x - last.x, p.z - last.z) > 2) points.push(p);
  }
  return points;
}

export function gpsSetTarget(gps, target) {
  if (!target) {
    gps.target = null;
    gps.route = [];
    gps.targetKey = '';
    return gps;
  }
  const key = `${Math.round(target.x)},${Math.round(target.z)}:${target.text || ''}`;
  gps.target = { x: target.x, z: target.z, text: target.text || '' };
  gps.targetKey = key;
  return gps;
}

// Route to a business by its id: the GPS target is the property's
// own spot, labelled with its name, so buying a shop is a drive away.
export function gpsSetBusinessTarget(gps, business) {
  if (!business || !business.name) return gps;
  return gpsSetTarget(gps, { x: business.x, z: business.z, text: business.name });
}

export function gpsUpdate(gps, px, pz, dt) {
  if (!gps.enabled || !gps.target) { gps.route = []; return gps; }
  gps.recomputeIn -= dt;
  // Recompute when the player has moved well off the route, or every
  // couple of seconds while driving, so the line never goes stale.
  const offRoute = gps.route.length === 0 || gpsOffRoute(gps, px, pz) > 12;
  if (offRoute || gps.recomputeIn <= 0) {
    gps.route = computeRoute(px, pz, gps.target.x, gps.target.z);
    gps.recomputeIn = 2;
  }
  // Advance the leg pointer past waypoints the player has reached.
  while (gps.leg < gps.route.length - 1) {
    const next = gps.route[gps.leg + 1];
    if (dist2(px, pz, next.x, next.z) < 64) gps.leg += 1;
    else break;
  }
  gps.leg = clamp(gps.leg, 0, Math.max(0, gps.route.length - 1));
  return gps;
}

// Distance from the player to the nearest point on the route polyline.
export function gpsOffRoute(gps, px, pz) {
  let best = Infinity;
  for (let i = 0; i + 1 < gps.route.length; i += 1) {
    const a = gps.route[i], b = gps.route[i + 1];
    best = Math.min(best, distToSegment(px, pz, a.x, a.z, b.x, b.z));
  }
  return best === Infinity ? 0 : best;
}

function distToSegment(px, pz, x1, z1, x2, z2) {
  const dx = x2 - x1, dz = z2 - z1;
  const len2 = dx * dx + dz * dz;
  if (len2 === 0) return Math.hypot(px - x1, pz - z1);
  let t = ((px - x1) * dx + (pz - z1) * dz) / len2;
  t = clamp(t, 0, 1);
  return Math.hypot(px - (x1 + t * dx), pz - (z1 + t * dz));
}

// Remaining drive distance along the route from the player's leg.
export function gpsRemaining(gps, px, pz) {
  if (!gps.target) return 0;
  let total = 0;
  let cx = px, cz = pz;
  for (let i = gps.leg + 1; i < gps.route.length; i += 1) {
    const p = gps.route[i];
    total += Math.hypot(p.x - cx, p.z - cz);
    cx = p.x; cz = p.z;
  }
  return total;
}

// The next turn, in plain words: "Turn left in 120m", or "Arriving".
export function gpsNextTurn(gps, px, pz, angle) {
  if (!gps.target || gps.route.length < 2) return 'No route';
  const remaining = gpsRemaining(gps, px, pz);
  if (remaining < 12) return 'Arriving — target ahead';
  const next = gps.route[Math.min(gps.leg + 1, gps.route.length - 1)];
  const dx = next.x - px, dz = next.z - pz;
  const dist = Math.hypot(dx, dz);
  const wantAngle = Math.atan2(dx, dz);
  let diff = wantAngle - angle;
  while (diff > Math.PI) diff -= Math.PI * 2;
  while (diff < -Math.PI) diff += Math.PI * 2;
  if (Math.abs(diff) < 0.35) return `Straight on — ${Math.round(dist)}m to the turn`;
  return diff > 0 ? `Turn right in ${Math.round(dist)}m` : `Turn left in ${Math.round(dist)}m`;
}

// Small gold diamonds along the route, every ~18 units, for the 3D
// scene — the player can follow the gold trail on the road itself.
export function gpsBoxes(gps, time) {
  if (!gps.enabled || gps.route.length < 2) return [];
  const out = [];
  const pulse = 1 + Math.sin(time * 3) * 0.15;
  for (let i = 0; i + 1 < gps.route.length; i += 1) {
    const a = gps.route[i], b = gps.route[i + 1];
    const segLen = Math.hypot(b.x - a.x, b.z - a.z);
    const steps = Math.max(1, Math.floor(segLen / 18));
    for (let s = 1; s < steps; s += 1) {
      const t = s / steps;
      out.push({
        x: a.x + (b.x - a.x) * t,
        y: 0.7,
        z: a.z + (b.z - a.z) * t,
        w: 0.9 * pulse, h: 0.9 * pulse, d: 0.9 * pulse,
        color: [1, 0.85, 0.2], yaw: time + s,
      });
    }
  }
  return out;
}

export function gpsLabel(gps, px, pz, angle) {
  if (!gps.enabled) return 'GPS off — press L';
  if (!gps.target) return 'GPS — no active target';
  return `GPS ${Math.round(gpsRemaining(gps, px, pz))}m · ${gpsNextTurn(gps, px, pz, angle)}`;
}

// v5: the same label, with the district Mara is driving through —
// "GPS 432m · Straight on — Marina District" reads like a real sat-nav.
export function gpsLabelWithDistrict(gps, px, pz, angle, district) {
  const base = gpsLabel(gps, px, pz, angle);
  return district ? `${base} · ${district}` : base;
}

export function gpsSave(gps) {
  return { enabled: gps.enabled };
}

export function gpsLoad(gps, data) {
  if (!data) return gps;
  if (typeof data.enabled === 'boolean') gps.enabled = data.enabled;
  return gps;
}

// Road lines, exported for the map overlay (drawn in hud.js).
export { roadLines };
