// shots.js — deterministic screenshot scenes behind ?shot=start|chase|street|mission.
// Each stages the real game state, then the main loop runs it live for a few
// seconds so the frame is what the game really looks like; main.js sets
// window.__shotReady once the scene has settled.
import { SCREEN_PLAY } from './world.js';
import { addWanted } from './police.js';
import { makeCar } from './vehicles.js';

export function stageShot(name, api) {
  const { game, player } = api;
  game.screen = SCREEN_PLAY;
  if (name === 'start') {
    // Title screen over a slow orbit of downtown: main.js keeps the title up.
    game.screen = 'title';
    player.x = 0; player.z = 60; player.angle = 0;
    return;
  }
  if (name === 'chase') {
    // Driving chase: wanted 3 stars, two cop cars, helicopter, mission active.
    // Staged on road z=27, driving east, so the car stays on the road.
    const car = makeCar({ id: 'coupe', name: 'Neon GT', color: [0.15, 0.55, 0.95], top: 33, accel: 22, brake: 34, grip: 3.1 }, 0, 27, Math.PI / 2, { driver: false });
    player.inCar = true; player.car = car; player.x = 0; player.z = 27; player.angle = Math.PI / 2; player.speed = 18;
    car.speed = 18;
    addWanted(game.police, 3);
    game.police.spawnTimer = 0;
    // Stage VCPD cruisers visibly ahead on the same road (frozen in place so
    // the screenshot catches the chase) and one behind.
    const policeType = { id: 'police', name: 'VCPD Interceptor', color: [0.08, 0.12, 0.2], top: 30, accel: 20, brake: 34, grip: 3.0 };
    game.police.cops.push(
      makeCar(policeType, 35, 23, -Math.PI / 2, { police: true, targetSpeed: 20 }),
      makeCar(policeType, 38, 31, -Math.PI / 2, { police: true, targetSpeed: 20 }),
      makeCar(policeType, -30, 27, Math.PI / 2, { police: true, targetSpeed: 20 }),
    );
    for (const cop of game.police.cops) cop.frozen = true;
    api.startMission();
    game.cash = 1850;
    return;
  }
  if (name === 'street') {
    // On foot at a neon road intersection, facing east down the road.
    player.inCar = false; player.car = null;
    player.x = -27; player.z = -27; player.angle = Math.PI / 2;
    game.cash = 640;
    return;
  }
  // mission: getaway in progress with the objective beacon visible.
  const car = makeCar({ id: 'sedan', name: 'Vesper S', color: [0.72, 0.18, 0.24], top: 24, accel: 16, brake: 30, grip: 2.6 }, -27, 27, Math.PI / 2, { driver: false });
  player.inCar = true; player.car = car; player.x = -27; player.z = 27; player.angle = Math.PI / 2; player.speed = 12;
  car.speed = 12;
  game.missions.index = 2; // The Getaway
  api.startMission();
  game.cash = 1200;
}
