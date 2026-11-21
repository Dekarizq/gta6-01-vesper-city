// Vesper City: Golden Hour — shared constants and tuning.
// Original game. No Rockstar names, assets or map. All art is procedural.
export const WORLD = {
  block: 44,          // size of one city block (world units)
  blocks: 9,          // blocks across (city spans blocks*block + roads)
  road: 10,           // road width
  stormDays: 7,       // hurricane countdown in days
  dayLength: 240,     // seconds per in-game day
};
// Low sun at the west end of the Sunset Shore boulevard (z = +27 road line),
// shining down the road corridor so downtown towers never hide it.
export const SUN = { x: -293, y: 26, z: 27, color: [1.0, 0.72, 0.28] };
export const STEP = 1 / 60;
export const PLAYER = { walkSpeed: 7, sprintSpeed: 11, health: 100, armour: 100, radius: 0.9 };
export const WANTED_MAX = 5;
export const SAVE_KEY = 'vesper-city-golden-hour-save-v1';
export const WEAPONS = [
  { id: 'fists', name: 'FISTS', ammo: Infinity, cooldown: 0.35, range: 3 },
  { id: 'pistol', name: 'VESPER 9MM', ammo: 72, cooldown: 0.28, range: 60 },
  { id: 'smg', name: 'MAKO SMG', ammo: 150, cooldown: 0.12, range: 55 },
];
export const CAR_TYPES = [
  { id: 'sedan', name: 'Vesper S', color: [0.72, 0.18, 0.24], top: 24, accel: 16, brake: 30, grip: 2.6 },
  { id: 'coupe', name: 'Sunset GT', color: [0.95, 0.68, 0.18], top: 33, accel: 22, brake: 34, grip: 3.1 },
  { id: 'van', name: 'Hauler XL', color: [0.9, 0.72, 0.18], top: 20, accel: 12, brake: 26, grip: 2.2 },
  { id: 'taxi', name: 'Sunset Cab', color: [0.95, 0.8, 0.1], top: 26, accel: 17, brake: 30, grip: 2.7 },
];
export const DISTRICTS = [
  { name: 'Sunset Mile', color: '#ff9a3d' },
  { name: 'Harbor Docks', color: '#f0a35e' },
  { name: 'Old Vesper', color: '#e8b04b' },
  { name: 'Glass Quarter', color: '#ffd166' },
  { name: 'Sunset Shore', color: '#ff7a59' },
];
// Warm golden-hour building palettes, one base per district feel.
export const GOLD = {
  sand: [0.62, 0.48, 0.3],
  cream: [0.78, 0.68, 0.5],
  terracotta: [0.66, 0.36, 0.22],
  gold: [0.85, 0.62, 0.28],
  rose: [0.72, 0.42, 0.38],
};
export const WINDOW_STRIP = ['#ffd166', '#7dd3fc', '#fda4af', '#fbbf24'];
export const RADIO_STATIONS = ['VESPER 98.1 · Golden Hour Mix', 'SUNSET FM · Coast Drive', 'STORM RADIO · Weather Band'];
