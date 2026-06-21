/* ============================================================
   BATTLESHIP — SOUND EFFECTS ENGINE
   Web Audio synthesis (no audio files). Retro naval-arcade SFX
   matched to the game's battle semantics.

   Usage:
     <script src="assets/audio/sfx.js"></script>
     BattleshipSFX.play('hit');        // fire a one-shot effect
     BattleshipSFX.setVolume(0.6);      // 0..1 master volume
     BattleshipSFX.muted = true;        // silence everything
     BattleshipSFX.unlock();            // call on first user gesture

   Effects: fire · hit · miss · sunk · sonar · place · rotate
            · click · win · lose
   ============================================================ */
(function (global) {
  let ctx = null;
  let master = null;
  let volume = 0.6;

  function engine() {
    if (!ctx) {
      ctx = new (global.AudioContext || global.webkitAudioContext)();
      master = ctx.createGain();
      master.gain.value = volume;
      master.connect(ctx.destination);
    }
    if (ctx.state === "suspended") ctx.resume();
    return ctx;
  }

  // ---- low-level helpers ---------------------------------------------
  function env(node, t0, a, d, peak, sustain) {
    const g = node.gain;
    g.cancelScheduledValues(t0);
    g.setValueAtTime(0.0001, t0);
    g.exponentialRampToValueAtTime(peak, t0 + a);
    g.exponentialRampToValueAtTime(Math.max(sustain, 0.0001), t0 + a + d);
    return g;
  }

  function noiseBuffer(dur) {
    const c = engine();
    const len = Math.floor(c.sampleRate * dur);
    const buf = c.createBuffer(1, len, c.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
    return buf;
  }

  function tone(freq, t0, dur, type, gain) {
    const c = engine();
    const o = c.createOscillator();
    const g = c.createGain();
    o.type = type || "sine";
    o.frequency.setValueAtTime(freq, t0);
    o.connect(g); g.connect(master);
    env(g, t0, 0.005, dur, gain || 0.5, 0.0001);
    o.start(t0); o.stop(t0 + dur + 0.05);
    return o;
  }

  // ---- effects --------------------------------------------------------
  const FX = {
    fire() {
      const c = engine(), t = c.currentTime;
      const o = c.createOscillator(), g = c.createGain();
      o.type = "sawtooth";
      o.frequency.setValueAtTime(220, t);
      o.frequency.exponentialRampToValueAtTime(1200, t + 0.12);
      o.connect(g); g.connect(master);
      env(g, t, 0.005, 0.22, 0.4, 0.0001);
      o.start(t); o.stop(t + 0.3);
      const n = c.createBufferSource(); n.buffer = noiseBuffer(0.3);
      const bp = c.createBiquadFilter(); bp.type = "bandpass";
      bp.frequency.setValueAtTime(800, t); bp.frequency.linearRampToValueAtTime(3000, t + 0.25);
      const ng = c.createGain(); env(ng, t, 0.01, 0.25, 0.25, 0.0001);
      n.connect(bp); bp.connect(ng); ng.connect(master);
      n.start(t); n.stop(t + 0.3);
    },
    hit() {
      const c = engine(), t = c.currentTime;
      const o = c.createOscillator(), g = c.createGain();
      o.type = "sine";
      o.frequency.setValueAtTime(180, t);
      o.frequency.exponentialRampToValueAtTime(40, t + 0.5);
      o.connect(g); g.connect(master);
      env(g, t, 0.005, 0.6, 0.9, 0.0001);
      o.start(t); o.stop(t + 0.7);
      const n = c.createBufferSource(); n.buffer = noiseBuffer(0.5);
      const lp = c.createBiquadFilter(); lp.type = "lowpass";
      lp.frequency.setValueAtTime(2200, t); lp.frequency.exponentialRampToValueAtTime(300, t + 0.5);
      const ng = c.createGain(); env(ng, t, 0.005, 0.45, 0.6, 0.0001);
      n.connect(lp); lp.connect(ng); ng.connect(master);
      n.start(t); n.stop(t + 0.6);
    },
    miss() {
      const c = engine(), t = c.currentTime;
      // 1) sharp surface-break transient: bright noise burst, very short
      const imp = c.createBufferSource(); imp.buffer = noiseBuffer(0.12);
      const hp = c.createBiquadFilter(); hp.type = "highpass"; hp.frequency.value = 1500;
      const ig = c.createGain(); env(ig, t, 0.002, 0.08, 0.5, 0.0001);
      imp.connect(hp); hp.connect(ig); ig.connect(master);
      imp.start(t); imp.stop(t + 0.14);
      // 2) water body: lowpass noise swelling then decaying (the displacement gush)
      const body = c.createBufferSource(); body.buffer = noiseBuffer(0.55);
      const lp = c.createBiquadFilter(); lp.type = "lowpass"; lp.Q.value = 1;
      lp.frequency.setValueAtTime(700, t);
      lp.frequency.exponentialRampToValueAtTime(2600, t + 0.07);
      lp.frequency.exponentialRampToValueAtTime(350, t + 0.5);
      const bg = c.createGain();
      bg.gain.setValueAtTime(0.0001, t);
      bg.gain.exponentialRampToValueAtTime(0.55, t + 0.05);
      bg.gain.exponentialRampToValueAtTime(0.0001, t + 0.55);
      body.connect(lp); lp.connect(bg); bg.connect(master);
      body.start(t); body.stop(t + 0.6);
      // 3) hollow "ploop" cavity resonance — pitch dropping fast
      const o = c.createOscillator(), g = c.createGain();
      o.type = "sine";
      o.frequency.setValueAtTime(900, t + 0.01);
      o.frequency.exponentialRampToValueAtTime(140, t + 0.16);
      o.connect(g); g.connect(master);
      env(g, t + 0.01, 0.004, 0.18, 0.3, 0.0001);
      o.start(t + 0.01); o.stop(t + 0.22);
      // 4) trailing bubbles — a few rising blips
      [ [0.18, 380], [0.27, 520], [0.36, 300] ].forEach(([dt, f]) => {
        const bo = c.createOscillator(), bgn = c.createGain();
        bo.type = "sine";
        bo.frequency.setValueAtTime(f, t + dt);
        bo.frequency.exponentialRampToValueAtTime(f * 1.8, t + dt + 0.05);
        bo.connect(bgn); bgn.connect(master);
        env(bgn, t + dt, 0.004, 0.06, 0.12, 0.0001);
        bo.start(t + dt); bo.stop(t + dt + 0.1);
      });
    },
    sunk() {
      const c = engine(), t = c.currentTime;
      const notes = [330, 247, 165];
      notes.forEach((f, i) => tone(f, t + i * 0.13, 0.16, "square", 0.3));
      const o = c.createOscillator(), g = c.createGain();
      o.type = "sine"; o.frequency.setValueAtTime(120, t + 0.4); o.frequency.exponentialRampToValueAtTime(30, t + 1.3);
      o.connect(g); g.connect(master); env(g, t + 0.4, 0.01, 1.0, 0.9, 0.0001);
      o.start(t + 0.4); o.stop(t + 1.5);
      const n = c.createBufferSource(); n.buffer = noiseBuffer(1.0);
      const lp = c.createBiquadFilter(); lp.type = "lowpass";
      lp.frequency.setValueAtTime(1800, t + 0.4); lp.frequency.exponentialRampToValueAtTime(200, t + 1.3);
      const ng = c.createGain(); env(ng, t + 0.4, 0.01, 0.95, 0.55, 0.0001);
      n.connect(lp); lp.connect(ng); ng.connect(master);
      n.start(t + 0.4); n.stop(t + 1.5);
    },
    sonar() {
      const c = engine(), t = c.currentTime;
      const o = c.createOscillator(), g = c.createGain();
      o.type = "sine"; o.frequency.setValueAtTime(880, t);
      o.connect(g); g.connect(master);
      env(g, t, 0.01, 0.9, 0.4, 0.0001);
      o.start(t); o.stop(t + 1.0);
      const o2 = c.createOscillator(), g2 = c.createGain();
      o2.type = "sine"; o2.frequency.setValueAtTime(880, t + 0.35);
      o2.connect(g2); g2.connect(master);
      env(g2, t + 0.35, 0.01, 0.6, 0.15, 0.0001);
      o2.start(t + 0.35); o2.stop(t + 1.0);
    },
    place() {
      const c = engine(), t = c.currentTime;
      tone(440, t, 0.05, "triangle", 0.3);
      tone(660, t + 0.05, 0.07, "triangle", 0.3);
    },
    rotate() {
      const c = engine(), t = c.currentTime;
      const o = c.createOscillator(), g = c.createGain();
      o.type = "triangle";
      o.frequency.setValueAtTime(300, t);
      o.frequency.exponentialRampToValueAtTime(720, t + 0.12);
      o.connect(g); g.connect(master);
      env(g, t, 0.005, 0.12, 0.28, 0.0001);
      o.start(t); o.stop(t + 0.18);
    },
    click() {
      const c = engine(), t = c.currentTime;
      tone(1200, t, 0.04, "square", 0.25);
    },
    win() {
      const c = engine(), t = c.currentTime;
      [523, 659, 784, 1046].forEach((f, i) => tone(f, t + i * 0.12, 0.18, "triangle", 0.35));
    },
    lose() {
      const c = engine(), t = c.currentTime;
      [392, 330, 262, 196].forEach((f, i) => tone(f, t + i * 0.16, 0.22, "sawtooth", 0.3));
    },
  };

  const BattleshipSFX = {
    muted: false,
    /** Resume the audio context — call from a user gesture handler. */
    unlock() { engine(); },
    /** Set master volume, 0..1. */
    setVolume(v) {
      volume = Math.max(0, Math.min(1, v));
      if (master) master.gain.value = volume;
    },
    get volume() { return volume; },
    /** Play a named effect. Returns false if the name is unknown. */
    play(name) {
      if (this.muted) return false;
      const fn = FX[name];
      if (!fn) { console.warn("BattleshipSFX: unknown effect '" + name + "'"); return false; }
      try { fn(); } catch (e) { console.warn("BattleshipSFX: playback failed", e); }
      return true;
    },
    /** All available effect names. */
    get names() { return Object.keys(FX); },
  };

  global.BattleshipSFX = BattleshipSFX;
  if (typeof module !== "undefined" && module.exports) module.exports = BattleshipSFX;
})(typeof window !== "undefined" ? window : this);
