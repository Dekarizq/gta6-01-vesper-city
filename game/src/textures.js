// textures.js — procedural "textures" for Vesper City v5. No image files,
// no network, no canvas at runtime: every visual is a colour choice
// made by a deterministic function of where it sits, so the same seed
// always builds the same city and a Node test can check every helper.
// v4's buildings were flat warm boxes with three window strips; v5
// gives each tower a real facade — a grid of windows, some lit gold,
// some dark glass — plus roof furniture, district palettes, metallic
// car paint, market colours, and a sky that deepens as the storm nears.
// Pure functions, no DOM, safe to import from Node tests.

// Deterministic 0..1 hash of a pair of integers — the same window is
// lit every time the city is generated, and never flickers at random.
export function hash2(x, z) {
  let h = (Math.imul(x | 0, 374761393) + Math.imul(z | 0, 668265263)) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return (((h ^ (h >>> 16)) >>> 0) % 100000) / 100000;
}

export function hexToRgb(hex) {
  const n = parseInt(hex.slice(1), 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
}

export function shadeRgb(rgb, f) {
  return [Math.min(1, rgb[0] * f), Math.min(1, rgb[1] * f), Math.min(1, rgb[2] * f)];
}

// v6: the storm tint — pull any colour toward flat storm grey by t
// (0 keeps the colour, 1 is fully grey). The engine mixes facades and
// fog toward this when the front arrives, so the whole city greys out
// together instead of one building at a time.
export function stormTint(rgb, t) {
  const grey = (rgb[0] + rgb[1] + rgb[2]) / 3;
  return [
    rgb[0] + (grey - rgb[0]) * t,
    rgb[1] + (grey - rgb[1]) * t,
    rgb[2] + (grey - rgb[2]) * t,
  ];
}

export function mixRgb(a, b, t) {
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
}

// One palette per district: facade bases, lit-window gold, dark glass,
// neon sign colour, roof colour, and the street colour underfoot. The
// Marina is white and teal against the sea; Old Town is brick and cream
// with warm market lamps; Glass Quarter is cool glass and gold.
export const DISTRICT_PALETTES = {
  'Sunset Mile': {
    facades: [[0.66, 0.36, 0.22], [0.78, 0.68, 0.5], [0.85, 0.62, 0.28]],
    lit: [1, 0.82, 0.4], dark: [0.16, 0.2, 0.3], neon: '#ff9a3d',
    roof: [0.42, 0.32, 0.24], street: [0.2, 0.16, 0.12],
  },
  'Harbor Docks': {
    facades: [[0.62, 0.48, 0.3], [0.55, 0.42, 0.3], [0.7, 0.55, 0.35]],
    lit: [1, 0.75, 0.35], dark: [0.14, 0.18, 0.26], neon: '#f0a35e',
    roof: [0.38, 0.3, 0.22], street: [0.22, 0.18, 0.14],
  },
  'Old Vesper': {
    facades: [[0.6, 0.32, 0.24], [0.72, 0.5, 0.32], [0.78, 0.66, 0.48]],
    lit: [1, 0.85, 0.5], dark: [0.18, 0.16, 0.2], neon: '#ffd166',
    roof: [0.4, 0.26, 0.2], street: [0.24, 0.2, 0.16],
  },
  'Glass Quarter': {
    facades: [[0.5, 0.55, 0.62], [0.62, 0.6, 0.55], [0.72, 0.42, 0.38]],
    lit: [0.55, 0.85, 1], dark: [0.1, 0.16, 0.28], neon: '#7dd3fc',
    roof: [0.3, 0.3, 0.34], street: [0.18, 0.16, 0.14],
  },
  'Sunset Shore': {
    facades: [[0.85, 0.62, 0.28], [0.72, 0.42, 0.38], [0.95, 0.68, 0.18]],
    lit: [1, 0.8, 0.35], dark: [0.16, 0.2, 0.3], neon: '#ff7a59',
    roof: [0.44, 0.32, 0.22], street: [0.2, 0.16, 0.12],
  },
  'Sunset Beach': {
    facades: [[0.85, 0.72, 0.48], [0.78, 0.68, 0.5], [0.9, 0.75, 0.55]],
    lit: [1, 0.88, 0.55], dark: [0.2, 0.26, 0.34], neon: '#ff8a5c',
    roof: [0.5, 0.4, 0.3], street: [0.85, 0.72, 0.48],
  },
  'Marina District': {
    facades: [[0.92, 0.9, 0.84], [0.75, 0.85, 0.85], [0.55, 0.7, 0.75]],
    lit: [0.6, 0.9, 1], dark: [0.12, 0.22, 0.3], neon: '#2dd4bf',
    roof: [0.35, 0.42, 0.45], street: [0.3, 0.32, 0.3],
  },
  'Old Town': {
    facades: [[0.58, 0.3, 0.22], [0.7, 0.52, 0.34], [0.8, 0.68, 0.5]],
    lit: [1, 0.72, 0.3], dark: [0.2, 0.16, 0.14], neon: '#fbbf24',
    roof: [0.36, 0.22, 0.16], street: [0.28, 0.22, 0.18],
  },
};

export function paletteForDistrict(name) {
  return DISTRICT_PALETTES[name] || DISTRICT_PALETTES['Old Vesper'];
}

// The facade pattern for one building: a window grid sized by the
// tower's footprint and height, a lit/dark decision per window (about
// 45% lit at golden hour — the city is waking up, not fully on), and
// a roof style. Rows are floors; columns are window bays.
export function facadeFor(building) {
  const cols = Math.max(2, Math.min(6, Math.floor(building.w / 3.2)));
  const rows = Math.max(2, Math.min(9, Math.floor(building.h / 4.2)));
  const lit = [];
  for (let r = 0; r < rows; r += 1) {
    const row = [];
    for (let c = 0; c < cols; c += 1) {
      const h = hash2(Math.round(building.x * 3) + c * 7, Math.round(building.z * 3) + r * 11);
      row.push(h < 0.45);
    }
    lit.push(row);
  }
  const roofRoll = hash2(Math.round(building.x), Math.round(building.z) + 99);
  const roof = building.h > 40 ? 'beacon' : roofRoll < 0.35 ? 'tank' : roofRoll < 0.7 ? 'antenna' : 'flat';
  return { cols, rows, lit, roof };
}

// Colour of one window: lit windows glow warm (or cool blue in the
// Glass Quarter), dark windows are deep glass that catches the sky.
export function windowColor(building, row, col, lit) {
  const pal = paletteForDistrict(building.district || 'Old Vesper');
  if (!lit) return pal.dark;
  const flick = hash2(Math.round(building.x) + col * 3, Math.round(building.z) + row * 5);
  return shadeRgb(pal.lit, 0.85 + flick * 0.3);
}

// Metallic car paint: a body colour, a darker trim, bright glass and
// a rim colour. Metallic means the body is a touch brighter on top —
// the engine already brightens top faces, so paint just needs a rich
// base and a contrasting trim to read as a real car, not a toy.
export const CAR_PAINT = {
  sedan: { body: [0.72, 0.18, 0.24], trim: [0.1, 0.1, 0.12], glass: [0.1, 0.14, 0.22], rim: [0.85, 0.85, 0.9] },
  coupe: { body: [0.95, 0.68, 0.18], trim: [0.12, 0.1, 0.08], glass: [0.08, 0.12, 0.2], rim: [0.9, 0.85, 0.7] },
  van: { body: [0.9, 0.72, 0.18], trim: [0.15, 0.12, 0.1], glass: [0.1, 0.14, 0.2], rim: [0.8, 0.8, 0.82] },
  taxi: { body: [0.95, 0.8, 0.1], trim: [0.1, 0.1, 0.1], glass: [0.1, 0.14, 0.2], rim: [0.85, 0.85, 0.85] },
  muscle: { body: [0.55, 0.15, 0.65], trim: [0.08, 0.08, 0.1], glass: [0.06, 0.08, 0.14], rim: [0.95, 0.9, 0.75] },
  convertible: { body: [0.2, 0.7, 0.9], trim: [0.1, 0.12, 0.14], glass: [0.1, 0.16, 0.24], rim: [0.9, 0.9, 0.92] },
  sports: { body: [0.95, 0.25, 0.15], trim: [0.05, 0.05, 0.08], glass: [0.05, 0.08, 0.16], rim: [0.95, 0.8, 0.4] },
  pickup: { body: [0.35, 0.55, 0.3], trim: [0.12, 0.12, 0.1], glass: [0.1, 0.14, 0.2], rim: [0.85, 0.85, 0.85] },
  limo: { body: [0.12, 0.1, 0.14], trim: [0.85, 0.7, 0.3], glass: [0.08, 0.1, 0.16], rim: [0.95, 0.85, 0.6] },
  hatch: { body: [0.3, 0.55, 0.9], trim: [0.1, 0.1, 0.12], glass: [0.1, 0.14, 0.22], rim: [0.85, 0.85, 0.9] },
  bus: { body: [0.9, 0.6, 0.2], trim: [0.15, 0.12, 0.1], glass: [0.12, 0.16, 0.24], rim: [0.8, 0.8, 0.82] },
};

export function carPaint(id) {
  return CAR_PAINT[id] || CAR_PAINT.sedan;
}

// Sky gradient stops for a day of the hurricane countdown (0 = day 1
// gold, 6 = day 7 ember). The top of the sky, the horizon band, and
// the low sun glow — the engine's clear colour is the horizon, the
// sun disc and halo carry the rest.
export function skyStops(day) {
  const t = Math.max(0, Math.min(6, day)) / 6;
  return {
    top: [0.45 - t * 0.18, 0.28 - t * 0.12, 0.3 - t * 0.08],
    horizon: [0.62 - t * 0.12, 0.38 - t * 0.14, 0.2 - t * 0.04],
    sunGlow: [1, 0.72 - t * 0.1, 0.28 - t * 0.05],
  };
}

// The sea's moving glint: a bright gold strip whose colour pulses
// with the tide and the time, so the water reads as water, not paint.
export function waterGlint(time, tide) {
  const pulse = 0.75 + Math.sin(time * 0.8) * 0.15 + tide * 0.1;
  return [Math.min(1, pulse), 0.62 * pulse, 0.3 * pulse];
}

// Neon sign colours, cycled by index — the market and the Mile never
// repeat the same two signs in a row.
export const NEON_COLORS = ['#ff9a3d', '#ffd166', '#fda4af', '#7dd3fc', '#ff5c5c', '#a5f3fc', '#2dd4bf', '#fbbf24'];

export function neonColor(i) {
  return NEON_COLORS[((i % NEON_COLORS.length) + NEON_COLORS.length) % NEON_COLORS.length];
}

// Night-market stall colours: striped awnings in pairs, warm lamps.
export const MARKET_COLORS = [
  [1, 0.45, 0.3], [0.3, 0.7, 0.95], [0.95, 0.8, 0.3],
  [0.75, 0.5, 0.95], [0.4, 0.85, 0.5], [0.95, 0.55, 0.2],
];

export function marketColor(i) {
  return MARKET_COLORS[((i % MARKET_COLORS.length) + MARKET_COLORS.length) % MARKET_COLORS.length];
}

// Street trees: trunk brown, canopy green-gold — golden hour turns
// every canopy into a warm green, never a flat cartoon green.
export function treePalette(kind) {
  if (kind === 'palm') return { trunk: [0.4, 0.28, 0.16], canopy: [0.25, 0.55, 0.3] };
  if (kind === 'jacaranda') return { trunk: [0.35, 0.25, 0.2], canopy: [0.6, 0.4, 0.7] };
  return { trunk: [0.38, 0.28, 0.18], canopy: [0.35, 0.55, 0.28] };
}

// Cloud tint at golden hour: warm white tops, rose undersides.
export function cloudTint(time) {
  const drift = Math.sin(time * 0.05) * 0.05;
  return { top: [0.98, 0.85 + drift, 0.7], under: [0.9, 0.55, 0.45] };
}
