// main.js — boot and the one loop for Vesper City: Neon Rain.
// ?shot=start|chase|street|mission stages a deterministic scene and sets
// window.__shotReady once it has settled, for screenshots. Otherwise the game
// runs from the title screen: start, drive, steal, run missions, outrun the
// VCPD, and save — all offline, all procedural, no network requests.
import { STEP, SAVE_KEY } from './config.js';
import { createRandom } from './random.js';
import { createGame, SCREEN_TITLE, SCREEN_PLAY, SCREEN_PAUSED, SCREEN_DEAD } from './world.js';
import { createInput, ACT_ENTER, ACT_SHOOT, ACT_PAUSE, ACT_MISSION, ACT_RESTART, ACT_MAP, ACT_MUTE, ACT_CONFIRM } from './input.js';
import { createEngine, chaseCamera, collideCamera } from './engine.js';
import { createHud } from './hud.js';
import { createAudio } from './audio.js';
import { hasSave, saveGame, loadGame } from './save.js';
import { stageShot } from './shots.js';

const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : 20261120;

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
  hud.message('Welcome to Vesper City. Press Q to start your first mission.', 6);
  announce('Playing Vesper City.');
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
  if (a & ACT_MISSION) api.startMission();
  if (a & ACT_RESTART) api.restartMission();
  if (a & ACT_MAP) { game.mapOpen = !game.mapOpen; hud.toggleMap(game.mapOpen); }
  if (a & ACT_MUTE) { const m = audio.toggleMute(); hud.message(m ? 'Sound muted.' : 'Sound on.', 2); }
}

function frame(now) {
  requestAnimationFrame(frame);
  const dt = Math.min(0.05, (now - (frame.last || now)) / 1000 || STEP);
  frame.last = now;
  handleActions();
  if (screen === SCREEN_PLAY) {
    api.step(dt, input, audio);
    if (game.screen === SCREEN_DEAD) { screen = SCREEN_DEAD; hud.showDead(); }
    autosaveTimer += dt;
    if (autosaveTimer > 20) { autosaveTimer = 0; saveGame(game); }
  } else if (screen === SCREEN_TITLE) {
    titleOrbit += dt * 0.05;
  }
  // Camera.
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
  engine.draw(cam, boxes, game.time);
  if (screen !== SCREEN_TITLE) hud.update(api.hudState(), dt);
  if (game.msg) { hud.message(game.msg, 4); game.msg = null; }
  if (shot) {
    shotFrames += 1;
    // 30 frames is enough for the scene to settle (headless SwiftShader is slow).
    if (shotFrames > 30 && !window.__shotReady) window.__shotReady = true;
  }
}

if (shot) {
  // Shot mode: stage the scene, hide the title unless it is the start shot,
  // and run the live loop so traffic, rain and the helicopter move.
  stageShot(shot, api);
  if (shot === 'start') {
    screen = SCREEN_TITLE;
    hud.showTitle(false);
  } else {
    screen = SCREEN_PLAY;
    hud.hideTitle();
    // Drive the chase/mission scenes forward so cops and the helicopter appear.
    // The chase gets a short sim and no throttle so the staged cruisers stay
    // in frame ahead; other scenes drive forward.
    const simSteps = shot === 'chase' ? 60 : 240;
    const simInput = { forward: () => (shot === 'chase' ? 0 : 1), steer: () => 0, sprint: () => false, handbrake: () => false };
    for (let i = 0; i < simSteps; i += 1) api.step(STEP, simInput, null);
  }
  requestAnimationFrame(frame);
} else {
  hud.showTitle(hasSave());
  announce('Vesper City: Neon Rain. Press Enter or click Start Engine to play.');
  requestAnimationFrame(frame);
}
