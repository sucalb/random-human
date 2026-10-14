// Lucky wheel: spins and lands on each chosen name in turn.
(function (RH) {
  const { rand, lerp, ease, roundRect, fitText, shuffle, short, font, clamp } = RH.util;
  const S = RH.sound;
  const COLORS = ['#ff6b6b', '#ffa94d', '#ffd43b', '#69db7c', '#38d9a9', '#4dabf7', '#748ffc', '#da77f2', '#f783ac'];
  const TAU = Math.PI * 2;

  class WheelGame {
    constructor() {
      this.id = 'wheel';
      this.name = 'Vòng quay';
      this.icon = '🎡';
      this.tl = new RH.Timeline();
      this.items = [];
      this.rot = 0;
      this.time = 0;
      this.kick = 0;
      this.lastIdx = -1;
      this.spinning = false;
      this.busy = false;
      this.highlight = null;
      this.w = 800; this.h = 500;
    }

    setup(names) {
      this.tl.clear();
      this.items = shuffle(names);
      this.highlight = null;
      this.tease = null;
      this.busy = false;
      this.spinning = false;
    }

    resize(w, h) { this.w = w; this.h = h; }

    seg() { return TAU / Math.max(1, this.items.length); }

    indexAtPointer() {
      let a = (-Math.PI / 2 - this.rot) % TAU;
      if (a < 0) a += TAU;
      return Math.floor(a / this.seg()) % Math.max(1, this.items.length);
    }

    update(dt) {
      this.time += dt;
      this.tl.update(dt);
      if (!this.busy) this.rot += dt * 0.12;
      const i = this.indexAtPointer();
      if (i !== this.lastIdx) {
        if (this.spinning) { S.tick(); this.kick = 1; }
        this.lastIdx = i;
      }
      this.kick = Math.max(0, this.kick - dt * 7);
    }

    async play(winners, onPick) {
      this.busy = true;
      for (let w = 0; w < winners.length; w++) {
        const name = winners[w];
        const k = this.items.indexOf(name);
        if (k < 0) continue;
        const seg = this.seg();
        const n = this.items.length;
        // a = angle under the pointer, measured from the wheel's 0; rot grows => a shrinks.
        const rotFor = (a) => {
          let r = -Math.PI / 2 - a;
          return r + TAU * Math.ceil((this.rot + TAU * 5 - r) / TAU);
        };
        const spinTo = async (target, dur, fn) => {
          const start = this.rot;
          await this.tl.tween(dur, (t) => (this.rot = lerp(start, target, fn(t))));
        };
        this.spinning = true;
        const drama = RH.settings.drama && n > 2 && Math.random() < 0.75;
        if (!drama) {
          await spinTo(rotFor((k + 0.5 + (Math.random() - 0.5) * 0.7) * seg), 5.5, ease.outQuart);
        } else if (Math.random() < 0.5) {
          // Crawls to a stop just before the winner's slice... then creeps over the line.
          const aStop = (k + 1 + rand(0.05, 0.14)) * seg;
          await spinTo(rotFor(aStop), 5.5, ease.outQuart);
          this.tease = this.items[(k + 1) % n];
          await this.tl.wait(0.9);
          this.tease = null;
          S.uhoh();
          await spinTo(this.rot + aStop - (k + rand(0.35, 0.65)) * seg, 1.1, ease.inOut);
        } else {
          // Overshoots into the next slice, hangs there, then rolls back.
          const aStop = (k - rand(0.1, 0.22)) * seg;
          await spinTo(rotFor(aStop), 5.5, ease.outQuart);
          this.tease = this.items[(k - 1 + n) % n];
          await this.tl.wait(0.9);
          this.tease = null;
          S.uhoh();
          await spinTo(this.rot - ((k + rand(0.35, 0.65)) * seg - aStop), 0.9, (t) => ease.outBack(t, 1.4));
        }
        this.spinning = false;
        this.highlight = name;
        RH.fx.shake(1);
        S.ding();
        onPick(name, w);
        await this.tl.wait(1.6);
        if (w < winners.length - 1) {
          this.items.splice(this.items.indexOf(name), 1);
          this.highlight = null;
        }
      }
      await this.tl.wait(0.3);
    }

    draw(ctx, w, h) {
      // background
      const bg = ctx.createRadialGradient(w / 2, h / 2, 10, w / 2, h / 2, Math.max(w, h) * 0.7);
      bg.addColorStop(0, '#2c3e8f');
      bg.addColorStop(1, '#141a3d');
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, w, h);
      // light rays
      ctx.save();
      ctx.translate(w / 2, h / 2);
      ctx.rotate(this.time * 0.05);
      ctx.fillStyle = 'rgba(255,255,255,0.035)';
      for (let i = 0; i < 12; i++) {
        ctx.rotate(TAU / 12);
        ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(-60, -Math.max(w, h)); ctx.lineTo(60, -Math.max(w, h)); ctx.fill();
      }
      ctx.restore();

      const n = this.items.length;
      const R = Math.min(w, h) * 0.42;
      const cx = w / 2, cy = h / 2 + h * 0.03;
      if (!n) return;
      const seg = this.seg();
      const useShort = n > 14;

      // stand
      ctx.fillStyle = '#9a6a1c';
      ctx.beginPath();
      ctx.moveTo(cx - R * 0.12, cy); ctx.lineTo(cx + R * 0.12, cy);
      ctx.lineTo(cx + R * 0.42, Math.min(h - 4, cy + R + 40)); ctx.lineTo(cx - R * 0.42, Math.min(h - 4, cy + R + 40));
      ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#c48a2a';
      roundRect(ctx, cx - R * 0.5, Math.min(h - 16, cy + R + 30), R, 14, 7); ctx.fill();
      // drop shadow + outer ring
      ctx.fillStyle = 'rgba(0,0,0,0.35)';
      ctx.beginPath(); ctx.arc(cx + 6, cy + 10, R + 16, 0, TAU); ctx.fill();
      const ring = ctx.createLinearGradient(cx - R, cy - R, cx + R, cy + R);
      ring.addColorStop(0, '#ffe08a');
      ring.addColorStop(0.5, '#e0a32e');
      ring.addColorStop(1, '#ffd36b');
      ctx.fillStyle = ring;
      ctx.beginPath(); ctx.arc(cx, cy, R + 16, 0, TAU); ctx.fill();

      const winIdx = this.highlight ? this.items.indexOf(this.highlight) : -1;
      for (let i = 0; i < n; i++) {
        const a0 = this.rot + i * seg, a1 = a0 + seg;
        let col = COLORS[i % COLORS.length];
        if (i === n - 1 && n % COLORS.length === 1 && n > 1) col = COLORS[4];
        ctx.fillStyle = col;
        ctx.beginPath(); ctx.moveTo(cx, cy); ctx.arc(cx, cy, R, a0, a1); ctx.closePath(); ctx.fill();
        if (winIdx >= 0 && i !== winIdx) {
          ctx.fillStyle = 'rgba(10,14,40,0.55)';
          ctx.fill();
        }
        if (n > 1) {
          ctx.strokeStyle = 'rgba(255,255,255,0.7)';
          ctx.lineWidth = 1.5;
          ctx.stroke();
        }
        // label
        const mid = a0 + seg / 2;
        const fs = clamp(Math.min(R * seg * 0.55, R * 0.085), 7, 24);
        ctx.save();
        ctx.translate(cx, cy);
        ctx.rotate(mid);
        ctx.font = font(fs, 800);
        ctx.fillStyle = '#1b2240';
        ctx.textAlign = 'right';
        ctx.textBaseline = 'middle';
        const label = useShort ? short(this.items[i]) : this.items[i];
        ctx.fillText(fitText(ctx, label, R * 0.68), R - 14, 1);
        ctx.restore();
      }

      // glossy highlight
      const gloss = ctx.createLinearGradient(cx, cy - R, cx, cy + R);
      gloss.addColorStop(0, 'rgba(255,255,255,0.28)');
      gloss.addColorStop(0.5, 'rgba(255,255,255,0.02)');
      gloss.addColorStop(1, 'rgba(0,0,0,0.12)');
      ctx.fillStyle = gloss;
      ctx.beginPath(); ctx.arc(cx, cy, R, 0, TAU); ctx.fill();
      // bulbs
      const bulbs = 24;
      for (let i = 0; i < bulbs; i++) {
        const a = (i / bulbs) * TAU;
        const on = (i + Math.floor(this.time * (this.spinning ? 12 : 3))) % 2 === 0;
        ctx.fillStyle = on ? '#fffbe6' : '#b37a14';
        ctx.beginPath(); ctx.arc(cx + Math.cos(a) * (R + 8), cy + Math.sin(a) * (R + 8), 4, 0, TAU); ctx.fill();
      }

      // hub
      const hub = ctx.createRadialGradient(cx - 6, cy - 6, 2, cx, cy, R * 0.16);
      hub.addColorStop(0, '#ffffff');
      hub.addColorStop(1, '#d6dbe8');
      ctx.fillStyle = hub;
      ctx.beginPath(); ctx.arc(cx, cy, R * 0.15, 0, TAU); ctx.fill();
      ctx.strokeStyle = '#e0a32e';
      ctx.lineWidth = 4;
      ctx.stroke();
      ctx.font = font(R * 0.09);
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('🎲', cx, cy + 1);

      // pointer
      ctx.save();
      ctx.translate(cx, cy - R - 6);
      ctx.rotate(-this.kick * 0.35);
      ctx.fillStyle = 'rgba(0,0,0,0.3)';
      ctx.beginPath(); ctx.moveTo(-16, -18); ctx.lineTo(18, -18); ctx.lineTo(2, 22); ctx.fill();
      ctx.fillStyle = '#ff3b5c';
      ctx.beginPath(); ctx.moveTo(-18, -22); ctx.lineTo(18, -22); ctx.lineTo(0, 20); ctx.closePath(); ctx.fill();
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 3;
      ctx.stroke();
      ctx.restore();

      // winner banner (or a shaky "is it...?" while teasing)
      const banner = this.highlight || (this.tease && this.tease + '…?');
      if (banner) {
        const hot = !!this.highlight;
        const pulse = hot ? 1 + Math.sin(this.time * 8) * 0.03 : 1;
        const fs = clamp(R * (hot ? 0.16 : 0.12), 16, hot ? 46 : 34) * pulse;
        const shake = hot ? 0 : Math.sin(this.time * 50) * 2;
        ctx.font = font(fs, 800);
        const tw = ctx.measureText(banner).width + fs * 1.4;
        const bx = cx - tw / 2 + shake, by = cy + R * 0.32;
        ctx.fillStyle = 'rgba(0,0,0,0.3)';
        roundRect(ctx, bx + 4, by + 6, tw, fs * 1.7, fs * 0.5); ctx.fill();
        ctx.fillStyle = hot ? '#ffd23f' : '#e9ecf5';
        roundRect(ctx, bx, by, tw, fs * 1.7, fs * 0.5); ctx.fill();
        ctx.fillStyle = hot ? '#1b2240' : '#6b7393';
        ctx.fillText(banner, cx + shake, by + fs * 0.88);
      }
    }
  }

  RH.games.push(new WheelGame());
})(window.RH);
