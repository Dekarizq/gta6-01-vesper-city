// save.js — localStorage save/load for Sunset Kings (v3): cash, health,
// armour, weapon loadout, position, mission progress, wanted level, the
// garage (cars owned + upgrade levels), the radio station, respect
// points and crew, and Sun Coin progress. The key is the v3 key, so a
// Golden Hour v2 save can never be mistaken for a v3 save.
import { SAVE_KEY } from './config.js';
import { garageSave } from './garage.js';
import { respectSave } from './respect.js';

export function hasSave() {
  try { return !!window.localStorage.getItem(SAVE_KEY); } catch { return false; }
}

export function saveGame(state) {
  const data = {
    cash: state.cash, health: state.health, armour: state.player.armour,
    weapon: state.combat.weapon, ammo: state.combat.ammo,
    x: state.player.x, z: state.player.z, angle: state.player.angle,
    missionIndex: state.missions.index, missionDone: state.missions.done,
    wanted: state.police.wanted, elapsed: state.elapsed,
    garage: state.garage, garageState: state.garageState ? garageSave(state.garageState) : null,
    radioIndex: state.radioState ? state.radioState.index : 0,
    respect: state.respect ? respectSave(state.respect) : null,
    coins: state.coins ? state.coins.save() : null, savedAt: Date.now(),
  };
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
