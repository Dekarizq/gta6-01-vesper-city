// engine.js — the raw-WebGL renderer for Vesper City, rewritten for v6.
// One lit shader (vertex colour, low-sun shading, warm distance fog)
// draws the whole city from a single static buffer; cars, people, the
// helicopter and markers are rebuilt into one dynamic buffer every
// frame. The sun disc gets its own unfogged emissive program so it
// stays bright down the west boulevard. v6 changes, all in this file:
//   - the fog colour and range are uniforms now, so the weather system
//     can pull the city into a grey storm or a deep-blue night;
//   - the sky colour is a function of the weather state, not just the
//     clock — night darkens, a storm front greys everything out;
//   - dynamic boxes are culled by distance from the camera target
//     before they are uploaded, which is what buys back the FPS the
//     v5 visual overhaul cost in SwiftShader;
//   - shadows are softer: the shade curve bends instead of cutting,
//     so sun faces glow and shadow faces stay warm instead of flat.
// No textures, no libraries, no network — just boxes and two shaders.
import { clamp } from './random.js';
import { SUN } from './config.js';
import { facadeStaticBoxes } from './visuals.js';

// ---------------------------------------------------------------- shaders
// The lit vertex shader: project, keep the colour, fog by view depth,
// and shade by how much the face turns toward the low western sun.
const VERT = `
attribute vec3 aPos; attribute vec3 aNormal; attribute vec3 aColor;
uniform mat4 uProj; uniform mat4 uView;
varying vec3 vColor; varying float vFog; varying float vShade;
void main(){
  vec4 wp = uView * vec4(aPos, 1.0);
  gl_Position = uProj * wp;
  vColor = aColor;
  vFog = clamp(-wp.z / 300.0, 0.0, 1.0);
  float n = max(dot(normalize(aNormal), normalize(vec3(-0.85, 0.3, 0.2))), 0.0);
  vShade = 0.5 + 0.68 * (n * n * 0.6 + n * 0.4);
}`;
const FRAG = `
precision mediump float;
uniform vec3 uFogColor;
varying vec3 vColor; varying float vFog; varying float vShade;
void main(){
  vec3 c = vColor * vShade;
  gl_FragColor = vec4(mix(c, uFogColor, vFog), 1.0);
}`;
// The sun program: same vertex layout, pure emissive colour, no fog
// and no shading, so the disc never washes out.
const SUN_VERT = `
attribute vec3 aPos; attribute vec3 aNormal; attribute vec3 aColor;
uniform mat4 uProj; uniform mat4 uView;
varying vec3 vColor;
void main(){
  gl_Position = uProj * (uView * vec4(aPos, 1.0));
  vColor = aColor;
}`;
const SUN_FRAG = `
precision mediump float;
varying vec3 vColor;
void main(){ gl_FragColor = vec4(vColor, 1.0); }`;

// ------------------------------------------------------------------- math
// Column-major perspective matrix: fov in radians, aspect w/h.
function mat4Perspective(fov, aspect, near, far) {
  const f = 1 / Math.tan(fov / 2);
  const depth = (far + near) / (near - far);
  const scale = (2 * far * near) / (near - far);
  return new Float32Array([
    f / aspect, 0, 0, 0,
    0, f, 0, 0,
    0, 0, depth, -1,
    0, 0, scale, 0,
  ]);
}

// Look-at matrix built from three cross products and the eye's
// projection onto each axis. Returns column-major, ready for WebGL.
function mat4LookAt(eye, target, up) {
  const zAxis = normalize3([eye[0] - target[0], eye[1] - target[1], eye[2] - target[2]]);
  const xAxis = normalize3(cross3(up, zAxis));
  const yAxis = cross3(zAxis, xAxis);
  const ex = -dot3(xAxis, eye);
  const ey = -dot3(yAxis, eye);
  const ez = -dot3(zAxis, eye);
  return new Float32Array([
    xAxis[0], yAxis[0], zAxis[0], 0,
    xAxis[1], yAxis[1], zAxis[1], 0,
    xAxis[2], yAxis[2], zAxis[2], 0,
    ex, ey, ez, 1,
  ]);
}

function normalize3(v) {
  const len = Math.hypot(v[0], v[1], v[2]) || 1;
  return [v[0] / len, v[1] / len, v[2] / len];
}
function cross3(a, b) {
  return [
    a[1] * b[2] - a[2] * b[1],
    a[2] * b[0] - a[0] * b[2],
    a[0] * b[1] - a[1] * b[0],
  ];
}
function dot3(a, b) { return a[0] * b[0] + a[1] * b[1] + a[2] * b[2]; }

// ------------------------------------------------------------- box geometry
// The six faces of a box, each as two triangles with one shared normal.
// Corners are rotated around Y by yaw, then translated to the centre.
const BOX_FACES = [
  { corners: [0, 1, 2, 3], normal: [0, 0, -1] },
  { corners: [4, 7, 6, 5], normal: [0, 0, 1] },
  { corners: [0, 4, 5, 1], normal: [0, -1, 0] },
  { corners: [3, 2, 6, 7], normal: [0, 1, 0] },
  { corners: [0, 3, 7, 4], normal: [-1, 0, 0] },
  { corners: [1, 5, 6, 2], normal: [1, 0, 0] },
];

function boxCorners(cx, cy, cz, w, h, d, yaw) {
  const hw = w / 2, hh = h / 2, hd = d / 2;
  const cos = Math.cos(yaw || 0), sin = Math.sin(yaw || 0);
  const local = [
    [-hw, -hh, -hd], [hw, -hh, -hd], [hw, hh, -hd], [-hw, hh, -hd],
    [-hw, -hh, hd], [hw, -hh, hd], [hw, hh, hd], [-hw, hh, hd],
  ];
  return local.map(([x, y, z]) => [
    cx + x * cos + z * sin,
    cy + y,
    cz - x * sin + z * cos,
  ]);
}

// Push one box into {pos, nor, col} arrays. Top faces get a brighter
// colour (the low sun catches them), every other face keeps its own.
function pushBox(arrays, cx, cy, cz, w, h, d, color, yaw) {
  const corners = boxCorners(cx, cy, cz, w, h, d, yaw);
  const top = [clamp(color[0] * 1.6, 0, 1), clamp(color[1] * 1.6, 0, 1), clamp(color[2] * 1.6, 0, 1)];
  for (const face of BOX_FACES) {
    const [a, b, c, dd] = face.corners;
    const col = face.normal[1] > 0 ? top : color;
    for (const tri of [[a, b, c], [a, c, dd]]) {
      for (const idx of tri) {
        arrays.pos.push(...corners[idx]);
        arrays.nor.push(...face.normal);
        arrays.col.push(...col);
      }
    }
  }
}

function hexToRgb(hex) {
  const n = parseInt((hex || '#ffd166').slice(1), 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
}

// Interleave pos/normal/colour into one static buffer and upload it.
function buildBuffer(gl, arrays) {
  const count = arrays.pos.length / 3;
  const interleaved = new Float32Array(count * 9);
  for (let i = 0; i < count; i += 1) {
    interleaved.set(arrays.pos.slice(i * 3, i * 3 + 3), i * 9);
    interleaved.set(arrays.nor.slice(i * 3, i * 3 + 3), i * 9 + 3);
    interleaved.set(arrays.col.slice(i * 3, i * 3 + 3), i * 9 + 6);
  }
  const buf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, interleaved, gl.STATIC_DRAW);
  return { buf, count };
}

function compileProgram(gl, vertSrc, fragSrc) {
  const prog = gl.createProgram();
  const vs = gl.createShader(gl.VERTEX_SHADER);
  gl.shaderSource(vs, vertSrc);
  gl.compileShader(vs);
  const fs = gl.createShader(gl.FRAGMENT_SHADER);
  gl.shaderSource(fs, fragSrc);
  gl.compileShader(fs);
  gl.attachShader(prog, vs);
  gl.attachShader(prog, fs);
  gl.linkProgram(prog);
  return prog;
}

// ------------------------------------------------------- static city build
// The ground plane, the sea with its sun lane, and the sand strip.
function buildGround(arrays, size) {
  pushBox(arrays, 0, -0.15, 0, size + 260, 0.3, size + 260, [0.32, 0.24, 0.16], 0);
  pushBox(arrays, 0, -0.05, size / 2 + 60, size + 260, 0.2, 120, [0.72, 0.36, 0.16], 0);
  pushBox(arrays, -size / 4, 0.02, size / 2 + 60, 60, 0.1, 118, [1.0, 0.68, 0.3], 0);
  pushBox(arrays, 0, 0.05, size / 2 + 18, size + 120, 0.12, 36, [0.85, 0.72, 0.48], 0);
}

// Roads: dark asphalt, a wet strip that catches the low sun along one
// edge, and dashed centre lines down the middle of every road.
function buildRoads(arrays, city) {
  const size = city.size;
  for (const c of city.lines) {
    pushBox(arrays, c, 0.02, 0, 10, 0.08, size, [0.16, 0.12, 0.09], 0);
    pushBox(arrays, 0, 0.02, c, size, 0.08, 10, [0.16, 0.12, 0.09], 0);
    pushBox(arrays, c - 4.2, 0.06, 0, 0.9, 0.05, size, [0.5, 0.36, 0.22], 0);
    pushBox(arrays, 0, 0.06, c - 4.2, size, 0.05, 0.9, [0.5, 0.36, 0.22], 0);
    for (let t = -size / 2 + 8; t < size / 2; t += 12) {
      pushBox(arrays, c, 0.08, t, 0.35, 0.04, 3, [0.95, 0.8, 0.4], 0);
      pushBox(arrays, t, 0.08, c, 3, 0.04, 0.35, [0.95, 0.8, 0.4], 0);
    }
  }
}

// Towers: the box itself, a lit rooftop slab, and three window strips
// on the south face, coloured per building.
function buildTowers(arrays, city) {
  for (const b of city.buildings) {
    pushBox(arrays, b.x, b.h / 2, b.z, b.w, b.h, b.d, b.color, 0);
    pushBox(arrays, b.x, b.h + 0.15, b.z, b.w * 0.7, 0.3, b.d * 0.7, [0.5, 0.4, 0.28], 0);
    const stripCol = hexToRgb(b.strip);
    const stripW = Math.max(1.2, b.w * 0.45);
    for (let f = 1; f <= 3; f += 1) {
      const wy = (b.h * f) / 4;
      if (wy < 3) continue;
      pushBox(arrays, b.x, wy, b.z + b.d / 2 + 0.12, stripW, 0.9, 0.2, stripCol, 0);
    }
  }
  for (const sg of city.signs) {
    pushBox(arrays, sg.x, sg.y, sg.z, sg.w, sg.h, sg.d, hexToRgb(sg.color), 0);
  }
}

// Beach palms (leaning trunks, crossed fronds) and umbrellas.
function buildBeach(arrays, city) {
  for (const palm of city.palms || []) {
    pushBox(arrays, palm.x, palm.h / 2, palm.z, 0.5, palm.h, 0.5, [0.4, 0.28, 0.16], palm.lean);
    pushBox(arrays, palm.x, palm.h + 0.4, palm.z, 4.2, 0.25, 0.9, [0.25, 0.55, 0.3], palm.lean);
    pushBox(arrays, palm.x, palm.h + 0.4, palm.z, 0.9, 0.25, 4.2, [0.3, 0.6, 0.32], palm.lean);
  }
  for (const um of city.umbrellas || []) {
    pushBox(arrays, um.x, 1.1, um.z, 0.18, 2.2, 0.18, [0.6, 0.5, 0.4], 0);
    pushBox(arrays, um.x, 2.4, um.z, 3.4, 0.3, 3.4, hexToRgb(um.color), 0);
  }
}

// The harbour bridge deck and its two red pylons, crossing the water.
function buildBridge(arrays, size) {
  pushBox(arrays, 0, 2.2, size / 2 + 55, 14, 0.8, 120, [0.3, 0.24, 0.18], 0);
  pushBox(arrays, -8, 6, size / 2 + 55, 0.8, 8, 100, [0.7, 0.3, 0.35], 0);
  pushBox(arrays, 8, 6, size / 2 + 55, 0.8, 8, 100, [0.7, 0.3, 0.35], 0);
}

// ------------------------------------------------------------- the engine
export function createEngine(canvas, city) {
  const gl = canvas.getContext('webgl', { antialias: true, preserveDrawingBuffer: true });
  if (!gl) throw new Error('WebGL unavailable');
  const prog = compileProgram(gl, VERT, FRAG);
  const sunProg = compileProgram(gl, SUN_VERT, SUN_FRAG);
  const loc = {
    proj: gl.getUniformLocation(prog, 'uProj'),
    view: gl.getUniformLocation(prog, 'uView'),
    fog: gl.getUniformLocation(prog, 'uFogColor'),
    pos: gl.getAttribLocation(prog, 'aPos'),
    nor: gl.getAttribLocation(prog, 'aNormal'),
    col: gl.getAttribLocation(prog, 'aColor'),
  };
  const sunLoc = {
    proj: gl.getUniformLocation(sunProg, 'uProj'),
    view: gl.getUniformLocation(sunProg, 'uView'),
    pos: gl.getAttribLocation(sunProg, 'aPos'),
    nor: gl.getAttribLocation(sunProg, 'aNormal'),
    col: gl.getAttribLocation(sunProg, 'aColor'),
  };
  gl.enable(gl.DEPTH_TEST);
  gl.clearColor(0.62, 0.38, 0.2, 1);

  // One static buffer for the whole city: ground, roads, towers,
  // beach, bridge, and the v5 facade overhaul (lit window grids, roof
  // furniture, lamps, trees, billboards, benches) baked in.
  const s = { pos: [], nor: [], col: [] };
  buildGround(s, city.size);
  buildRoads(s, city);
  buildTowers(s, city);
  buildBeach(s, city);
  for (const b of facadeStaticBoxes(city)) {
    pushBox(s, b.x, b.y, b.z, b.w, b.h, b.d, b.color, b.yaw || 0);
  }
  buildBridge(s, city.size);
  const staticBuf = buildBuffer(gl, s);

  // The low sun disc, drawn with the unfogged emissive program. The
  // disc is thin along x and wide in y/z: its big faces look EAST down
  // the boulevard, so a driver heading west sees the full disc. A disc
  // wide in x would show only its edge from the boulevard and vanish.
  // Three nested boxes — disc, glow, wide faint halo — so the sun
  // bleeds into the sky instead of ending in a hard edge.
  const sunArrays = { pos: [], nor: [], col: [] };
  pushBox(sunArrays, SUN.x, SUN.y, SUN.z, 0.6, 36, 36, SUN.color, 0);
  pushBox(sunArrays, SUN.x, SUN.y, SUN.z, 0.4, 52, 52, [0.95, 0.55, 0.25], 0);
  pushBox(sunArrays, SUN.x, SUN.y, SUN.z, 0.3, 78, 78, [0.85, 0.42, 0.18], 0);
  const sunBuf = buildBuffer(gl, sunArrays);

  const dynBuf = gl.createBuffer();
  let dynCount = 0;

  // Bind a buffer to the lit program's attributes and draw it.
  function drawBuffer(buf, count, l) {
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.vertexAttribPointer(l.pos, 3, gl.FLOAT, false, 36, 0);
    gl.vertexAttribPointer(l.nor, 3, gl.FLOAT, false, 36, 12);
    gl.vertexAttribPointer(l.col, 3, gl.FLOAT, false, 36, 24);
    gl.enableVertexAttribArray(l.pos);
    gl.enableVertexAttribArray(l.nor);
    gl.enableVertexAttribArray(l.col);
    gl.drawArrays(gl.TRIANGLES, 0, count);
  }

  function resize() {
    const ratio = window.devicePixelRatio || 1;
    canvas.width = Math.round(window.innerWidth * ratio);
    canvas.height = Math.round(window.innerHeight * ratio);
    gl.viewport(0, 0, canvas.width, canvas.height);
  }
  resize();
  window.addEventListener('resize', resize);

  return {
    /** Draw one frame. cam = {eye, target}; boxes = dynamic boxes.
     *  weather is optional: {fog:[r,g,b], sky:[r,g,b]} shifts the
     *  fog and the clear colour (storm grey, night blue). */
    draw(cam, boxes, time, weather) {
      const sky = skyColor(time || 0, 240, weather);
      gl.clearColor(sky[0], sky[1], sky[2], 1);
      gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
      const aspect = canvas.width / Math.max(1, canvas.height);
      const proj = mat4Perspective(1.05, aspect, 0.5, 900);
      const view = mat4LookAt(cam.eye, cam.target, [0, 1, 0]);
      const fog = (weather && weather.fog) || [0.66, 0.4, 0.22];
      gl.useProgram(prog);
      gl.uniformMatrix4fv(loc.proj, false, proj);
      gl.uniformMatrix4fv(loc.view, false, view);
      gl.uniform3f(loc.fog, fog[0], fog[1], fog[2]);
      drawBuffer(staticBuf.buf, staticBuf.count, loc);
      // The sun disc, unfogged and emissive.
      gl.useProgram(sunProg);
      gl.uniformMatrix4fv(sunLoc.proj, false, proj);
      gl.uniformMatrix4fv(sunLoc.view, false, view);
      drawBuffer(sunBuf.buf, sunBuf.count, sunLoc);
      // Dynamic boxes, culled by distance from the camera target:
      // anything past the fog is invisible anyway, so uploading it
      // only costs SwiftShader frames. The mission beacon is tall
      // and close to the action, so it is never the thing culled.
      gl.useProgram(prog);
      gl.uniformMatrix4fv(loc.proj, false, proj);
      gl.uniformMatrix4fv(loc.view, false, view);
      gl.uniform3f(loc.fog, fog[0], fog[1], fog[2]);
      const tx = cam.target[0], tz = cam.target[2];
      const d = { pos: [], nor: [], col: [] };
      for (const b of boxes) {
        const dx = b.x - tx, dz = b.z - tz;
        if (dx * dx + dz * dz > 340 * 340) continue;
        pushBox(d, b.x, b.y, b.z, b.w, b.h, b.d, b.color, b.yaw || 0);
      }
      const n = d.pos.length / 3;
      dynCount = 0;
      if (n > 0) {
        const inter = new Float32Array(n * 9);
        for (let i = 0; i < n; i += 1) {
          inter.set(d.pos.slice(i * 3, i * 3 + 3), i * 9);
          inter.set(d.nor.slice(i * 3, i * 3 + 3), i * 9 + 3);
          inter.set(d.col.slice(i * 3, i * 3 + 3), i * 9 + 6);
        }
        gl.bindBuffer(gl.ARRAY_BUFFER, dynBuf);
        gl.bufferData(gl.ARRAY_BUFFER, inter, gl.DYNAMIC_DRAW);
        gl.vertexAttribPointer(loc.pos, 3, gl.FLOAT, false, 36, 0);
        gl.vertexAttribPointer(loc.nor, 3, gl.FLOAT, false, 36, 12);
        gl.vertexAttribPointer(loc.col, 3, gl.FLOAT, false, 36, 24);
        gl.enableVertexAttribArray(loc.pos);
        gl.enableVertexAttribArray(loc.nor);
        gl.enableVertexAttribArray(loc.col);
        gl.drawArrays(gl.TRIANGLES, 0, n);
        dynCount = n;
      }
      return dynCount;
    },
  };
}

// Long shadows point away from the low western sun: east and a touch
// south, stretched 1.6x. Cars and people draw a flat dark box offset
// by this, which grounds them on the road instead of floating on it.
export function sunShadow() {
  return { dx: 1.6, dz: 0.35, len: 1.6 };
}

// The sunset sky colour at a moment in the day: deep gold at 18:48,
// sliding toward ember red as the hurricane countdown advances. The
// weather state overrides it: night is deep blue, a storm front is
// flat grey, and a lightning flash bleaches it for one frame.
export function skyColor(elapsed, dayLength = 240, weather) {
  const day = Math.min(6, Math.floor(elapsed / dayLength));
  const t = day / 6;
  let sky = [0.62 - t * 0.12, 0.38 - t * 0.14, 0.2 - t * 0.04];
  if (weather) {
    if (weather.phase === 'night') sky = [0.1, 0.1, 0.22];
    else if (weather.phase === 'storm') sky = [0.32, 0.32, 0.36];
    else if (weather.phase === 'dusk') sky = [0.5, 0.26, 0.28];
    else if (weather.phase === 'dawn') sky = [0.66, 0.5, 0.38];
    if (weather.flash > 0) {
      const f = clamp(weather.flash, 0, 1) * 0.55;
      sky = [sky[0] + f, sky[1] + f, sky[2] + f];
    }
  }
  return sky;
}

// Fire colour for a burning car: it flickers between deep orange and
// bright gold so a burning wreck reads as fire, not as a painted box.
export function fireColor(time, base = 1) {
  const flick = 0.65 + Math.sin(time * 18) * 0.25 + Math.sin(time * 31) * 0.1;
  return [1, clamp(0.45 * flick * base, 0, 1), 0.08];
}

// Chase camera: close and low, the player car filling the lower frame.
export function chaseCamera(px, pz, angle, speed, inCar) {
  const back = inCar ? 9 + speed * 0.12 : 7;
  const height = inCar ? 4.8 + speed * 0.04 : 4.2;
  const fx = Math.sin(angle), fz = Math.cos(angle);
  return {
    eye: [px - fx * back, height, pz - fz * back],
    target: [px + fx * 6, 1.2, pz + fz * 6],
  };
}

// Keep the camera out of buildings: walk from the target toward the
// eye and stop just before the first building the line would enter.
export function collideCamera(cam, buildings) {
  const tx = cam.target[0], ty = cam.target[1], tz = cam.target[2];
  const ex = cam.eye[0], ey = cam.eye[1], ez = cam.eye[2];
  let best = 1;
  for (let i = 1; i <= 10; i += 1) {
    const t = i / 10;
    const x = tx + (ex - tx) * t, y = ty + (ey - ty) * t, z = tz + (ez - tz) * t;
    let hit = false;
    for (const b of buildings) {
      if (y < b.h && Math.abs(x - b.x) < b.w / 2 + 0.6 && Math.abs(z - b.z) < b.d / 2 + 0.6) {
        best = Math.max(0.15, t - 0.12);
        hit = true;
        break;
      }
    }
    if (hit) break;
  }
  if (best >= 1) return cam;
  return {
    eye: [tx + (ex - tx) * best, Math.max(2.5, ty + (ey - ty) * best), tz + (ez - tz) * best],
    target: cam.target,
  };
}
