// island-police.js — the Ember Island Patrol, new in Sunset Kings v7.
// Vesper City has the VCPD; Ember Isle has its own law, and it is
// smaller, louder and closer to the volcano. The Ember Island Patrol
// is four named units with their own tactics, their own radio chatter,
// and their own roadblock on the volcano bridge — plus a wanted system
// that is separate from the city's: the island counts its own heat,
// and the heat follows Mara back across the ferry if she leaves with
// stars on her name. The patrol only exists on the island; the VCPD
// never crosses the water, and the patrol never leaves the island.
//   The four units: EIP-7 Sgt. Kana (RAM — she hits what she chases),
// EIP-12 Ofc. Rolo (PIT — he spins what he catches), EIP-23 Ofc. Mina
// (BLOCKADE — she closes the road ahead of you), and EIP-31 Sgt. Boro
// (PURSUIT — he never gives up, he just gets closer). Above them,
// the patrol has no helicopter — it has the lighthouse, and the
// lighthouse sees everything.
//   The patrol is a self-contained system: it owns its cops, its
// roadblock and its heat, it steps itself every frame, and it renders
// its own boxes. The world loop only has to call stepIslandPolice and
// islandPoliceBoxes, and to ask islandPoliceLabel for the HUD.
import { ISLAND } from './island.js';
import { makeCar } from './vehicles.js';

// The four patrol units, in the order they join a chase. Each one has
// a callsign, an officer, a tactic, a personality line, and a home
// beat on the island — the beat is where the unit starts its shift,
// so the chase always begins from somewhere real.
export const ISLAND_PATROL_UNITS = [
  {
    callsign: 'EIP-7', officer: 'Sgt. Kana', tactic: 'RAM',
    beat: { x: 680, z: 30 }, home: 'Ember Town crossroads',
    line: "Kana: \"You can run, but the island is small.\"",
    speed: 30, aggression: 0.9,
  },
  {
    callsign: 'EIP-12', officer: 'Ofc. Rolo', tactic: 'PIT',
    beat: { x: 560, z: 30 }, home: 'Fisher Village square',
    line: "Rolo: \"One spin, one stop. That is the whole job.\"",
    speed: 28, aggression: 0.75,
  },
  {
    callsign: 'EIP-23', officer: 'Ofc. Mina', tactic: 'BLOCKADE',
    beat: { x: 740, z: -30 }, home: 'St. Ember Church',
    line: "Mina: \"The road ahead is closed. The road behind is lava.\"",
    speed: 26, aggression: 0.6,
  },
  {
    callsign: 'EIP-31', officer: 'Sgt. Boro', tactic: 'PURSUIT',
    beat: { x: 800, z: 120 }, home: 'Ember Resort',
    line: "Boro: \"I do not hurry. Hurrying is for people who lose.\"",
    speed: 32, aggression: 0.85,
  },
];

// The patrol car itself: white with a teal stripe and a light bar
// that flashes island blue, built on the same car shape as the city
// cruisers so the renderer never learns a new trick.
export const ISLAND_PATROL_CAR = {
  id: 'patrol', name: 'Ember Patrol Cruiser', color: [0.92, 0.92, 0.9],
  top: 30, accel: 20, brake: 32, grip: 3.0, len: 4.6,
};

// The volcano bridge roadblock: two striped barriers across the north
// road at the volcano base, with a warning sign. The patrol only
// lays it when the heat is high — a roadblock on a quiet day is just
// roadworks, and the island hates roadworks.
export const ISLAND_ROADBLOCK_POINT = { x: 700, z: -60, angle: Math.PI / 2 };

// The patrol's own state: its cops, its roadblock, its heat, and the
// chatter clock that keeps the radio alive during a chase.
export function createIslandPolice() {
  return {
    cops: [],
    roadblock: null,
    heat: 0,
    wanted: 0,
    chatterTimer: 0,
    lastChatter: null,
    busted: 0,
    escapes: 0,
    rams: 0,
  };
}

// How many patrol cars the heat calls out: one per wanted star, up
// to all four units, and the fourth only comes out at three stars —
// the island does not send Sergeant Boro for a parking ticket.
export function islandPatrolStrength(wanted) {
  if (wanted <= 0) return 0;
  if (wanted === 1) return 1;
  if (wanted === 2) return 2;
  if (wanted === 3) return 3;
  return 4;
}

// Add island heat: the island counts its own wanted level, separate
// from the city's, and the patrol strength follows it. Returns the
// new island wanted level, clamped to the island maximum of four.
export function addIslandWanted(police, amount) {
  police.wanted = Math.max(0, Math.min(4, police.wanted + amount));
  police.heat = police.wanted;
  return police.wanted;
}

// Clear the island heat — when Mara leaves the island clean, or when
// the patrol loses her for good, the island forgets. For a while.
export function clearIslandWanted(police) {
  police.wanted = 0;
  police.heat = 0;
  police.cops = [];
  police.roadblock = null;
  return 0;
}

// Spawn one patrol unit as a live car on the island grid, starting
// from its home beat and already rolling toward the player.
export function spawnIslandCop(police, unit, px, pz) {
  const car = makeCar(ISLAND_PATROL_CAR, unit.beat.x, unit.beat.z, 0, { driver: true });
  car.unit = unit;
  car.patrol = true;
  car.targetX = px;
  car.targetZ = pz;
  police.cops.push(car);
  return car;
}

// The roadblock: two striped barriers and a sign across the north
// road at the volcano base. Only laid when the heat is three stars
// or more, and only once per chase — the patrol has two barriers and
// it is not buying more.
export function layIslandRoadblock(police) {
  if (police.roadblock) return police.roadblock;
  police.roadblock = {
    x: ISLAND_ROADBLOCK_POINT.x, z: ISLAND_ROADBLOCK_POINT.z,
    angle: ISLAND_ROADBLOCK_POINT.angle, unit: ISLAND_PATROL_UNITS[2],
  };
  return police.roadblock;
}

export function clearIslandRoadblock(police) {
  police.roadblock = null;
}

// Step the patrol: match the cop count to the heat, steer every cop
// toward the player, lay the roadblock when the heat is high, and
// let the radio chatter. Cops drive on the island roads — they steer
// toward the player in a straight line and the island collision
// keeps them out of the buildings, the same as the player.
export function stepIslandPolice(police, dt, player, rng, wanted, time) {
  const want = islandPatrolStrength(wanted);
  // Spawn the missing units, in order, from their home beats.
  while (police.cops.length < want) {
    const unit = ISLAND_PATROL_UNITS[police.cops.length];
    if (!unit) break;
    spawnIslandCop(police, unit, player.x, player.z);
  }
  // The heat fell: the extra units peel off and drive home.
  while (police.cops.length > want) {
    police.cops.pop();
    police.escapes += 1;
  }
  // The roadblock goes up at three stars and comes down at one.
  if (wanted >= 3 && !police.roadblock) layIslandRoadblock(police);
  if (wanted <= 1 && police.roadblock) clearIslandRoadblock(police);
  // Every cop steers toward the player and closes in. RAM units aim
  // straight at the player; PIT units aim slightly ahead of them;
  // BLOCKADE units aim at the road ahead of the player; PURSUIT
  // units just keep coming, forever, at a steady speed.
  for (const cop of police.cops) {
    const unit = cop.unit || ISLAND_PATROL_UNITS[0];
    const speed = unit.speed * (0.8 + unit.aggression * 0.3);
    let tx = player.x, tz = player.z;
    if (unit.tactic === 'PIT') {
      tx = player.x + Math.sin(player.angle || 0) * 8;
      tz = player.z + Math.cos(player.angle || 0) * 8;
    }
    if (unit.tactic === 'BLOCKADE') {
      tx = player.x + Math.sin(player.angle || 0) * 24;
      tz = player.z + Math.cos(player.angle || 0) * 24;
    }
    const dx = tx - cop.x, dz = tz - cop.z;
    const dist = Math.hypot(dx, dz) || 1;
    const targetAngle = Math.atan2(dx, dz);
    let da = targetAngle - cop.angle;
    while (da > Math.PI) da -= Math.PI * 2;
    while (da < -Math.PI) da += Math.PI * 2;
    cop.angle += Math.max(-2.4 * dt, Math.min(2.4 * dt, da));
    cop.speed = Math.min(speed, (cop.speed || 0) + 14 * dt);
    cop.x += Math.sin(cop.angle) * cop.speed * dt;
    cop.z += Math.cos(cop.angle) * cop.speed * dt;
    // A cop that catches the player on foot stops and holds them —
    // the chase ends in a talking-to, not a crash.
    if (dist < 4 && !player.inCar) {
      cop.speed = 0;
    }
    // A RAM cop that hits the player car counts a ram and slows down
    // for a second, so the player can break away.
    if (dist < 5 && player.inCar && unit.tactic === 'RAM' && !cop.ramCooldown) {
      police.rams += 1;
      cop.ramCooldown = 2;
    }
    if (cop.ramCooldown) cop.ramCooldown -= dt;
  }
  // Radio chatter: every six seconds during a chase, one of the units
  // says something on the island channel.
  police.chatterTimer += dt;
  if (police.chatterTimer > 6 && police.cops.length > 0) {
    police.chatterTimer = 0;
    const unit = police.cops[Math.floor((rng ? rng.next() : Math.random()) * police.cops.length)].unit;
    police.lastChatter = unit ? unit.line : null;
  }
  return police;
}

// The patrol's status line for the HUD: how many units, which
// tactics, and whether the roadblock is up.
export function islandPoliceLabel(police, wanted) {
  if (!police || police.cops.length === 0) {
    return '● EMBER PATROL · 0 UNITS — the island is quiet.';
  }
  const tactics = police.cops.map((c) => (c.unit ? c.unit.tactic : 'PATROL')).join(' + ');
  const rb = police.roadblock ? ' · ROADBLOCK UP' : '';
  return `● EMBER PATROL · ${police.cops.length} UNITS · ${tactics}${rb}`;
}

// One cop's display row for the HUD: callsign, officer, tactic, and
// how far away they are from the player.
export function islandCopDisplay(cop, player) {
  const unit = cop.unit || ISLAND_PATROL_UNITS[0];
  const dist = Math.round(Math.hypot(cop.x - player.x, cop.z - player.z));
  return {
    callsign: unit.callsign, officer: unit.officer, tactic: unit.tactic,
    dist, speed: Math.round(Math.abs(cop.speed || 0) * 3.2),
  };
}

// The patrol's boxes for the renderer: the cruisers themselves, with
// their light bars flashing island blue, plus the roadblock barriers
// and the warning sign when the road is closed.
export function islandPoliceBoxes(police, time) {
  const boxes = [];
  const t = time || 0;
  const flash = Math.sin(t * 10) > 0;
  for (const cop of police.cops) {
    boxes.push({ x: cop.x, y: 0.9, z: cop.z, w: 2.0, h: 1.1, d: 4.6, color: [0.92, 0.92, 0.9], yaw: cop.angle });
    boxes.push({ x: cop.x, y: 1.6, z: cop.z, w: 1.2, h: 0.35, d: 0.8, color: flash ? [0.2, 0.4, 1] : [0.9, 0.2, 0.2], yaw: cop.angle });
    boxes.push({ x: cop.x, y: 0.5, z: cop.z, w: 2.1, h: 0.3, d: 4.7, color: [0.15, 0.5, 0.55], yaw: cop.angle });
  }
  if (police.roadblock) {
    const rb = police.roadblock;
    boxes.push({ x: rb.x, y: 0.55, z: rb.z, w: 2.0, h: 0.75, d: 4.4, color: [0.95, 0.85, 0.3], yaw: rb.angle });
    boxes.push({ x: rb.x + 6, y: 0.55, z: rb.z + 2, w: 2.0, h: 0.75, d: 4.4, color: [0.95, 0.85, 0.3], yaw: rb.angle });
    boxes.push({ x: rb.x - 6, y: 1.4, z: rb.z - 2, w: 3.0, h: 1.6, d: 0.3, color: [0.9, 0.2, 0.2], yaw: rb.angle });
  }
  return boxes;
}

// The patrol's radio chatter lines, by situation — the world loop
// can ask for one when the chase changes, and the HUD can show it.
export const ISLAND_PATROL_CHATTER = {
  start: [
    "Dispatch: \"All units, the Sunset King is on the island.\"",
    "Kana: \"Eyes on the ferry dock. She came by boat, she leaves by boat.\"",
    "Rolo: \"I have the village. Nobody parks here without paying.\"",
  ],
  close: [
    "Mina: \"She is close. Close the north road.\"",
    "Boro: \"I see her. I always see her.\"",
    "Kana: \"Ram her. Gently. The island needs the car intact.\"",
  ],
  lost: [
    "Dispatch: \"Units, we lost her. Check the beach.\"",
    "Rolo: \"She went into the palm grove. I am not going in there.\"",
    "Mina: \"The volcano hides everyone eventually.\"",
  ],
  roadblock: [
    "Mina: \"Roadblock is up on the volcano bridge.\"",
    "Dispatch: \"All units, the north road is closed.\"",
    "Boro: \"She will try the beach road. She always tries the beach road.\"",
  ],
};

export function islandChatter(kind, index) {
  const lines = ISLAND_PATROL_CHATTER[kind] || ISLAND_PATROL_CHATTER.start;
  return lines[(index || 0) % lines.length];
}

// The island wanted stars, as a number and as a string of stars for
// the HUD — the island counts to four, not six, because the island
// is smaller and the patrol is prouder.
export function islandWantedStars(wanted) {
  const n = Math.max(0, Math.min(4, wanted || 0));
  return '★'.repeat(n) + '☆'.repeat(4 - n);
}

// Save/load: the patrol keeps its heat and its chase counts, but
// never its live cops — a save made mid-chase loads with the heat
// still on, but the units have to find Mara all over again.
export function islandPoliceSave(police) {
  return {
    wanted: police.wanted, heat: police.heat,
    busted: police.busted, escapes: police.escapes, rams: police.rams,
  };
}

export function islandPoliceLoad(data) {
  const p = createIslandPolice();
  if (!data || typeof data !== 'object') return p;
  p.wanted = data.wanted || 0;
  p.heat = data.heat || 0;
  p.busted = data.busted || 0;
  p.escapes = data.escapes || 0;
  p.rams = data.rams || 0;
  return p;
}

// The patrol's summary for tests and the HUD: units out, heat, and
// the chase record so far.
export function islandPoliceSummary(police) {
  return {
    units: police.cops.length,
    wanted: police.wanted,
    roadblock: !!police.roadblock,
    rams: police.rams,
    escapes: police.escapes,
    chatter: police.lastChatter,
  };
}

// The patrol's own wanted multiplier: on the island, the heat rises
// faster at night and faster still in a storm, the same as the city
// — the dark belongs to the law everywhere, even on a volcano.
export function islandHeatMultiplier(isStorm, isNight) {
  let m = 1;
  if (isNight) m *= 1.5;
  if (isStorm) m *= 1.25;
  return m;
}
