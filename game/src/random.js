// Seeded random helpers (mulberry32) so staged screenshots are deterministic,
// plus the small math helpers the v3 systems share: clamping, lerping,
// distance, angle wrapping, and a weighted pick for the radio walk and
// the traffic spawner. Pure functions — safe to import from Node tests.
export function createRandom(seed) {
  let a = seed >>> 0;
  return {
    next() {
      a |= 0; a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    },
    range(min, max) { return min + this.next() * (max - min); },
    int(min, max) { return Math.floor(this.range(min, max + 1)); },
    pick(arr) { return arr[Math.floor(this.next() * arr.length)]; },
    pickWeighted(pairs) {
      let total = 0;
      for (const [, w] of pairs) total += w;
      let roll = this.next() * total;
      for (const [v, w] of pairs) {
        roll -= w;
        if (roll <= 0) return v;
      }
      return pairs[pairs.length - 1][0];
    },
  };
}
export function clamp(v, lo, hi) { return v < lo ? lo : v > hi ? hi : v; }
// v6: a seeded coin flip — true with probability p (0..1), drawn from
// the game's rng so a test with the same seed always flips the same way.
export function chance(rng, p) { return rng.next() < p; }
// v5: a normal-distributed value (Box-Muller on the seeded rng) so
// crowd speeds cluster around a natural average instead of spreading
// flat across a range — walkers mostly stroll, a few hurry.
export function gauss(rng) {
  const u = Math.max(1e-9, rng.next());
  const v = rng.next();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}
export function clamp01(v) { return v < 0 ? 0 : v > 1 ? 1 : v; }
export function lerp(a, b, t) { return a + (b - a) * t; }
export function dist2(ax, az, bx, bz) { const dx = ax - bx, dz = az - bz; return dx * dx + dz * dz; }
export function angleLerp(a, b, t) {
  let d = (b - a) % (Math.PI * 2);
  if (d > Math.PI) d -= Math.PI * 2;
  if (d < -Math.PI) d += Math.PI * 2;
  return a + d * t;
}
// Wrap an angle into (-PI, PI] so chase steering never spins the long way.
export function wrapAngle(a) {
  while (a > Math.PI) a -= Math.PI * 2;
  while (a <= -Math.PI) a += Math.PI * 2;
  return a;
}
// A deterministic shuffle (Fisher-Yates on the seeded rng) for the radio
// walk and for dealing traffic types without repeats in a row.
export function shuffle(rng, arr) {
  const out = [...arr];
  for (let i = out.length - 1; i > 0; i -= 1) {
    const j = rng.int(0, i);
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

// v4 helpers, shared by the coast, the GPS and the spike strips.
// pickN: n distinct items from an array, in seeded order. angleDiff:
// the signed shortest turn from a to b, in (-PI, PI]. clampAngle: wrap
// an angle into (-PI, PI]. smoothstep: the classic 0..1 ease used by
// the tide and the sun-lane slide.
export function pickN(rng, arr, n) {
  return shuffle(rng, arr).slice(0, Math.min(n, arr.length));
}
export function angleDiff(a, b) {
  let d = (b - a) % (Math.PI * 2);
  if (d > Math.PI) d -= Math.PI * 2;
  if (d < -Math.PI) d += Math.PI * 2;
  return d;
}
export function clampAngle(a) {
  return wrapAngle(a);
}
export function smoothstep(t) {
  const x = clamp01(t);
  return x * x * (3 - 2 * x);
}
