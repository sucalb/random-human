// Shared helpers: math, easing, timeline (async tweens), sound, drawing utils.
window.RH = window.RH || { games: [] };
RH.settings = { drama: true };
// Screen effects; the app replaces these with real implementations.
RH.fx = { shake() {}, flash() {} };

(function (RH) {
  function secureInt(n) {
    if (!(window.crypto && crypto.getRandomValues)) return Math.floor(Math.random() * n);
    const buf = new Uint32Array(1);
    const limit = Math.floor(0x100000000 / n) * n;
    let v;
    do { crypto.getRandomValues(buf); v = buf[0]; } while (v >= limit);
    return v % n;
  }

  const U = RH.util = {
    rand: (a, b) => a + Math.random() * (b - a),
    randInt: (a, b) => Math.floor(a + Math.random() * (b - a + 1)),
    pick: (a) => a[Math.floor(Math.random() * a.length)],
    clamp: (v, a, b) => Math.max(a, Math.min(b, v)),
    lerp: (a, b, t) => a + (b - a) * t,
    shuffle(arr) {
      const a = arr.slice();
      for (let i = a.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [a[i], a[j]] = [a[j], a[i]];
      }
      return a;
    },
    // Fair pick of k distinct items using crypto randomness.
    secureSample(arr, k) {
      const a = arr.slice();
      k = Math.min(k, a.length);
      for (let i = 0; i < k; i++) {
        const j = i + secureInt(a.length - i);
        [a[i], a[j]] = [a[j], a[i]];
      }
      return a.slice(0, k);
    },
    seeded(seed) {
      return function () {
        seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
        let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
      };
    },
    // "Nguyễn Văn Bảo Ngọc" -> "Bảo Ngọc" for crowded scenes.
    short(name) {
      const parts = name.trim().split(/\s+/);
      return parts.length >= 3 ? parts.slice(-2).join(' ') : name;
    },
    ease: {
      linear: (t) => t,
      inOut: (t) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2),
      outCubic: (t) => 1 - Math.pow(1 - t, 3),
      outQuart: (t) => 1 - Math.pow(1 - t, 4),
      inCubic: (t) => t * t * t,
      outBack: (t, s = 1.70158) => 1 + (s + 1) * Math.pow(t - 1, 3) + s * Math.pow(t - 1, 2),
    },
    roundRect(ctx, x, y, w, h, r) {
      r = Math.min(r, w / 2, h / 2);
      ctx.beginPath();
      ctx.moveTo(x + r, y);
      ctx.arcTo(x + w, y, x + w, y + h, r);
      ctx.arcTo(x + w, y + h, x, y + h, r);
      ctx.arcTo(x, y + h, x, y, r);
      ctx.arcTo(x, y, x + w, y, r);
      ctx.closePath();
    },
    fitText(ctx, text, maxW) {
      if (ctx.measureText(text).width <= maxW) return text;
      let s = text;
      while (s.length > 1 && ctx.measureText(s + '…').width > maxW) s = s.slice(0, -1);
      return s + '…';
    },
    // Speech bubble whose box is centred on (x, y) with a tail pointing at (tx, ty).
    bubble(ctx, x, y, text, fs, tx, ty) {
      ctx.font = U.font(fs, 800);
      const w = ctx.measureText(text).width + fs * 1.2, h = fs * 1.9;
      const bx = Math.max(6, Math.min(ctx.canvas.clientWidth - w - 6, x - w / 2)), by = y - h / 2;
      ctx.fillStyle = '#fff';
      U.roundRect(ctx, bx, by, w, h, h * 0.4);
      ctx.fill();
      if (tx !== undefined) {
        const ax = U.clamp(tx, bx + h * 0.5, bx + w - h * 0.5), ay = ty < by ? by + 1 : by + h - 1;
        ctx.beginPath();
        ctx.moveTo(ax - 7, ay); ctx.lineTo(tx, ty); ctx.lineTo(ax + 7, ay);
        ctx.fill();
      }
      ctx.fillStyle = '#1b2240';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(text, bx + w / 2, by + h / 2 + 1);
    },
    font: (size, weight = 700) =>
      `${weight} ${Math.round(size)}px "Be Vietnam Pro", system-ui, -apple-system, "Segoe UI", sans-serif`,
  };

  // Tweens driven by the game's update(dt), so everything stays in sync with the frame loop.
  RH.Timeline = class {
    constructor() { this.tasks = []; }
    update(dt) {
      const tasks = this.tasks.slice();
      for (const t of tasks) {
        t.elapsed += dt;
        const k = Math.min(1, t.elapsed / t.dur);
        t.fn(k);
        if (k >= 1) {
          this.tasks.splice(this.tasks.indexOf(t), 1);
          t.resolve();
        }
      }
    }
    tween(dur, fn = () => {}) {
      return new Promise((resolve) => this.tasks.push({ dur: Math.max(0.001, dur), elapsed: 0, fn, resolve }));
    }
    wait(dur) { return this.tween(dur); }
    clear() { this.tasks = []; }
  };

  RH.sound = {
    enabled: true,
    ac: null,
    lastTick: 0,
    ctx() {
      if (!this.ac) {
        const AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) return null;
        this.ac = new AC();
      }
      if (this.ac.state === 'suspended') this.ac.resume();
      return this.ac;
    },
    tone(freq, dur, { type = 'sine', vol = 0.12, slide = 0, delay = 0 } = {}) {
      if (!this.enabled) return;
      const ac = this.ctx();
      if (!ac) return;
      const t = ac.currentTime + delay;
      const o = ac.createOscillator();
      const g = ac.createGain();
      o.type = type;
      o.frequency.setValueAtTime(freq, t);
      if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(20, freq + slide), t + dur);
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(vol, t + 0.015);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      o.connect(g).connect(ac.destination);
      o.start(t);
      o.stop(t + dur + 0.05);
    },
    // Filtered white noise: thunder, crackles, rain.
    noise(dur, { vol = 0.2, freq = 800, type = 'lowpass', delay = 0, attack = 0.01 } = {}) {
      if (!this.enabled) return;
      const ac = this.ctx();
      if (!ac) return;
      if (!this.noiseBuf) {
        this.noiseBuf = ac.createBuffer(1, ac.sampleRate * 3, ac.sampleRate);
        const d = this.noiseBuf.getChannelData(0);
        for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
      }
      const t = ac.currentTime + delay;
      const src = ac.createBufferSource();
      src.buffer = this.noiseBuf;
      const f = ac.createBiquadFilter();
      f.type = type;
      f.frequency.value = freq;
      const g = ac.createGain();
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(vol, t + attack);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      src.connect(f).connect(g).connect(ac.destination);
      src.start(t, Math.random() * 1.5);
      src.stop(t + dur + 0.05);
    },
    thunder() {
      this.noise(0.25, { vol: 0.5, freq: 3000, type: 'highpass' });
      this.noise(2.6, { vol: 0.6, freq: 260, attack: 0.05 });
      this.noise(2.0, { vol: 0.35, freq: 120, delay: 0.25, attack: 0.2 });
    },
    rumble() { this.noise(2.2, { vol: 0.18, freq: 160, attack: 0.4 }); },
    crackle() { this.noise(0.06, { vol: 0.12, freq: 2500, type: 'highpass' }); },
    // Soft heartbeat while a round is playing.
    tension(on) {
      clearInterval(this.tensionTimer);
      if (!on) return;
      const beat = () => {
        this.tone(58, 0.16, { type: 'sine', vol: 0.09 });
        this.tone(52, 0.16, { type: 'sine', vol: 0.06, delay: 0.2 });
      };
      beat();
      this.tensionTimer = setInterval(beat, 950);
    },
    flush(big) {
      this.noise(big ? 2.4 : 1.2, { vol: big ? 0.35 : 0.16, freq: big ? 700 : 1000, type: 'bandpass', attack: 0.15 });
      this.tone(big ? 300 : 420, big ? 1.8 : 0.9, { type: 'sine', vol: 0.05, slide: big ? -220 : -200 });
    },
    eagleCry() {
      this.tone(2100, 0.25, { type: 'sawtooth', vol: 0.04, slide: 300 });
      this.tone(2300, 0.7, { type: 'sawtooth', vol: 0.05, slide: -1300, delay: 0.22 });
    },
    // Continuous buzzing for the bee swarm; intensity 0..1, off when on=false.
    buzz(on, intensity = 0.5) {
      const ac = this.enabled && this.ctx();
      if (!ac) return;
      if (!on) {
        if (this.buzzNodes) {
          const { osc, lfo, gain } = this.buzzNodes;
          gain.gain.setTargetAtTime(0.0001, ac.currentTime, 0.15);
          osc.stop(ac.currentTime + 0.8); lfo.stop(ac.currentTime + 0.8);
          this.buzzNodes = null;
        }
        return;
      }
      if (!this.buzzNodes) {
        const osc = ac.createOscillator(), lfo = ac.createOscillator(), lfoGain = ac.createGain(), gain = ac.createGain();
        osc.type = 'sawtooth'; osc.frequency.value = 210;
        lfo.frequency.value = 23; lfoGain.gain.value = 18;
        lfo.connect(lfoGain).connect(osc.frequency);
        gain.gain.value = 0.0001;
        osc.connect(gain).connect(ac.destination);
        osc.start(); lfo.start();
        this.buzzNodes = { osc, lfo, gain };
      }
      this.buzzNodes.gain.gain.setTargetAtTime(0.015 + 0.045 * intensity, ac.currentTime, 0.2);
      this.buzzNodes.osc.frequency.setTargetAtTime(200 + 80 * intensity, ac.currentTime, 0.2);
    },
    cackle() {
      [0, 0.16, 0.32, 0.48, 0.64].forEach((d, i) => this.tone(900 - i * 70, 0.13, { type: 'sawtooth', vol: 0.05, slide: -250, delay: d }));
    },
    zap() { this.tone(400, 0.35, { type: 'square', vol: 0.05, slide: 1600 }); this.noise(0.3, { vol: 0.08, freq: 4000, type: 'highpass' }); },
    poof() { this.noise(0.5, { vol: 0.25, freq: 900, attack: 0.01 }); this.tone(300, 0.3, { type: 'sine', vol: 0.08, slide: -200 }); },
    ribbit() {
      this.tone(180, 0.09, { type: 'square', vol: 0.09, slide: 60 });
      this.tone(160, 0.12, { type: 'square', vol: 0.09, slide: 50, delay: 0.12 });
    },
    // Looping wind for the tornado; intensity 0..1, off when on=false.
    wind(on, intensity = 0.5) {
      const ac = this.enabled && this.ctx();
      if (!ac) return;
      if (!on) {
        if (this.windNodes) {
          this.windNodes.gain.gain.setTargetAtTime(0.0001, ac.currentTime, 0.3);
          this.windNodes.src.stop(ac.currentTime + 1.5);
          this.windNodes = null;
        }
        return;
      }
      if (!this.windNodes) {
        this.noise(0.01, { vol: 0.0001 }); // makes sure the noise buffer exists
        const src = ac.createBufferSource();
        src.buffer = this.noiseBuf;
        src.loop = true;
        const f = ac.createBiquadFilter();
        f.type = 'bandpass'; f.Q.value = 0.8;
        const gain = ac.createGain();
        gain.gain.value = 0.0001;
        src.connect(f).connect(gain).connect(ac.destination);
        src.start();
        this.windNodes = { src, f, gain };
      }
      this.windNodes.f.frequency.setTargetAtTime(250 + 700 * intensity, ac.currentTime, 0.3);
      this.windNodes.gain.gain.setTargetAtTime(0.05 + 0.3 * intensity, ac.currentTime, 0.3);
    },
    tick() {
      const now = performance.now();
      if (now - this.lastTick < 45) return;
      this.lastTick = now;
      this.tone(1400, 0.035, { type: 'square', vol: 0.04 });
    },
    beep() { this.tone(660, 0.18, { type: 'square', vol: 0.07 }); },
    go() { this.tone(990, 0.45, { type: 'square', vol: 0.08 }); },
    ding() {
      this.tone(880, 0.5, { type: 'triangle', vol: 0.14 });
      this.tone(1320, 0.6, { type: 'triangle', vol: 0.1, delay: 0.08 });
    },
    uhoh() {
      this.tone(392, 0.22, { type: 'triangle', vol: 0.13 });
      this.tone(311, 0.5, { type: 'triangle', vol: 0.13, slide: -60, delay: 0.22 });
    },
    whistle() {
      this.tone(1046, 0.55, { type: 'sine', vol: 0.09 });
      this.tone(1318, 0.55, { type: 'sine', vol: 0.07 });
      this.tone(1046, 0.7, { type: 'sine', vol: 0.09, delay: 0.6 });
      this.tone(1318, 0.7, { type: 'sine', vol: 0.07, delay: 0.6 });
    },
    screech() { this.tone(2400, 0.9, { type: 'sawtooth', vol: 0.025, slide: -1400 }); },
    splash() { this.tone(700, 0.25, { type: 'triangle', vol: 0.06, slide: -500 }); },
    pop() { this.tone(900, 0.09, { type: 'square', vol: 0.08, slide: -600 }); },
    groan() {
      this.tone(110, 1.4, { type: 'sawtooth', vol: 0.06, slide: -45 });
      this.tone(117, 1.4, { type: 'sawtooth', vol: 0.05, slide: -50 });
    },
    chomp() {
      this.tone(180, 0.1, { type: 'square', vol: 0.12, slide: -90 });
      this.tone(140, 0.12, { type: 'square', vol: 0.12, slide: -70, delay: 0.12 });
    },
    whoosh() { this.tone(180, 0.9, { type: 'sawtooth', vol: 0.035, slide: 500 }); },
    ufo() {
      this.tone(520, 1.4, { type: 'sine', vol: 0.08, slide: -260 });
      this.tone(530, 1.4, { type: 'triangle', vol: 0.05, slide: -240 });
    },
    beam() {
      this.tone(220, 1.6, { type: 'sine', vol: 0.12, slide: 900 });
      this.tone(330, 1.6, { type: 'triangle', vol: 0.06, slide: 1200 });
    },
    fanfare() {
      [523, 659, 784, 1047].forEach((f, i) => this.tone(f, 0.28, { type: 'triangle', vol: 0.12, delay: i * 0.11 }));
      this.tone(1047, 0.9, { type: 'triangle', vol: 0.12, delay: 0.48 });
      this.tone(784, 0.9, { type: 'sine', vol: 0.08, delay: 0.48 });
    },
  };
})(window.RH);
