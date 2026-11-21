// Vesper City: Golden Hour — Sunset Kings v4 — shared constants and tuning.
// Original game. No Rockstar names, assets or map. All art is procedural.
// v3 added the Sunset Garage upgrade shop, three procedural radio stations,
// the Sunset Kings respect ladder and crew, named VCPD units, and cars
// that burn and explode. v4 adds the weapon wheel (hold Q, four weapons
// incl. the Golden 12-Gauge shotgun), missions 11-12 on the Sunset Beach
// coast, repeatable side jobs (taxi, delivery, street race), spike strips
// and wanted level 6, a GPS route line, three save slots, a fourth radio
// station, a NITRO garage upgrade, and the Coast Cruiser convertible.
// v5 is a visual overhaul, not a feature pile: procedural facades with
// lit windows, roof furniture, street lamps, trees and billboards, two
// new districts (Marina District and Old Town), five more traffic car
// models, denser traffic and crowds, clouds, birds and sea glints —
// the city finally looks as rich as the top entries' screenshots.
// The save key is new so a v5 save never collides with a v4 save.
// v6 is the authorship round: the renderer and the city generator are
// rewritten in one recorded session, the week gets real weather (a day
// cycle, rain, lightning, the hurricane front), Mara can buy six
// businesses that pay daily income, and a three-mission arc (13-15)
// crowns her King of Vesper — gated on a level-2 business and 2,000
// respect. The save key is new so a v6 save never collides with a v5 one.
export const GAME_TITLE = 'Vesper City: Golden Hour — Sunset Kings v6';
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
// v4: the heat goes to 6 stars. Six stars means five cruisers, CONDOR-1,
// a roadblock AND spike strips — the full VCPD response.
export const WANTED_MAX = 6;
export const SAVE_KEY = 'vesper-city-golden-hour-v6-save-v1';
export const WEAPONS = [
  { id: 'fists', name: 'FISTS', ammo: Infinity, cooldown: 0.35, range: 3 },
  { id: 'pistol', name: 'VESPER 9MM', ammo: 72, cooldown: 0.28, range: 60 },
  { id: 'smg', name: 'MAKO SMG', ammo: 150, cooldown: 0.12, range: 55 },
  // v4: the Golden 12-Gauge — slow, loud, close-range, and it ends arguments.
  { id: 'shotgun', name: 'GOLDEN 12-GAUGE', ammo: 40, cooldown: 0.7, range: 38 },
];
// Every car has a name and a personality: top speed, pull, brakes, grip.
// The Storm King muscle car is the Sunset Kings' prize — fast, thirsty,
// and the only car that starts with a full tank of nerve. v4 adds the
// Coast Cruiser convertible, built for the beach road at golden hour.
export const CAR_TYPES = [
  { id: 'sedan', name: 'Vesper S', color: [0.72, 0.18, 0.24], top: 24, accel: 16, brake: 30, grip: 2.6, len: 4.4 },
  { id: 'coupe', name: 'Sunset GT', color: [0.95, 0.68, 0.18], top: 33, accel: 22, brake: 34, grip: 3.1, len: 4.4 },
  { id: 'van', name: 'Hauler XL', color: [0.9, 0.72, 0.18], top: 20, accel: 12, brake: 26, grip: 2.2, len: 4.8 },
  { id: 'taxi', name: 'Sunset Cab', color: [0.95, 0.8, 0.1], top: 26, accel: 17, brake: 30, grip: 2.7, len: 4.4 },
  { id: 'muscle', name: 'Storm King', color: [0.55, 0.15, 0.65], top: 36, accel: 24, brake: 32, grip: 2.9, len: 4.6 },
  { id: 'convertible', name: 'Coast Cruiser', color: [0.2, 0.7, 0.9], top: 31, accel: 21, brake: 33, grip: 3.0, len: 4.4 },
  // v5 traffic: five more models so the streets stop repeating the
  // same six cars — a red sports car with a spoiler, a green pickup
  // with a roof rack, a black-and-gold limo, a blue hatch, and the
  // orange Vesper Bus that lumbers down the Shore boulevard.
  { id: 'sports', name: 'Sunset Viper', color: [0.95, 0.25, 0.15], top: 38, accel: 26, brake: 36, grip: 3.3, len: 4.4 },
  { id: 'pickup', name: 'Dune Hauler', color: [0.35, 0.55, 0.3], top: 27, accel: 18, brake: 30, grip: 2.8, len: 5.0 },
  { id: 'limo', name: 'Gold Limo', color: [0.12, 0.1, 0.14], top: 28, accel: 16, brake: 30, grip: 2.6, len: 6.4 },
  { id: 'hatch', name: 'City Hatch', color: [0.3, 0.55, 0.9], top: 25, accel: 18, brake: 30, grip: 2.9, len: 3.8 },
  { id: 'bus', name: 'Vesper Bus', color: [0.9, 0.6, 0.2], top: 18, accel: 10, brake: 24, grip: 2.0, len: 7.2 },
  // v6 traffic: the Storm Chaser 4x4 — a lifted truck with a roof rack
  // and a snorkel, built for the flooded harbour roads in the front.
  { id: 'storm4x4', name: 'Storm Chaser', color: [0.85, 0.4, 0.15], top: 29, accel: 20, brake: 32, grip: 3.2, len: 5.2 },
];
export const DISTRICTS = [
  { name: 'Sunset Mile', color: '#ff9a3d' },
  { name: 'Harbor Docks', color: '#f0a35e' },
  { name: 'Old Vesper', color: '#e8b04b' },
  { name: 'Glass Quarter', color: '#ffd166' },
  { name: 'Sunset Shore', color: '#ff7a59' },
  // v4: the beach is a district of its own now, not just scenery.
  { name: 'Sunset Beach', color: '#ff8a5c' },
  // v5: the Marina District (white yachts, cranes, lighthouse) and
  // Old Town (brick lanes, night market, church tower) finally read
  // as different places instead of more warm boxes.
  { name: 'Marina District', color: '#2dd4bf' },
  { name: 'Old Town', color: '#fbbf24' },
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
export const RADIO_STATIONS = ['VESPER 98.1 · Golden Hour Mix', 'SUNSET FM 101.5 · Coast Drive', 'STORM RADIO 87.9 · Weather Band', 'COAST 104.7 · Beach Nights', 'MARINA 99.9 · Yacht Rock', 'HURRICANE 88.8 · Storm Watch'];
// Named VCPD units: every cruiser and the helicopter have a callsign, an
// officer, and a tactic, so the pursuit panel reads like a real dispatch.
// v4 adds the SPIKE unit (Ofc. Duarte, lays spike strips at 4+ stars)
// and the BLOCKADE unit (Sgt. Kim, holds the roadblock with two cars).
export const VCPD_UNITS = [
  { callsign: 'VCPD-11', officer: 'Sgt. Reyes', tactic: 'RAM', role: 'Interceptor' },
  { callsign: 'VCPD-25', officer: 'Ofc. Hale', tactic: 'PIT', role: 'Interceptor' },
  { callsign: 'VCPD-18', officer: 'Ofc. Cruz', tactic: 'ROADBLOCK', role: 'Blocker' },
  { callsign: 'VCPD-45', officer: 'Sgt. Okafor', tactic: 'PURSUIT', role: 'Interceptor' },
  { callsign: 'VCPD-07', officer: 'Ofc. Lind', tactic: 'PURSUIT', role: 'Interceptor' },
  { callsign: 'VCPD-33', officer: 'Ofc. Voss', tactic: 'RAM', role: 'Interceptor' },
  { callsign: 'VCPD-52', officer: 'Ofc. Duarte', tactic: 'SPIKE', role: 'Spike Strip' },
  { callsign: 'VCPD-61', officer: 'Sgt. Kim', tactic: 'BLOCKADE', role: 'Blocker' },
  // v5: the marina gets its own patrol — Ofc. Marisol works the quay
  // and the lighthouse road, so the new district has a police presence.
  { callsign: 'VCPD-77', officer: 'Ofc. Marisol', tactic: 'MARINA', role: 'Marina Patrol' },
  // v6: the storm unit — Sgt. Reyes' old partner Ofc. Storm works the
  // flooded harbour roads in the front, when the rest of the VCPD
  // stays on the high ground.
  { callsign: 'VCPD-88', officer: 'Ofc. Storm', tactic: 'STORM', role: 'Storm Unit' },
];
export const HELI_UNIT = { callsign: 'CONDOR-1', officer: 'Capt. Hale', tactic: 'AIR SUPPORT', role: 'Helicopter' };
// v4 coast: the pier, the boardwalk and the boat dock live south of the
// city, past the beach. The GPS and the coast missions use these.
export const COAST = {
  pierX: -20,
  boardwalkX: 60,
  dockX: 110,
  boatCount: 5,
};
// v4 weapon wheel: hold Q this long (ms) to open it; a shorter press
// still starts the next mission, so one key does both jobs.
export const WHEEL_HOLD_MS = 350;
