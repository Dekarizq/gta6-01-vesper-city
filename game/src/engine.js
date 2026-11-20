// engine.js — a small raw-WebGL 3D renderer, written for this game.
// One shader (vertex colour + fake sun/moon shading + distance fog), boxes only:
// the whole city is one static vertex buffer; cars, people, the helicopter and
// markers are drawn from a small dynamic buffer rebuilt each frame.
import { clamp } from './random.js';

const VERT = `
attribute vec3 aPos; attribute vec3 aNormal; attribute vec3 aColor;
uniform mat4 uProj; uniform mat4 uView;
varying vec3 vColor; varying float vFog; varying float vShade;
void main(){
  vec4 wp = uView * vec4(aPos, 1.0);
  gl_Position = uProj * wp;
  vColor = aColor;
  vFog = clamp(-wp.z / 260.0, 0.0, 1.0);
  float n = max(dot(normalize(aNormal), normalize(vec3(0.4, 0.8, 0.3))), 0.0);
  vShade = 0.68 + 0.32 * n;
}`;
const FRAG = `
precision mediump float;
varying vec3 vColor; varying float vFog; varying float vShade;
void main(){
  vec3 fogColor = vec3(0.05, 0.06, 0.12);
  vec3 c = vColor * vShade;
  gl_FragColor = vec4(mix(c, fogColor, vFog), 1.0);
}`;

function mat4Perspective(fov, aspect, near, far) {
  const f = 1 / Math.tan(fov / 2);
  return new Float32Array([
    f / aspect, 0, 0, 0,
    0, f, 0, 0,
    0, 0, (far + near) / (near - far), -1,
    0, 0, (2 * far * near) / (near - far), 0,
  ]);
}
function mat4LookAt(eye, target, up) {
  const zx = eye[0] - target[0], zy = eye[1] - target[1], zz = eye[2] - target[2];
  const zl = Math.hypot(zx, zy, zz) || 1;
  const z = [zx / zl, zy / zl, zz / zl];
  const xx = up[1] * z[2] - up[2] * z[1], xy = up[2] * z[0] - up[0] * z[2], xz = up[0] * z[1] - up[1] * z[0];
  const xl = Math.hypot(xx, xy, xz) || 1;
  const x = [xx / xl, xy / xl, xz / xl];
  const y = [z[1] * x[2] - z[2] * x[1], z[2] * x[0] - z[0] * x[2], z[0] * x[1] - z[1] * x[0]];
  const ex = -(x[0] * eye[0] + x[1] * eye[1] + x[2] * eye[2]);
  const ey = -(y[0] * eye[0] + y[1] * eye[1] + y[2] * eye[2]);
  const ez = -(z[0] * eye[0] + z[1] * eye[1] + z[2] * eye[2]);
  return new Float32Array([
    x[0], y[0], z[0], 0,
    x[1], y[1], z[1], 0,
    x[2], y[2], z[2], 0,
    ex, ey, ez, 1,
  ]);
}

// Push one axis-aligned (or yaw-rotated) box into arrays. pos/normal/color per vertex.
function pushBox(arrays, cx, cy, cz, w, h, d, color, yaw) {
  const hw = w / 2, hh = h / 2, hd = d / 2;
  const cos = Math.cos(yaw || 0), sin = Math.sin(yaw || 0);
  const corners = [
    [-hw, -hh, -hd], [hw, -hh, -hd], [hw, hh, -hd], [-hw, hh, -hd],
    [-hw, -hh, hd], [hw, -hh, hd], [hw, hh, hd], [-hw, hh, hd],
  ].map(([x, y, z]) => [
    cx + x * cos + z * sin,
    cy + y,
    cz - x * sin + z * cos,
  ]);
  const faces = [
    [0, 1, 2, 3, [0, 0, -1]], [4, 7, 6, 5, [0, 0, 1]],
    [0, 4, 5, 1, [0, -1, 0]], [3, 2, 6, 7, [0, 1, 0]],
    [0, 3, 7, 4, [-1, 0, 0]], [1, 5, 6, 2, [1, 0, 0]],
  ];
  const bright = [clamp(color[0] * 1.6, 0, 1), clamp(color[1] * 1.6, 0, 1), clamp(color[2] * 1.6, 0, 1)];
  for (const [a, b, c, dd, n] of faces) {
    const top = n[1] > 0;
    const col = top ? bright : color;
    const tris = [[a, b, c], [a, c, dd]];
    for (const tri of tris) {
      for (const idx of tri) {
        arrays.pos.push(...corners[idx]);
        arrays.nor.push(...n);
        arrays.col.push(...col);
      }
    }
  }
}

function buildBuffer(gl, arrays) {
  const buf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  const interleaved = new Float32Array(arrays.pos.length * 3);
  for (let i = 0; i < arrays.pos.length / 3; i += 1) {
    interleaved.set(arrays.pos.slice(i * 3, i * 3 + 3), i * 9);
    interleaved.set(arrays.nor.slice(i * 3, i * 3 + 3), i * 9 + 3);
    interleaved.set(arrays.col.slice(i * 3, i * 3 + 3), i * 9 + 6);
  }
  gl.bufferData(gl.ARRAY_BUFFER, interleaved, gl.STATIC_DRAW);
  return { buf, count: arrays.pos.length / 3 };
}

export function createEngine(canvas, city) {
  const gl = canvas.getContext('webgl', { antialias: true, preserveDrawingBuffer: true });
  if (!gl) throw new Error('WebGL unavailable');
  const prog = gl.createProgram();
  const vs = gl.createShader(gl.VERTEX_SHADER); gl.shaderSource(vs, VERT); gl.compileShader(vs);
  const fs = gl.createShader(gl.FRAGMENT_SHADER); gl.shaderSource(fs, FRAG); gl.compileShader(fs);
  gl.attachShader(prog, vs); gl.attachShader(prog, fs); gl.linkProgram(prog);
  gl.useProgram(prog);
  const loc = {
    proj: gl.getUniformLocation(prog, 'uProj'),
    view: gl.getUniformLocation(prog, 'uView'),
    pos: gl.getAttribLocation(prog, 'aPos'),
    nor: gl.getAttribLocation(prog, 'aNormal'),
    col: gl.getAttribLocation(prog, 'aColor'),
  };
  gl.enable(gl.DEPTH_TEST);
  gl.clearColor(0.04, 0.05, 0.11, 1);

  // Static city geometry: ground, road strips, buildings, neon signs, bridge, water.
  const s = { pos: [], nor: [], col: [] };
  const size = city.size;
  pushBox(s, 0, -0.15, 0, size + 260, 0.3, size + 260, [0.05, 0.06, 0.10], 0); // ground
  // Harbor water (south edge, beyond the roads).
  pushBox(s, 0, -0.05, size / 2 + 60, size + 260, 0.2, 120, [0.02, 0.12, 0.22], 0);
  for (const c of city.lines) {
    pushBox(s, c, 0.02, 0, 10, 0.08, size, [0.09, 0.09, 0.12], 0);
    pushBox(s, 0, 0.02, c, size, 0.08, 10, [0.09, 0.09, 0.12], 0);
    // Dashed centre lines.
    for (let t = -size / 2 + 8; t < size / 2; t += 12) {
      pushBox(s, c, 0.08, t, 0.35, 0.04, 3, [0.75, 0.65, 0.25], 0);
      pushBox(s, t, 0.08, c, 3, 0.04, 0.35, [0.75, 0.65, 0.25], 0);
    }
  }
  for (const b of city.buildings) {
    pushBox(s, b.x, b.h / 2, b.z, b.w, b.h, b.d, b.color, 0);
    // Lit windows: a lighter rooftop slab reads as windows at night.
    pushBox(s, b.x, b.h + 0.15, b.z, b.w * 0.7, 0.3, b.d * 0.7, [0.35, 0.3, 0.2], 0);
    // Warm lit-window strips on the south face so towers read at night.
    const stripW = Math.max(1.2, b.w * 0.45);
    for (let f = 1; f <= 3; f += 1) {
      const wy = (b.h * f) / 4;
      if (wy < 3) continue;
      pushBox(s, b.x, wy, b.z + b.d / 2 + 0.12, stripW, 0.9, 0.2, [0.95, 0.72, 0.35], 0);
    }
  }
  for (const sg of city.signs) {
    const hex = parseInt(sg.color.slice(1), 16);
    const col = [((hex >> 16) & 255) / 255, ((hex >> 8) & 255) / 255, (hex & 255) / 255];
    pushBox(s, sg.x, sg.y, sg.z, sg.w, sg.h, sg.d, col, 0);
  }
  // Harbor bridge deck crossing the water.
  pushBox(s, 0, 2.2, size / 2 + 55, 14, 0.8, 120, [0.16, 0.16, 0.2], 0);
  pushBox(s, -8, 6, size / 2 + 55, 0.8, 8, 100, [0.5, 0.15, 0.3], 0);
  pushBox(s, 8, 6, size / 2 + 55, 0.8, 8, 100, [0.5, 0.15, 0.3], 0);
  const staticBuf = buildBuffer(gl, s);

  const dynBuf = gl.createBuffer();
  let dynCount = 0;

  function bind(buf, count) {
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.vertexAttribPointer(loc.pos, 3, gl.FLOAT, false, 36, 0);
    gl.vertexAttribPointer(loc.nor, 3, gl.FLOAT, false, 36, 12);
    gl.vertexAttribPointer(loc.col, 3, gl.FLOAT, false, 36, 24);
    gl.enableVertexAttribArray(loc.pos);
    gl.enableVertexAttribArray(loc.nor);
    gl.enableVertexAttribArray(loc.col);
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
    /** Draw one frame. cam = {eye:[x,y,z], target:[x,y,z]}; boxes = dynamic boxes. */
    draw(cam, boxes, time) {
      gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
      const aspect = canvas.width / Math.max(1, canvas.height);
      gl.uniformMatrix4fv(loc.proj, false, mat4Perspective(1.05, aspect, 0.5, 600));
      gl.uniformMatrix4fv(loc.view, false, mat4LookAt(cam.eye, cam.target, [0, 1, 0]));
      bind(staticBuf.buf, staticBuf.count);
      // Dynamic boxes into one interleaved buffer.
      const d = { pos: [], nor: [], col: [] };
      for (const b of boxes) pushBox(d, b.x, b.y, b.z, b.w, b.h, b.d, b.color, b.yaw || 0);
      const n = d.pos.length / 3;
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

// Chase camera: behind and above the player, looking ahead.
export function chaseCamera(px, pz, angle, speed, inCar) {
  const back = inCar ? 13 + speed * 0.16 : 9;
  const height = inCar ? 6.5 + speed * 0.05 : 5.5;
  const fx = Math.sin(angle), fz = Math.cos(angle);
  return {
    eye: [px - fx * back, height, pz - fz * back],
    target: [px + fx * 6, 1.2, pz + fz * 6],
  };
}

// Keep the camera out of buildings: walk from the target toward the eye and
// stop just before the first building the line would enter.
export function collideCamera(cam, buildings) {
  const tx = cam.target[0], ty = cam.target[1], tz = cam.target[2];
  const ex = cam.eye[0], ey = cam.eye[1], ez = cam.eye[2];
  let best = 1;
  for (let i = 1; i <= 10; i += 1) {
    const t = i / 10;
    const x = tx + (ex - tx) * t, y = ty + (ey - ty) * t, z = tz + (ez - tz) * t;
    for (const b of buildings) {
      if (y < b.h && Math.abs(x - b.x) < b.w / 2 + 0.6 && Math.abs(z - b.z) < b.d / 2 + 0.6) {
        best = Math.max(0.15, t - 0.12);
        i = 11;
        break;
      }
    }
    if (best < 1) break;
  }
  if (best >= 1) return cam;
  return {
    eye: [tx + (ex - tx) * best, Math.max(2.5, ty + (ey - ty) * best), tz + (ez - tz) * best],
    target: cam.target,
  };
}
