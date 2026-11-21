// hud.js — the DOM HUD for Sunset Kings (v6), dense like the rank 1-2
// entries: big cash, health + armour bars, wanted stars, four weapon
// slots with ammo, storm countdown, district + radio, a mission card
// with progress, a live VCPD pursuit panel with named officers and
// tactics, a dialog box with a portrait, a big speedometer with car
// name/condition, a circular minimap — and new in v3: a respect bar
// with Mara's rank, the crew who have joined, and the Sunset Garage
// shop panel with upgrade levels and prices. v4 adds the weapon wheel
// overlay (hold Q), a side-job card with its timer, a GPS chip with the
// next turn, a coast chip, a spike-strip warning, and the save-slot line.
// v6 adds a weather chip (phase, rain, lightning strikes) and a
// business panel (portfolio, daily income, what the nearest property
// costs) — the city Mara owns is on screen, not just in the save.
// The gameplay panels hide on the title screen. Also the start screen,
// pause menu, map overlay and drizzle overlay canvas.
import { WANTED_MAX } from './config.js';
import { districtAt } from './city.js';
import { respectRank, nextRank } from './respect.js';
import { GARAGE_UPGRADES } from './garage.js';

export function createHud(city) {
  const root = document.getElementById('hud');
  root.innerHTML = `
    <div id="hud-top-left" class="hud-panel"><div id="hud-cash">$0</div>
      <div id="hud-health"><div id="hud-health-fill"></div></div>
      <div id="hud-armour"><div id="hud-armour-fill"></div></div>
      <div id="hud-car"></div><div id="hud-coins"></div>
      <div id="hud-respect"></div><div id="hud-crew"></div></div>
    <div id="hud-top-right" class="hud-panel"><div id="hud-wanted-label">WANTED</div><div id="hud-stars"></div>
      <div id="hud-weapons"></div>
      <div id="hud-storm"></div><div id="hud-district"></div><div id="hud-radio"></div></div>
    <div id="hud-mission" class="hud-panel"></div>
    <div id="hud-vcpd" class="hud-panel"></div>
    <div id="hud-garage" class="hud-panel"></div>
    <div id="hud-jobs" class="hud-panel"></div>
    <div id="hud-gps" class="hud-panel"></div>
    <div id="hud-coast" class="hud-panel"></div>
    <div id="hud-weather" class="hud-panel"></div>
    <div id="hud-business" class="hud-panel"></div>
    <div id="hud-slots" class="hud-panel"></div>
    <div id="weapon-wheel" class="hud-panel"></div>
    <div id="hud-dialog" class="hud-panel"><div id="hud-portrait">D</div><div id="hud-dialog-text"></div></div>
    <div id="hud-objective" class="hud-panel"></div>
    <div id="hud-speedo" class="hud-panel"><div id="hud-speed">0</div><div id="hud-speed-unit">KM/H</div><div id="hud-speed-car"></div></div>
    <div id="hud-msg" class="hud-panel"></div>
    <div id="hud-help" class="hud-panel">WASD drive / walk &nbsp;·&nbsp; E steal car &nbsp;·&nbsp; F / click shoot &nbsp;·&nbsp; 1/2/3/4 weapons &nbsp;·&nbsp; HOLD Q wheel / TAP Q mission &nbsp;·&nbsp; G garage &nbsp;·&nbsp; R radio &nbsp;·&nbsp; J side job &nbsp;·&nbsp; L GPS &nbsp;·&nbsp; K save slot &nbsp;·&nbsp; B buy business &nbsp;·&nbsp; Space handbrake &nbsp;·&nbsp; Shift sprint &nbsp;·&nbsp; T restart &nbsp;·&nbsp; M map &nbsp;·&nbsp; P pause</div>
    <canvas id="minimap" class="hud-panel" width="190" height="190"></canvas>
    <div id="map-overlay"><div id="map-title">VESPER CITY — SUNSET KINGS · 7 DAYS TO THE STORM</div><canvas id="bigmap" width="640" height="640"></canvas><div id="map-hint">Press M to close</div></div>
    <div id="title-screen">
      <div id="title-inner">
        <div id="title-kicker">A SUN-SOAKED OPEN WORLD · GOLDEN HOUR BEFORE THE HURRICANE · SUNSET KINGS</div>
        <h1 id="title-name">VESPER CITY<br><span>GOLDEN HOUR</span><br><span class="title-kings">— SUNSET KINGS —</span></h1>
        <p id="title-story">Mara Voss, getaway driver. One week before Hurricane Ilsa drowns the city, the morning rain
        has cleared and the whole coast is gold. Fixer Dario Kess offers her one last way out — fifteen jobs, fifteen sunsets, no way back.
        Build respect, gather your crew, tune your car at the Sunset Garage, buy the businesses that pay you back, hold the beach against the Tide Kings through the storm itself, and become the King of Vesper.</p>
        <div id="title-controls">WASD / Arrows — drive &amp; walk &nbsp;·&nbsp; E — steal car &nbsp;·&nbsp; F / click — shoot<br>
        1 / 2 / 3 / 4 — switch weapon &nbsp;·&nbsp; HOLD Q — weapon wheel &nbsp;·&nbsp; TAP Q — start mission &nbsp;·&nbsp; G — Sunset Garage &nbsp;·&nbsp; R — radio station<br>
        J — side job (taxi / delivery / race) &nbsp;·&nbsp; L — GPS route &nbsp;·&nbsp; K — save slot &nbsp;·&nbsp; B — buy business &nbsp;·&nbsp; Space — handbrake &nbsp;·&nbsp; Shift — sprint &nbsp;·&nbsp; T — restart mission &nbsp;·&nbsp; M — map &nbsp;·&nbsp; P — pause</div>
        <button id="start-btn">START ENGINE</button>
        <button id="continue-btn">CONTINUE SAVED GAME</button>
        <div id="title-foot">15 story missions · 11 car types · Sunset Garage upgrades incl. NITRO &amp; CHROME · 6 radio stations · respect ranks &amp; crew · wanted 0–6 · spike strips · named VCPD units, roadblocks &amp; CONDOR-1 helicopter · cars that burn &amp; explode · Sunset Beach coast with pier, boats &amp; side jobs · Marina District &amp; Old Town · day cycle, rain &amp; lightning · 6 buyable businesses · GPS route · 3 save slots</div>
      </div>
    </div>
    <div id="pause-screen"><h2>PAUSED</h2><p>WASD drive · E steal car · F shoot · 1/2/3 weapons · G garage · R radio · Q mission · T restart mission · U mute</p>
    <button id="resume-btn">RESUME</button> <button id="save-btn">SAVE GAME</button> <button id="quit-btn">QUIT TO TITLE</button></div>
    <div id="dead-screen"><h2>BUSTED / DOWN</h2><p id="dead-text">Mara wakes up at St. Mara Hospital. The rain has cleared — the coast is gold.</p><button id="respawn-btn">GET BACK UP</button></div>
    <div id="vignette"></div>`;
  const $ = (id) => document.getElementById(id);
  const mm = $('minimap').getContext('2d');
  const bm = $('bigmap').getContext('2d');
  const rain = document.getElementById('rain');
  const rainCtx = rain.getContext('2d');
  const drops = [];
  for (let i = 0; i < 80; i += 1) drops.push({ x: Math.random(), y: Math.random(), s: 0.4 + Math.random() * 0.6 });
  let msgTimer = 0;
  let lastCash = -1, lastStars = -1, lastWeapons = '', lastCoins = '', lastRespect = '';

  function fmtCash(v) { return '$' + Math.floor(v).toLocaleString('en-US'); }

  function drawMap(ctx, size, px, pz, state) {
    const s = city.size;
    const toMap = (x, z) => [(x + s / 2) / s * size, (z + s / 2) / s * size];
    ctx.fillStyle = '#2a1a0e'; ctx.fillRect(0, 0, size, size);
    ctx.strokeStyle = 'rgba(255,200,120,0.4)'; ctx.lineWidth = Math.max(1, size / 220);
    for (const c of city.lines) {
      const [ax] = toMap(c, 0); const [, bz] = toMap(0, c);
      ctx.beginPath(); ctx.moveTo(ax, 0); ctx.lineTo(ax, size); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(0, bz); ctx.lineTo(size, bz); ctx.stroke();
    }
    ctx.fillStyle = 'rgba(240,120,50,0.5)';
    ctx.fillRect(0, size * 0.94, size, size * 0.06);
    for (const b of city.buildings) {
      const [bx, bz] = toMap(b.x, b.z);
      ctx.fillStyle = '#6b4a2a';
      ctx.fillRect(bx - 2, bz - 2, 4, 4);
    }
    for (const l of city.landmarks) {
      const [lx, lz] = toMap(l.x, l.z);
      ctx.fillStyle = l.id === 'garage' ? '#ffd166' : l.id === 'pier' || l.id === 'boatdock' ? '#7dd3fc' : '#ffd166';
      ctx.beginPath(); ctx.arc(lx, lz, l.id === 'garage' ? 5 : 3, 0, Math.PI * 2); ctx.fill();
    }
    // v4: the GPS route as a gold polyline, the coast band as a blue
    // strip along the south edge, and live spike strips as red dots.
    if (state.gps && state.gps.route && state.gps.route.length > 1) {
      ctx.strokeStyle = '#ffd166'; ctx.lineWidth = Math.max(2, size / 160);
      ctx.beginPath();
      state.gps.route.forEach((p, i) => {
        const [rx, rz] = toMap(p.x, p.z);
        if (i === 0) ctx.moveTo(rx, rz); else ctx.lineTo(rx, rz);
      });
      ctx.stroke();
    }
    ctx.fillStyle = 'rgba(125,211,252,0.35)';
    ctx.fillRect(0, size * 0.965, size, size * 0.035);
    if (state.spikeAhead) {
      ctx.fillStyle = '#ef4444';
      ctx.font = `bold ${Math.max(9, size / 22)}px sans-serif`;
      ctx.fillText('▲ SPIKE ' + state.spikeAhead + 'm', size * 0.04, size * 0.08);
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
      root.classList.add('hud-off');
      $('title-screen').style.display = 'flex';
      $('continue-btn').style.display = hasSave ? 'inline-block' : 'none';
      $('pause-screen').style.display = 'none';
      $('dead-screen').style.display = 'none';
    },
    hideTitle() {
      root.classList.remove('hud-off');
      $('title-screen').style.display = 'none';
    },
    showPause() { $('pause-screen').style.display = 'flex'; },
    hidePause() { $('pause-screen').style.display = 'none'; },
    showDead() { $('dead-screen').style.display = 'flex'; },
    hideDead() { $('dead-screen').style.display = 'none'; },
    toggleMap(show) { $('map-overlay').style.display = show ? 'flex' : 'none'; },
    // v5: H hides the whole HUD (clean screenshot), H again brings it back.
    toggleHud() { root.classList.toggle('hud-off'); return root.classList.contains('hud-off'); },
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
      $('hud-armour-fill').style.width = Math.max(0, state.armour) + '%';
      $('hud-car').textContent = state.carName ? '🚗 ' + state.carName : 'On foot — press E near a car to steal it';
      const cKey = state.coins ? `${state.coins.collected}/${state.coins.total}` : '';
      if (cKey !== lastCoins) {
        $('hud-coins').textContent = state.coins ? `☀ SUN COINS ${cKey}` : '';
        lastCoins = cKey;
      }
      // Respect bar + rank, and the crew who have joined.
      const rp = state.respectPoints || 0;
      const rank = respectRank(rp);
      const nxt = nextRank(rp);
      const rKey = `${rp}:${rank.name}:${(state.crew || []).join(',')}`;
      if (rKey !== lastRespect) {
        const pct = nxt ? Math.round(((rp - rank.min) / (nxt.min - rank.min)) * 100) : 100;
        $('hud-respect').innerHTML = `👑 ${rank.name} · ${rp} RESPECT` + (nxt ? ` · next ${nxt.name} ${pct}%` : ' · MAX RANK');
        $('hud-crew').textContent = (state.crew && state.crew.length > 0)
          ? 'CREW: ' + state.crew.join(' · ')
          : 'CREW: Mara alone — earn respect to recruit Lena, Rook, Dario';
        lastRespect = rKey;
      }
      if (state.wanted !== lastStars) {
        $('hud-stars').innerHTML = Array.from({ length: WANTED_MAX }, (_, i) =>
          `<span class="star ${i < state.wanted ? 'on' : ''}">★</span>`).join('');
        lastStars = state.wanted;
      }
      const wKey = (state.weapons || []).map((w) => `${w.name}:${w.ammo}:${w.active}`).join('|');
      if (wKey !== lastWeapons) {
        $('hud-weapons').innerHTML = (state.weapons || []).map((w, i) =>
          `<span class="weapon ${w.active ? 'active' : ''}">${i + 1} ${w.name} ${w.ammo === Infinity ? '∞' : w.ammo}</span>`).join('');
        lastWeapons = wKey;
      }
      const day = Math.min(7, 1 + Math.floor(state.elapsed / 240));
      const left = Math.max(0, 7 - day + 1);
      $('hud-storm').textContent = `⛈ HURRICANE IN ${left} DAY${left === 1 ? '' : 'S'} · DAY ${day}/7 · 18:48`;
      $('hud-district').textContent = (state.district || districtAt(state.x, state.z).name) + ' · Vesper City';
      $('hud-radio').textContent = '♪ ' + (state.radio || '');
      const m = state.objective;
      if (m) {
        const total = state.missionTotal || 10;
        $('hud-mission').innerHTML = `<div class="mission-kicker">MISSION ${state.missionIndex + 1}/${total} · SUNSET KINGS</div>
          <div class="mission-title">${m.title}</div>
          <div class="mission-bar"><div class="mission-fill" style="width:${Math.round(100 / total)}%"></div></div>
          <div class="mission-stage">STAGE — ${m.text}</div>
          <div class="mission-next">NEXT ${Math.round(m.dist)}m</div>`;
        $('hud-mission').style.display = 'block';
      } else {
        $('hud-mission').innerHTML = '<div class="mission-kicker">FREE ROAM · SUNSET KINGS</div><div class="mission-stage">Press Q to start the next story mission</div>';
      }
      // VCPD pursuit panel: named officer, tactic, status, distance.
      const cops = state.cops || [];
      if (cops.length > 0) {
        $('hud-vcpd').innerHTML = `<div class="vcpd-head">● VCPD RESPONSE &nbsp; ${cops.length} UNIT${cops.length === 1 ? '' : 'S'}${state.heliUp ? ' · CONDOR-1 AIR SUPPORT' : ''}</div>`
          + cops.map((c) => `<div class="vcpd-row"><span>${c.callsign} ${c.officer || ''}</span><span class="vcpd-status">${c.tactic || c.status}</span><span>${c.dist}m</span></div>`).join('')
          + (state.roadblock ? '<div class="vcpd-warn">▲ ROADBLOCK AHEAD — find another way round</div>' : '')
          + (state.spikeAhead ? `<div class="vcpd-warn">▲ SPIKE STRIP ${state.spikeAhead}m AHEAD — slow down or swerve!</div>` : '');
        $('hud-vcpd').style.display = 'block';
      } else {
        $('hud-vcpd').innerHTML = '<div class="vcpd-head">● VCPD RESPONSE &nbsp; 0 UNITS</div><div class="vcpd-row">No units on you — the coast is clear.</div>';
      }
      // Sunset Garage shop panel: upgrade levels and next prices.
      const g = state.garage;
      if (g) {
        $('hud-garage').innerHTML = '<div class="vcpd-head">🔧 SUNSET GARAGE — press G in the yard</div>'
          + GARAGE_UPGRADES.map((def) => {
            const lvl = (g.upgrades && g.upgrades[def.id]) || 0;
            const next = (g.nextCosts || []).find((n) => n.id === def.id);
            return `<div class="vcpd-row"><span>${def.name} Lv${lvl}/3</span><span>${next && next.cost !== null ? '$' + next.cost : 'MAX'}</span></div>`;
          }).join('')
          + (state.wrecks ? `<div class="vcpd-row"><span>Wrecks left burning</span><span>${state.wrecks}</span></div>` : '');
        $('hud-garage').style.display = 'block';
      }
      // v4: weapon wheel overlay — four slots in a ring, the hovered
      // slot gold, the active slot outlined. Hidden when closed.
      if (state.wheel && state.wheel.open) {
        const slots = state.wheel.slots || [];
        $('weapon-wheel').innerHTML = '<div class="wheel-title">WEAPON WHEEL — release Q to pick</div>'
          + slots.map((s, i) => {
            const pos = [[50, 8], [86, 50], [50, 86], [14, 50]][i % 4];
            return `<div class="wheel-slot ${s.hovered ? 'hovered' : ''} ${s.active ? 'active' : ''}" style="left:${pos[0]}%;top:${pos[1]}%">${s.name}<br><span>${s.ammo === Infinity ? '∞' : s.ammo}</span></div>`;
          }).join('');
        $('weapon-wheel').style.display = 'block';
      } else {
        $('weapon-wheel').style.display = 'none';
      }
      // v4: side-job card with its timer and payout, or the job totals
      // when free — the city always has work, even after the story ends.
      if (state.job) {
        $('hud-jobs').innerHTML = `<div class="vcpd-head">💼 SIDE JOB — ${state.job.name}</div>`
          + `<div class="vcpd-row"><span>${state.job.text}</span><span>${state.job.timeLeft}s</span></div>`
          + `<div class="vcpd-row"><span>Pay on completion</span><span>$${state.job.pay}</span></div>`
          + (state.job.checkpoint ? `<div class="vcpd-row"><span>Checkpoints</span><span>${state.job.checkpoint}</span></div>` : '');
        $('hud-jobs').style.display = 'block';
      } else if (state.jobsSummary && state.jobsSummary.total > 0) {
        $('hud-jobs').innerHTML = `<div class="vcpd-head">💼 SIDE JOBS — press J for the next</div>`
          + `<div class="vcpd-row"><span>Jobs done</span><span>${state.jobsSummary.total} · $${state.jobsSummary.earned} earned</span></div>`
          + `<div class="vcpd-row"><span>Best race</span><span>${state.jobsSummary.bestRace ? Math.round(state.jobsSummary.bestRace) + 's' : '—'}</span></div>`;
        $('hud-jobs').style.display = 'block';
      } else {
        $('hud-jobs').innerHTML = '<div class="vcpd-head">💼 SIDE JOBS — press J for work</div><div class="vcpd-row">Taxi · Delivery · Street Race — repeatable, paid in cash + respect</div>';
        $('hud-jobs').style.display = 'block';
      }
      // v4: GPS chip — the next turn and the distance to the target.
      if (state.gps) {
        $('hud-gps').textContent = '🧭 ' + (state.gps.label || '');
        $('hud-gps').style.display = 'block';
      }
      // v4: coast chip — which part of the beach Mara is standing on.
      if (state.coast) {
        $('hud-coast').textContent = '🏖 ' + state.coast + ' · Sunset Beach';
        $('hud-coast').style.display = 'block';
      } else {
        $('hud-coast').style.display = 'none';
      }
      // v6: weather chip — the phase, the rain, how many times the
      // lightning has struck, and tomorrow's forecast, so the storm
      // is always in view and never a surprise.
      if (state.weather) {
        const w = state.weather;
        $('hud-weather').textContent = `🌩 ${w.label || ''}${w.strikes > 0 ? ` · ⚡ ${w.strikes} strike${w.strikes === 1 ? '' : 's'}` : ''}${w.forecast ? ` · ${w.forecast}` : ''}`;
        $('hud-weather').style.display = 'block';
      }
      // v6: business panel — the portfolio, the daily take, and what
      // Mara owns, so the city she is buying stays on screen.
      if (state.business) {
        const b = state.business;
        $('hud-business').innerHTML = '<div class="vcpd-head">🏪 BUSINESSES — press B near a FOR SALE board</div>'
          + `<div class="vcpd-row"><span>Owned</span><span>${b.owned}/${b.total} · $${b.incomePerDay}/day</span></div>`
          + `<div class="vcpd-row"><span>Passive income earned</span><span>$${b.earned.toLocaleString()}</span></div>`
          + (b.list || []).map((x) => `<div class="vcpd-row"><span>${x.name}</span><span>Lv${x.level} · $${x.income}/day</span></div>`).join('')
          + (b.hint ? `<div class="vcpd-row"><span>${b.hint}</span></div>` : '');
        $('hud-business').style.display = 'block';
      }
      // v4: save-slot line — which slot is active, and what it holds.
      if (state.slots) {
        const filled = state.slots.filter((s) => s.has).length;
        $('hud-slots').textContent = `💾 ${state.slotLabel || 'SLOT 1'} · ${filled}/3 slots filled · K cycles slots`;
        $('hud-slots').style.display = 'block';
      }
      if (state.missionGiver && m) {
        $('hud-dialog-text').innerHTML = `<b>${state.missionGiver}</b> — ${m.text}`;
        $('hud-portrait').textContent = state.missionGiver[0];
        $('hud-dialog').style.display = 'flex';
      } else {
        $('hud-dialog').style.display = 'none';
      }
      $('hud-objective').innerHTML = m
        ? `<b>${m.title}</b> — ${m.text}<span class="obj-dist">${Math.round(m.dist)}m</span>`
        : 'Free roam — press Q to start the next story mission';
      $('hud-speed').textContent = state.speedKmh || 0;
      // v4: a flat tyre and a firing nitro both show on the speedo, so
      // the player always knows why the car feels wrong — or very right.
      $('hud-speed-car').textContent = state.carName
        ? `${state.carName} · CONDITION ${state.carCondition ?? 100}%${state.flatTyre ? ' · ⚠ FLAT TYRE — garage repairs free' : ''}${state.nitro > 0.3 ? ' · 🔥 NITRO!' : ''}`
        : 'ON FOOT';
      drawMap(mm, 190, state.x, state.z, state);
      if (this.isMapOpen()) drawMap(bm, 640, state.x, state.z, state);
      const w = rain.width = window.innerWidth, h = rain.height = window.innerHeight;
      rainCtx.clearRect(0, 0, w, h);
      rainCtx.strokeStyle = 'rgba(255,220,170,0.16)';
      rainCtx.lineWidth = 1;
      for (const d of drops) {
        d.y += d.s * dt * 1.1; d.x += dt * 0.04;
        if (d.y > 1) { d.y = -0.05; d.x = Math.random(); }
        const x = d.x * w, y = d.y * h;
        rainCtx.beginPath(); rainCtx.moveTo(x, y); rainCtx.lineTo(x - 2, y + 8 * d.s); rainCtx.stroke();
      }
    },
  };
}
