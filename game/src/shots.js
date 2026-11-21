// shots.js — deterministic screenshot scenes for Sunset Kings (v3) behind
// ?shot=start|chase|street|mission. Each stages the real game state and
// then FREEZES it (game.frozen): the main loop draws the staged frame but
// the world does not advance, so the car, the cops, the helicopter and the
// burning wreck stay exactly where they were placed. The chase and mission
// scenes drive WEST down the z=27 boulevard, straight toward the low sun
// at the end of the road, so the golden-hour disc is in frame — and now
// the chase also shows a smoking wreck and the upgraded Sunset GT, the
// street scene shows Mara carjacking a Sunset Cab, and every scene shows
// the respect rank, the radio station and the garage panel.
import { SCREEN_PLAY } from './world.js';
import { addWanted } from './police.js';
import { makeCar } from './vehicles.js';
import { VCPD_UNITS, HELI_UNIT } from './config.js';
import { addRespect } from './respect.js';

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
    // Wanted-4 chase driving WEST toward the sun: an engine-upgraded
    // Sunset GT, three named white cruisers ahead and behind, CONDOR-1
    // with its searchlight overhead, and a smoking wreck on the roadside
    // from the last explosion — the Sunset Kings at full speed.
    const car = makeCar({ id: 'coupe', name: 'Sunset GT', color: [0.95, 0.68, 0.18], top: 33, accel: 22, brake: 34, grip: 3.1 }, 0, 27, -Math.PI / 2, { driver: false });
    game.garageState.upgrades.engine = 2;
    game.garageState.upgrades.tires = 1;
    player.inCar = true; player.car = car; player.x = 0; player.z = 27; player.angle = -Math.PI / 2; player.speed = 24;
    car.speed = 24;
    addWanted(game.police, 4);
    game.police.spawnTimer = 0;
    stagePolice(api, [[-35, 23, Math.PI / 2], [-38, 31, Math.PI / 2], [30, 27, -Math.PI / 2]]);
    game.police.heli = { angle: 0.6, x: -28, z: 22, y: 12, unit: HELI_UNIT };
    game.police.roadblock = { x: -42, z: 27, angle: Math.PI / 2, unit: VCPD_UNITS[2] };
    stageWreck(api, 18, 33, Math.PI / 2);
    addRespect(game.respect, 420);
    game.radioState.index = 1; // SUNSET FM — Coast Drive
    api.startMission();
    game.msg = null; // staged shot: no intro banner over the HUD
    game.cash = 24800;
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
  game.msg = null; // staged shot: no intro banner over the HUD
  addWanted(game.police, 3);
  stagePolice(api, [[-20, -23, Math.PI / 2]]);
  game.police.heli = { angle: 0.4, x: -14, z: -22, y: 11, unit: HELI_UNIT };
  stageWreck(api, 45, -33, -Math.PI / 2);
  addRespect(game.respect, 400);
  game.radioState.index = 2; // STORM RADIO — Weather Band
  game.cash = 9800;
}
