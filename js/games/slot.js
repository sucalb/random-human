// Slot machine: one reel per chosen person (up to 5 per round), reels stop left to right.
(function (RH) {
  const { lerp, ease, shuffle, roundRect, fitText, font, clamp, short } = RH.util;
  const S = RH.sound;
  const PER_ROUND = 5;

  class SlotGame {
    constructor() {
      this.id = 'slot';
      this.name = 'Máy xèng';
      this.icon = '🎰';
      this.tl = new RH.Timeline();
      this.time = 0;
      this.reels = [];
      this.lever = 0;
      this.names = [];
      this.w = 800; this.h = 500;
    }

    setup(names) {
      this.tl.clear();
      this.names = names.slice();
      this.reels = Array.from({ length: Math.min(3, Math.max(1, names.length)) }, () => this.makeReel());
      this.spinning = false;
    }

    makeReel() {
      let strip = shuffle(this.names);
      while (strip.length && strip.length < 12) strip = strip.concat(shuffle(this.names));
      return { strip, off: Math.random() * strip.length, result: null, lastInt: 0 };
    }

    resize(w, h) { this.w = w; this.h = h; }

    update(dt) {
      this.time += dt;
      this.tl.update(dt);
      if (!this.spinning) for (const r of this.reels) if (!r.result) r.off += dt * 0.4;
      for (const r of this.reels) {
        const i = Math.floor(r.off);
        if (i !== r.lastInt) { if (this.spinning && !r.result) S.tick(); r.lastInt = i; }
      }
    }

    async play(winners, onPick) {
      let picked = 0;
      for (let start = 0; start < winners.length; start += PER_ROUND) {
        const batch = winners.slice(start, start + PER_ROUND);
        this.reels = batch.map(() => this.makeReel());
        this.spinning = true;
        await this.tl.tween(0.35, (t) => (this.lever = Math.sin(t * Math.PI)));
        S.whoosh();
        await Promise.all(batch.map(async (name, j) => {
          const r = this.reels[j];
          const len = r.strip.length;
          const idx = r.strip.indexOf(name);
          const startOff = r.off;
          let target = idx;
          target += len * Math.ceil((startOff + 30 + j * 8 - target) / len);
          const dur = 2.4 + j * 0.65;
          const last = j === batch.length - 1;
          const fake = RH.settings.drama && len > 2 && Math.random() < (last ? 0.85 : 0.3);
          if (!fake) {
            await this.tl.tween(dur, (t) => (r.off = lerp(startOff, target, ease.outBack(t, 0.9))));
          } else {
            // Stops one name short (or one past), holds, then clunks onto the real one.
            const stop = target + (Math.random() < 0.6 ? -1 : 1);
            await this.tl.tween(dur + (last ? 0.6 : 0), (t) => (r.off = lerp(startOff, stop, ease.outQuart(t))));
            await this.tl.wait(last ? 1.0 : 0.6);
            S.uhoh();
            await this.tl.tween(0.45, (t) => (r.off = lerp(stop, target, ease.outBack(t, 2.2))));
          }
          r.off = target;
          r.result = name;
          RH.fx.shake(1);
          S.ding();
          onPick(name, picked++);
        }));
        this.spinning = false;
        await this.tl.wait(start + PER_ROUND < winners.length ? 1.4 : 0.8);
      }
    }

    draw(ctx, w, h) {
      const bg = ctx.createLinearGradient(0, 0, 0, h);
      bg.addColorStop(0, '#3b1e5e');
      bg.addColorStop(1, '#16102e');
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, w, h);
      // sparkle dots
      for (let i = 0; i < 40; i++) {
        const x = (i * 197.3) % w, y = (i * 89.7) % h;
        ctx.fillStyle = `rgba(255,220,120,${0.15 + 0.15 * Math.sin(this.time * 3 + i)})`;
        ctx.beginPath(); ctx.arc(x, y, 2, 0, Math.PI * 2); ctx.fill();
      }

      const cols = Math.max(1, this.reels.length);
      const leverW = 50;
      const mw = Math.min(w - 40 - leverW, Math.max(420, cols * 230 + 70));
      const mh = Math.min(h - 40, 380);
      const mx = (w - mw - leverW) / 2, my = (h - mh) / 2;

      // cabinet
      ctx.fillStyle = 'rgba(0,0,0,0.4)';
      roundRect(ctx, mx + 8, my + 12, mw, mh, 26); ctx.fill();
      const cab = ctx.createLinearGradient(mx, my, mx, my + mh);
      cab.addColorStop(0, '#ff4d6d');
      cab.addColorStop(1, '#b5173b');
      ctx.fillStyle = cab;
      roundRect(ctx, mx, my, mw, mh, 26); ctx.fill();
      ctx.strokeStyle = '#ffd36b';
      ctx.lineWidth = 6;
      ctx.stroke();

      // marquee
      const mqH = mh * 0.17;
      ctx.fillStyle = '#2a0f3f';
      roundRect(ctx, mx + 18, my + 14, mw - 36, mqH, 14); ctx.fill();
      const title = '★ MÁY XÈNG MAY MẮN ★';
      let mfs = clamp(mqH * 0.45, 14, 30);
      ctx.font = font(mfs, 800);
      mfs *= Math.min(1, (mw - 60) / ctx.measureText(title).width);
      ctx.font = font(mfs, 800);
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = '#ffd23f';
      ctx.fillText(title, mx + mw / 2, my + 14 + mqH / 2 + 1);
      const bulbs = Math.floor((mw - 36) / 22);
      for (let i = 0; i < bulbs; i++) {
        const on = (i + Math.floor(this.time * (this.spinning ? 10 : 3))) % 3 === 0;
        ctx.fillStyle = on ? '#fff7d1' : '#c98a1a';
        ctx.beginPath(); ctx.arc(mx + 29 + i * 22, my + 14 + mqH + 9, 4, 0, Math.PI * 2); ctx.fill();
      }

      // reels window
      const wx = mx + 24, wy = my + 14 + mqH + 24, ww = mw - 48, wh = mh - (wy - my) - 26;
      ctx.fillStyle = '#1a1030';
      roundRect(ctx, wx - 6, wy - 6, ww + 12, wh + 12, 14); ctx.fill();
      const gap = 10;
      const rw = (ww - gap * (cols - 1)) / cols;
      const rowH = wh / 3;
      this.reels.forEach((r, j) => {
        const rx = wx + j * (rw + gap);
        ctx.save();
        roundRect(ctx, rx, wy, rw, wh, 10);
        ctx.clip();
        ctx.fillStyle = r.result ? '#fff6cc' : '#fbfbff';
        ctx.fillRect(rx, wy, rw, wh);
        const len = r.strip.length;
        if (len) {
          const base = Math.floor(r.off), frac = r.off - base;
          const fs = clamp(Math.min(rowH * 0.32, rw * 0.13), 11, 30);
          ctx.font = font(fs, 800);
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          for (let k = -2; k <= 2; k++) {
            const name = r.strip[(((base + k) % len) + len) % len];
            const y = wy + wh / 2 - (k - frac) * rowH;
            const isMid = Math.abs(k - frac) < 0.5;
            ctx.fillStyle = r.result && isMid ? '#c2185b' : '#2a2350';
            const label = rw < 150 ? short(name) : name;
            ctx.fillText(fitText(ctx, label, rw - 16), rx + rw / 2, y);
          }
        }
        // cylinder shading
        const sh = ctx.createLinearGradient(0, wy, 0, wy + wh);
        sh.addColorStop(0, 'rgba(20,10,40,0.55)');
        sh.addColorStop(0.3, 'rgba(20,10,40,0)');
        sh.addColorStop(0.7, 'rgba(20,10,40,0)');
        sh.addColorStop(1, 'rgba(20,10,40,0.55)');
        ctx.fillStyle = sh;
        ctx.fillRect(rx, wy, rw, wh);
        ctx.restore();
        if (r.result) {
          ctx.strokeStyle = `rgba(255,210,63,${0.7 + 0.3 * Math.sin(this.time * 8)})`;
          ctx.lineWidth = 4;
          roundRect(ctx, rx + 2, wy + rowH + 2, rw - 4, rowH - 4, 8);
          ctx.stroke();
        }
      });
      // payline arrows
      ctx.fillStyle = '#ffd23f';
      const py = wy + wh / 2;
      ctx.beginPath(); ctx.moveTo(wx - 18, py - 10); ctx.lineTo(wx - 6, py); ctx.lineTo(wx - 18, py + 10); ctx.fill();
      ctx.beginPath(); ctx.moveTo(wx + ww + 18, py - 10); ctx.lineTo(wx + ww + 6, py); ctx.lineTo(wx + ww + 18, py + 10); ctx.fill();

      // lever
      const lx = mx + mw + 14, ly = my + mh * 0.55;
      ctx.fillStyle = '#9aa3b5';
      roundRect(ctx, mx + mw - 4, ly - 18, 22, 36, 6); ctx.fill();
      const ang = -0.5 + this.lever * 1.9;
      const len = mh * 0.38;
      const ex = lx + Math.sin(-ang) * 4 + 6, ey = ly - Math.cos(ang) * len;
      ctx.strokeStyle = '#c9ced8';
      ctx.lineWidth = 7;
      ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(lx + 4, ly); ctx.lineTo(ex, ey); ctx.stroke();
      const ball = ctx.createRadialGradient(ex - 4, ey - 4, 2, ex, ey, 16);
      ball.addColorStop(0, '#ff8fa3');
      ball.addColorStop(1, '#d6143f');
      ctx.fillStyle = ball;
      ctx.beginPath(); ctx.arc(ex, ey, 15, 0, Math.PI * 2); ctx.fill();
    }
  }

  RH.games.push(new SlotGame());
})(window.RH);
