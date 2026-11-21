// weapon-wheel.js — the weapon wheel for Sunset Kings v4. Hold Q and
// the wheel opens: four slots around Mara — FISTS, VESPER 9MM, MAKO SMG
// and the new GOLDEN 12-GAUGE shotgun. While the wheel is open the game
// keeps running (the street does not wait for you), the mouse angle
// picks a slot, releasing Q locks it in, and a quick tap of Q still
// starts the next story mission — the tap/hold split is decided by how
// long Q was held, so both actions live on one key without fighting.
// Pure logic, no DOM: the HUD draws the wheel from wheelSlots(), and
// the world loop asks the wheel which weapon the player chose.
import { WEAPONS } from './config.js';
import { clamp, wrapAngle } from './random.js';

// Hold Q this long (ms) before the wheel counts as a hold, not a tap.
export const WHEEL_HOLD_MS = 350;
// The wheel is a ring of slots; each slot owns a wedge of the circle.
export const WHEEL_SLOTS = WEAPONS.map((w, i) => ({
  index: i,
  id: w.id,
  name: w.name,
  // Wedge centre angle, in screen radians, starting at the top and
  // going clockwise: fists up, pistol right, SMG down, shotgun left.
  angle: -Math.PI / 2 + (i * Math.PI * 2) / WEAPONS.length,
}));

export function createWeaponWheel() {
  return {
    open: false,
    selected: 1, // start on the pistol, like the v3 loadout
    hovered: 1,
    holdMs: 0,
    openedAt: 0,
    // Mouse position (screen px) while the wheel is open, so the HUD
    // can highlight the slot under the cursor.
    mouseX: 0,
    mouseY: 0,
    centerX: 0,
    centerY: 0,
    // How many times the player opened the wheel — a stat for the HUD.
    opens: 0,
    switches: 0,
  };
}

// Which slot does a screen angle point at? Angles are measured from
// the wheel centre, -PI/2 is the top slot, clockwise from there.
export function slotForAngle(angle) {
  let best = 0;
  let bestD = Infinity;
  for (let i = 0; i < WHEEL_SLOTS.length; i += 1) {
    const d = Math.abs(wrapAngle(angle - WHEEL_SLOTS[i].angle));
    if (d < bestD) { bestD = d; best = i; }
  }
  return best;
}

// The slot under a mouse position relative to the wheel centre. Close
// to the centre (inside the dead zone) the hovered slot does not move,
// so a shaky hand never flips the pick at the last moment.
export function slotForMouse(wheel, mouseX, mouseY) {
  const dx = mouseX - wheel.centerX;
  const dy = mouseY - wheel.centerY;
  const dist = Math.hypot(dx, dy);
  if (dist < 28) return wheel.hovered;
  // Screen y grows downward, so the angle is atan2(dy, dx) directly.
  return slotForAngle(Math.atan2(dy, dx));
}

export function openWheel(wheel, now, centerX, centerY, currentWeapon) {
  if (wheel.open) return wheel;
  wheel.open = true;
  wheel.openedAt = now;
  wheel.centerX = centerX;
  wheel.centerY = centerY;
  wheel.selected = currentWeapon;
  wheel.hovered = currentWeapon;
  wheel.opens += 1;
  return wheel;
}

// Close the wheel and lock in the hovered slot. Returns the weapon
// index the player picked, or null when nothing changed.
export function closeWheel(wheel) {
  if (!wheel.open) return null;
  wheel.open = false;
  const picked = wheel.hovered;
  const changed = picked !== wheel.selected;
  wheel.selected = picked;
  if (changed) wheel.switches += 1;
  wheel.holdMs = 0;
  return picked;
}

export function cancelWheel(wheel) {
  if (!wheel.open) return null;
  wheel.open = false;
  wheel.hovered = wheel.selected;
  wheel.holdMs = 0;
  return wheel.selected;
}

// While the wheel is open, feed it the mouse position every frame so
// the highlight follows the cursor.
export function wheelMouse(wheel, mouseX, mouseY) {
  wheel.mouseX = mouseX;
  wheel.mouseY = mouseY;
  if (!wheel.open) return wheel.hovered;
  wheel.hovered = slotForMouse(wheel, mouseX, mouseY);
  return wheel.hovered;
}

// Keyboard fallback while the wheel is open: number keys jump straight
// to a slot, arrow keys step around the ring.
export function wheelKey(wheel, key) {
  if (!wheel.open) return wheel.hovered;
  if (key >= 0 && key < WEAPONS.length) {
    wheel.hovered = key;
    return wheel.hovered;
  }
  if (key === 'next') wheel.hovered = (wheel.hovered + 1) % WEAPONS.length;
  if (key === 'prev') wheel.hovered = (wheel.hovered + WEAPONS.length - 1) % WEAPONS.length;
  return wheel.hovered;
}

// The four slots as the HUD draws them: name, ammo, active, hovered,
// and the wedge angle for the ring layout.
export function wheelSlots(wheel, combat) {
  return WHEEL_SLOTS.map((slot) => ({
    index: slot.index,
    id: slot.id,
    name: slot.name,
    angle: slot.angle,
    ammo: combat ? combat.ammo[slot.index] : WEAPONS[slot.index].ammo,
    active: combat ? combat.weapon === slot.index : slot.index === wheel.selected,
    hovered: wheel.open && wheel.hovered === slot.index,
    selected: wheel.selected === slot.index,
  }));
}

// One-line label for the HUD: the picked weapon and its ammo.
// v6: in a storm the label says so — the wheel is the same, but the
// rain is coming down on it.
export function wheelLabel(wheel, combat, weather) {
  const w = WEAPONS[wheel.selected] || WEAPONS[1];
  const ammo = combat ? combat.ammo[wheel.selected] : w.ammo;
  const storm = weather && weather.phase === 'storm' ? ' · IN THE STORM' : '';
  return `${w.name} · ${ammo === Infinity ? '∞' : ammo} rounds${storm}`;
}

// The wheel's own render boxes: a gold ring marker floating over
// Mara's head while the wheel is open, so a screenshot can show the
// wheel state in the 3D scene as well as in the HUD.
export function wheelBoxes(wheel, player, time) {
  if (!wheel.open || !player) return [];
  const pulse = 1 + Math.sin(time * 4) * 0.08;
  const boxes = [];
  for (let i = 0; i < WHEEL_SLOTS.length; i += 1) {
    const a = WHEEL_SLOTS[i].angle;
    // The ring sits flat above the player, one marker per slot.
    const x = player.x + Math.sin(a) * 3.2 * pulse;
    const z = player.z + Math.cos(a) * 3.2 * pulse;
    const hovered = wheel.hovered === i;
    boxes.push({
      x, y: 2.6, z, w: 0.9, h: 0.5, d: 0.9,
      color: hovered ? [1, 0.85, 0.2] : [0.55, 0.45, 0.35],
      yaw: a,
    });
  }
  // Centre hub: bright gold while the wheel is open.
  boxes.push({
    x: player.x, y: 2.6, z: player.z, w: 0.7, h: 0.7, d: 0.7,
    color: [1, 0.72, 0.2], yaw: time,
  });
  // v5: a thin gold ring around the hub, so the wheel reads as a
  // wheel even from the chase camera behind the player.
  for (let i = 0; i < 4; i += 1) {
    const a = (i * Math.PI) / 2 + time * 0.5;
    boxes.push({
      x: player.x + Math.sin(a) * 1.5, y: 2.6, z: player.z + Math.cos(a) * 1.5,
      w: 0.35, h: 0.35, d: 0.35, color: [0.95, 0.8, 0.35], yaw: 0,
    });
  }
  return boxes;
}

// How long Q has been held, in ms — the main loop opens the wheel
// once this passes WHEEL_HOLD_MS, and treats a shorter press as a tap.
export function holdDurationMs(downAt, now) {
  return Math.max(0, now - downAt);
}

export function wheelSave(wheel) {
  return { selected: wheel.selected, opens: wheel.opens, switches: wheel.switches };
}

export function wheelLoad(data) {
  const w = createWeaponWheel();
  if (!data) return w;
  if (Number.isInteger(data.selected)) w.selected = clamp(data.selected, 0, WEAPONS.length - 1);
  if (Number.isInteger(data.opens)) w.opens = Math.max(0, data.opens);
  if (Number.isInteger(data.switches)) w.switches = Math.max(0, data.switches);
  return w;
}
