// weather.js — the day cycle and the hurricane weather for v6.
// Vesper City lives on a seven-day countdown to Hurricane Ilsa, and
// until v5 the countdown was only a number on the HUD: the sky stayed
// golden whatever the clock said. v6 makes the week real. Every in-game
// day (240 seconds) runs gold -> dusk -> night -> dawn, and as the days
// pass the storm front builds: day 6 brings heavy rain and lightning,
// day 7 is the hurricane itself. The weather is pure logic plus render
// boxes; the engine reads it for the sky and fog colours, the world
// loop reads it for gameplay — traffic thins in a storm, the VCPD heat
// rises faster at night, and the roads shine wet when the rain comes.
// The storm is also why the city has sandbags and storm drains now.
import { clamp, lerp } from './random.js';

// Where each part of the day starts, as a fraction of the day.
export const DAY_PHASES = [
  { id: 'gold', from: 0.0, rain: 0.12 },
  { id: 'dusk', from: 0.4, rain: 0.18 },
  { id: 'night', from: 0.55, rain: 0.15 },
  { id: 'storm', from: 0.75, rain: 0.75 },
  { id: 'dawn', from: 0.9, rain: 0.2 },
];

// How grey the fog goes in each phase (gold stays warm, storm is flat
// grey, night is deep blue). The engine mixes toward these colours.
export const PHASE_FOG = {
  gold: [0.66, 0.4, 0.22],
  dusk: [0.5, 0.28, 0.26],
  night: [0.12, 0.11, 0.2],
  storm: [0.34, 0.34, 0.38],
  dawn: [0.64, 0.46, 0.34],
};

export function createWeather() {
  return {
    time: 0,          // seconds since the game started (mirrors game.time)
    phase: 'gold',    // gold | dusk | night | storm | dawn
    rain: 0.12,       // 0..1, drives the HUD drizzle and the wet roads
    wetness: 0,       // 0..1, builds while it rains, dries in the sun
    flash: 0,         // lightning brightness, 1 on the strike, decays fast
    flashTimer: 9,    // seconds to the next strike (storm only)
    strikes: 0,       // lightning strikes so far, for the HUD and stats
    stormFront: 0,    // 0..1, how close the hurricane is (day 1 -> 0, day 7 -> 1)
    day: 1,
  };
}

// Which phase the clock is in, from the fraction of the day elapsed.
export function phaseAt(dayT) {
  let phase = 'gold';
  for (const p of DAY_PHASES) {
    if (dayT >= p.from) phase = p.id;
  }
  return phase;
}

// Advance the weather one frame. elapsed is the game's total seconds;
// dayLength is the seconds per in-game day (240). The storm front
// grows with the day count, so the last two days are genuinely wet.
export function stepWeather(state, dt, elapsed, dayLength = 240, rng = null) {
  state.time += dt;
  const day = Math.min(7, 1 + Math.floor(elapsed / dayLength));
  const dayT = ((elapsed % dayLength) + dayLength) % dayLength / dayLength;
  state.day = day;
  state.stormFront = clamp((day - 1) / 6, 0, 1);
  // Days 1-5 run the normal cycle. From day 6 the storm front swallows
  // the dusk and night: the storm phase starts earlier and lasts longer.
  let phase = phaseAt(dayT);
  if (day >= 6 && dayT >= 0.5 && dayT < 0.9) phase = 'storm';
  if (day >= 7 && dayT >= 0.3) phase = 'storm';
  state.phase = phase;
  const base = DAY_PHASES.find((p) => p.id === phase).rain;
  const target = clamp(base + state.stormFront * 0.25, 0.1, 0.95);
  state.rain = lerp(state.rain, target, Math.min(1, dt * 0.5));
  // Wet roads: rain soaks them in seconds, the gold sun dries them
  // over a minute. Wetness is what the engine's wet strips reflect.
  if (state.rain > 0.4) state.wetness = clamp(state.wetness + dt * 0.15, 0, 1);
  else state.wetness = clamp(state.wetness - dt * 0.02, 0, 1);
  // Lightning only in a storm: a strike every 6-14 seconds, a flash
  // that bleaches the sky and decays over half a second.
  if (phase === 'storm' || state.stormFront > 0.8) {
    state.flashTimer -= dt;
    if (state.flashTimer <= 0) {
      state.flash = 1;
      state.strikes += 1;
      // Seeded when the caller passes its rng, so a test replay with
      // the same seed strikes at the same seconds; plain Math.random
      // only when no rng is given (browser play).
      state.flashTimer = 6 + (rng ? rng.next() : Math.random()) * 8;
    }
  }
  if (state.flash > 0) state.flash = Math.max(0, state.flash - dt * 2.2);
  return state;
}

// Fog colour for the engine: the phase fog, darkened by rain.
export function weatherFog(state) {
  const base = PHASE_FOG[state.phase] || PHASE_FOG.gold;
  const dark = 1 - state.rain * 0.25;
  return [base[0] * dark, base[1] * dark, base[2] * dark];
}

// What the weather hands the engine each frame: fog + the phase and
// the lightning flash the sky colour is built from.
export function weatherRender(state) {
  return { fog: weatherFog(state), phase: state.phase, flash: state.flash };
}

// Gameplay: how fast wanted heat rises (night is 1.5x — the VCPD
// owns the dark streets) and how much traffic is on the roads (a
// storm empties them to half).
export function wantedMultiplier(state) {
  return state.phase === 'night' ? 1.5 : state.phase === 'storm' ? 1.25 : 1;
}
export function trafficFactor(state) {
  return state.phase === 'storm' ? 0.5 : state.phase === 'night' ? 0.8 : 1;
}

// One-line label for the HUD weather chip.
export function weatherLabel(state) {
  const names = {
    gold: 'GOLDEN HOUR', dusk: 'DUSK', night: 'NIGHT', storm: 'HURRICANE STORM', dawn: 'DAWN',
  };
  const rain = state.rain > 0.55 ? ' · HEAVY RAIN' : state.rain > 0.3 ? ' · RAIN' : '';
  return `${names[state.phase] || 'GOLDEN HOUR'} · DAY ${state.day}/7${rain}`;
}

// The 7-day hurricane forecast, one row per day — the whole countdown
// written out so the player can plan around it. Day 1 is the golden
// morning the game opens on; day 7 is landfall, when the storm never
// lets up. Each row names the rain, the wind, and what the city should
// do about it: the advice is the gameplay hint (board the boats on
// day 5, stay off the pier on day 7), not decoration.
export const HURRICANE_FORECAST = [
  { day: 1, name: 'GOLDEN MORNING', rain: 0.12, wind: 8, advice: 'Clear skies — run the city, buy in early.' },
  { day: 2, name: 'WARM BUILD-UP', rain: 0.18, wind: 14, advice: 'Clouds gathering — the front is offshore.' },
  { day: 3, name: 'FIRST RAIN', rain: 0.32, wind: 22, advice: 'Rain on the roads — wet grip, slower stops.' },
  { day: 4, name: 'SQUALLS', rain: 0.48, wind: 34, advice: 'Squalls at dusk — traffic thins after dark.' },
  { day: 5, name: 'FRONT ARRIVES', rain: 0.62, wind: 48, advice: 'Storm front — board the boats, mind the surge.' },
  { day: 6, name: 'HURRICANE EDGE', rain: 0.8, wind: 66, advice: 'The edge is here — storms own the night now.' },
  { day: 7, name: 'LANDFALL', rain: 0.95, wind: 88, advice: 'Landfall — the storm never lets up. Hold on.' },
];

// The forecast row for a day (1-7, clamped): the plan for that day.
export function forecastForDay(day) {
  const d = clamp(Math.round(day) || 1, 1, 7);
  return HURRICANE_FORECAST[d - 1];
}

// How bad the storm is on a day, 0-3: 0 is clear, 1 is rain, 2 is
// the front, 3 is landfall. The HUD colours the warning by this, and
// the radio storm-watch reads it out as a number, not a feeling.
export function stormWarningLevel(day) {
  if (day >= 7) return 3;
  if (day >= 5) return 2;
  if (day >= 3) return 1;
  return 0;
}

// One-line forecast for the HUD: what tomorrow brings, so the player
// never walks into the front unprepared. On day 7 there is no
// tomorrow — the line says so, and to hold on.
export function weatherForecastText(state) {
  const today = state.day || 1;
  if (today >= 7) return 'LANDFALL TODAY — hold the city through the storm.';
  const next = forecastForDay(today + 1);
  return `TOMORROW DAY ${next.day}: ${next.name} — ${next.advice}`;
}

// Render boxes: storm clouds drifting over the city, a lightning bolt
// on the strike frame, and wet-road glints near the player when the
// roads are soaked. Clouds are big dark boxes high up; they move with
// the clock so the sky never sits still.
export function weatherBoxes(state, time, px, pz) {
  const boxes = [];
  if (state.phase === 'storm' || state.stormFront > 0.5) {
    for (let i = 0; i < 5; i += 1) {
      const drift = ((time * 6 + i * 90) % 560) - 280;
      boxes.push({
        x: drift, y: 78 + (i % 3) * 6, z: -160 + i * 70,
        w: 90, h: 7, d: 55,
        color: [0.22 + i * 0.02, 0.22 + i * 0.02, 0.26], yaw: 0,
      });
    }
  }
  if (state.flash > 0.5) {
    const f = state.flash;
    boxes.push({
      x: px + 60, y: 55, z: pz - 90, w: 1.6 * f, h: 90, d: 1.6 * f,
      color: [0.95, 0.95, 1.0], yaw: 0,
    });
    boxes.push({
      x: px + 60, y: 95, z: pz - 90, w: 14 * f, h: 2, d: 14 * f,
      color: [0.85, 0.88, 1.0], yaw: 0,
    });
  }
  if (state.wetness > 0.45) {
    const shine = 0.35 + state.wetness * 0.4;
    for (let i = 0; i < 4; i += 1) {
      const ox = ((i * 37) % 80) - 40;
      const oz = ((i * 53) % 80) - 40;
      boxes.push({
        x: px + ox, y: 0.12, z: pz + oz, w: 9, h: 0.06, d: 4,
        color: [shine, shine * 0.75, shine * 0.5], yaw: 0,
      });
    }
  }
  return boxes;
}

// Force a phase (used by the screenshot stager and the unit sim):
// 'storm' jumps straight to the hurricane front, 'night' to the dark.
export function forceWeather(state, phase) {
  state.phase = phase;
  if (phase === 'storm') {
    state.rain = 0.85;
    state.wetness = 0.9;
    state.stormFront = 1;
    state.flash = 1;
    state.strikes += 1;
  } else if (phase === 'night') {
    state.rain = 0.15;
    state.stormFront = 0.4;
  }
  return state;
}

export function weatherSave(state) {
  return { day: state.day, phase: state.phase, rain: state.rain, strikes: state.strikes };
}

export function weatherLoad(data) {
  const s = createWeather();
  if (!data) return s;
  if (Number.isInteger(data.day)) s.day = clamp(data.day, 1, 7);
  if (typeof data.phase === 'string') s.phase = data.phase;
  if (Number.isFinite(data.rain)) s.rain = clamp(data.rain, 0, 1);
  if (Number.isInteger(data.strikes)) s.strikes = data.strikes;
  s.stormFront = clamp((s.day - 1) / 6, 0, 1);
  return s;
}
