// island-events.js — random island events on Ember Isle, new in
// Sunset Kings v7. The city has a hurricane countdown; the island
// has a life of its own, and it keeps interrupting Mara with things
// that only happen on a volcano: lava festivals, fishing
// tournaments, storm warnings from the lighthouse, a lost tourist,
// a beached whale, a wedding at the resort, and the one event nobody
// wants — the volcano clearing its throat. Events fire on a timer
// while Mara is on the island, they pay cash and respect when she
// answers them, and they expire if she ignores them — the island
// does not wait, and neither does the lava.
//   The events are a self-contained system: they own their defs,
// their schedule, their active event and their history, and they
// step themselves every frame. The world loop only has to call
// stepIslandEvents and read the event it returns, and to ask for
// the event label for the HUD.
//   An event has an id, a name, a blurb, a duration, a reward, a
// respect payout, and a place on the island where it happens. Some
// events are good news (a festival pays everyone who shows up),
// some are bad news (a storm warning pays the people who warn the
// village), and one of them — the eruption — pays nobody, because
// the volcano does not do refunds.
import { islandPoints } from './island.js';

// The island events, in the order the islanders tell them: the
// festival first (everyone loves a festival), the tournament second,
// the warning third, and the eruption last (nobody loves an
// eruption, but everybody remembers one).
export const ISLAND_EVENT_DEFS = [
  {
    id: 'lava-festival', name: 'Lava Festival', duration: 90,
    reward: 300, respect: 40,
    blurb: 'The volcano is calm and the market is dancing. Show up, eat, and be seen.',
    place: 'nightMarket',
    line: 'Seller: "Festival tonight! The lava is calm and the fish is fresh!"',
  },
  {
    id: 'fishing-tournament', name: 'Fishing Tournament', duration: 120,
    reward: 400, respect: 50,
    blurb: 'The biggest catch of the day wins the pot. Bring a rod, or just bring luck.',
    place: 'ferryDock',
    line: 'Fisherman: "Biggest fish wins. My fish is very big. You have not seen it yet."',
  },
  {
    id: 'storm-warning', name: 'Storm Warning', duration: 60,
    reward: 250, respect: 45,
    blurb: 'The lighthouse keeper needs the warning carried to the village before the squall hits.',
    place: 'lighthouseGate',
    line: 'Keeper: "Squall coming. Tell the village. Tell them twice."',
  },
  {
    id: 'lost-tourist', name: 'Lost Tourist', duration: 100,
    reward: 200, respect: 30,
    blurb: 'A tourist took the wrong road to the volcano and is now very lost and very sunburnt.',
    place: 'volcanoBase',
    line: 'Tourist: "Is this the resort? This does not look like the resort."',
  },
  {
    id: 'beached-whale', name: 'Beached Whale', duration: 110,
    reward: 350, respect: 55,
    blurb: 'A whale beached itself on the black sand. The village needs hands, rope and a tide.',
    place: 'blackBeach',
    line: 'Villager: "Push with your legs, not your back. The whale appreciates it."',
  },
  {
    id: 'resort-wedding', name: 'Resort Wedding', duration: 80,
    reward: 500, respect: 45,
    blurb: 'A wedding at the resort needs a getaway driver for the happy couple. Drive slow. Smile.',
    place: 'resort',
    line: 'Bride: "Drive slow, drive pretty, and do not lose the rings."',
  },
  {
    id: 'eruption-watch', name: 'Eruption Watch', duration: 70,
    reward: 0, respect: 80,
    blurb: 'The volcano is clearing its throat. Watch the rim, warn the village, and do not panic.',
    place: 'volcanoRim',
    line: 'Old Tomas: "The volcano is talking. Listen, then run if it shouts."',
  },
  {
    id: 'night-market-rush', name: 'Night Market Rush', duration: 75,
    reward: 280, respect: 35,
    blurb: 'The market is packed and the stalls need a runner. Carry, fetch, and do not drop the fish.',
    place: 'nightMarket',
    line: 'Seller: "Runner! My stall, my fish, my money — go, go, go!"',
  },
];

// An event def by id.
export function islandEventDef(id) {
  return ISLAND_EVENT_DEFS.find((d) => d.id === id) || ISLAND_EVENT_DEFS[0];
}

// The live event state: the active event (or null), the timer that
// decides when the next one fires, and the history of what Mara has
// answered and what she has ignored.
export function createIslandEvents() {
  return {
    active: null,
    nextIn: 75,
    done: {},
    ignored: {},
    earned: 0,
    cycle: 0,
  };
}

// Pick the next event: round-robin through the defs, so the island
// never repeats itself twice in a row and every event gets its turn.
export function nextIslandEvent(events) {
  const def = ISLAND_EVENT_DEFS[events.cycle % ISLAND_EVENT_DEFS.length];
  events.cycle += 1;
  return def;
}

// Start an event: resolve its place to coordinates and arm its
// timer. Returns the active event.
export function startIslandEvent(events, def, elapsed) {
  const pts = islandPoints();
  const place = pts[def.place] || { x: 700, z: 0 };
  events.active = {
    def, x: place.x, z: place.z, placeName: place.name,
    timeLeft: def.duration, startedAt: elapsed || 0,
  };
  return events.active;
}

// Step the event clock: count down to the next event, count down the
// active event, and expire it when the timer runs out. Returns an
// event the world loop must act on, or null:
//   {type:'started', event} when a new event fires,
//   {type:'expired', event} when Mara ignored one.
export function stepIslandEvents(events, dt, elapsed, onIsland) {
  if (!onIsland) {
    if (events.active) {
      events.active = null;
    }
    events.nextIn = 75;
    return null;
  }
  if (events.active) {
    events.active.timeLeft -= dt;
    if (events.active.timeLeft <= 0) {
      const expired = events.active;
      events.ignored[expired.def.id] = (events.ignored[expired.def.id] || 0) + 1;
      events.active = null;
      events.nextIn = 60;
      return { type: 'expired', event: expired };
    }
    return null;
  }
  events.nextIn -= dt;
  if (events.nextIn <= 0) {
    const def = nextIslandEvent(events);
    const started = startIslandEvent(events, def, elapsed);
    return { type: 'started', event: started };
  }
  return null;
}

// Answer the active event: Mara reached its place in time. Pays the
// reward and the respect, records it, and clears the event.
export function answerIslandEvent(events) {
  if (!events.active) return null;
  const ev = events.active;
  events.done[ev.def.id] = (events.done[ev.def.id] || 0) + 1;
  events.earned += ev.def.reward;
  events.active = null;
  events.nextIn = 90;
  return { type: 'answered', event: ev, pay: ev.def.reward, respect: ev.def.respect };
}

// Is Mara standing on the active event's place? The world loop asks
// this every frame while an event is live — reaching the place is
// how an event gets answered.
export function islandEventReached(events, px, pz) {
  if (!events.active) return false;
  const dx = px - events.active.x, dz = pz - events.active.z;
  return dx * dx + dz * dz < 9 * 9;
}

// The active event's label for the HUD: its name, its place, and how
// much time is left before the island moves on without her.
export function islandEventLabel(events) {
  if (!events.active) return null;
  const ev = events.active;
  return {
    name: ev.def.name,
    place: ev.placeName,
    timeLeft: Math.max(0, Math.round(ev.timeLeft)),
    reward: ev.def.reward,
    respect: ev.def.respect,
    line: ev.def.line,
  };
}

// The event's boxes for the renderer: a gold beacon over the event's
// place, so the player can always see where the island needs her.
export function islandEventBoxes(events, time) {
  const boxes = [];
  if (!events.active) return boxes;
  const ev = events.active;
  const pulse = 1 + Math.sin((time || 0) * 4) * 0.3;
  boxes.push(
    { x: ev.x, y: 9, z: ev.z, w: 2.0 * pulse, h: 16, d: 2.0 * pulse, color: [1, 0.75, 0.2], yaw: 0 },
    { x: ev.x, y: 3.0, z: ev.z, w: 2.2, h: 2.2, d: 2.2, color: [1, 0.85, 0.3], yaw: time || 0 },
  );
  return boxes;
}

// The events' totals for the HUD and the save: how many Mara has
// answered, how many she has ignored, and how much the island has
// paid her for showing up.
export function islandEventsSummary(events) {
  const done = Object.values(events.done).reduce((n, v) => n + v, 0);
  const ignored = Object.values(events.ignored).reduce((n, v) => n + v, 0);
  return {
    done: { ...events.done }, ignored: { ...events.ignored },
    totalDone: done, totalIgnored: ignored, earned: events.earned,
    active: events.active ? events.active.def.name : null,
    nextIn: Math.max(0, Math.round(events.nextIn)),
  };
}

// Save/load: the events keep their totals and their cycle pointer,
// but never an active event — a save made mid-festival loads with
// the festival gone, the same as the jobs.
export function islandEventsSave(events) {
  return {
    done: { ...events.done }, ignored: { ...events.ignored },
    earned: events.earned, cycle: events.cycle,
  };
}

export function islandEventsLoad(data) {
  const events = createIslandEvents();
  if (!data || typeof data !== 'object') return events;
  events.done = data.done || {};
  events.ignored = data.ignored || {};
  events.earned = data.earned || 0;
  events.cycle = data.cycle || 0;
  return events;
}

// The island events' own tips, one per event — the HUD can show one
// when an event starts, so Mara knows what the island wants before
// the timer starts running.
export const ISLAND_EVENT_TIPS = {
  'lava-festival': 'Tip: festivals pay everyone who shows up. Just show up.',
  'fishing-tournament': 'Tip: the biggest fish wins. The dock is where the big fish are.',
  'storm-warning': 'Tip: warnings are worth more than fish. Carry it fast.',
  'lost-tourist': 'Tip: tourists get lost on the north road. Start there.',
  'beached-whale': 'Tip: the whale needs the tide, not a car. Bring rope and friends.',
  'resort-wedding': 'Tip: drive slow. The bride is watching, and so is the volcano.',
  'eruption-watch': 'Tip: watch the rim, warn the village, and do not panic. Panicking is for tourists.',
  'night-market-rush': 'Tip: the market is packed. Walk, do not drive, through the stalls.',
};

export function islandEventTip(id) {
  return ISLAND_EVENT_TIPS[id] || 'Tip: the island needs you. Go.';
}

// Validate the events the way the sim does: every event has a place
// on the island, a duration, and a reward. Returns a list of
// problems — empty means the events are ready to fire.
export function validateIslandEvents() {
  const problems = [];
  const pts = islandPoints();
  for (const def of ISLAND_EVENT_DEFS) {
    if (!pts[def.place]) problems.push(`${def.id} has an unknown place: ${def.place}`);
    if (!def.duration || def.duration <= 0) problems.push(`${def.id} has no duration`);
    if (def.reward < 0) problems.push(`${def.id} has a negative reward`);
  }
  return problems;
}
