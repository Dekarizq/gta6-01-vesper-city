// shots.js — deterministic screenshot scenes for Sunset Kings (v6) behind
// ?shot=start|chase|street|mission|coast|wheel|marina|oldtown|storm|business|arc. Each stages the real game
// state and then FREEZES it (game.frozen): the main loop draws the staged
// frame but the world does not advance, so the car, the cops, the
// helicopter and the burning wreck stay exactly where they were placed.
// The chase and mission scenes drive WEST down the z=27 boulevard,
// straight toward the low sun at the end of the road, so the golden-hour
// disc is in frame — and now the chase also shows a smoking wreck and the
// upgraded Sunset GT, the street scene shows Mara carjacking a Sunset Cab,
// the coast scene stages the Tide Runner chase on the pier with boats
// and a spike strip, the wheel scene shows the weapon wheel open with
// the shotgun picked, and every scene shows the respect rank, the radio
// station and the garage panel. v5 adds the marina hero (Sunset Viper
// on the quay, yachts and the lighthouse behind) and the old-town
// night market (Mara on foot among the stalls, church tower behind).
// v6 adds the storm hero (a wanted-5 chase in the hurricane front,
// lightning in the sky, wet roads), the business hero (Mara on the
// marina quay in front of the fish market she just bought, its gold
// sign and level pips overhead, mission 13 active), and the arc hero
// (the King of Vesper finale, mission 15, at dusk in the Storm Chaser
// with the level-2 fish market behind her).
import { SCREEN_PLAY } from './world.js';
import { addWanted } from './police.js';
import { makeCar } from './vehicles.js';
import { VCPD_UNITS, HELI_UNIT } from './config.js';
import { addRespect } from './respect.js';
import { deployStrip } from './spikestrip.js';
import { currentStep } from './missions.js';
import { gpsSetTarget, gpsUpdate } from './gps.js';
import { forceWeather } from './weather.js';
import { buyBusiness as buyBiz, upgradeBusiness as upgradeBiz } from './business.js';

// Staged shots are frozen, so the world loop never runs to build the
// GPS route — pre-compute it here, or every shot's HUD chip reads
// "No route" instead of the real distance to the mission target.
function stageGps(api) {
  const step = currentStep(api.game.missions);
  if (!step) return;
  gpsSetTarget(api.game.gps, step);
  gpsUpdate(api.game.gps, api.player.x, api.player.z, 0.016);
}

function stagePolice(api, spots) {
  const policeType = { id: 'police', name: 'VCPD Interceptor', color: [0.92, 0.92, 0.95], top: 30, accel: 20, brake: 34, grip: 3.0 };
  for (let i = 0; i < spots.length; i += 1) {
    const [x, z, angle] = spots[i];
    const unit = VCPD_UNITS[i % VCPD_UNITS.length];
    const cop = makeCar(policeType, x, z, angle, { police: true, targetSpeed: 20, callsign: unit.callsign, unit });
    cop.frozen = true;
    api.game.police.cops.push(cop);
  }
}

function stageWreck(api, x, z, angle) {
  const wreck = makeCar({ id: 'sedan', name: 'Vesper S', color: [0.72, 0.18, 0.24], top: 24, accel: 16, brake: 30, grip: 2.6 }, x, z, angle, { driver: false });
  wreck.wreck = true;
  wreck.exploded = true;
  wreck.smoke = 1;
  wreck.health = 0;
  wreck.condition = 0;
  api.game.traffic.push(wreck);
  api.game.wrecks.push({ x, z, time: 0 });
  return wreck;
}

export function stageShot(name, api) {
  const { game, player } = api;
  game.screen = SCREEN_PLAY;
  game.frozen = true;
  if (name === 'start') {
    game.screen = 'title';
    player.x = 0; player.z = 60; player.angle = 0;
    return;
  }
  if (name === 'chase') {
    // Wanted-5 chase driving WEST toward the sun: a NITRO-upgraded
    // Sunset GT, four named white cruisers ahead and behind, CONDOR-1
    // with its searchlight overhead, a spike strip across the road, and
    // a smoking wreck on the roadside from the last explosion — the
    // Sunset Kings at full speed.
    const car = makeCar({ id: 'coupe', name: 'Sunset GT', color: [0.95, 0.68, 0.18], top: 33, accel: 22, brake: 34, grip: 3.1 }, 0, 27, -Math.PI / 2, { driver: false });
    game.garageState.upgrades.engine = 2;
    game.garageState.upgrades.tires = 1;
    game.garageState.upgrades.nitro = 2;
    player.inCar = true; player.car = car; player.x = 0; player.z = 27; player.angle = -Math.PI / 2; player.speed = 24;
    car.speed = 24;
    car.nitroBoost = 0.8;
    addWanted(game.police, 5);
    game.police.spawnTimer = 0;
    stagePolice(api, [[-35, 23, Math.PI / 2], [-38, 31, Math.PI / 2], [30, 27, -Math.PI / 2], [-20, 31, Math.PI / 2]]);
    game.police.heli = { angle: 0.6, x: -28, z: 22, y: 12, unit: HELI_UNIT };
    game.police.roadblock = { x: -42, z: 27, angle: Math.PI / 2, unit: VCPD_UNITS[2] };
    deployStrip(game.police.spikes, -55, 27, Math.PI / 2, 'VCPD-52', 0);
    stageWreck(api, 18, 33, Math.PI / 2);
    addRespect(game.respect, 420);
    game.radioState.index = 1; // SUNSET FM — Coast Drive
    api.startMission();
    stageGps(api);
    game.msg = null; // staged shot: no intro banner over the HUD
    game.cash = 24800;
    return;
  }
  if (name === 'coast') {
    // v4 cover: the Tide Runner chase on the coast. Mara in the Coast
    // Cruiser convertible driving SOUTH down the pier road toward the
    // sea, boats at the dock to the east, a spike strip ahead on the
    // sand, CONDOR-1 low overhead, and mission 11 active with the GPS
    // route on. (Angle 0 faces +z, south toward the pier and the sea.)
    const car = makeCar({ id: 'convertible', name: 'Coast Cruiser', color: [0.2, 0.7, 0.9], top: 31, accel: 21, brake: 33, grip: 3.0 }, -20, 272, 0, { driver: false });
    game.garageState.upgrades.engine = 2;
    game.garageState.upgrades.nitro = 1;
    player.inCar = true; player.car = car; player.x = -20; player.z = 272; player.angle = 0; player.speed = 20;
    car.speed = 20;
    addWanted(game.police, 4);
    game.police.spawnTimer = 0;
    stagePolice(api, [[-32, 258, 0], [-8, 262, 0]]);
    game.police.heli = { angle: 0.6, x: -30, z: 282, y: 12, unit: HELI_UNIT };
    deployStrip(game.police.spikes, -20, 300, 0, 'VCPD-52', 0);
    game.missions.index = 10; // Tide Runner
    api.startMission();
    stageGps(api);
    game.msg = null;
    addRespect(game.respect, 900);
    game.radioState.index = 3; // COAST 104.7 — Beach Nights
    game.cash = 31200;
    return;
  }
  if (name === 'marina') {
    // v5 hero: Mara in the red Sunset Viper sports car on the marina
    // quay, facing SOUTH toward the sea — white yachts, harbour
    // cranes and the lighthouse ahead, the fish market to the left,
    // a sailboat crossing the water. No police, just golden hour.
    const car = makeCar({ id: 'sports', name: 'Sunset Viper', color: [0.95, 0.25, 0.15], top: 38, accel: 26, brake: 36, grip: 3.3, len: 4.4 }, 200, 250, 0, { driver: false });
    game.garageState.upgrades.engine = 2;
    game.garageState.upgrades.nitro = 2;
    player.inCar = true; player.car = car; player.x = 200; player.z = 250; player.angle = 0; player.speed = 12;
    car.speed = 12;
    car.nitroBoost = 0.5;
    addRespect(game.respect, 900);
    game.radioState.index = 4; // MARINA 99.9 — Yacht Rock
    api.startMission();
    stageGps(api);
    game.msg = null;
    game.cash = 41200;
    return;
  }
  if (name === 'oldtown') {
    // v5 hero: Mara on foot in the Old Town night market, facing
    // NORTH into the stalls — striped awnings, warm lamps, neon,
    // the church tower behind the market, clotheslines overhead.
    // A quiet scene on purpose: the market is the picture.
    player.inCar = false; player.car = null;
    player.x = -30; player.z = -182; player.angle = Math.PI;
    addRespect(game.respect, 700);
    game.radioState.index = 0;
    api.startMission();
    stageGps(api);
    game.msg = null;
    game.cash = 18700;
    return;
  }
  if (name === 'storm') {
    // v6 hero: a wanted-5 chase in the hurricane front. The weather is
    // forced to storm (grey sky, heavy rain, lightning), Mara drives
    // the Storm King muscle car WEST down the z=27 boulevard into the
    // rain, four named cruisers behind her, CONDOR-1 low overhead with
    // its searchlight, a spike strip across the road, and a smoking
    // wreck on the roadside. The storm clouds are the picture.
    forceWeather(game.weather, 'storm');
    const car = makeCar({ id: 'muscle', name: 'Storm King', color: [0.55, 0.15, 0.65], top: 36, accel: 24, brake: 32, grip: 2.9 }, 0, 27, -Math.PI / 2, { driver: false });
    game.garageState.upgrades.engine = 2;
    game.garageState.upgrades.tires = 1;
    game.garageState.upgrades.nitro = 2;
    player.inCar = true; player.car = car; player.x = 0; player.z = 27; player.angle = -Math.PI / 2; player.speed = 26;
    car.speed = 26;
    car.nitroBoost = 0.8;
    addWanted(game.police, 5);
    game.police.spawnTimer = 0;
    stagePolice(api, [[-35, 23, Math.PI / 2], [-38, 31, Math.PI / 2], [30, 27, -Math.PI / 2], [-20, 31, Math.PI / 2]]);
    game.police.heli = { angle: 0.6, x: -28, z: 22, y: 12, unit: HELI_UNIT };
    game.police.roadblock = { x: -42, z: 27, angle: Math.PI / 2, unit: VCPD_UNITS[2] };
    deployStrip(game.police.spikes, -55, 27, Math.PI / 2, 'VCPD-52', 0);
    stageWreck(api, 18, 33, Math.PI / 2);
    addRespect(game.respect, 1200);
    game.radioState.index = 2; // STORM RADIO — Weather Band
    api.startMission();
    stageGps(api);
    game.msg = null;
    game.cash = 41200;
    return;
  }
  if (name === 'business') {
    // v6 hero: Mara on foot on the marina quay, facing SOUTH toward
    // the sea — the Marina Fish Market ahead of her, bought and paid
    // for: its gold sign and level pips overhead, yachts and cranes in
    // the frame, mission 13 (Storm Warning) active with the GPS route
    // on. She stands just north of the market's own spot (237,243),
    // 11m from the sign post, so the sign is dead centre in frame.
    game.cash = 50000;
    buyBiz(game.business, 'fish-market', game.cash);
    game.cash -= 5000;
    player.inCar = false; player.car = null;
    player.x = 237; player.z = 232; player.angle = 0;
    addRespect(game.respect, 1500);
    game.radioState.index = 4; // MARINA 99.9 — Yacht Rock
    game.missions.index = 12; // Storm Warning
    api.startMission();
    stageGps(api);
    game.msg = null;
    game.cash = 45000;
    return;
  }
  if (name === 'arc') {
    // v6 hero: the King of Vesper finale, mission 15. Mara drives the
    // Storm Chaser 4x4 (amber light bar) at dusk on the marina quay,
    // the level-2 fish market ahead of her with two gold pips, the
    // lighthouse beam sweeping the harbour, and the finale's GPS route
    // on. The gate is genuinely met here: the market is bought and
    // upgraded to level 2, and respect is over 2,000.
    game.cash = 60000;
    let r = buyBiz(game.business, 'fish-market', game.cash);
    if (r.ok) game.cash -= r.cost;
    r = upgradeBiz(game.business, 'fish-market', game.cash);
    if (r.ok) game.cash -= r.cost;
    const car = makeCar({ id: 'storm4x4', name: 'Storm Chaser', color: [0.2, 0.35, 0.3], top: 29, accel: 20, brake: 30, grip: 3.2 }, 237, 252, Math.PI, { driver: false });
    player.inCar = true; player.car = car; player.x = 237; player.z = 252; player.angle = Math.PI; player.speed = 0;
    addRespect(game.respect, 2400);
    game.radioState.index = 5; // HURRICANE 88.8 — Storm Watch
    game.missions.index = 14; // King of Vesper
    api.startMission();
    stageGps(api);
    game.msg = null;
    game.cash = 50000;
    return;
  }
  if (name === 'wheel') {
    // v4: Mara on foot at golden hour with the weapon wheel open, the
    // Golden 12-Gauge hovered, two cruisers closing in, and the shotgun
    // ammo showing on the wheel. She stands on the z=27 boulevard
    // facing WEST into the low sun, so the street, the sun disc and the
    // cruisers are all in frame behind the wheel — never a blank wall.
    player.inCar = false; player.car = null;
    player.x = 27; player.z = 27; player.angle = -Math.PI / 2;
    game.combat.weapon = 3;
    game.combat.ammo[3] = 38;
    api.openWheel();
    game.wheel.hovered = 3;
    game.wheel.centerX = 640; game.wheel.centerY = 360;
    addWanted(game.police, 3);
    stagePolice(api, [[-12, 23, Math.PI / 2], [48, 31, -Math.PI / 2]]);
    game.police.heli = { angle: 0.4, x: -8, z: 20, y: 12, unit: HELI_UNIT };
    addRespect(game.respect, 500);
    game.radioState.index = 0;
    api.startMission();
    stageGps(api);
    game.msg = null;
    game.cash = 12400;
    return;
  }
  if (name === 'street') {
    // Mara on foot on the Sunset Shore beach boulevard, facing WEST into
    // the low sun, about to carjack the Sunset Cab waiting beside her —
    // the driver is already stepping out. Respect rank: Sunset Runner.
    player.inCar = false; player.car = null;
    player.x = 40; player.z = 240; player.angle = -Math.PI / 2;
    const taxi = makeCar({ id: 'taxi', name: 'Sunset Cab', color: [0.95, 0.8, 0.1], top: 26, accel: 17, brake: 30, grip: 2.7 }, 34, 243, Math.PI / 2, { driver: true });
    game.traffic = [taxi];
    addRespect(game.respect, 160);
    game.radioState.index = 0;
    api.startMission();
    game.msg = null;
    game.cash = 3200;
    return;
  }
  // mission: The Getaway in progress, driving WEST toward the sun on the
  // z=-27 road, the pink beacon marking the crew corner (-27,-27) straight
  // ahead, CONDOR-1 overhead, and a burning cruiser behind.
  const car = makeCar({ id: 'sedan', name: 'Vesper S', color: [0.72, 0.18, 0.24], top: 24, accel: 16, brake: 30, grip: 2.6 }, 27, -27, -Math.PI / 2, { driver: false });
  game.garageState.upgrades.armour = 1;
  player.inCar = true; player.car = car; player.x = 27; player.z = -27; player.angle = -Math.PI / 2; player.speed = 16;
  car.speed = 16;
  game.missions.index = 2; // The Getaway
  api.startMission();
  stageGps(api);
  game.msg = null; // staged shot: no intro banner over the HUD
  addWanted(game.police, 3);
  stagePolice(api, [[-20, -23, Math.PI / 2]]);
  game.police.heli = { angle: 0.4, x: -14, z: -22, y: 11, unit: HELI_UNIT };
  stageWreck(api, 45, -33, -Math.PI / 2);
  addRespect(game.respect, 400);
  game.radioState.index = 2; // STORM RADIO — Weather Band
  game.cash = 9800;
}
