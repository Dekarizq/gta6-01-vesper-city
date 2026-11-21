// ferry.js — the Sunset Pier ferry to Ember Isle, new in Sunset Kings
// v7. Vesper City is one map and Ember Isle is a second one, and the
// ferry is the door between them: stand on the pier-end dock, stand
// still for a few seconds, pay the $50 fare (free if Mara owns any
// business — the city looks after its own), and the boat carries her
// across 520 units of open water in twelve seconds. The return trip
// works the same way from the Ember Dock. No key, no menu, no loading
// screen: the crossing is a real boat ride the player watches, with
// gulls, waves and the volcano growing on the horizon.
//   Why a ferry and not a bridge: the hurricane is coming, and the
// city never finished the bridge. The ferry is also the game's best
// screenshot — a slow boat, a low sun, and a volcano ahead.
//   The ferry is a small state machine with four states: docked at
// the city pier, crossing to the island, docked at the island, and
// crossing back to the city. The world loop steps it every frame and
// the player position lerps along the crossing line while the boat
// is under way. Boarding is automatic on purpose — a ferry you have
// to find a key for is a ferry nobody rides.
import { ISLAND } from './island.js';

// The fare, the crossing time, and the two ends of the line. The city
// terminal is the end of the Sunset Pier itself, so every player who
// finished mission 11 already knows the way there.
export const FERRY_FARE = 50;
export const FERRY_CROSS_SECONDS = 12;
export const FERRY_BOARD_SECONDS = 4;
export const FERRY_TERMINAL_CITY = { x: -20, z: 330, name: 'Sunset Pier Ferry' };
export const FERRY_TERMINAL_ISLAND = { x: 500, z: 0, name: 'Ember Dock' };

// The crossing line, from pier to dock, with the sea in between. The
// boat does not sail straight: it arcs slightly south so the crossing
// passes the boat dock and the player sees the city fall behind.
export const FERRY_ROUTE = {
  from: { x: -20, z: 330 },
  to: { x: 500, z: 0 },
  bow: { x: 240, z: 380 },
};

// A point on the crossing line at progress t (0..1), with the bow arc
// folded in — a quadratic Bezier through the bow point, so the boat
// curves instead of cutting a dead straight line through the sea.
export function ferryPointAt(t) {
  const a = FERRY_ROUTE.from, b = FERRY_ROUTE.bow, c = FERRY_ROUTE.to;
  const u = 1 - t;
  return {
    x: u * u * a.x + 2 * u * t * b.x + t * t * c.x,
    z: u * u * a.z + 2 * u * t * b.z + t * t * c.z,
  };
}

// The ferry's own state: where it is, where it is going, how far
// along the crossing it is, how long Mara has stood on the dock, and
// how many trips she has made in total.
export function createFerry() {
  return {
    side: 'city',        // 'city' = docked at the pier, 'island' = docked at Ember Dock
    state: 'docked',     // 'docked' | 'boarding' | 'crossing'
    progress: 0,         // 0..1 along the crossing, while crossing
    boardTimer: 0,       // seconds Mara has stood still on the dock
    trips: 0,            // completed crossings this game
    farePaid: 0,         // total fares paid this game
    freeRides: 0,        // free rides taken as a business owner
    lastMsg: null,
  };
}

// Which terminal Mara is standing on, if any: 'city', 'island', or
// null. The boarding radius is generous — the dock is a busy place
// and nobody should have to pixel-hunt the exact plank.
export function ferryNear(ferry, px, pz) {
  const dc = (px - FERRY_TERMINAL_CITY.x) ** 2 + (pz - FERRY_TERMINAL_CITY.z) ** 2;
  if (dc < 10 * 10) return 'city';
  const di = (px - FERRY_TERMINAL_ISLAND.x) ** 2 + (pz - FERRY_TERMINAL_ISLAND.z) ** 2;
  if (di < 10 * 10) return 'island';
  return null;
}

// Is the ferry currently at the terminal Mara is standing on? A ferry
// docked on the other side cannot board her — she has to wait for it
// to come back, which is why the schedule matters.
export function ferryHere(ferry, side) {
  return ferry.side === side && ferry.state === 'docked';
}

// The fare for the next crossing. Business owners ride free — the
// city looks after its own, and a woman who owns half the Marina does
// not pay $50 to cross her own water.
export function ferryFareFor(ownsAnyBusiness) {
  return ownsAnyBusiness ? 0 : FERRY_FARE;
}

// Try to board: returns {ok, cost, msg}. Fails cleanly when Mara is
// broke — the ferry does not take IOUs, and the game says so instead
// of silently doing nothing.
export function ferryBoard(ferry, cash, ownsAnyBusiness) {
  const fare = ferryFareFor(ownsAnyBusiness);
  if (cash < fare) {
    return { ok: false, cost: 0, msg: `The ferry costs $${fare} — you have $${cash}. Earn it first.` };
  }
  ferry.state = 'crossing';
  ferry.progress = 0;
  ferry.boardTimer = 0;
  if (fare === 0) {
    ferry.freeRides += 1;
    return { ok: true, cost: 0, msg: 'The ferry waves you aboard — business owners ride free.' };
  }
  ferry.farePaid += fare;
  return { ok: true, cost: fare, msg: `Ferry to ${ferry.side === 'city' ? 'Ember Isle' : 'Vesper City'} — $${fare}. Twelve seconds across the water.` };
}

// Step the ferry clock. While docked, it watches Mara standing on
// the dock and counts up the boarding timer; while crossing, it
// advances the boat along the route. Returns an event object when
// something happens the world loop must act on, or null.
//   Events: {type:'boarding', side, secondsLeft} while she waits,
//   {type:'departed', to} when the boat leaves, {type:'arrived', side}
//   when the boat ties up on the other side.
export function ferryStep(ferry, px, pz, dt, moving, inCar, missionActive, ownsAnyBusiness) {
  ferry.lastMsg = null;
  if (ferry.state === 'crossing') {
    ferry.progress += dt / FERRY_CROSS_SECONDS;
    if (ferry.progress >= 1) {
      ferry.progress = 1;
      ferry.state = 'docked';
      ferry.side = ferry.side === 'city' ? 'island' : 'city';
      ferry.trips += 1;
      return { type: 'arrived', side: ferry.side };
    }
    return { type: 'sailing', progress: ferry.progress };
  }
  // Docked: boarding needs Mara on foot, standing still, on the dock
  // where the ferry actually is, with no story mission running — the
  // ferry never steals her out of a mission.
  const side = ferryNear(ferry, px, pz);
  if (!side || side !== ferry.side || inCar || missionActive || moving) {
    ferry.boardTimer = 0;
    return null;
  }
  ferry.boardTimer += dt;
  if (ferry.boardTimer < FERRY_BOARD_SECONDS) {
    return { type: 'boarding', side, secondsLeft: Math.ceil(FERRY_BOARD_SECONDS - ferry.boardTimer) };
  }
  const board = ferryBoard(ferry, Number.POSITIVE_INFINITY, ownsAnyBusiness);
  if (!board.ok) return { type: 'denied', msg: board.msg };
  return { type: 'departed', to: ferry.side === 'city' ? 'island' : 'city', cost: board.cost, msg: board.msg };
}

// Where the ferry boat itself is right now, for the renderer: at its
// terminal while docked, or along the crossing line while sailing.
// The boat faces along the route, and bobs on the swell.
export function ferryBoatPosition(ferry, time) {
  const bob = Math.sin((time || 0) * 1.1) * 0.3;
  if (ferry.state === 'crossing') {
    const p = ferryPointAt(ferry.progress);
    const ahead = ferryPointAt(Math.min(1, ferry.progress + 0.02));
    const angle = Math.atan2(ahead.x - p.x, ahead.z - p.z);
    return { x: p.x, z: p.z, y: bob, angle, sailing: true };
  }
  const term = ferry.side === 'city' ? FERRY_TERMINAL_CITY : FERRY_TERMINAL_ISLAND;
  return { x: term.x, z: term.z, y: bob, angle: ferry.side === 'city' ? Math.PI / 2 : -Math.PI / 2, sailing: false };
}

// The ferry's boxes for the renderer: the hull, the cabin, the funnel
// with its sunset stripe, and the little flag on the stern. While the
// boat is sailing the boxes move with it — the renderer never needs
// to know the ferry exists as anything but boxes.
export function ferryBoxes(ferry, time) {
  const pos = ferryBoatPosition(ferry, time);
  const t = time || 0;
  const boxes = [];
  // Hull: long, white with a teal stripe, riding low in the water.
  boxes.push({ x: pos.x, y: 1.0 + pos.y, z: pos.z, w: 6, h: 2.2, d: 16, color: [0.92, 0.9, 0.85], yaw: pos.angle });
  boxes.push({ x: pos.x, y: 0.7 + pos.y, z: pos.z, w: 6.4, h: 0.8, d: 16.4, color: [0.15, 0.5, 0.55], yaw: pos.angle });
  // Cabin: glass all round, warm light inside at dusk.
  boxes.push({ x: pos.x, y: 2.8 + pos.y, z: pos.z, w: 4.6, h: 1.8, d: 11, color: [0.95, 0.85, 0.55], yaw: pos.angle });
  // Funnel with the sunset stripe — the ferry's signature.
  boxes.push({ x: pos.x, y: 4.4 + pos.y, z: pos.z - 3, w: 1.6, h: 2.2, d: 1.6, color: [0.9, 0.35, 0.15], yaw: pos.angle });
  // Stern flag, fluttering.
  const flutter = Math.sin(t * 6) * 0.3;
  boxes.push({ x: pos.x + 2.2, y: 5.6 + pos.y, z: pos.z + 7.5, w: 1.6, h: 1.0, d: 0.2, color: [1, 0.6, 0.2], yaw: pos.angle + flutter });
  // The terminal itself: a wooden jetty, a ticket booth, and the
  // timetable board, on whichever side the ferry is docked.
  const term = ferry.side === 'city' ? FERRY_TERMINAL_CITY : FERRY_TERMINAL_ISLAND;
  boxes.push({ x: term.x, y: 0.4, z: term.z, w: 10, h: 0.8, d: 12, color: [0.55, 0.4, 0.25], yaw: 0 });
  boxes.push({ x: term.x - 6, y: 1.4, z: term.z - 4, w: 3, h: 2.8, d: 3, color: [0.9, 0.8, 0.6], yaw: 0 });
  boxes.push({ x: term.x + 5, y: 2.2, z: term.z - 5, w: 2.4, h: 1.8, d: 0.3, color: [0.15, 0.5, 0.55], yaw: 0 });
  return boxes;
}

// The ferry timetable, for the HUD: the next departure, the fare,
// and whether Mara rides free. The ferry never leaves on a schedule
// the player cannot see — it leaves when she stands on the dock.
export function ferryLabel(ferry, ownsAnyBusiness) {
  const fare = ferryFareFor(ownsAnyBusiness);
  if (ferry.state === 'crossing') {
    const pct = Math.round(ferry.progress * 100);
    return `⛴ Ferry crossing — ${pct}% · ${ferry.side === 'city' ? 'to Ember Isle' : 'to Vesper City'}`;
  }
  if (ferry.state === 'boarding') {
    return `⛴ Ferry boarding — stand still…`;
  }
  const dest = ferry.side === 'city' ? 'Ember Isle' : 'Vesper City';
  return `⛴ Ferry to ${dest} · ${fare === 0 ? 'FREE (business owner)' : `$${fare}`} · stand on the dock`;
}

// Save/load: the ferry keeps its side, its trips and its fares — a
// save made on Ember Isle loads with the ferry still on the island,
// not mysteriously back at the pier.
export function ferrySave(ferry) {
  return {
    side: ferry.side, state: ferry.state === 'crossing' ? 'docked' : ferry.state,
    trips: ferry.trips, farePaid: ferry.farePaid, freeRides: ferry.freeRides,
  };
}

export function ferryLoad(data) {
  if (!data || typeof data !== 'object') return null;
  const f = createFerry();
  f.side = data.side === 'island' ? 'island' : 'city';
  f.trips = data.trips || 0;
  f.farePaid = data.farePaid || 0;
  f.freeRides = data.freeRides || 0;
  return f;
}

// The ferry's own summary, for tests and the HUD: trips, fares, and
// where the boat is right now.
export function ferrySummary(ferry) {
  return {
    side: ferry.side, state: ferry.state,
    progress: Math.round(ferry.progress * 100) / 100,
    trips: ferry.trips, farePaid: ferry.farePaid, freeRides: ferry.freeRides,
  };
}

// Gulls over the crossing — three birds that circle the ferry while
// it sails, because a boat without gulls is just a bus that floats.
export function ferryGullBoxes(ferry, time) {
  const pos = ferryBoatPosition(ferry, time);
  const boxes = [];
  for (let i = 0; i < 3; i += 1) {
    const a = (time || 0) * 0.5 + (i * Math.PI * 2) / 3;
    boxes.push({
      x: pos.x + Math.sin(a) * 9, y: 8 + Math.sin((time || 0) * 2 + i) * 1.2,
      z: pos.z + Math.cos(a) * 9, w: 1.4, h: 0.25, d: 0.5,
      color: [0.95, 0.95, 0.92], yaw: a,
    });
  }
  return boxes;
}

// How far along the crossing Mara is, as a friendly fraction for the
// loading-style message the HUD shows while the boat is under way.
export function ferryProgressText(ferry) {
  if (ferry.state !== 'crossing') return null;
  const left = Math.ceil((1 - ferry.progress) * FERRY_CROSS_SECONDS);
  return `Crossing to ${ferry.side === 'city' ? 'Ember Isle' : 'Vesper City'} — ${left}s · the volcano is getting closer.`;
}
