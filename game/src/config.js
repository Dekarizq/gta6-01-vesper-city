// Vesper City: Neon Rain — shared constants and tuning.
// Original game. No Rockstar names, assets or map. All art is procedural.
export const WORLD = {
  block: 44,          // size of one city block (world units)
  blocks: 9,          // blocks across (city spans blocks*block + roads)
  road: 10,           // road width
  stormDays: 7,       // hurricane countdown in days
  dayLength: 240,     // seconds per in-game day
};
export const STEP = 1 / 60;
export const PLAYER = { walkSpeed: 7, sprintSpeed: 11, health: 100, radius: 0.9 };
export const WANTED_MAX = 5;
export const SAVE_KEY = 'vesper-city-neon-rain-save-v1';
export const CAR_TYPES = [
  { id: 'sedan', name: 'Vesper S', color: [0.72, 0.18, 0.24], top: 24, accel: 16, brake: 30, grip: 2.6 },
  { id: 'coupe', name: 'Neon GT', color: [0.15, 0.55, 0.95], top: 33, accel: 22, brake: 34, grip: 3.1 },
  { id: 'van', name: 'Hauler XL', color: [0.9, 0.72, 0.18], top: 20, accel: 12, brake: 26, grip: 2.2 },
  { id: 'taxi', name: 'Night Cab', color: [0.95, 0.8, 0.1], top: 26, accel: 17, brake: 30, grip: 2.7 },
];
export const DISTRICTS = [
  { name: 'Neon Mile', color: '#ff2e88' },
  { name: 'Harbor Docks', color: '#22d3ee' },
  { name: 'Old Vesper', color: '#f59e0b' },
  { name: 'Glass Quarter', color: '#a78bfa' },
  { name: 'Rainmarket', color: '#34d399' },
];
export const NEON = ['#ff2e88', '#22d3ee', '#f59e0b', '#a78bfa', '#34d399', '#ff5c5c', '#7c3aed'];
