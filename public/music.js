/* ============================================================
   BATTLESHIP — BACKGROUND MUSIC
   Procedural chiptune loop, synthesized live (no audio files).
   A driving naval-arcade theme in A minor: Am – F – C – G.

   Usage:
     <script src="assets/audio/music.js"></script>
     BattleshipMusic.start();      // begin loop (from a user gesture)
     BattleshipMusic.stop();
     BattleshipMusic.toggle();
     BattleshipMusic.setVolume(0.25);   // 0..1
     BattleshipMusic.muted = true;
     BattleshipMusic.playing;           // boolean
   ============================================================ */
(function (global) {
  let ctx = null;
  let master = null;          // overall music bus
  let volume = 0.22;
  let playing = false;
  let timer = null;

  // sequencer clock
  const BPM = 132;
  const STEP = (60 / BPM) / 4;   // 16th-note duration (s)
  const TOTAL_STEPS = 64;        // 4 bars × 16
  const LOOKAHEAD = 25;          // ms
  const SCHEDULE_AHEAD = 0.12;   // s
  let nextStepTime = 0;
  let step = 0;

  function engine() {
    if (!ctx) {
      ctx = new (global.AudioContext || global.webkitAudioContext)();
      master = ctx.createGain();
      master.gain.value = volume;
      // soften the whole mix a touch
      const lp = ctx.createBiquadFilter();
      lp.type = "lowpass"; lp.frequency.value = 6500;
      master.connect(lp); lp.connect(ctx.destination);
    }
    if (ctx.state === "suspended") ctx.resume();
    return ctx;
  }

  // midi → Hz
  function hz(m) { return 440 * Math.pow(2, (m - 69) / 12); }
  // note name → midi
  const NOTE = { C: 0, "C#": 1, D: 2, "D#": 3, E: 4, F: 5, "F#": 6, G: 7, "G#": 8, A: 9, "A#": 10, B: 11 };
  function n(name) {
    const m = name.match(/^([A-G]#?)(\d)$/);
    return 12 * (parseInt(m[2], 10) + 1) + NOTE[m[1]];
  }

  // ── musical material ───────────────────────────────────────────────
  // chord roots (one per bar) for the bass
  const BASS = ["A2", "F2", "C3", "G2"].map(n);
  // triads per bar for the arp
  const TRIADS = [
    ["A3", "C4", "E4"],
    ["F3", "A3", "C4"],
    ["C4", "E4", "G4"],
    ["G3", "B3", "D4"],
  ].map((c) => c.map(n));
  // lead hook — 8 eighth-notes per bar (× 4 bars)
  const LEAD = [
    "A4","C5","E5","C5","A4","C5","E5","D5",
    "C5","A4","F4","A4","C5","F5","E5","C5",
    "E5","G5","E5","C5","G4","C5","E5","G5",
    "D5","B4","G4","B4","D5","G5","F5","D5",
  ].map(n);

  // ── voices ─────────────────────────────────────────────────────────
  function pulse(freq, t, dur, gain, type, duty) {
    const c = engine();
    const o = c.createOscillator();
    const g = c.createGain();
    o.type = type || "square";
    o.frequency.setValueAtTime(freq, t);
    o.connect(g); g.connect(master);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(gain, t + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.start(t); o.stop(t + dur + 0.02);
  }

  function bass(freq, t, dur) {
    const c = engine();
    const o = c.createOscillator(), sub = c.createOscillator(), g = c.createGain();
    o.type = "square"; sub.type = "triangle";
    o.frequency.setValueAtTime(freq, t);
    sub.frequency.setValueAtTime(freq / 2, t);
    o.connect(g); sub.connect(g); g.connect(master);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.32, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.start(t); sub.start(t); o.stop(t + dur + 0.02); sub.stop(t + dur + 0.02);
  }

  function kick(t) {
    const c = engine();
    const o = c.createOscillator(), g = c.createGain();
    o.type = "sine";
    o.frequency.setValueAtTime(150, t);
    o.frequency.exponentialRampToValueAtTime(45, t + 0.12);
    o.connect(g); g.connect(master);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.6, t + 0.005);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.18);
    o.start(t); o.stop(t + 0.2);
  }

  let noiseBuf = null;
  function noise() {
    if (!noiseBuf) {
      const c = engine(), len = Math.floor(c.sampleRate * 0.3);
      noiseBuf = c.createBuffer(1, len, c.sampleRate);
      const d = noiseBuf.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    }
    return noiseBuf;
  }

  function snare(t) {
    const c = engine();
    const s = c.createBufferSource(); s.buffer = noise();
    const hp = c.createBiquadFilter(); hp.type = "highpass"; hp.frequency.value = 1200;
    const g = c.createGain();
    s.connect(hp); hp.connect(g); g.connect(master);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.28, t + 0.005);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.16);
    s.start(t); s.stop(t + 0.18);
  }

  function hat(t, open) {
    const c = engine();
    const s = c.createBufferSource(); s.buffer = noise();
    const hp = c.createBiquadFilter(); hp.type = "highpass"; hp.frequency.value = 7000;
    const g = c.createGain();
    s.connect(hp); hp.connect(g); g.connect(master);
    const dur = open ? 0.12 : 0.04;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.10, t + 0.003);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.start(t); s.stop(t + dur + 0.02);
  }

  // ── scheduler ──────────────────────────────────────────────────────
  function scheduleStep(s, t) {
    const bar = Math.floor(s / 16);
    const inBar = s % 16;

    // bass — eighth-note pulse, root with an octave lift on offbeats
    if (inBar % 2 === 0) {
      const root = BASS[bar];
      const note = inBar % 4 === 0 ? root : root + 12;
      bass(hz(note), t, STEP * 1.8);
    }

    // lead — eighth notes
    if (inBar % 2 === 0) {
      const idx = bar * 8 + inBar / 2;
      pulse(hz(LEAD[idx]), t, STEP * 1.7, 0.16, "square");
    }

    // arp — 16th-note triad shimmer, quiet
    const triad = TRIADS[bar];
    pulse(hz(triad[inBar % 3] + 12), t, STEP * 0.9, 0.05, "square");

    // drums
    if (inBar === 0 || inBar === 6 || inBar === 8 || inBar === 14) kick(t);
    if (inBar === 4 || inBar === 12) snare(t);
    if (inBar % 2 === 0) hat(t, inBar % 8 === 4);
  }

  function tick() {
    const c = engine();
    while (nextStepTime < c.currentTime + SCHEDULE_AHEAD) {
      scheduleStep(step, nextStepTime);
      nextStepTime += STEP;
      step = (step + 1) % TOTAL_STEPS;
    }
  }

  const BattleshipMusic = {
    get playing() { return playing; },
    get volume() { return volume; },
    set muted(v) { if (v) this.stop(); },
    get muted() { return !playing; },
    setVolume(v) {
      volume = Math.max(0, Math.min(1, v));
      if (master) master.gain.value = volume;
    },
    start() {
      if (playing) return;
      const c = engine();
      playing = true;
      step = 0;
      nextStepTime = c.currentTime + 0.08;
      tick();
      timer = setInterval(tick, LOOKAHEAD);
    },
    stop() {
      playing = false;
      if (timer) { clearInterval(timer); timer = null; }
    },
    toggle() { playing ? this.stop() : this.start(); },
  };

  global.BattleshipMusic = BattleshipMusic;
  if (typeof module !== "undefined" && module.exports) module.exports = BattleshipMusic;
})(typeof window !== "undefined" ? window : this);
