// main.js — boot and the one loop for Vesper City: Golden Hour — Sunset Kings v6.
// ?shot=start|chase|street|mission|coast|wheel|marina|oldtown|storm|business stages a deterministic frozen
// scene and sets window.__shotReady once it has settled, for screenshots.
// Otherwise the game runs from the title screen: start, drive, steal, run
// missions, tune the car at the Sunset Garage, switch radio stations, build
// respect and a crew, outrun the named VCPD units, and save — all offline,
// all procedural, no network requests. v4: hold Q for the weapon wheel
// (tap Q still starts a mission), J for side jobs, L for the GPS route,
// K to cycle save slots, and the coast — pier, boardwalk, boats — is open.
// v5: the city is visually rebuilt — lit window facades, street lamps,
// trees, billboards, the Marina District and Old Town, denser traffic
// with five new car models, clouds, birds and sea glints.
// v6: the week gets real weather (day cycle, rain, lightning, the
// hurricane front), B buys and upgrades businesses that pay daily
// income, and a three-mission arc (13-15) crowns Mara King of Vesper.
import { STEP, SAVE_KEY, GAME_TITLE, WHEEL_HOLD_MS } from './config.js';
import { createRandom } from './random.js';
import { createGame, SCREEN_TITLE, SCREEN_PLAY, SCREEN_PAUSED, SCREEN_DEAD } from './world.js';
import { createInput, ACT_ENTER, ACT_SHOOT, ACT_PAUSE, ACT_MISSION, ACT_RESTART, ACT_MAP, ACT_MUTE, ACT_CONFIRM, ACT_WEAPON1, ACT_WEAPON2, ACT_WEAPON3, ACT_WEAPON4, ACT_GARAGE, ACT_RADIO, ACT_JOB, ACT_GPS, ACT_SLOT, ACT_HUD, ACT_BUSINESS } from './input.js';
import { createEngine, chaseCamera, collideCamera } from './engine.js';
import { weatherRender } from './weather.js';
import { createHud } from './hud.js';
import { createAudio } from './audio.js';
import { hasSave, saveGame, loadGame } from './save.js';
import { stageShot } from './shots.js';

const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : 20261121;

const canvas = document.getElementById('game');
const status = document.getElementById('status');
const rng = createRandom(seed);
const api = createGame(rng);
const game = api.game;
const engine = createEngine(canvas, game.city);
const hud = createHud(game.city);
const audio = createAudio();
const input = createInput();

// Debug/test hook (harmless in play): lets automated playtests drive the real game.
window.__vesper = { api, game, startNew, continueSaved, saveGame: () => saveGame(game) };

let screen = SCREEN_TITLE;
let titleOrbit = 0;
let autosaveTimer = 0;
let shotFrames = 0;

function announce(message) { status.textContent = message; }

function startNew() {
  api.reset(true);
  screen = SCREEN_PLAY;
  hud.hideTitle(); hud.hidePause(); hud.hideDead();
  audio.unlock();
  hud.message('Welcome to Vesper City, Sunset King. Tap Q to start your first mission, hold Q for the weapon wheel, J for side jobs, B near a FOR SALE board to buy a business — and watch the sky: the hurricane front is coming.', 7);
  announce('Playing Vesper City: Golden Hour — Sunset Kings v6.');
}

function continueSaved() {
  const data = loadGame();
  if (data) api.applySave(data);
  screen = SCREEN_PLAY;
  hud.hideTitle(); hud.hidePause(); hud.hideDead();
  audio.unlock();
  hud.message('Saved game loaded. The storm is still coming.', 5);
}

function pauseGame() {
  screen = SCREEN_PAUSED;
  hud.showPause();
  announce('Paused.');
}
function resumeGame() {
  screen = SCREEN_PLAY;
  hud.hidePause();
  announce('Playing.');
}
function quitToTitle() {
  saveGame(game);
  screen = SCREEN_TITLE;
  hud.hidePause(); hud.hideDead();
  hud.showTitle(hasSave());
  announce('Title screen.');
}

hud.bindButtons({
  start: startNew,
  continue: continueSaved,
  resume: resumeGame,
  save: () => { saveGame(game); hud.message('Game saved.', 3); },
  quit: quitToTitle,
  respawn: () => { api.respawn(); screen = SCREEN_PLAY; hud.hideDead(); },
});

function handleActions() {
  // v4 weapon wheel: a quick Q tap arrives here as ACT_MISSION (the
  // input queues it on release); a hold opens the wheel in frame()
  // instead, and the release there locks the weapon in.
  input.takeQtap();
  const a = input.takeActions();
  if (screen === SCREEN_TITLE) {
    if (a & ACT_CONFIRM) startNew();
    return;
  }
  if (screen === SCREEN_DEAD) {
    if (a & ACT_CONFIRM) { api.respawn(); screen = SCREEN_PLAY; hud.hideDead(); }
    return;
  }
  if (a & ACT_PAUSE) {
    if (screen === SCREEN_PLAY) pauseGame();
    else if (screen === SCREEN_PAUSED) resumeGame();
    return;
  }
  if (screen !== SCREEN_PLAY) return;
  if (a & ACT_ENTER) api.enterCar();
  if (a & ACT_SHOOT) { api.fireWeapon(); audio.unlock(); audio.shot(); }
  if (a & ACT_WEAPON1) api.changeWeapon(0);
  if (a & ACT_WEAPON2) api.changeWeapon(1);
  if (a & ACT_WEAPON3) api.changeWeapon(2);
  if (a & ACT_WEAPON4) api.changeWeapon(3);
  if (a & ACT_GARAGE) api.cycleGarageUpgrade();
  if (a & ACT_RADIO) { const s = api.nextRadio(); if (audio.setRadioStation) audio.setRadioStation(s.id); }
  if (a & ACT_MISSION) api.startMission();
  if (a & ACT_JOB) { const j = api.startSideJob(); if (j && audio.horn) audio.horn(); }
  if (a & ACT_GPS) api.toggleGps();
  if (a & ACT_BUSINESS) api.buyBusiness();
  if (a & ACT_SLOT) api.cycleSaveSlot();
  if (a & ACT_RESTART) api.restartMission();
  if (a & ACT_MAP) { game.mapOpen = !game.mapOpen; hud.toggleMap(game.mapOpen); }
  if (a & ACT_HUD) { const off = hud.toggleHud(); hud.message(off ? 'HUD hidden — press H to bring it back.' : 'HUD back on.', 2); }
  if (a & ACT_MUTE) { const m = audio.toggleMute(); hud.message(m ? 'Sound muted.' : 'Sound on.', 2); }
}

// v4: the weapon wheel lives on the frame loop, not on actions: while
// Q is held past the hold time the wheel opens, the mouse picks the
// slot, and releasing Q locks it in.
function handleWheel() {
  if (screen !== SCREEN_PLAY) return;
  const wheel = game.wheel;
  if (!wheel) return;
  if (input.qDown() && input.qHeldMs() > WHEEL_HOLD_MS && !wheel.open) {
    api.openWheel();
    input.markQWheelOpened();
    if (audio.wheelTick) audio.wheelTick();
  }
  if (wheel.open) {
    const m = input.mouse();
    const before = wheel.hovered;
    api.wheelHover(m.x, m.y);
    if (wheel.hovered !== before && audio.wheelTick) audio.wheelTick();
  }
  if (input.takeQRelease() && wheel.open) api.closeWheel();
}

function frame(now) {
  requestAnimationFrame(frame);
  const dt = Math.min(0.05, (now - (frame.last || now)) / 1000 || STEP);
  frame.last = now;
  handleActions();
  handleWheel();
  if (screen === SCREEN_PLAY && !game.frozen) {
    api.step(dt, input, audio);
    if (game.screen === SCREEN_DEAD) { screen = SCREEN_DEAD; hud.showDead(); }
    autosaveTimer += dt;
    if (autosaveTimer > 20) { autosaveTimer = 0; saveGame(game); }
  } else if (screen === SCREEN_TITLE) {
    titleOrbit += dt * 0.05;
  }
  const p = api.player;
  let cam;
  if (screen === SCREEN_TITLE) {
    const r = 95;
    cam = {
      eye: [Math.sin(titleOrbit) * r, 42, Math.cos(titleOrbit) * r],
      target: [0, 18, 0],
    };
  } else {
    cam = collideCamera(chaseCamera(p.x, p.z, p.angle, Math.abs(p.speed || 0), p.inCar), game.city.buildings);
  }
  const boxes = api.collectBoxes(game.time);
  // v6: the weather drives the sky and the fog — gold by day, grey in
  // the storm front, deep blue at night, bleached on a lightning strike.
  engine.draw(cam, boxes, game.time, game.weather ? weatherRender(game.weather) : undefined);
  if (screen !== SCREEN_TITLE) hud.update(api.hudState(), dt);
  if (game.msg) { hud.message(game.msg, 4); game.msg = null; }
  if (shot) {
    shotFrames += 1;
    if (shotFrames > 30 && !window.__shotReady) window.__shotReady = true;
  }
}

if (shot) {
  stageShot(shot, api);
  if (shot === 'start') {
    screen = SCREEN_TITLE;
    hud.showTitle(false);
  } else {
    screen = SCREEN_PLAY;
    hud.hideTitle();
  }
  requestAnimationFrame(frame);
} else {
  hud.showTitle(hasSave());
  announce(GAME_TITLE + '. Press Enter or click Start Engine to play.');
  requestAnimationFrame(frame);
}
