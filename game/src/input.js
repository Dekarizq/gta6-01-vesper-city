// input.js — keyboard + mouse for Sunset Kings (v3). Held keys are read
// every frame; one-shot presses are queued as flags. v3 keys: E enter /
// steal a car, F or click shoot, 1/2/3 switch weapons, G open the Sunset
// Garage shop when standing in the garage yard, R switch radio station,
// T restart the mission (R used to restart — it now changes the radio, so
// restart moved to T), Q start a mission, M map, U mute, P pause.
export const ACT_ENTER = 1;
export const ACT_SHOOT = 2;
export const ACT_PAUSE = 4;
export const ACT_MISSION = 8;
export const ACT_RESTART = 16;
export const ACT_MAP = 32;
export const ACT_MUTE = 64;
export const ACT_CONFIRM = 128;
export const ACT_WEAPON1 = 256;
export const ACT_WEAPON2 = 512;
export const ACT_WEAPON3 = 1024;
export const ACT_GARAGE = 2048;
export const ACT_RADIO = 4096;

const KEYMAP = {
  KeyE: ACT_ENTER, KeyF: ACT_SHOOT, KeyP: ACT_PAUSE, KeyM: ACT_MAP,
  KeyT: ACT_RESTART, KeyU: ACT_MUTE, KeyG: ACT_GARAGE, KeyR: ACT_RADIO,
  Space: ACT_CONFIRM, Enter: ACT_CONFIRM,
};
const MISSION_KEYS = new Set(['KeyQ', 'KeyN']);

export function createInput() {
  const keys = new Set();
  let actions = 0;
  let mouseX = 0, mouseY = 0, mouseDown = false;
  window.addEventListener('keydown', (event) => {
    if (event.repeat) return;
    keys.add(event.code);
    if (KEYMAP[event.code]) actions |= KEYMAP[event.code];
    if (event.code === 'Digit1') actions |= ACT_WEAPON1;
    if (event.code === 'Digit2') actions |= ACT_WEAPON2;
    if (event.code === 'Digit3') actions |= ACT_WEAPON3;
    if (MISSION_KEYS.has(event.code)) actions |= ACT_MISSION;
    if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(event.code)) event.preventDefault();
  });
  window.addEventListener('keyup', (event) => keys.delete(event.code));
  window.addEventListener('blur', () => keys.clear());
  window.addEventListener('mousedown', (e) => { mouseDown = true; mouseX = e.clientX; mouseY = e.clientY; actions |= ACT_SHOOT; });
  window.addEventListener('mouseup', () => { mouseDown = false; });
  window.addEventListener('mousemove', (e) => { mouseX = e.clientX; mouseY = e.clientY; });
  return {
    held(code) { return keys.has(code); },
    forward() { return (keys.has('KeyW') || keys.has('ArrowUp') ? 1 : 0) - (keys.has('KeyS') || keys.has('ArrowDown') ? 1 : 0); },
    steer() { return (keys.has('KeyA') || keys.has('ArrowLeft') ? 1 : 0) - (keys.has('KeyD') || keys.has('ArrowRight') ? 1 : 0); },
    sprint() { return keys.has('ShiftLeft') || keys.has('ShiftRight'); },
    handbrake() { return keys.has('Space'); },
    mouse() { return { x: mouseX, y: mouseY, down: mouseDown }; },
    takeActions() { const t = actions; actions = 0; return t; },
  };
}
