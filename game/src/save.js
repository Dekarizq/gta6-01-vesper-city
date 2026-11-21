// save.js — localStorage save/load for Sunset Kings (v6): cash, health,
// armour, weapon loadout, position, mission progress, wanted level, the
// garage (cars owned + upgrade levels), the radio station, respect
// points and crew, Sun Coin progress — and new in v4: the weapon wheel
// pick, the coast state, side-job totals, the GPS setting, and the
// active save slot; new in v6: the weather state and the business
// portfolio, so a storm and a shop never vanish between sessions. The
// key is the v6 key, so a Golden Hour v5 save can never be mistaken for
// a v6 save. buildSaveData() is shared with the three save slots
// (saveslots.js), so a slot and the main save are the same shape and
// load through the same code.
import { SAVE_KEY } from './config.js';
import { garageSave } from './garage.js';
import { respectSave } from './respect.js';
import { jobsSave } from './side-jobs.js';
import { coastSave } from './coast.js';
import { gpsSave } from './gps.js';
import { wheelSave } from './weapon-wheel.js';
import { spikesSave } from './spikestrip.js';
import { districtsSave } from './districts.js';
import { weatherSave } from './weather.js';
import { businessSave } from './business.js';

export function hasSave() {
  try { return !!window.localStorage.getItem(SAVE_KEY); } catch { return false; }
}

// The save payload, built from a live game object. Slots reuse this
// exact shape — buildSaveData is the one place the shape is defined.
export function buildSaveData(state) {
  return {
    cash: state.cash, health: state.health, armour: state.player.armour,
    weapon: state.combat.weapon, ammo: state.combat.ammo,
    x: state.player.x, z: state.player.z, angle: state.player.angle,
    missionIndex: state.missions.index, missionDone: state.missions.done,
    wanted: state.police.wanted, elapsed: state.elapsed,
    garage: state.garage, garageState: state.garageState ? garageSave(state.garageState) : null,
    radioIndex: state.radioState ? state.radioState.index : 0,
    respect: state.respect ? respectSave(state.respect) : null,
    coins: state.coins ? state.coins.save() : null,
    // v4: wheel pick, coast tide, side-job totals, GPS setting, slot.
    wheel: state.wheel ? wheelSave(state.wheel) : null,
    coast: state.coast ? coastSave(state.coast) : null,
    jobs: state.jobs ? jobsSave(state.jobs) : null,
    gps: state.gps ? gpsSave(state.gps) : null,
    spikes: state.police && state.police.spikes ? spikesSave(state.police.spikes) : null,
    slot: state.saveSlots ? state.saveSlots.active : 1,
    // v5: the districts' clock (lighthouse beam, sailboats) and the
    // save format version, so a v4 save is never mistaken for a v5 one.
    districts: state.districts ? districtsSave(state.districts) : null,
    // v6: the weather state and the business portfolio.
    weather: state.weather ? weatherSave(state.weather) : null,
    business: state.business ? businessSave(state.business) : null,
    version: 6,
    savedAt: Date.now(),
  };
}

export function saveGame(state) {
  const data = buildSaveData(state);
  try { window.localStorage.setItem(SAVE_KEY, JSON.stringify(data)); return true; }
  catch { return false; }
}

export function loadGame() {
  try {
    const raw = window.localStorage.getItem(SAVE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

export function clearSave() {
  try { window.localStorage.removeItem(SAVE_KEY); } catch { /* storage off */ }
}

// Is a save payload sane enough to load? A corrupt save is refused
// whole, so it can never half-load a broken game.
export function isValidSave(data) {
  if (!data || typeof data !== 'object') return false;
  if (!Number.isFinite(data.cash) || !Number.isFinite(data.x) || !Number.isFinite(data.z)) return false;
  if (!Number.isInteger(data.missionIndex) || data.missionIndex < 0) return false;
  return true;
}
