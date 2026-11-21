// audio.js — procedural WebAudio for Sunset Kings (v3): light drizzle
// noise, engine hum, sirens, gunshots, mission chimes, and now the radio:
// three stations of synth plucks whose notes the radio module schedules,
// plus a deep explosion boom when a car goes up. No audio files;
// everything is synthesized. Mute with U. The radio keeps playing under
// the engine and the sirens, quieter than both, like a real car stereo.
export function createAudio() {
  let ctx = null, master = null, rainGain = null, engineOsc = null, engineGain = null;
  let sirenOsc = null, sirenGain = null, muted = false, started = false;
  let sirenPhase = 0, radioGain = null, radioStation = 'vesper';

  function ensure() {
    if (ctx) return true;
    try {
      ctx = new (window.AudioContext || window.webkitAudioContext)();
      master = ctx.createGain(); master.gain.value = muted ? 0 : 0.5; master.connect(ctx.destination);
      const len = ctx.sampleRate * 2;
      const buf = ctx.createBuffer(1, len, ctx.sampleRate);
      const data = buf.getChannelData(0);
      for (let i = 0; i < len; i += 1) data[i] = Math.random() * 2 - 1;
      const src = ctx.createBufferSource(); src.buffer = buf; src.loop = true;
      const filt = ctx.createBiquadFilter(); filt.type = 'lowpass'; filt.frequency.value = 2400;
      rainGain = ctx.createGain(); rainGain.gain.value = 0.04;
      src.connect(filt); filt.connect(rainGain); rainGain.connect(master); src.start();
      engineOsc = ctx.createOscillator(); engineOsc.type = 'sawtooth'; engineOsc.frequency.value = 55;
      const ef = ctx.createBiquadFilter(); ef.type = 'lowpass'; ef.frequency.value = 320;
      engineGain = ctx.createGain(); engineGain.gain.value = 0;
      engineOsc.connect(ef); ef.connect(engineGain); engineGain.connect(master); engineOsc.start();
      sirenOsc = ctx.createOscillator(); sirenOsc.type = 'sine'; sirenOsc.frequency.value = 700;
      sirenGain = ctx.createGain(); sirenGain.gain.value = 0;
      sirenOsc.connect(sirenGain); sirenGain.connect(master); sirenOsc.start();
      radioGain = ctx.createGain(); radioGain.gain.value = 0.12; radioGain.connect(master);
      started = true;
      return true;
    } catch { return false; }
  }

  // One radio note: a triangle pluck with a soft decay, plus its octave
  // shimmer on the Storm Radio station — and a soft fifth on Coast 104.7,
  // the beach-nights station, so it shimmers a different way.
  function radioNote(freq, dur) {
    if (!ctx) return;
    const t = ctx.currentTime;
    const o = ctx.createOscillator(); o.type = 'triangle'; o.frequency.value = freq;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.14, t + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, t + Math.max(0.15, dur));
    o.connect(g); g.connect(radioGain); o.start(t); o.stop(t + Math.max(0.2, dur) + 0.05);
    if (radioStation === 'storm') {
      const o2 = ctx.createOscillator(); o2.type = 'sine'; o2.frequency.value = freq * 2;
      const g2 = ctx.createGain();
      g2.gain.setValueAtTime(0.0001, t);
      g2.gain.exponentialRampToValueAtTime(0.05, t + 0.03);
      g2.gain.exponentialRampToValueAtTime(0.0001, t + Math.max(0.2, dur));
      o2.connect(g2); g2.connect(radioGain); o2.start(t); o2.stop(t + Math.max(0.25, dur) + 0.05);
    }
    if (radioStation === 'marina') {
      const o4 = ctx.createOscillator(); o4.type = 'sine'; o4.frequency.value = freq * 1.25;
      const g4 = ctx.createGain();
      g4.setValueAtTime(0.0001, t);
      g4.gain.exponentialRampToValueAtTime(0.04, t + 0.03);
      g4.gain.exponentialRampToValueAtTime(0.0001, t + Math.max(0.2, dur));
      o4.connect(g4); g4.connect(radioGain); o4.start(t); o4.stop(t + Math.max(0.25, dur) + 0.05);
    }
    if (radioStation === 'coast') {
      const o3 = ctx.createOscillator(); o3.type = 'sine'; o3.frequency.value = freq * 1.5;
      const g3 = ctx.createGain();
      g3.gain.setValueAtTime(0.0001, t);
      g3.gain.exponentialRampToValueAtTime(0.04, t + 0.03);
      g3.gain.exponentialRampToValueAtTime(0.0001, t + Math.max(0.2, dur));
      o3.connect(g3); g3.connect(radioGain); o3.start(t); o3.stop(t + Math.max(0.25, dur) + 0.05);
    }
  }

  // v4 one-shots: a soft tick as the weapon wheel spins past a slot,
  // a countdown beep for the street race, a horn for the taxi job, and
  // the hiss of a tyre going down on a spike strip.
  function blip(freq, dur, vol, type) {
    if (!ctx) return;
    const t = ctx.currentTime;
    const o = ctx.createOscillator(); o.type = type || 'sine'; o.frequency.value = freq;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(master); o.start(t); o.stop(t + dur + 0.05);
  }

  return {
    unlock() { if (ensure() && ctx.state === 'suspended') ctx.resume(); },
    setEngine(speed, inCar) {
      if (!ctx) return;
      engineOsc.frequency.value = 50 + Math.abs(speed) * 6;
      engineGain.gain.value = inCar ? 0.05 + Math.min(0.08, Math.abs(speed) * 0.003) : 0;
    },
    setSiren(wanted, dt) {
      if (!ctx) return;
      sirenPhase += dt;
      if (wanted > 0) {
        sirenOsc.frequency.value = (Math.floor(sirenPhase * 1.6) % 2 === 0) ? 720 : 540;
        sirenGain.gain.value = 0.03 + wanted * 0.008;
      } else sirenGain.gain.value = 0;
    },
    setRain(intensity) { if (rainGain) rainGain.gain.value = 0.02 + intensity * 0.05; },
    setRadioStation(id) { radioStation = id; },
    radioNote(freq, dur) { radioNote(freq, dur); },
    shot() {
      if (!ctx) return;
      const t = ctx.currentTime;
      const src = ctx.createBufferSource();
      const b = ctx.createBuffer(1, ctx.sampleRate * 0.12, ctx.sampleRate);
      const d = b.getChannelData(0);
      for (let i = 0; i < d.length; i += 1) d[i] = (Math.random() * 2 - 1) * (1 - i / d.length);
      src.buffer = b;
      const g = ctx.createGain(); g.gain.setValueAtTime(0.35, t); g.gain.exponentialRampToValueAtTime(0.01, t + 0.12);
      src.connect(g); g.connect(master); src.start();
    },
    explosion() {
      if (!ctx) return;
      const t = ctx.currentTime;
      const src = ctx.createBufferSource();
      const b = ctx.createBuffer(1, ctx.sampleRate * 0.7, ctx.sampleRate);
      const d = b.getChannelData(0);
      for (let i = 0; i < d.length; i += 1) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / d.length, 2);
      src.buffer = b;
      const filt = ctx.createBiquadFilter(); filt.type = 'lowpass'; filt.frequency.value = 420;
      const g = ctx.createGain(); g.gain.setValueAtTime(0.6, t); g.gain.exponentialRampToValueAtTime(0.01, t + 0.7);
      src.connect(filt); filt.connect(g); g.connect(master); src.start();
    },
    chime() {
      if (!ctx) return;
      const t = ctx.currentTime;
      [660, 880, 1320].forEach((f, i) => {
        const o = ctx.createOscillator(); o.type = 'sine'; o.frequency.value = f;
        const g = ctx.createGain();
        g.gain.setValueAtTime(0.0001, t + i * 0.09);
        g.gain.exponentialRampToValueAtTime(0.18, t + i * 0.09 + 0.02);
        g.gain.exponentialRampToValueAtTime(0.0001, t + i * 0.09 + 0.5);
        o.connect(g); g.connect(master); o.start(t + i * 0.09); o.stop(t + i * 0.09 + 0.55);
      });
    },
    // v4: wheel tick, race countdown beep, taxi horn, spike hiss.
    // v5: a seagull cry over the marina and the coast — two falling
    // notes, quiet, so it never fights the radio.
    // v6: thunder for the lightning strikes — a low rolling rumble
    // that starts loud and fades over two seconds.
    thunder() {
      if (!ctx) return;
      const t = ctx.currentTime;
      const src = ctx.createBufferSource();
      const b = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
      const d = b.getChannelData(0);
      for (let i = 0; i < d.length; i += 1) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / d.length, 1.5);
      src.buffer = b;
      const filt = ctx.createBiquadFilter(); filt.type = 'lowpass'; filt.frequency.value = 160;
      const g = ctx.createGain(); g.gain.setValueAtTime(0.5, t); g.gain.exponentialRampToValueAtTime(0.01, t + 2);
      src.connect(filt); filt.connect(g); g.connect(master); src.start();
    },
    gull() { blip(1900, 0.28, 0.05, 'sine'); setTimeout(() => blip(1500, 0.32, 0.04, 'sine'), 160); },
    wheelTick() { blip(1200, 0.07, 0.12, 'square'); },
    raceBeep(final) { blip(final ? 1320 : 880, final ? 0.35 : 0.15, 0.2, 'sine'); },
    horn() { blip(420, 0.25, 0.18, 'sawtooth'); blip(530, 0.25, 0.14, 'sawtooth'); },
    spikeHiss() { blip(220, 0.5, 0.1, 'sawtooth'); },
    toggleMute() {
      muted = !muted;
      if (master) master.gain.value = muted ? 0 : 0.5;
      return muted;
    },
    isMuted() { return muted; },
    isStarted() { return started; },
  };
}
