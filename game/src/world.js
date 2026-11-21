// world.js — the game itself for Sunset Kings (v3): player state, the
// loop's update, and how every system fits together — driving, stealing,
// police, missions, combat, the storm clock, and the v3 systems: the
// Sunset Garage upgrade shop, three procedural radio stations, the
// Sunset Kings respect ladder and crew, named VCPD units, and cars that
// burn and explode into smoking wrecks. No drawing here except collecting
// the boxes the engine renders. Golden Hour: building collision keeps
// cars and pedestrians out of towers, armour absorbs damage before
// health, and the HUD state carries everything the dense rank-1-style
// HUD needs.
import { WORLD, PLAYER, STEP, WEAPONS, GAME_TITLE } from './config.js';
import { clamp, dist2, angleLerp } from './random.js';
import { generateCity, citySize, isOnRoad, roadPointNear, resolveBuildingCollision, sunVisibleFrom } from './city.js';
import { makeCar, spawnTraffic, stepTraffic, stepPlayerCar, nearestCar, carBoxes, damageCar, stepBurning } from './vehicles.js';
import { spawnPedestrians, spawnCrew, stepPedestrians, pedBoxes } from './pedestrians.js';
import { createPolice, addWanted, stepPolice, heliBoxes, copStatus, copDisplay } from './police.js';
import { buildMissions, createMissionState, currentMission, currentStep, updateMission } from './missions.js';
import { createCombat, shoot, punch, stepCombat, switchWeapon, currentWeapon, applyBlast } from './combat.js';
import { createCollectibles, SUN_COIN_BONUS, SUN_COIN_RESPECT, SUN_STREAK_RESPECT } from './collectibles.js';
import { createGarage, buyUpgrade, applyUpgrades, garageCost, garageLoad, garageBoxes, GARAGE_UPGRADES } from './garage.js';
import { createRadio, nextStation, radioStep, radioLabel, RADIO_STATIONS } from './radio.js';
import { createRespect, addRespect, crewJoined, garageDiscount, streakMultiplier, missionCashMultiplier, respectLoad, respectRank, RESPECT_POINTS } from './respect.js';

export const SCREEN_TITLE = 'title';
export const SCREEN_PLAY = 'play';
export const SCREEN_PAUSED = 'paused';
export const SCREEN_DEAD = 'dead';

export function createGame(rng) {
  const city = generateCity(rng);
  const missions = buildMissions(city);
  const coins = createCollectibles();
  const size = citySize();
  const garageLandmark = city.landmarks.find((l) => l.id === 'garage');
  const player = {
    x: 0, z: 40, angle: 0, speed: 0, health: PLAYER.health, armour: PLAYER.armour,
    inCar: false, car: null, armed: true, hurtFlash: 0,
  };
  const game = {
    city, missions: createMissionState(missions), police: createPolice(), combat: createCombat(),
    coins, player, cash: 250, elapsed: 0, time: 0, screen: SCREEN_TITLE,
    traffic: [], peds: [], garage: ['sedan'], ramTimer: 0,
    msg: null, gunshot: false, mapOpen: false, muted: false, frozen: false,
    stats: { carsStolen: 0, missionsDone: 0, kills: 0, explosions: 0, upgradesBought: 0 },
    sunClear: sunVisibleFrom(0, 27, city.buildings),
    garageState: createGarage(),
    radioState: createRadio(),
    respect: createRespect(),
    garageLandmark,
    wrecks: [],
  };
  game.traffic = spawnTraffic(rng, 16, player.x, player.z);
  game.peds = spawnPedestrians(rng, 26, player.x, player.z);
  game.peds.push(...spawnCrew(rng, garageLandmark));

  function reset(newGame) {
    player.x = 0; player.z = 40; player.angle = 0; player.speed = 0;
    player.health = PLAYER.health; player.armour = PLAYER.armour;
    player.inCar = false; player.car = null;
    game.cash = 250; game.elapsed = 0;
    game.missions = createMissionState(missions);
    game.police = createPolice();
    game.combat = createCombat();
    coins.reset();
    game.garageState = createGarage();
    game.radioState = createRadio();
    game.respect = createRespect();
    game.wrecks = [];
    game.stats = { carsStolen: 0, missionsDone: 0, kills: 0, explosions: 0, upgradesBought: 0 };
    game.traffic = spawnTraffic(rng, 16, player.x, player.z);
    game.peds = spawnPedestrians(rng, 26, player.x, player.z);
    game.peds.push(...spawnCrew(rng, garageLandmark));
    if (newGame) game.screen = SCREEN_PLAY;
  }

  function applySave(data) {
    player.x = data.x; player.z = data.z; player.angle = data.angle || 0;
    player.health = data.health ?? 100;
    player.armour = data.armour ?? 100;
    game.cash = data.cash ?? 250;
    game.elapsed = data.elapsed || 0;
    game.missions.index = data.missionIndex || 0;
    game.missions.done = data.missionDone || 0;
    game.combat.weapon = data.weapon ?? 1;
    if (Array.isArray(data.ammo)) game.combat.ammo = data.ammo;
    game.police.wanted = data.wanted || 0;
    game.garage = data.garage || ['sedan'];
    if (data.garageState) game.garageState = garageLoad(data.garageState);
    if (Number.isInteger(data.radioIndex)) game.radioState.index = data.radioIndex;
    if (data.respect) game.respect = respectLoad(data.respect);
    if (data.coins) coins.load(data.coins);
    game.traffic = spawnTraffic(rng, 16, player.x, player.z);
    game.peds = spawnPedestrians(rng, 26, player.x, player.z);
    game.peds.push(...spawnCrew(rng, garageLandmark));
    game.screen = SCREEN_PLAY;
  }

  function startMission() {
    const m = currentMission(game.missions);
    if (!m) { game.msg = 'All 10 missions complete — Vesper City is yours, Sunset King.'; return; }
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

  // Carjacking (v3): steal the nearest driveable car. A driven car pays
  // respect and wanted; a parked car is free. Every stolen car is named
  // in the message, and the garage-effective stats apply when Mara drives.
  function enterCar() {
    if (player.inCar) {
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
    const gained = addRespect(game.respect, RESPECT_POINTS.carStolen);
    if (car.driver && !wasPolice) {
      addWanted(game.police, 1);
      game.msg = `Carjacked the ${car.type.name}! The owner called the VCPD — wanted ★. +${RESPECT_POINTS.carStolen} respect.`;
    } else game.msg = `You took the ${car.type.name}. +${RESPECT_POINTS.carStolen} respect.`;
    if (gained.rankUp) game.msg += ` Rank up: ${gained.rank.name}!`;
  }

  // Buy the next garage upgrade, but only in the garage yard.
  function buyGarageUpgrade(id) {
    const g = game.garageLandmark;
    if (!g || dist2(player.x, player.z, g.x, g.z) > 40 * 40) {
      game.msg = 'Drive to the Sunset Garage yard and press G to buy upgrades.';
      return;
    }
    const discount = garageDiscount(game.respect.points);
    const result = buyUpgrade(game.garageState, game.cash, id, discount);
    if (!result.ok) { game.msg = result.msg; return; }
    game.cash -= result.cost;
    game.stats.upgradesBought += 1;
    game.msg = discount > 0
      ? `${result.msg} ($${result.cost}) — Rook tuned it in.`
      : `${result.msg} ($${result.cost}).`;
  }

  function cycleGarageUpgrade() {
    // G cycles the shop: buy the cheapest next upgrade the player can
    // afford, so one key does the whole shop in the heat of a chase.
    const discount = garageDiscount(game.respect.points);
    let best = null;
    for (const def of GARAGE_UPGRADES) {
      const cost = garageCost(game.garageState, def.id, discount);
      if (cost === null || game.cash < cost) continue;
      if (!best || cost < best.cost) best = { id: def.id, cost };
    }
    if (!best) { game.msg = 'No upgrade you can afford right now — earn cash on a mission first.'; return; }
    buyGarageUpgrade(best.id);
  }

  function nextRadio() {
    const station = nextStation(game.radioState);
    game.msg = `♪ ${station.name} — ${station.show}`;
    return station;
  }

  function fireWeapon() {
    if (player.inCar) return;
    const weapon = currentWeapon(game.combat);
    if (game.combat.weapon === 0) {
      const hit = punch(player, game.peds.filter((p) => !p.crew));
      game.combat.shotsFired += 1;
      if (hit) { addWanted(game.police, 1); game.msg = 'You knocked a bystander down.'; }
      return;
    }
    const hit = shoot(game.combat, player, game.peds.filter((p) => !p.crew), game.police.cops, game.time, game.traffic);
    if (!hit) return;
    if (hit.kind === 'dry') { game.msg = weapon.name + ' is empty — press 1 for fists or find ammo.'; return; }
    game.gunshot = true;
    if (hit.kind === 'cop') {
      game.police.cops = game.police.cops.filter((c) => c !== hit.ref);
      addWanted(game.police, 1);
      const gained = addRespect(game.respect, RESPECT_POINTS.copDown);
      game.msg = `Officer down! Wanted level rose. +${RESPECT_POINTS.copDown} respect.`;
      if (gained.rankUp) game.msg += ` Rank up: ${gained.rank.name}!`;
      if (hit.damage === 'burning') game.msg += ' The cruiser is on fire!';
    } else if (hit.kind === 'ped') {
      addWanted(game.police, 1);
      game.msg = 'A bystander is down. Someone called the police.';
    } else if (hit.kind === 'car') {
      if (hit.damage === 'burning') game.msg = `The ${hit.ref.type.name} is on fire!`;
      else if (hit.damage === 'exploded') game.msg = `The ${hit.ref.type.name} blew up!`;
      else game.msg = `You hit the ${hit.ref.type.name}.`;
    }
  }

  function changeWeapon(index) {
    if (switchWeapon(game.combat, index)) {
      game.msg = 'Weapon: ' + WEAPONS[index].name + '.';
    }
  }

  function step(dt, input, audio) {
    if (game.frozen) return;
    game.time += dt;
    game.elapsed += dt;
    game.gunshot = false;
    if (game.ramTimer > 0) game.ramTimer -= dt;
    const p = player;
    // --- radio: the station clock ticks and plays its next note ---
    const note = radioStep(game.radioState, dt);
    if (note && audio && audio.radioNote) audio.radioNote(note.freq, note.dur);
    // --- movement ---
    if (p.inCar && p.car && p.car.wreck) {
      player.inCar = false; player.car = null;
      game.msg = 'Your car blew up — you bailed out just in time!';
    }
    if (p.inCar && p.car) {
      const stats = applyUpgrades(p.car.type, game.garageState.upgrades);
      stepPlayerCar(p.car, input, dt, stats);
      const fixed = resolveBuildingCollision(p.car.x, p.car.z, 2.2, game.city.buildings);
      if (fixed.x !== p.car.x || fixed.z !== p.car.z) {
        p.car.speed *= 0.4;
        damageCar(p.car, 6);
      }
      p.car.x = fixed.x; p.car.z = fixed.z;
      p.x = p.car.x; p.z = p.car.z; p.angle = p.car.angle; p.speed = p.car.speed;
      for (const ped of game.peds) {
        if (!ped.dead && !ped.crew && dist2(ped.x, ped.z, p.x, p.z) < 4) {
          ped.dead = true;
          addWanted(game.police, 1);
          game.msg = 'You hit a pedestrian! Wanted ★.';
        }
      }
      for (const cop of game.police.cops) {
        if (dist2(cop.x, cop.z, p.x, p.z) < 6 && Math.abs(p.speed) > 8 && game.ramTimer <= 0) {
          addWanted(game.police, 1);
          game.msg = 'You rammed a VCPD cruiser!';
          p.speed *= 0.5;
          game.ramTimer = 3;
          damageCar(cop, 25);
        }
      }
      // Slamming a burning car into a wall finishes it off.
      if (p.car.burning && p.car.health <= 0) damageCar(p.car, 1);
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
      const fixed = resolveBuildingCollision(p.x, p.z, PLAYER.radius, game.city.buildings);
      p.x = fixed.x; p.z = fixed.z;
    }
    // --- world life ---
    for (const car of game.traffic) stepTraffic(car, dt, rng);
    if (game.traffic.length < 14) {
      const extra = spawnTraffic(rng, 2, p.x, p.z);
      game.traffic.push(...extra);
    }
    game.traffic = game.traffic.filter((c) => dist2(c.x, c.z, p.x, p.z) < 220 * 220);
    stepPedestrians(game.peds, dt, p, game.traffic.concat(game.police.cops), game.gunshot, game.city.buildings);
    if (game.peds.filter((x) => !x.dead).length < 18) {
      game.peds.push(...spawnPedestrians(rng, 4, p.x, p.z));
    }
    stepPolice(game.police, dt, p, rng);
    stepCombat(game.combat, dt, p, game.police);
    for (const cop of game.police.cops) {
      if (!p.inCar && dist2(cop.x, cop.z, p.x, p.z) < 5) {
        p.health -= 20 * dt;
        p.hurtFlash = 0.2;
      }
    }
    // --- burning cars and explosions (v3) ---
    const allCars = game.traffic.concat(game.police.cops);
    if (p.car) allCars.push(p.car);
    for (const ev of stepBurning(allCars, dt)) {
      game.stats.explosions += 1;
      game.wrecks.push({ x: ev.car.x, z: ev.car.z, time: game.time });
      if (audio && audio.explosion) audio.explosion();
      applyBlast(p, allCars, ev.car.x, ev.car.z);
      const gained = addRespect(game.respect, RESPECT_POINTS.explosion);
      game.msg = `BOOM! The ${ev.car.type.name} blew up! +${RESPECT_POINTS.explosion} respect.`;
      if (gained.rankUp) game.msg += ` Rank up: ${gained.rank.name}!`;
      addWanted(game.police, 1);
    }
    // --- missions ---
    const result = updateMission(game.missions, p.x, p.z, dt);
    if (result === 'step') {
      const step = currentStep(game.missions);
      game.msg = step ? step.text : '';
      if (audio) audio.chime();
    } else if (result === 'done') {
      const done = game.missions.list[game.missions.index - 1];
      const mult = missionCashMultiplier(game.respect.points);
      const reward = Math.round(done.reward * mult);
      game.cash += reward;
      game.stats.missionsDone += 1;
      const gained = addRespect(game.respect, done.respect || RESPECT_POINTS.mission);
      game.msg = `Mission complete: ${done.title} — earned $${reward}! +${done.respect || RESPECT_POINTS.mission} respect.`;
      if (gained.rankUp) game.msg += ` Rank up: ${gained.rank.name}! ${gained.joined.map((c) => c.name + ' joined the crew!').join(' ')}`;
      if (audio) audio.chime();
      const unlocks = ['taxi', 'van', 'coupe', 'muscle'];
      const u = unlocks[Math.floor(game.stats.missionsDone / 2) - 1];
      if (u && !game.garage.includes(u)) {
        game.garage.push(u);
        game.msg += ` Garage unlocked a ${u}!`;
      }
    }
    // --- Sun Coins ---
    for (const ev of coins.update(dt, p.x, p.z, game.elapsed)) {
      if (ev.type === 'pickup') {
        addRespect(game.respect, SUN_COIN_RESPECT);
        game.msg = `Sun Coin ${ev.collected}/${ev.total} — ${ev.name}! +${SUN_COIN_RESPECT} respect.`;
        if (audio) audio.chime();
      } else if (ev.type === 'complete') {
        game.cash += SUN_COIN_BONUS;
        game.msg = `All ${coins.total} Sun Coins! Dario pays the $${ev.bonus} bonus.`;
        if (audio) audio.chime();
      } else if (ev.type === 'streak') {
        const bonus = ev.bonus * streakMultiplier(game.respect.points);
        game.cash += bonus;
        addRespect(game.respect, SUN_STREAK_RESPECT);
        game.msg = `Sun Streak x${ev.streak}! Dario slips you $${bonus} for the hot run.`;
        if (audio) audio.chime();
      } else if (ev.type === 'respawn') {
        game.msg = `Day ${ev.day} dawns — the Sun Coins are hidden again.`;
      }
    }
    game.rain = clamp(0.12 + (game.elapsed / (WORLD.dayLength * WORLD.stormDays)) * 0.1, 0.12, 0.25);
    if (p.health <= 0) {
      game.screen = SCREEN_DEAD;
      game.cash = Math.max(0, game.cash - 200);
      game.police.wanted = 0;
    }
    if (audio) {
      audio.setEngine(p.inCar ? p.speed : 0, p.inCar);
      audio.setSiren(game.police.wanted, dt);
      audio.setRain(game.rain);
      if (audio.setRadioStation) audio.setRadioStation(game.radioState ? RADIO_STATIONS[game.radioState.index]?.id || 'vesper' : 'vesper');
    }
  }

  function collectBoxes(time) {
    const boxes = [];
    for (const car of game.traffic) boxes.push(...carBoxes(car, time));
    for (const cop of game.police.cops) boxes.push(...carBoxes(cop, time));
    if (game.player.car) boxes.push(...carBoxes(game.player.car, time));
    for (const ped of game.peds) boxes.push(...pedBoxes(ped));
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
    const step = currentStep(game.missions);
    if (game.missions.active && step) {
      const pulse = 1 + Math.sin(time * 3) * 0.25;
      boxes.push(
        { x: step.x, y: 9, z: step.z, w: 2.4 * pulse, h: 18, d: 2.4 * pulse, color: [1, 0.18, 0.53], yaw: 0 },
        { x: step.x, y: 3.2 + Math.sin(time * 2) * 0.4, z: step.z, w: 2.6, h: 2.6, d: 2.6, color: [1, 0.85, 0.2], yaw: time },
      );
    }
    if (game.police.roadblock) {
      const rb = game.police.roadblock;
      boxes.push(
        { x: rb.x, y: 0.55, z: rb.z, w: 2.0, h: 0.75, d: 4.4, color: [0.93, 0.93, 0.96], yaw: rb.angle },
        { x: rb.x + 6, y: 0.55, z: rb.z + 2, w: 2.0, h: 0.75, d: 4.4, color: [0.93, 0.93, 0.96], yaw: rb.angle },
      );
    }
    boxes.push(...heliBoxes(game.police.heli, time, player));
    boxes.push(...coins.boxes(time));
    // Sunset Garage yard sign + show car.
    if (game.garageLandmark) boxes.push(...garageBoxes(game.garageLandmark, time));
    if (game.combat.muzzle > 0) {
      boxes.push({ x: p.x + Math.sin(p.angle) * 1.2, y: 1.0, z: p.z + Math.cos(p.angle) * 1.2, w: 0.6, h: 0.6, d: 0.6, color: [1, 0.9, 0.4], yaw: 0 });
    }
    return boxes;
  }

  function hudState() {
    const step = currentStep(game.missions);
    const m = currentMission(game.missions);
    const weapon = currentWeapon(game.combat);
    const respect = game.respect;
    return {
      cash: game.cash, health: Math.round(player.health), armour: Math.round(player.armour || 0),
      wanted: game.police.wanted, elapsed: game.elapsed,
      x: player.x, z: player.z, angle: player.angle,
      speedKmh: Math.round(Math.abs(player.speed || 0) * 3.2),
      carName: player.inCar && player.car ? player.car.type.name : null,
      carCondition: player.inCar && player.car ? Math.round(player.car.condition ?? 100) : null,
      cops: game.police.cops.map((c) => copDisplay(c, player)),
      heliUp: !!game.police.heli,
      heliUnit: game.police.heli ? game.police.heli.unit : null,
      roadblock: !!game.police.roadblock,
      weapons: WEAPONS.map((w, i) => ({ name: w.name, ammo: game.combat.ammo[i], active: i === game.combat.weapon })),
      weaponName: weapon.name,
      missionIndex: game.missions.index, missionTotal: game.missions.list.length,
      missionGiver: m ? m.giver : null,
      missionStep: game.missions.active ? step : null,
      radio: radioLabel(game.radioState),
      radioStation: game.radioState ? game.radioState.index : 0,
      coins: { collected: coins.count(), total: coins.total, hint: coins.nearest(player.x, player.z) },
      respect: { points: respect.points, rank: respect.rank, rankName: respectRank(respect.points).name },
      respectPoints: respect.points,
      respectRank: respect.rank,
      crew: crewJoined(respect.points).map((c) => c.name),
      crewList: crewJoined(respect.points),
      garage: {
        upgrades: { ...game.garageState.upgrades },
        owned: [...game.garageState.owned],
        nextCosts: GARAGE_UPGRADES.map((def) => ({ id: def.id, name: def.name, cost: garageCost(game.garageState, def.id, 0), level: game.garageState.upgrades[def.id] || 0 })),
      },
      wrecks: game.wrecks.length,
      explosions: game.stats.explosions,
      carsStolen: game.stats.carsStolen,
      objective: game.missions.active && m && step ? {
        title: m.title,
        text: step.text,
        dist: Math.sqrt(dist2(player.x, player.z, step.x, step.z)),
      } : null,
    };
  }

  function respawn() {
    const hosp = game.city.landmarks.find((l) => l.id === 'hospital');
    player.x = hosp.x; player.z = hosp.z; player.health = 60; player.armour = 50;
    player.inCar = false; player.car = null;
    game.police = createPolice();
    game.screen = SCREEN_PLAY;
    game.msg = 'Mara wakes up at St. Mara Hospital. The rain has cleared — the coast is gold.';
  }

  return {
    game, player, city, reset, applySave, startMission, restartMission,
    enterCar, fireWeapon, changeWeapon, step, collectBoxes, hudState, respawn,
    buyGarageUpgrade, cycleGarageUpgrade, nextRadio,
  };
}
