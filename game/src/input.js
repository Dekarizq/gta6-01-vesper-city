// input.js — keyboard + mouse for Sunset Kings (v4). Held keys are read
// every frame; one-shot presses are queued as flags. v4 keys: E enter /
// steal a car, F or click shoot, 1/2/3/4 switch weapons, G open the Sunset
// Garage shop when standing in the garage yard, R switch radio station,
// T restart the mission (R used to restart — it now changes the radio, so
// restart moved to T), Q start a mission on a TAP — or HOLD Q to open the
// weapon wheel (hold >350ms, release to lock in the picked weapon), J start
// the next side job (taxi / delivery / street race, cycling), L toggle the
// GPS route line, K cycle save slots, M map, U mute, P pause.
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
// v4 actions: shotgun, side job, GPS toggle, save-slot cycle.
export const ACT_WEAPON4 = 8192;
export const ACT_JOB = 16384;
export const ACT_GPS = 32768;
export const ACT_SLOT = 65536;
// Wheel: hold Q longer than this (ms) and it is a wheel hold, not a tap.
export const WHEEL_HOLD_MS = 350;

const KEYMAP = {
  KeyE: ACT_ENTER, KeyF: ACT_SHOOT, KeyP: ACT_PAUSE, KeyM: ACT_MAP,
  KeyT: ACT_RESTART, KeyU: ACT_MUTE, KeyG: ACT_GARAGE, KeyR: ACT_RADIO,
  KeyJ: ACT_JOB, KeyL: ACT_GPS, KeyK: ACT_SLOT,
  Space: ACT_CONFIRM, Enter: ACT_CONFIRM,
};
// Q is NOT in KEYMAP: it is handled specially (tap = mission, hold = wheel).

export function createInput() {
  const keys = new Set();
  let actions = 0;
  let mouseX = 0, mouseY = 0, mouseDown = false;
  // Q state: when it went down, whether the wheel already opened for
  // this press, and whether the release should count as a tap.
  let qDownAt = 0;
  let qWheelOpened = false;
  let qTapPending = false;
  let qReleasePending = false;
  window.addEventListener('keydown', (event) => {
    if (event.repeat) return;
    keys.add(event.code);
    if (KEYMAP[event.code]) actions |= KEYMAP[event.code];
    if (event.code === 'Digit1') actions |= ACT_WEAPON1;
    if (event.code === 'Digit2') actions |= ACT_WEAPON2;
    if (event.code === 'Digit3') actions |= ACT_WEAPON3;
    if (event.code === 'Digit4') actions |= ACT_WEAPON4;
    if (event.code === 'KeyQ') {
      qDownAt = performance.now();
      qWheelOpened = false;
      qTapPending = false;
      qReleasePending = false;
    }
    if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(event.code)) event.preventDefault();
  });
  window.addEventListener('keyup', (event) => {
    keys.delete(event.code);
    if (event.code === 'KeyQ' && qDownAt > 0) {
      const held = performance.now() - qDownAt;
      qDownAt = 0;
      if (held < WHEEL_HOLD_MS && !qWheelOpened) qTapPending = true;
      else qReleasePending = true;
    }
  });
  window.addEventListener('blur', () => {
    keys.clear();
    qDownAt = 0;
    qWheelOpened = false;
  });
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
    // Q hold state, for the weapon wheel: how long Q has been held
    // (ms), and whether this press has already opened the wheel.
    qHeldMs() { return qDownAt > 0 ? performance.now() - qDownAt : 0; },
    qDown() { return qDownAt > 0; },
    qWheelOpened() { return qWheelOpened; },
    markQWheelOpened() { qWheelOpened = true; },
    // True once, on the frame after a quick Q tap was released — the
    // main loop turns it into ACT_MISSION. A hold never taps.
    takeQtap() {
      if (!qTapPending) return false;
      qTapPending = false;
      actions |= ACT_MISSION;
      return true;
    },
    // True once, on the frame after Q was released from a wheel hold —
    // the main loop locks in the hovered weapon and closes the wheel.
    takeQRelease() {
      if (!qReleasePending) return false;
      qReleasePending = false;
      return true;
    },
    takeActions() { const t = actions; actions = 0; return t; },
  };
}
