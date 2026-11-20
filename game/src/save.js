// save.js — localStorage save/load for Vesper City: cash, health, position,
// mission progress, wanted level, garage cars owned, and elapsed days.
import { SAVE_KEY } from './config.js';

export function hasSave() {
  try { return !!window.localStorage.getItem(SAVE_KEY); } catch { return false; }
}

export function saveGame(state) {
  const data = {
    cash: state.cash, health: state.health,
    x: state.player.x, z: state.player.z, angle: state.player.angle,
    missionIndex: state.missions.index, missionDone: state.missions.done,
    wanted: state.police.wanted, elapsed: state.elapsed,
    garage: state.garage, savedAt: Date.now(),
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
