// saveslots.js — three save slots for Sunset Kings v4. V3 had one
// autosave slot and one manual save, both on the same key: quit mid-
// mission and your only save was the moment you quit. V4 keeps the
// main save key for the current game, and adds three named slots —
// SLOT 1 is the autosave (written after every mission and every side
// job), SLOT 2 and SLOT 3 are the player's own checkpoints. Cycle
// slots with K, and the HUD always shows which slot is active. Slots
// live in localStorage beside the main key, same data shape, so a slot
// loads through exactly the same code path as a normal save.
import { SAVE_KEY } from './config.js';
import { buildSaveData } from './save.js';

export const SAVE_SLOTS = [
  { slot: 1, name: 'SLOT 1 · AUTOSAVE', auto: true },
  { slot: 2, name: 'SLOT 2 · CHECKPOINT', auto: false },
  { slot: 3, name: 'SLOT 3 · CHECKPOINT', auto: false },
];

export function slotKey(slot) {
  return `${SAVE_KEY}-slot-${slot}`;
}

export function createSaveSlots() {
  return {
    active: 1, // the slot K cycles through, and the one manual saves use
    lastAutosaveAt: 0,
    lastSavedAt: 0,
    lastLoadedAt: 0,
  };
}

export function slotLabel(slots) {
  const def = SAVE_SLOTS.find((s) => s.slot === slots.active) || SAVE_SLOTS[0];
  return def.name;
}

export function cycleSlot(slots) {
  slots.active = (slots.active % SAVE_SLOTS.length) + 1;
  return slots.active;
}

// Write the current game into a slot. Returns false when storage is
// off or full — the caller shows a message instead of crashing.
export function saveToSlot(state, slots, slot) {
  const target = slot || slots.active;
  try {
    const data = buildSaveData(state);
    data.slot = target;
    data.slotName = (SAVE_SLOTS.find((s) => s.slot === target) || SAVE_SLOTS[0]).name;
    window.localStorage.setItem(slotKey(target), JSON.stringify(data));
    slots.lastSavedAt = Date.now();
    if (target === 1) slots.lastAutosaveAt = Date.now();
    return true;
  } catch {
    return false;
  }
}

// Read a slot back. Returns the save data, or null when the slot is
// empty or corrupt — a corrupt slot never wipes the live game.
export function loadFromSlot(slot) {
  try {
    const raw = window.localStorage.getItem(slotKey(slot));
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (!data || typeof data !== 'object') return null;
    if (!Number.isFinite(data.cash) || !Number.isFinite(data.x)) return null;
    return data;
  } catch {
    return null;
  }
}

export function deleteSlot(slot) {
  try {
    window.localStorage.removeItem(slotKey(slot));
    return true;
  } catch {
    return false;
  }
}

// A one-line summary of every slot for the HUD and the pause menu:
// which slots hold a game, and how far that game had got.
export function listSlots() {
  return SAVE_SLOTS.map((def) => {
    const data = loadFromSlot(def.slot);
    if (!data) return { slot: def.slot, name: def.name, has: false };
    return {
      slot: def.slot,
      name: def.name,
      has: true,
      cash: data.cash,
      missionIndex: data.missionIndex || 0,
      missionDone: data.missionDone || 0,
      respect: data.respect ? data.respect.points || 0 : 0,
      savedAt: data.savedAt || 0,
    };
  });
}

// Autosave after a mission or a side job: slot 1, silently, no
// message spam — the HUD's slot line shows the time it happened.
export function autosave(state, slots) {
  const ok = saveToSlot(state, slots, 1);
  if (ok) slots.lastAutosaveAt = Date.now();
  return ok;
}

export function slotsSave(slots) {
  return { active: slots.active, lastAutosaveAt: slots.lastAutosaveAt };
}

export function slotsLoad(data) {
  const s = createSaveSlots();
  if (!data) return s;
  if (Number.isInteger(data.active)) s.active = Math.min(3, Math.max(1, data.active));
  if (Number.isFinite(data.lastAutosaveAt)) s.lastAutosaveAt = data.lastAutosaveAt;
  return s;
}
