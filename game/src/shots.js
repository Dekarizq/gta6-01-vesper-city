// shots.js — deterministic screenshot scenes behind ?shot=start|chase|street|mission.
// Each stages the real game state and then FREEZES it (game.frozen): the main
// loop draws the staged frame but the world does not advance, so the car,
// the cops and the helicopter stay exactly where they were placed. The chase
// and mission scenes drive WEST down the z=27 boulevard, straight toward the
// low sun at the end of the road, so the golden-hour disc is in frame.
import { SCREEN_PLAY } from './world.js';
import { addWanted } from './police.js';
import { makeCar } from './vehicles.js';

function stagePolice(api, spots) {
  const policeType = { id: 'police', name: 'VCPD Interceptor', color: [0.92, 0.92, 0.95], top: 30, accel: 20, brake: 34, grip: 3.0 };
  const names = ['VCPD-11', 'VCPD-25', 'VCPD-18'];
  for (let i = 0; i < spots.length; i += 1) {
    const [x, z, angle] = spots[i];
    const cop = makeCar(policeType, x, z, angle, { police: true, targetSpeed: 20, callsign: names[i % names.length] });
    cop.frozen = true;
    api.game.police.cops.push(cop);
  }
}

export function stageShot(name, api) {
  const { game, player } = api;
  game.screen = SCREEN_PLAY;
  game.frozen = true; // freeze every staged scene: nothing moves before the shot
  if (name === 'start') {
    // Title screen over a slow orbit of downtown: main.js keeps the title up.
    game.screen = 'title';
    player.x = 0; player.z = 60; player.angle = 0;
    return;
  }
  if (name === 'chase') {
    // Wanted-4 chase driving WEST toward the sun: Sunset GT, three white
    // cruisers ahead and behind, helicopter with its searchlight overhead.
    const car = makeCar({ id: 'coupe', name: 'Sunset GT', color: [0.95, 0.68, 0.18], top: 33, accel: 22, brake: 34, grip: 3.1 }, 0, 27, -Math.PI / 2, { driver: false });
    player.inCar = true; player.car = car; player.x = 0; player.z = 27; player.angle = -Math.PI / 2; player.speed = 24;
    car.speed = 24;
    addWanted(game.police, 4);
    game.police.spawnTimer = 0;
    stagePolice(api, [[-35, 23, Math.PI / 2], [-38, 31, Math.PI / 2], [30, 27, -Math.PI / 2]]);
    // Helicopter low and far ahead, offset 7 units off the road centre so it
    // sits BESIDE the sun disc instead of hiding behind it, its searchlight
    // beam slanting down to the player.
    game.police.heli = { angle: 0.6, x: -45, z: 20, y: 20 };
    game.police.roadblock = { x: -55, z: 27, angle: Math.PI / 2 };
    api.startMission();
    game.cash = 12480;
    return;
  }
  if (name === 'street') {
    // Mara on foot on the Sunset Shore beach boulevard, facing WEST into the
    // low sun, a Sunset Cab taxi waiting on the road beside her.
    player.inCar = false; player.car = null;
    player.x = 40; player.z = 240; player.angle = -Math.PI / 2;
    const taxi = makeCar({ id: 'taxi', name: 'Sunset Cab', color: [0.95, 0.8, 0.1], top: 26, accel: 17, brake: 30, grip: 2.7 }, 34, 243, Math.PI / 2, { driver: true });
    game.traffic = [taxi];
    api.startMission();
    game.cash = 1840;
    return;
  }
  // mission: The Getaway in progress, driving WEST toward the sun on the
  // z=-27 road, the pink beacon marking the crew corner (-27,-27) straight
  // ahead, helicopter overhead.
  const car = makeCar({ id: 'sedan', name: 'Vesper S', color: [0.72, 0.18, 0.24], top: 24, accel: 16, brake: 30, grip: 2.6 }, 27, -27, -Math.PI / 2, { driver: false });
  player.inCar = true; player.car = car; player.x = 27; player.z = -27; player.angle = -Math.PI / 2; player.speed = 16;
  car.speed = 16;
  game.missions.index = 2; // The Getaway
  api.startMission();
  addWanted(game.police, 3);
  stagePolice(api, [[-20, -23, Math.PI / 2]]);
  // Helicopter low and ahead, offset off the road centre so it sits beside
  // the beacon pillar instead of hiding behind it.
  game.police.heli = { angle: 0.4, x: -8, z: -20, y: 16 };
  game.cash = 9800;
}
