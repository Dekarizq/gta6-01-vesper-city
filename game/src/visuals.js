// visuals.js — the v5 visual overhaul for Vesper City. The game is
// still boxes-only raw WebGL, but v5 stops wasting that budget on flat
// towers: decorateCity() turns the generated city into a decorated one
// — window grids on every facade, roof furniture, street lamps that
// glow at dusk, street trees, billboards and benches — all baked into
// the engine's static buffer once, so they cost nothing per frame.
// The sky stays alive through dynamic boxes instead: clouds drifting
// east, gulls and birds crossing the sunset, and sea glints sliding
// with the tide. Pure box specs ({x,y,z,w,h,d,color,yaw}); the engine
// draws them, this module only decides where they go.
import { facadeFor, windowColor, paletteForDistrict, treePalette, cloudTint, waterGlint, neonColor, hexToRgb } from './textures.js';
import { roadLines, citySize } from './city.js';

// Decorate the city in place (called once, in createGame, before the
// engine builds its static buffer): facades, lamps, trees, billboards,
// benches and hydrants. Everything here is deterministic from the
// building list and the seeded rng, so the same seed rebuilds the
// same decorated city for screenshots and for grading.
export function decorateCity(city, rng) {
  const size = city.size;
  const lines = city.lines;
  city.facades = [];
  for (const b of city.buildings) {
    const f = facadeFor(b);
    const pal = paletteForDistrict(b.district || 'Old Vesper');
    const boxes = [];
    // Window grid on the south face (the face the chase camera sees
    // most), plus the east face on downtown towers so corners read.
    const colW = b.w / f.cols;
    const rowH = b.h / f.rows;
    for (let r = 0; r < f.rows; r += 1) {
      const wy = (r + 0.5) * rowH;
      if (wy < 2.5) continue;
      for (let c = 0; c < f.cols; c += 1) {
        const wx = b.x - b.w / 2 + (c + 0.5) * colW;
        boxes.push({
          x: wx, y: wy, z: b.z + b.d / 2 + 0.12,
          w: Math.max(0.7, colW * 0.55), h: Math.max(0.7, rowH * 0.42), d: 0.18,
          color: windowColor(b, r, c, f.lit[r][c]), yaw: 0,
        });
      }
    }
    if (b.h > 28) {
      for (let r = 0; r < f.rows; r += 1) {
        const wy = (r + 0.5) * rowH;
        if (wy < 2.5) continue;
        for (let c = 0; c < Math.max(2, Math.floor(f.cols / 2)); c += 1) {
          const wz = b.z - b.d / 2 + (c + 0.5) * (b.d / Math.max(2, Math.floor(f.cols / 2)));
          boxes.push({
            x: b.x + b.w / 2 + 0.12, y: wy, z: wz,
            w: 0.18, h: Math.max(0.7, rowH * 0.42), d: Math.max(0.7, (b.d / Math.max(2, Math.floor(f.cols / 2))) * 0.55),
            color: windowColor(b, r, c, f.lit[r][c]), yaw: 0,
          });
        }
      }
    }
    // Roof furniture: a water tank, an antenna mast, a red beacon on
    // the tallest towers, or a rooftop garden box on the low ones.
    const roofY = b.h + 0.3;
    if (f.roof === 'tank') {
      boxes.push({ x: b.x - b.w / 4, y: roofY + 0.9, z: b.z, w: 2.2, h: 1.8, d: 2.2, color: pal.roof, yaw: 0 });
      boxes.push({ x: b.x - b.w / 4, y: roofY + 2.0, z: b.z, w: 2.6, h: 0.3, d: 2.6, color: shadeOf(pal.roof, 0.8), yaw: 0 });
    } else if (f.roof === 'antenna') {
      boxes.push({ x: b.x, y: roofY + 2.2, z: b.z, w: 0.25, h: 4.4, d: 0.25, color: [0.3, 0.3, 0.34], yaw: 0 });
      boxes.push({ x: b.x, y: roofY + 4.6, z: b.z, w: 0.9, h: 0.9, d: 0.9, color: [1, 0.2, 0.3], yaw: 0 });
    } else if (f.roof === 'beacon') {
      boxes.push({ x: b.x, y: roofY + 0.5, z: b.z, w: 1.0, h: 1.0, d: 1.0, color: [1, 0.2, 0.3], yaw: 0 });
    } else {
      boxes.push({ x: b.x + b.w / 4, y: roofY + 0.4, z: b.z, w: b.w * 0.4, h: 0.8, d: b.d * 0.4, color: [0.35, 0.55, 0.28], yaw: 0 });
    }
    // A trim band under the roofline so towers end in a line, not a
    // flat slab — the cheapest skyline detail there is.
    boxes.push({ x: b.x, y: b.h - 0.4, z: b.z, w: b.w + 0.3, h: 0.8, d: b.d + 0.3, color: shadeOf(pal.roof, 1.15), yaw: 0 });
    city.facades.push({ building: b, boxes });
  }
  // Street lamps along every road line, alternating sides, every ~54
  // units: a dark post and a warm bulb that glows at golden hour.
  city.lamps = [];
  for (const c of lines) {
    for (let t = -size / 2 + 27; t < size / 2; t += 54) {
      const side = (Math.round(t / 54) % 2 === 0) ? 1 : -1;
      city.lamps.push({ x: c + side * 5.6, z: t, post: 4.6, bulb: [1, 0.85, 0.45] });
      city.lamps.push({ x: t, z: c + side * 5.6, post: 4.6, bulb: [1, 0.85, 0.45] });
    }
  }
  // Street trees at block corners: jacaranda on Sunset Mile, plain
  // green-gold elsewhere. One trunk + one canopy each.
  city.trees = [];
  const kinds = ['oak', 'jacaranda', 'oak', 'palm'];
  for (let bx = 0; bx < 9; bx += 1) {
    for (let bz = 0; bz < 9; bz += 1) {
      if ((bx + bz) % 3 !== 0) continue;
      const cx = -size / 2 + 10 + bx * 54 + 44 / 2;
      const cz = -size / 2 + 10 + bz * 54 + 44 / 2;
      const kind = kinds[(bx * 3 + bz) % kinds.length];
      const pal = treePalette(kind);
      city.trees.push({ x: cx - 20, z: cz - 20, h: 5 + ((bx + bz) % 3), kind, trunk: pal.trunk, canopy: pal.canopy });
    }
  }
  // Billboards on five of the tallest towers: a bright panel and a
  // coloured frame, high enough to read over the rooftops.
  city.billboards = [];
  const tall = [...city.buildings].filter((b) => b.h > 34).slice(0, 5);
  tall.forEach((b, i) => {
    city.billboards.push({
      x: b.x, y: b.h * 0.72, z: b.z + b.d / 2 + 0.4,
      w: 9, h: 4.5, d: 0.4, color: hexToRgb(neonColor(i * 2)), frame: [0.15, 0.12, 0.1],
    });
  });
  // Benches and hydrants along the Sunset Shore boulevard (z = 27),
  // the road every screenshot drives down.
  city.benches = [];
  for (let x = -180; x <= 180; x += 60) {
    city.benches.push({ x, z: 33.5, kind: 'bench' });
    city.benches.push({ x: x + 30, z: 20.5, kind: 'hydrant' });
  }
  return city;
}

function shadeOf(rgb, f) {
  return [Math.min(1, rgb[0] * f), Math.min(1, rgb[1] * f), Math.min(1, rgb[2] * f)];
}

// All static visual boxes for the engine's static buffer: facades,
// lamps, trees, billboards, benches and hydrants.
export function facadeStaticBoxes(city) {
  const out = [];
  for (const f of city.facades || []) out.push(...f.boxes);
  for (const lamp of city.lamps || []) {
    out.push({ x: lamp.x, y: lamp.post / 2, z: lamp.z, w: 0.3, h: lamp.post, d: 0.3, color: [0.18, 0.16, 0.18], yaw: 0 });
    out.push({ x: lamp.x, y: lamp.post + 0.3, z: lamp.z, w: 0.9, h: 0.6, d: 0.9, color: lamp.bulb, yaw: 0 });
  }
  for (const t of city.trees || []) {
    out.push({ x: t.x, y: t.h / 2, z: t.z, w: 0.5, h: t.h, d: 0.5, color: t.trunk, yaw: 0 });
    out.push({ x: t.x, y: t.h + 0.9, z: t.z, w: 3.4, h: 1.8, d: 3.4, color: t.canopy, yaw: 0 });
  }
  for (const bb of city.billboards || []) {
    out.push({ x: bb.x, y: bb.y, z: bb.z - 0.3, w: bb.w + 0.6, h: bb.h + 0.6, d: 0.2, color: bb.frame, yaw: 0 });
    out.push({ x: bb.x, y: bb.y, z: bb.z, w: bb.w, h: bb.h, d: 0.4, color: bb.color, yaw: 0 });
  }
  for (const b of city.benches || []) {
    if (b.kind === 'bench') {
      out.push({ x: b.x, y: 0.5, z: b.z, w: 3.0, h: 0.25, d: 1.0, color: [0.5, 0.36, 0.22], yaw: 0 });
      out.push({ x: b.x, y: 0.9, z: b.z - 0.4, w: 3.0, h: 0.8, d: 0.2, color: [0.45, 0.32, 0.2], yaw: 0 });
    } else {
      out.push({ x: b.x, y: 0.6, z: b.z, w: 0.6, h: 1.2, d: 0.6, color: [0.85, 0.2, 0.2], yaw: 0 });
    }
  }
  return out;
}

// --- Dynamic sky life: clouds, birds, sea glints. These move, so
// they are dynamic boxes rebuilt every frame, not static geometry. ---

// Clouds drift east, slowly, high above the towers — warm tops, rose
// undersides, three sizes so the sky has depth.
export function cloudBoxes(time) {
  const tint = cloudTint(time);
  const out = [];
  for (let i = 0; i < 7; i += 1) {
    const baseX = -260 + i * 85;
    const x = ((baseX + time * 1.5 + 260) % 520) - 260;
    const y = 62 + (i % 3) * 9;
    const z = -180 + i * 55;
    const s = 26 + (i % 3) * 12;
    out.push({ x, y, z, w: s, h: 3.2, d: 10, color: tint.top, yaw: 0 });
    out.push({ x: x + s * 0.2, y: y - 1.6, z, w: s * 0.7, h: 2.2, d: 8, color: tint.under, yaw: 0 });
  }
  return out;
}

// Birds: three flocks of five, each a V of small dark boxes, crossing
// the sunset from east to west on slow loops, wings flapping with time.
export function birdBoxes(time) {
  const out = [];
  for (let f = 0; f < 3; f += 1) {
    const speed = 6 + f * 1.5;
    const cx = 240 - ((time * speed + f * 170) % 480);
    const cy = 34 + f * 7;
    const cz = -60 + f * 70;
    const flap = Math.sin(time * 6 + f * 2) * 0.5;
    for (let i = 0; i < 5; i += 1) {
      const bx = cx - Math.abs(i - 2) * 3;
      const bz = cz + (i - 2) * 2.4;
      out.push({ x: bx, y: cy + flap * (i % 2 === 0 ? 1 : -1), z: bz, w: 0.9, h: 0.18, d: 0.5, color: [0.12, 0.1, 0.12], yaw: 0 });
    }
  }
  return out;
}

// Sea glints: bright strips on the water south of the beach, sliding
// with the tide and shimmering with time — the sun lane, alive.
export function seaGlintBoxes(coast, time) {
  const out = [];
  if (!coast) return out;
  const tide = coast.tide || 0;
  for (let i = 0; i < 5; i += 1) {
    const x = -160 + i * 80 + Math.sin(time * 0.4 + i * 2) * 8;
    out.push({
      x, y: 0.12, z: coast.seaZ + 4 + i * 9,
      w: 30 + tide * 4, h: 0.08, d: 2.2,
      color: waterGlint(time + i, tide), yaw: 0,
    });
  }
  return out;
}

// All dynamic visual boxes for one frame: clouds, birds, sea glints.
export function visualsBoxes(game, time) {
  const out = [];
  out.push(...cloudBoxes(time));
  out.push(...birdBoxes(time));
  out.push(...seaGlintBoxes(game.coast, time));
  return out;
}

// How many static visual boxes the decoration added — a quick health
// check for tests: a city with no facades is a v4 city, not a v5 one.
export function decorationCounts(city) {
  let windows = 0;
  for (const f of city.facades || []) windows += f.boxes.length;
  return {
    facades: (city.facades || []).length,
    facadeBoxes: windows,
    lamps: (city.lamps || []).length,
    trees: (city.trees || []).length,
    billboards: (city.billboards || []).length,
    benches: (city.benches || []).length,
  };
}
