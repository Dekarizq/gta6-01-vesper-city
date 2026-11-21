// audio.js — procedural WebAudio: light drizzle noise, engine hum, sirens,
// gunshots, mission chimes. No audio files; everything is synthesized.
// Golden Hour: the morning rain has cleared to a soft drizzle, so the rain
// bed is quieter and higher (a light patter, not a downpour). Mute with U.
export function createAudio() {
  let ctx = null, master = null, rainGain = null, engineOsc = null, engineGain = null;
  let sirenOsc = null, sirenGain = null, muted = false, started = false;
  let sirenPhase = 0;

  function ensure() {
    if (ctx) return true;
    try {
      ctx = new (window.AudioContext || window.webkitAudioContext)();
      master = ctx.createGain(); master.gain.value = muted ? 0 : 0.5; master.connect(ctx.destination);
      // Rain: looped filtered noise.
      const len = ctx.sampleRate * 2;
      const buf = ctx.createBuffer(1, len, ctx.sampleRate);
      const data = buf.getChannelData(0);
      for (let i = 0; i < len; i += 1) data[i] = Math.random() * 2 - 1;
      const src = ctx.createBufferSource(); src.buffer = buf; src.loop = true;
      const filt = ctx.createBiquadFilter(); filt.type = 'lowpass'; filt.frequency.value = 2400;
      rainGain = ctx.createGain(); rainGain.gain.value = 0.04;
      src.connect(filt); filt.connect(rainGain); rainGain.connect(master); src.start();
      // Engine: sawtooth whose pitch follows speed.
      engineOsc = ctx.createOscillator(); engineOsc.type = 'sawtooth'; engineOsc.frequency.value = 55;
      const ef = ctx.createBiquadFilter(); ef.type = 'lowpass'; ef.frequency.value = 320;
      engineGain = ctx.createGain(); engineGain.gain.value = 0;
      engineOsc.connect(ef); ef.connect(engineGain); engineGain.connect(master); engineOsc.start();
      // Siren: sine that alternates pitch.
      sirenOsc = ctx.createOscillator(); sirenOsc.type = 'sine'; sirenOsc.frequency.value = 700;
      sirenGain = ctx.createGain(); sirenGain.gain.value = 0;
      sirenOsc.connect(sirenGain); sirenGain.connect(master); sirenOsc.start();
      started = true;
      return true;
    } catch { return false; }
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
    toggleMute() {
      muted = !muted;
      if (master) master.gain.value = muted ? 0 : 0.5;
      return muted;
    },
    isMuted() { return muted; },
    isStarted() { return started; },
  };
}
