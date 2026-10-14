// Train: every car carries one student; the train pulls in and stops with the chosen car at the platform.
(function (RH) {
  const { rand, pick, lerp, ease, roundRect, fitText, short, font, clamp } = RH.util;
  const S = RH.sound;
  const CAR_COLORS = ['#e8505b', '#f9a03f', '#3fa7d6', '#59cd90', '#8f6ad8', '#f47fb4'];

  class TrainGame {
    constructor() {
      this.id = 'train';
      this.name = 'Tàu hoả';
      this.icon = '🚂';
      this.tl = new RH.Timeline();
      this.time = 0;
      this.w = 800; this.h = 500;
      this.cars = [];
      this.smoke = [];
      this.sparks = [];
      this.riders = [];
      this.X = 0;
      this.lastX = 0;
      this.speed = 0;
      this.dist = 0;
    }

    setup(names) {
      this.tl.clear();
      this.cars = names.map((name, i) => ({
        name, label: short(name), color: CAR_COLORS[i % CAR_COLORS.length], look: RH.art.look(),
        empty: false, hot: false,
      }));
      this.riders = [];
      this.bubble = null;
      this.braking = false;
      this.X = this.lastX = this.w * 0.85;
    }

    resize(w, h) {
      this.X *= w / this.w;
      this.lastX = this.X;
      this.w = w; this.h = h;
    }

    geo() {
      const { w, h } = this;
      const s = clamp(Math.min(w / 1000, h / 520), 0.55, 1.5);
      return { s, locoW: 150 * s, carW: 124 * s, gap: 10 * s, carH: 64 * s, trackY: h * 0.66, px: w * 0.5 };
    }

    step(g = this.geo()) { return g.carW + g.gap; }
    carCenter(i, g = this.geo()) { return this.X - g.locoW - g.gap - i * this.step(g) - g.carW / 2; }
    xForCar(i, g = this.geo()) { return g.px + g.locoW + g.gap + i * this.step(g) + g.carW / 2; }
    trainLen(g = this.geo()) { return g.locoW + this.cars.length * this.step(g); }

    teleport(x) { this.X = this.lastX = x; }

    update(dt) {
      this.time += dt;
      this.tl.update(dt);
      const g = this.geo();
      const dx = this.X - this.lastX;
      this.lastX = this.X;
      this.speed = dt > 0 ? dx / dt : 0;
      this.dist += Math.abs(dx);
      if (this.dist > this.step(g) / 2) { this.dist = 0; if (Math.abs(this.speed) > 5) S.tick(); }

      const chimX = this.X - g.locoW * 0.3, chimY = g.trackY - g.carH * 1.75;
      const moving = Math.abs(this.speed) > 5;
      if (chimX > -60 && chimX < this.w + 60 && Math.random() < dt * (moving ? 14 : 2.5)) {
        this.smoke.push({ x: chimX, y: chimY, r: 7 * g.s, life: 1, vx: -this.speed * 0.15 + rand(-8, 8), vy: -rand(25, 50) });
      }
      for (const p of this.smoke) { p.x += p.vx * dt; p.y += p.vy * dt; p.r += dt * 16 * g.s; p.life -= dt * 0.5; }
      this.smoke = this.smoke.filter((p) => p.life > 0);

      if (this.braking && Math.abs(this.speed) > 20) {
        for (let i = 0; i < 3; i++) {
          this.sparks.push({ x: rand(0, this.w), y: g.trackY - 2, vx: rand(-120, 40), vy: -rand(40, 140), life: rand(0.2, 0.45) });
        }
      }
      for (const p of this.sparks) { p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 500 * dt; p.life -= dt; }
      this.sparks = this.sparks.filter((p) => p.life > 0);
      for (const r of this.riders) if (r.t < 1) r.t = Math.min(1, r.t + dt / 0.9);
    }

    say(text, dur = 1.6) { this.bubble = { text, until: this.time + dur }; }

    async play(winners, onPick) {
      let cur = null;
      for (let i = 0; i < winners.length; i++) {
        const k = this.cars.findIndex((c) => c.name === winners[i]);
        if (k < 0) continue;
        const g = this.geo();
        const target = this.xForCar(k, g);
        if (cur !== null && k > cur) {
          // The next chosen car is further back: just pull forward.
          await this.arrive(k, target, clamp(1.6 + 0.3 * (k - cur), 2.2, 5), ease.inOut);
        } else {
          if (this.X - this.trainLen(g) < this.w) {
            S.whistle();
            await this.tl.wait(0.5);
            const sx = this.X;
            await this.tl.tween(2.2, (t) => (this.X = lerp(sx, this.w + this.trainLen(g) + 40, ease.inCubic(t))));
          }
          this.teleport(Math.min(-20, target - this.w * 1.6));
          await this.tl.wait(0.3);
          S.whistle();
          await this.arrive(k, target, 5.5, ease.outQuart);
        }
        cur = k;
        await this.unload(k, i, onPick);
      }
      await this.tl.wait(0.6);
    }

    async arrive(k, target, dur, fn) {
      const step = this.step();
      let stop = target;
      const opts = [];
      if (k > 0) opts.push(-1);
      if (k < this.cars.length - 1) opts.push(1);
      const fake = RH.settings.drama && opts.length && Math.random() < 0.65;
      const d = fake ? pick(opts) : 0;
      stop += d * step;
      const sx = this.X;
      this.braking = false;
      await this.tl.tween(dur, (t) => {
        this.X = lerp(sx, stop, fn(t));
        if (t > 0.55 && t < 0.95 && !this.braking) { this.braking = true; S.screech(); }
        if (t >= 0.95) this.braking = false;
      });
      this.braking = false;
      if (fake) {
        const wrong = this.cars[k + d];
        wrong.hot = true;
        await this.tl.wait(0.7);
        S.uhoh();
        this.say(d > 0 ? pick(['📢 Ối, quá ga rồi! Lùi lại…', '📢 Lố một toa, xin lỗi!']) : pick(['📢 Ơ… chưa tới ga!', '📢 Nhầm toa rồi, nhích thêm tí!']));
        await this.tl.wait(0.9);
        wrong.hot = false;
        await this.tl.tween(1.2, (t) => (this.X = lerp(stop, target, ease.inOut(t))));
      }
    }

    async unload(k, i, onPick) {
      const g = this.geo();
      const c = this.cars[k];
      c.hot = true;
      RH.fx.shake(1);
      await this.tl.wait(0.4);
      c.empty = true;
      const side = i % 2 ? 1 : -1;
      this.riders.push({
        name: c.name, label: c.label, look: c.look, t: 0,
        fx0: 0, fx1: side * (95 + Math.floor(i / 2) * 58) / 1000,
      });
      S.pop();
      await this.tl.wait(0.95);
      S.ding();
      onPick(c.name, i);
      c.hot = false;
      await this.tl.wait(0.8);
    }

    // ---------- drawing ----------
    draw(ctx, w, h) {
      const g = this.geo();
      const { s, trackY, px } = g;
      const sky = ctx.createLinearGradient(0, 0, 0, trackY);
      sky.addColorStop(0, '#8fd0f5');
      sky.addColorStop(1, '#e6f6ff');
      ctx.fillStyle = sky;
      ctx.fillRect(0, 0, w, trackY);
      ctx.fillStyle = '#fff6c2';
      ctx.beginPath(); ctx.arc(w * 0.86, h * 0.12, 30 * s, 0, Math.PI * 2); ctx.fill();
      // hills
      ctx.fillStyle = '#9dd39a';
      for (let i = -1; i < 6; i++) {
        ctx.beginPath(); ctx.ellipse(i * w * 0.22 + 60, trackY - 20 * s, w * 0.16, h * 0.2, 0, Math.PI, 0); ctx.fill();
      }
      ctx.fillStyle = '#7cc47f';
      for (let i = -1; i < 5; i++) {
        ctx.beginPath(); ctx.ellipse(i * w * 0.27 + 160, trackY - 10 * s, w * 0.2, h * 0.13, 0, Math.PI, 0); ctx.fill();
      }
      this.drawStation(ctx, g);
      // ground + track
      ctx.fillStyle = '#6dbb6a';
      ctx.fillRect(0, trackY, w, h - trackY);
      for (let i = 0; i < 26; i++) {
        const fx = (i * 157) % w, fy = trackY + 70 * s + ((i * 61) % Math.max(1, h - trackY - 80 * s));
        if (i % 3 === 0) {
          ctx.fillStyle = '#5aa95a';
          ctx.beginPath(); ctx.arc(fx, fy, 14 * s, 0, Math.PI * 2); ctx.arc(fx + 14 * s, fy + 2 * s, 11 * s, 0, Math.PI * 2); ctx.fill();
        } else {
          ctx.fillStyle = ['#ffd23f', '#ff8fa3', '#fff'][i % 3];
          ctx.beginPath(); ctx.arc(fx, fy, 3.5 * s, 0, Math.PI * 2); ctx.fill();
        }
      }
      ctx.fillStyle = '#9b8d7c';
      ctx.fillRect(0, trackY - 2 * s, w, 10 * s);
      ctx.fillStyle = '#6b4f3a';
      for (let x = 0; x < w; x += 22 * s) ctx.fillRect(x, trackY - 1 * s, 12 * s, 5 * s);
      ctx.fillStyle = '#555c66';
      ctx.fillRect(0, trackY - 3 * s, w, 3 * s);

      this.drawTrain(ctx, g);
      for (const p of this.smoke) {
        ctx.fillStyle = `rgba(240,240,245,${0.7 * p.life})`;
        ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2); ctx.fill();
      }
      for (const p of this.sparks) {
        ctx.fillStyle = `rgba(255,${180 + Math.random() * 70},60,${p.life * 2})`;
        ctx.fillRect(p.x, p.y, 3, 3);
      }
      // platform (in front of the track)
      const pw = Math.min(w * 0.8, 640 * s);
      ctx.fillStyle = '#c9c2b5';
      ctx.fillRect(px - pw / 2, trackY + 6 * s, pw, 44 * s);
      ctx.fillStyle = '#e0dbd1';
      ctx.fillRect(px - pw / 2, trackY + 6 * s, pw, 8 * s);
      ctx.fillStyle = '#ffd23f';
      ctx.fillRect(px - pw / 2, trackY + 12 * s, pw, 3 * s);
      ctx.fillStyle = '#a69e8f';
      ctx.fillRect(px - pw / 2, trackY + 50 * s, pw, 6 * s);
      for (const r of this.riders) this.drawRider(ctx, r, g);
      if (this.bubble && this.time < this.bubble.until) {
        const sx = px - 150 * s, sy = trackY - g.carH - 175 * s;
        RH.util.bubble(ctx, sx - 40 * s, sy - 34 * s, this.bubble.text, Math.max(13, 17 * s), sx, sy - 6 * s);
      }
    }

    drawStation(ctx, g) {
      const { s, trackY, px, carH } = g;
      const bw = 380 * s, bh = 150 * s, by = trackY - carH - 150 * s;
      ctx.fillStyle = '#f2e3c6';
      ctx.fillRect(px - bw / 2, by, bw, bh + carH);
      ctx.fillStyle = '#e2cfa8';
      for (let i = 0; i < 5; i++) ctx.fillRect(px - bw / 2 + 20 * s + i * 72 * s, by + 50 * s, 40 * s, 55 * s);
      ctx.fillStyle = '#c0533f';
      ctx.beginPath();
      ctx.moveTo(px - bw / 2 - 20 * s, by + 4 * s); ctx.lineTo(px, by - 40 * s); ctx.lineTo(px + bw / 2 + 20 * s, by + 4 * s);
      ctx.closePath(); ctx.fill();
      // sign
      ctx.fillStyle = '#1b2240';
      roundRect(ctx, px - 110 * s, by + 10 * s, 220 * s, 32 * s, 6 * s); ctx.fill();
      ctx.fillStyle = '#ffd23f';
      ctx.font = font(17 * s, 800);
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('GA LÊN BẢNG', px, by + 27 * s);
      // clock
      ctx.fillStyle = '#fff';
      ctx.beginPath(); ctx.arc(px, by - 14 * s, 12 * s, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = '#1b2240'; ctx.lineWidth = 2;
      ctx.stroke();
      ctx.beginPath(); ctx.moveTo(px, by - 14 * s); ctx.lineTo(px, by - 22 * s); ctx.moveTo(px, by - 14 * s); ctx.lineTo(px + 6 * s, by - 14 * s); ctx.stroke();
      // loudspeaker
      const sx = px - 150 * s, sy = trackY - carH - 175 * s;
      ctx.fillStyle = '#566';
      ctx.beginPath(); ctx.moveTo(sx - 6 * s, sy - 4 * s); ctx.lineTo(sx + 8 * s, sy - 10 * s); ctx.lineTo(sx + 8 * s, sy + 6 * s); ctx.lineTo(sx - 6 * s, sy + 2 * s); ctx.fill();
      // stop marker hanging over the platform
      ctx.strokeStyle = '#555';
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(px, by + bh * 0.72); ctx.lineTo(px, trackY - carH - 34 * s); ctx.stroke();
      ctx.fillStyle = '#ff3b5c';
      ctx.beginPath();
      ctx.moveTo(px - 12 * s, trackY - carH - 34 * s); ctx.lineTo(px + 12 * s, trackY - carH - 34 * s); ctx.lineTo(px, trackY - carH - 18 * s);
      ctx.closePath(); ctx.fill();
    }

    drawWheel(ctx, x, y, r) {
      ctx.fillStyle = '#2b2b33';
      ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = '#9aa0aa';
      ctx.lineWidth = Math.max(1, r * 0.18);
      const a = this.X / r;
      ctx.beginPath();
      for (let i = 0; i < 3; i++) {
        const t = a + (i * Math.PI) / 3;
        ctx.moveTo(x - Math.cos(t) * r * 0.75, y - Math.sin(t) * r * 0.75);
        ctx.lineTo(x + Math.cos(t) * r * 0.75, y + Math.sin(t) * r * 0.75);
      }
      ctx.stroke();
    }

    drawTrain(ctx, g) {
      const { s, carW, carH, trackY, gap, locoW } = g;
      const w = this.w;
      const bottom = trackY - 10 * s;
      for (let i = 0; i < this.cars.length; i++) {
        const cx = this.carCenter(i, g);
        if (cx < -carW || cx > w + carW) continue;
        const c = this.cars[i];
        const x = cx - carW / 2, top = bottom - carH;
        ctx.fillStyle = '#444';
        ctx.fillRect(x + carW, bottom - 14 * s, gap, 5 * s);
        ctx.fillStyle = c.color;
        roundRect(ctx, x, top, carW, carH, 7 * s); ctx.fill();
        ctx.fillStyle = 'rgba(0,0,0,0.15)';
        ctx.fillRect(x, bottom - 10 * s, carW, 10 * s);
        ctx.fillStyle = '#3a3f4b';
        roundRect(ctx, x - 3 * s, top - 6 * s, carW + 6 * s, 9 * s, 4 * s); ctx.fill();
        // window with passenger
        const wx = x + carW * 0.14, wy = top + 7 * s, ww = carW * 0.72, wh = carH * 0.36;
        ctx.fillStyle = '#d5efff';
        roundRect(ctx, wx, wy, ww, wh, 4 * s); ctx.fill();
        if (!c.empty) {
          ctx.save();
          roundRect(ctx, wx, wy, ww, wh, 4 * s); ctx.clip();
          const bounce = Math.abs(this.speed) > 5 ? Math.sin(this.time * 18 + i) * 1.2 * s : 0;
          RH.art.bust(ctx, cx, wy + wh + 6 * s + bounce, s * 0.72, c.look, { expr: c.hot ? 'happy' : 'normal' });
          ctx.restore();
        }
        // name plate
        const fs = clamp(carH * 0.2, 9, 17);
        const ny = top + carH * 0.5, nh = carH * 0.3;
        ctx.fillStyle = c.hot ? '#ffd23f' : c.empty ? 'rgba(255,255,255,0.45)' : '#fff';
        roundRect(ctx, x + carW * 0.06, ny, carW * 0.88, nh, 4 * s); ctx.fill();
        ctx.font = font(fs, 800);
        ctx.fillStyle = c.empty ? 'rgba(27,34,64,0.45)' : '#1b2240';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(fitText(ctx, c.label, carW * 0.82), cx, ny + nh / 2 + 1);
        this.drawWheel(ctx, cx - carW * 0.3, trackY - 9 * s, 9 * s);
        this.drawWheel(ctx, cx + carW * 0.3, trackY - 9 * s, 9 * s);
      }
      // locomotive (front at X, facing right)
      const fx = this.X;
      if (fx > -locoW - 40 && fx - locoW < w + 40) {
        const lx = fx - locoW;
        ctx.fillStyle = '#c62f3a';
        roundRect(ctx, lx, bottom - carH * 1.3, locoW * 0.36, carH * 1.3, 6 * s); ctx.fill();
        ctx.fillStyle = '#2a2f3a';
        roundRect(ctx, lx - 4 * s, bottom - carH * 1.3 - 8 * s, locoW * 0.36 + 8 * s, 10 * s, 4 * s); ctx.fill();
        ctx.fillStyle = '#d5efff';
        roundRect(ctx, lx + locoW * 0.07, bottom - carH * 1.12, locoW * 0.22, carH * 0.38, 4 * s); ctx.fill();
        ctx.fillStyle = '#2a2f3a';
        roundRect(ctx, lx + locoW * 0.34, bottom - carH * 0.82, locoW * 0.58, carH * 0.82, carH * 0.3); ctx.fill();
        ctx.fillStyle = '#ffd23f';
        ctx.fillRect(lx + locoW * 0.36, bottom - carH * 0.5, locoW * 0.54, 4 * s);
        ctx.fillStyle = '#2a2f3a';
        ctx.fillRect(fx - locoW * 0.36, bottom - carH * 1.6, 16 * s, carH * 0.8);
        ctx.fillRect(fx - locoW * 0.36 - 4 * s, bottom - carH * 1.65, 24 * s, 8 * s);
        ctx.fillStyle = '#ffe28a';
        ctx.beginPath(); ctx.arc(fx - 6 * s, bottom - carH * 0.55, 6 * s, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#c62f3a';
        ctx.beginPath(); ctx.moveTo(fx - 8 * s, bottom - 8 * s); ctx.lineTo(fx + 10 * s, bottom + 4 * s); ctx.lineTo(fx - 8 * s, bottom + 4 * s); ctx.fill();
        this.drawWheel(ctx, lx + locoW * 0.18, trackY - 13 * s, 13 * s);
        this.drawWheel(ctx, lx + locoW * 0.5, trackY - 13 * s, 13 * s);
        this.drawWheel(ctx, lx + locoW * 0.78, trackY - 10 * s, 10 * s);
      }
    }

    drawRider(ctx, r, g) {
      const { s, trackY, px, carH } = g;
      const t = ease.outCubic(r.t);
      const x = lerp(px, px + r.fx1 * 1000 * s, t);
      const y = lerp(trackY - carH * 0.55, trackY + 34 * s, t) - Math.sin(Math.PI * r.t) * 50 * s;
      const k = 1.15 * s;
      RH.art.student(ctx, x, y, k, r.look, { t: this.time, arms: 'up', expr: 'happy', noShadow: r.t < 1 });
      const fs = Math.max(12, 15 * s);
      ctx.font = font(fs, 800);
      const tw = ctx.measureText(r.label).width + fs;
      ctx.fillStyle = '#ffd23f';
      roundRect(ctx, x - tw / 2, y - 50 * k - fs * 1.5, tw, fs * 1.5, fs * 0.5); ctx.fill();
      ctx.fillStyle = '#1b2240';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(r.label, x, y - 50 * k - fs * 0.75 + 1);
    }
  }

  RH.games.push(new TrainGame());
})(window.RH);
