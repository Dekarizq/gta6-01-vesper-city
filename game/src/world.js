// world.js — the game itself: player state, the loop's update, and how every
// system (driving, stealing, police, missions, combat, storm clock) fits
// together. No drawing here except collecting the boxes the engine renders.
import { WORLD, PLAYER, STEP } from './config.js';
import { clamp, dist2, angleLerp } from './random.js';
import { generateCity, citySize, isOnRoad, roadPointNear } from './city.js';
import { makeCar, spawnTraffic, stepTraffic, stepPlayerCar, nearestCar, carBoxes } from './vehicles.js';
import { spawnPedestrians, stepPedestrians, pedBoxes } from './pedestrians.js';
import { createPolice, addWanted, stepPolice, heliBoxes } from './police.js';
import { buildMissions, createMissionState, currentMission, currentStep, updateMission } from './missions.js';
import { createCombat, shoot, punch, stepCombat } from './combat.js';

export const SCREEN_TITLE = 'title';
export const SCREEN_PLAY = 'play';
export const SCREEN_PAUSED = 'paused';
export const SCREEN_DEAD = 'dead';

export function createGame(rng) {
  const city = generateCity(rng);
  const missions = buildMissions(city);
  const size = citySize();
  const player = {
    x: 0, z: 40, angle: 0, speed: 0, health: PLAYER.health,
    inCar: false, car: null, armed: true, hurtFlash: 0,
  };
  const game = {
    city, missions: createMissionState(missions), police: createPolice(), combat: createCombat(),
    player, cash: 250, elapsed: 0, time: 0, screen: SCREEN_TITLE,
    traffic: [], peds: [], garage: ['sedan'], ramTimer: 0,
    msg: null, gunshot: false, mapOpen: false, muted: false,
    stats: { carsStolen: 0, missionsDone: 0, kills: 0 },
  };
  game.traffic = spawnTraffic(rng, 16, player.x, player.z);
  game.peds = spawnPedestrians(rng, 26, player.x, player.z);

  function reset(newGame) {
    player.x = 0; player.z = 40; player.angle = 0; player.speed = 0;
    player.health = PLAYER.health; player.inCar = false; player.car = null;
    game.cash = 250; game.elapsed = 0;
    game.missions = createMissionState(missions);
    game.police = createPolice();
    game.combat = createCombat();
    game.stats = { carsStolen: 0, missionsDone: 0, kills: 0 };
    game.traffic = spawnTraffic(rng, 16, player.x, player.z);
    game.peds = spawnPedestrians(rng, 26, player.x, player.z);
    if (newGame) game.screen = SCREEN_PLAY;
  }

  function applySave(data) {
    player.x = data.x; player.z = data.z; player.angle = data.angle || 0;
    player.health = data.health ?? 100;
    game.cash = data.cash ?? 250;
    game.elapsed = data.elapsed || 0;
    game.missions.index = data.missionIndex || 0;
    game.missions.done = data.missionDone || 0;
    game.police.wanted = data.wanted || 0;
    game.garage = data.garage || ['sedan'];
    game.traffic = spawnTraffic(rng, 16, player.x, player.z);
    game.peds = spawnPedestrians(rng, 26, player.x, player.z);
    game.screen = SCREEN_PLAY;
  }

  function startMission() {
    const m = currentMission(game.missions);
    if (!m) { game.msg = 'All 10 missions complete — Vesper City is yours, Mara.'; return; }
    if (game.missions.active) { game.msg = 'Mission already active: ' + m.title; return; }
    game.missions.active = true;
    game.missions.step = 0;
    game.missions.startedAt = game.elapsed;
    game.msg = m.title + ' — ' + m.intro;
  }

  function restartMission() {
    const m = currentMission(game.missions);
    if (!m) return;
    game.missions.active = false;
    game.missions.step = 0;
    startMission();
  }

  function enterCar() {
    if (player.inCar) {
      // Exit the car: step out beside it.
      const car = player.car;
      player.inCar = false; player.car = null;
      player.x = car.x + Math.cos(car.angle) * 3;
      player.z = car.z - Math.sin(car.angle) * 3;
      player.angle = car.angle;
      game.msg = 'You left the ' + car.type.name + '.';
      return;
    }
    const car = nearestCar(game.traffic, player.x, player.z, 5);
    if (!car) { game.msg = 'No car nearby — walk to a car on the road and press E.'; return; }
    const wasPolice = car.police;
    game.traffic = game.traffic.filter((c) => c !== car);
    player.inCar = true; player.car = car; player.speed = 0;
    game.stats.carsStolen += 1;
    if (car.driver && !wasPolice) {
      addWanted(game.police, 1);
      game.msg = 'Stolen ' + car.type.name + '! The owner called the VCPD — wanted ★.';
    } else game.msg = 'You took the ' + car.type.name + '.';
  }

  function fireWeapon() {
    if (player.inCar) return; // no drive-by shooting in this build
    const hit = shoot(game.combat, player, game.peds, game.police.cops, game.time);
    if (!hit) return;
    game.gunshot = true;
    if (hit.kind === 'cop') {
      game.police.cops = game.police.cops.filter((c) => c !== hit.ref);
      addWanted(game.police, 1);
      game.msg = 'Officer down! Wanted level rose.';
    } else if (hit.kind === 'ped') {
      addWanted(game.police, 1);
      game.msg = 'A bystander is down. Someone called the police.';
    }
  }

  function step(dt, input, audio) {
    game.time += dt;
    game.elapsed += dt;
    game.gunshot = false;
    if (game.ramTimer > 0) game.ramTimer -= dt;
    const p = player;
    // --- movement ---
    if (p.inCar && p.car) {
      stepPlayerCar(p.car, input, dt);
      p.x = p.car.x; p.z = p.car.z; p.angle = p.car.angle; p.speed = p.car.speed;
      // Running over pedestrians is a crime.
      for (const ped of game.peds) {
        if (!ped.dead && dist2(ped.x, ped.z, p.x, p.z) < 4) {
          ped.dead = true;
          addWanted(game.police, 1);
          game.msg = 'You hit a pedestrian! Wanted ★.';
        }
      }
      // Bumping a cop car raises heat (at most once every 3 s).
      for (const cop of game.police.cops) {
        if (dist2(cop.x, cop.z, p.x, p.z) < 6 && Math.abs(p.speed) > 8 && game.ramTimer <= 0) {
          addWanted(game.police, 1);
          game.msg = 'You rammed a VCPD cruiser!';
          p.speed *= 0.5;
          game.ramTimer = 3;
        }
      }
    } else {
      const fwd = input.forward();
      const steer = input.steer();
      const sprint = input.sprint();
      const speed = sprint ? PLAYER.sprintSpeed : PLAYER.walkSpeed;
      if (fwd !== 0 || steer !== 0) {
        const moveAngle = p.angle + (steer !== 0 && fwd === 0 ? steer * Math.PI / 2 : 0);
        const dir = fwd >= 0 ? 1 : -1;
        const turn = steer * 2.6 * dt;
        p.angle += fwd !== 0 ? turn * (fwd > 0 ? 1 : -1) : turn;
        p.x += Math.sin(p.angle) * speed * dir * dt * (fwd !== 0 ? 1 : 0);
        p.z += Math.cos(p.angle) * speed * dir * dt * (fwd !== 0 ? 1 : 0);
        if (fwd === 0 && steer !== 0) {
          p.x += Math.sin(moveAngle) * speed * 0.5 * dt;
          p.z += Math.cos(moveAngle) * speed * 0.5 * dt;
        }
      }
      p.speed = 0;
      const half = citySize() / 2 + 30;
      p.x = clamp(p.x, -half, half);
      p.z = clamp(p.z, -half, half);
    }
    // --- world life ---
    for (const car of game.traffic) stepTraffic(car, dt, rng);
    // Keep traffic near the player.
    if (game.traffic.length < 14) {
      const extra = spawnTraffic(rng, 2, p.x, p.z);
      game.traffic.push(...extra);
    }
    game.traffic = game.traffic.filter((c) => dist2(c.x, c.z, p.x, p.z) < 220 * 220);
    stepPedestrians(game.peds, dt, p, game.traffic.concat(game.police.cops), game.gunshot);
    if (game.peds.filter((x) => !x.dead).length < 18) {
      game.peds.push(...spawnPedestrians(rng, 4, p.x, p.z));
    }
    stepPolice(game.police, dt, p, rng);
    stepCombat(game.combat, dt, p, game.police);
    // Cop bullets already applied in stepCombat; ramming damage on foot.
    for (const cop of game.police.cops) {
      if (!p.inCar && dist2(cop.x, cop.z, p.x, p.z) < 5) {
        p.health -= 20 * dt;
        p.hurtFlash = 0.2;
      }
    }
    // --- missions ---
    const result = updateMission(game.missions, p.x, p.z, dt);
    if (result === 'step') {
      const step = currentStep(game.missions);
      game.msg = step ? step.text : '';
      if (audio) audio.chime();
    } else if (result === 'done') {
      const done = game.missions.list[game.missions.index - 1];
      game.cash += done.reward;
      game.stats.missionsDone += 1;
      game.msg = `Mission complete: ${done.title} — earned $${done.reward}!`;
      if (audio) audio.chime();
      // Unlock a garage car every two missions.
      const unlocks = ['taxi', 'van', 'coupe'];
      const u = unlocks[Math.floor(game.stats.missionsDone / 2) - 1];
      if (u && !game.garage.includes(u)) {
        game.garage.push(u);
        game.msg += ` Garage unlocked a ${u}!`;
      }
    }
    // --- storm: rain intensifies as the week runs out ---
    game.rain = clamp(0.4 + (game.elapsed / (WORLD.dayLength * WORLD.stormDays)) * 0.6, 0.4, 1);
    // --- death ---
    if (p.health <= 0) {
      game.screen = SCREEN_DEAD;
      game.cash = Math.max(0, game.cash - 200);
      game.police.wanted = 0;
    }
    // --- audio ---
    if (audio) {
      audio.setEngine(p.inCar ? p.speed : 0, p.inCar);
      audio.setSiren(game.police.wanted, dt);
      audio.setRain(game.rain);
    }
  }

  function collectBoxes(time) {
    const boxes = [];
    for (const car of game.traffic) boxes.push(...carBoxes(car));
    for (const cop of game.police.cops) boxes.push(...carBoxes(cop));
    if (game.player.car) boxes.push(...carBoxes(game.player.car));
    for (const ped of game.peds) boxes.push(...pedBoxes(ped));
    // Player on foot.
    const p = player;
    if (!p.inCar) {
      const bob = Math.sin(game.time * 8) * 0.05;
      boxes.push(
        { x: p.x, y: 0.5 + bob, z: p.z, w: 0.65, h: 1.0, d: 0.5, color: [0.85, 0.25, 0.45], yaw: p.angle },
        { x: p.x, y: 1.2 + bob, z: p.z, w: 0.5, h: 0.5, d: 0.5, color: [0.9, 0.75, 0.6], yaw: p.angle },
      );
      if (p.armed) {
        boxes.push({ x: p.x + Math.sin(p.angle) * 0.5, y: 0.9, z: p.z + Math.cos(p.angle) * 0.5, w: 0.15, h: 0.15, d: 0.9, color: [0.15, 0.15, 0.18], yaw: p.angle });
      }
    }
    // Mission marker: glowing beacon pillar + floating diamond.
    const step = currentStep(game.missions);
    if (game.missions.active && step) {
      const pulse = 1 + Math.sin(time * 3) * 0.25;
      boxes.push(
        { x: step.x, y: 6, z: step.z, w: 1.2 * pulse, h: 12, d: 1.2 * pulse, color: [1, 0.18, 0.53], yaw: 0 },
        { x: step.x, y: 2.5 + Math.sin(time * 2) * 0.4, z: step.z, w: 1.6, h: 1.6, d: 1.6, color: [1, 0.85, 0.2], yaw: time },
      );
    }
    // Roadblock cars.
    if (game.police.roadblock) {
      const rb = game.police.roadblock;
      boxes.push(
        { x: rb.x, y: 0.55, z: rb.z, w: 2.0, h: 0.75, d: 4.4, color: [0.08, 0.12, 0.2], yaw: rb.angle },
        { x: rb.x + 6, y: 0.55, z: rb.z + 2, w: 2.0, h: 0.75, d: 4.4, color: [0.08, 0.12, 0.2], yaw: rb.angle },
      );
    }
    boxes.push(...heliBoxes(game.police.heli, time));
    // Muzzle flash.
    if (game.combat.muzzle > 0) {
      boxes.push({ x: p.x + Math.sin(p.angle) * 1.2, y: 1.0, z: p.z + Math.cos(p.angle) * 1.2, w: 0.6, h: 0.6, d: 0.6, color: [1, 0.9, 0.4], yaw: 0 });
    }
    return boxes;
  }

  function hudState() {
    const step = currentStep(game.missions);
    const m = currentMission(game.missions);
    return {
      cash: game.cash, health: Math.round(player.health),
      wanted: game.police.wanted, elapsed: game.elapsed,
      x: player.x, z: player.z, angle: player.angle,
      carName: player.inCar && player.car ? player.car.type.name : null,
      cops: game.police.cops,
      missionStep: game.missions.active ? step : null,
      objective: game.missions.active && m && step ? {
        title: m.title,
        text: step.text,
        dist: Math.sqrt(dist2(player.x, player.z, step.x, step.z)),
      } : null,
    };
  }

  function respawn() {
    const hosp = game.city.landmarks.find((l) => l.id === 'hospital');
    player.x = hosp.x; player.z = hosp.z; player.health = 60;
    player.inCar = false; player.car = null;
    game.police = createPolice();
    game.screen = SCREEN_PLAY;
    game.msg = 'Mara wakes up at St. Mara Hospital. The city keeps raining.';
  }

  return {
    game, player, city, reset, applySave, startMission, restartMission,
    enterCar, fireWeapon, step, collectBoxes, hudState, respawn,
  };
}
