// hud.js — the DOM HUD: cash, health, wanted stars, storm countdown, mission
// objective, district name, messages, and a live canvas minimap. Also the
// start screen, pause menu, map overlay and rain overlay canvas.
import { WANTED_MAX } from './config.js';
import { districtAt } from './city.js';

export function createHud(city) {
  const root = document.getElementById('hud');
  root.innerHTML = `
    <div id="hud-top-left"><div id="hud-cash">$0</div><div id="hud-health"><div id="hud-health-fill"></div></div><div id="hud-car"></div></div>
    <div id="hud-top-right"><div id="hud-stars"></div><div id="hud-storm"></div><div id="hud-district"></div></div>
    <div id="hud-objective"></div>
    <div id="hud-msg"></div>
    <div id="hud-help">WASD drive / walk &nbsp;·&nbsp; E enter car &nbsp;·&nbsp; F / click shoot &nbsp;·&nbsp; Space handbrake &nbsp;·&nbsp; Shift sprint &nbsp;·&nbsp; Q mission &nbsp;·&nbsp; M map &nbsp;·&nbsp; P pause</div>
    <canvas id="minimap" width="190" height="190"></canvas>
    <div id="map-overlay"><div id="map-title">VESPER CITY — 7 DAYS TO THE STORM</div><canvas id="bigmap" width="640" height="640"></canvas><div id="map-hint">Press M to close</div></div>
    <div id="title-screen">
      <div id="title-inner">
        <div id="title-kicker">A RAIN-SOAKED OPEN WORLD · 7 DAYS TO THE HURRICANE</div>
        <h1 id="title-name">VESPER CITY<br><span>NEON RAIN</span></h1>
        <p id="title-story">Mara Voss, getaway driver. One week before Hurricane Ilsa drowns the city,
        fixer Dario Kess offers her one last way out — ten jobs, ten nights, no way back.</p>
        <div id="title-controls">WASD / Arrows — drive &amp; walk &nbsp;·&nbsp; E — enter / steal car &nbsp;·&nbsp; F / click — shoot<br>
        Space — handbrake &nbsp;·&nbsp; Shift — sprint / boost &nbsp;·&nbsp; Q — start mission &nbsp;·&nbsp; M — map &nbsp;·&nbsp; P — pause &nbsp;·&nbsp; R — restart mission</div>
        <button id="start-btn">START ENGINE</button>
        <button id="continue-btn">CONTINUE SAVED GAME</button>
        <div id="title-foot">10 story missions · 4 car types · wanted level 0–5 · police chases &amp; helicopter · save in your browser</div>
      </div>
    </div>
    <div id="pause-screen"><h2>PAUSED</h2><p>WASD drive · E enter car · F shoot · Q mission · R restart mission · U mute</p>
    <button id="resume-btn">RESUME</button> <button id="save-btn">SAVE GAME</button> <button id="quit-btn">QUIT TO TITLE</button></div>
    <div id="dead-screen"><h2>BUSTED / DOWN</h2><p id="dead-text">Mara wakes up at St. Mara Hospital. The city keeps raining.</p><button id="respawn-btn">GET BACK UP</button></div>
    <div id="vignette"></div>`;
  const $ = (id) => document.getElementById(id);
  const mm = $('minimap').getContext('2d');
  const bm = $('bigmap').getContext('2d');
  const rain = document.getElementById('rain');
  const rainCtx = rain.getContext('2d');
  const drops = [];
  for (let i = 0; i < 160; i += 1) drops.push({ x: Math.random(), y: Math.random(), s: 0.5 + Math.random() });
  let msgTimer = 0;
  let lastCash = -1, lastStars = -1;

  function fmtCash(v) { return '$' + Math.floor(v).toLocaleString('en-US'); }

  function drawMap(ctx, size, px, pz, state) {
    const s = city.size;
    const toMap = (x, z) => [(x + s / 2) / s * size, (z + s / 2) / s * size];
    ctx.fillStyle = '#0a0e1a'; ctx.fillRect(0, 0, size, size);
    ctx.strokeStyle = 'rgba(120,140,200,0.35)'; ctx.lineWidth = Math.max(1, size / 220);
    for (const c of city.lines) {
      const [ax] = toMap(c, 0); const [, bz] = toMap(0, c);
      ctx.beginPath(); ctx.moveTo(ax, 0); ctx.lineTo(ax, size); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(0, bz); ctx.lineTo(size, bz); ctx.stroke();
    }
    ctx.fillStyle = 'rgba(34,211,238,0.25)';
    ctx.fillRect(0, size * 0.94, size, size * 0.06); // harbor water
    for (const b of city.buildings) {
      const [bx, bz] = toMap(b.x, b.z);
      ctx.fillStyle = '#2a3350';
      ctx.fillRect(bx - 2, bz - 2, 4, 4);
    }
    for (const l of city.landmarks) {
      const [lx, lz] = toMap(l.x, l.z);
      ctx.fillStyle = '#f59e0b'; ctx.beginPath(); ctx.arc(lx, lz, 3, 0, Math.PI * 2); ctx.fill();
    }
    const step = state.missionStep;
    if (step) {
      const [mx, mz] = toMap(step.x, step.z);
      ctx.fillStyle = '#ff2e88';
      ctx.beginPath(); ctx.arc(mx, mz, 5, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = '#ff2e88'; ctx.beginPath(); ctx.arc(mx, mz, 9 + Math.sin(performance.now() / 300) * 2, 0, Math.PI * 2); ctx.stroke();
    }
    for (const cop of state.cops || []) {
      const [cx, cz] = toMap(cop.x, cop.z);
      ctx.fillStyle = '#3b82f6'; ctx.fillRect(cx - 2, cz - 2, 4, 4);
    }
    const [pxm, pzm] = toMap(px, pz);
    ctx.save(); ctx.translate(pxm, pzm); ctx.rotate(state.angle || 0);
    ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.moveTo(0, -6); ctx.lineTo(4, 5); ctx.lineTo(-4, 5); ctx.closePath(); ctx.fill();
    ctx.restore();
  }

  return {
    showTitle(hasSave) {
      $('title-screen').style.display = 'flex';
      $('continue-btn').style.display = hasSave ? 'inline-block' : 'none';
      $('pause-screen').style.display = 'none';
      $('dead-screen').style.display = 'none';
    },
    hideTitle() { $('title-screen').style.display = 'none'; },
    showPause() { $('pause-screen').style.display = 'flex'; },
    hidePause() { $('pause-screen').style.display = 'none'; },
    showDead() { $('dead-screen').style.display = 'flex'; },
    hideDead() { $('dead-screen').style.display = 'none'; },
    toggleMap(show) { $('map-overlay').style.display = show ? 'flex' : 'none'; },
    isMapOpen() { return $('map-overlay').style.display === 'flex'; },
    bindButtons(handlers) {
      $('start-btn').onclick = handlers.start;
      $('continue-btn').onclick = handlers.continue;
      $('resume-btn').onclick = handlers.resume;
      $('save-btn').onclick = handlers.save;
      $('quit-btn').onclick = handlers.quit;
      $('respawn-btn').onclick = handlers.respawn;
    },
    message(text, seconds = 4) {
      $('hud-msg').textContent = text;
      $('hud-msg').style.opacity = '1';
      msgTimer = seconds;
    },
    update(state, dt) {
      if (msgTimer > 0) {
        msgTimer -= dt;
        if (msgTimer <= 0) $('hud-msg').style.opacity = '0';
      }
      if (state.cash !== lastCash) { $('hud-cash').textContent = fmtCash(state.cash); lastCash = state.cash; }
      $('hud-health-fill').style.width = Math.max(0, state.health) + '%';
      $('hud-health-fill').style.background = state.health > 50 ? '#34d399' : state.health > 25 ? '#f59e0b' : '#ef4444';
      $('hud-car').textContent = state.carName ? '🚗 ' + state.carName : 'On foot — press E near a car to steal it';
      if (state.wanted !== lastStars) {
        $('hud-stars').innerHTML = Array.from({ length: WANTED_MAX }, (_, i) =>
          `<span class="star ${i < state.wanted ? 'on' : ''}">★</span>`).join('');
        lastStars = state.wanted;
      }
      const day = Math.min(7, 1 + Math.floor(state.elapsed / 240));
      const left = Math.max(0, 7 - day + 1);
      $('hud-storm').textContent = `⛈ HURRICANE IN ${left} DAY${left === 1 ? '' : 'S'} · DAY ${day}/7`;
      $('hud-district').textContent = districtAt(state.x, state.z).name + ' · Vesper City';
      $('hud-objective').innerHTML = state.objective
        ? `<b>${state.objective.title}</b> — ${state.objective.text}<span class="obj-dist">${Math.round(state.objective.dist)}m</span>`
        : 'Free roam — press Q to start the next story mission';
      drawMap(mm, 190, state.x, state.z, state);
      if (this.isMapOpen()) drawMap(bm, 640, state.x, state.z, state);
      // Rain overlay streaks.
      const w = rain.width = window.innerWidth, h = rain.height = window.innerHeight;
      rainCtx.clearRect(0, 0, w, h);
      rainCtx.strokeStyle = 'rgba(170,200,255,0.28)';
      rainCtx.lineWidth = 1;
      for (const d of drops) {
        d.y += d.s * dt * 2.2; d.x += dt * 0.08;
        if (d.y > 1) { d.y = -0.05; d.x = Math.random(); }
        const x = d.x * w, y = d.y * h;
        rainCtx.beginPath(); rainCtx.moveTo(x, y); rainCtx.lineTo(x - 4, y + 14 * d.s); rainCtx.stroke();
      }
    },
  };
}
