// Lightning: a storm rolls in, static charge hops between students, and a bolt strikes the chosen one.
(function (RH) {
  const { rand, pick, shuffle, lerp, ease, roundRect, fitText, short, font, clamp } = RH.util;
  const S = RH.sound;
  const HORIZON = 0.42;

  // Jagged bolt by midpoint displacement, with a few side branches.
  function makeBolt(x0, y0, x1, y1, spread, depth = 0) {
    let pts = [[x0, y0], [x1, y1]];
    let off = spread;
    for (let i = 0; i < 6; i++) {
      const next = [pts[0]];
      for (let j = 1; j < pts.length; j++) {
        const [ax, ay] = pts[j - 1], [bx, by] = pts[j];
        next.push([(ax + bx) / 2 + rand(-off, off), (ay + by) / 2 + rand(-off, off) * 0.3]);
        next.push([bx, by]);
      }
      pts = next;
      off *= 0.55;
    }
    const bolts = [{ pts, w: depth ? 0.5 : 1 }];
    if (depth < 1) {
      for (let k = 0; k < 3; k++) {
        const i = Math.floor(rand(0.2, 0.7) * pts.length);
        const [bx, by] = pts[i];
        const len = Math.hypot(x1 - x0, y1 - y0) * rand(0.15, 0.3);
        const a = Math.atan2(y1 - y0, x1 - x0) + rand(-0.9, 0.9);
        bolts.push(...makeBolt(bx, by, bx + Math.cos(a) * len, by + Math.sin(a) * len, spread * 0.4, depth + 1));
      }
    }
    return bolts;
  }

  class LightningGame {
    constructor() {
      this.id = 'lightning';
      this.name = 'Sét đánh';
      this.icon = '⚡';
      this.tl = new RH.Timeline();
      this.time = 0;
      this.w = 800; this.h = 500;
      this.people = [];
      this.rain = [];
      this.bolts = [];
      this.sparks = [];
      this.smoke = [];
    }

    setup(names) {
      this.tl.clear();
      const r = RH.util.seeded(names.length * 7 + 3);
      const n = names.length;
      const cols = clamp(Math.ceil(Math.sqrt(n * 2.2)), 1, 9);
      const rows = Math.ceil(n / cols);
      const order = shuffle(names);
      this.people = order.map((name, i) => {
        const row = Math.floor(i / cols), col = i % cols;
        const inRow = Math.min(cols, n - row * cols);
        return {
          name, label: short(name), look: RH.art.look(),
          fx: (col + 0.5 + (cols - inRow) / 2) / cols + (r() - 0.5) * 0.04,
          fy: rows === 1 ? 0.5 : row / (rows - 1) + (r() - 0.5) * 0.06,
          ph: r() * 6, charge: 0, fried: 0, umbrella: 0, hot: false,
        };
      });
      this.storm = 0;
      this.rainAmt = 0;
      this.clear = 0;
      this.flashA = 0;
      this.bolts = [];
      this.sparks = [];
      this.smoke = [];
      this.rain = [];
      this.bubble = null;
      this.cursor = null;
    }

    resize(w, h) { this.w = w; this.h = h; }

    pos(p) {
      const { w, h } = this;
      const fy = clamp(p.fy, 0, 1);
      const y = h * (0.56 + fy * 0.36);
      const s = (0.75 + fy * 0.45) * clamp(Math.min(w / 900, h / 520), 0.6, 1.5);
      return { x: w * (0.06 + clamp(p.fx, 0, 1) * 0.88), y, s };
    }

    update(dt) {
      this.time += dt;
      this.tl.update(dt);
      this.flashA = Math.max(0, this.flashA - dt * 3.5);
      // rain
      const want = Math.floor(this.rainAmt * 260);
      while (this.rain.length < want) this.rain.push({ x: rand(-50, this.w + 50), y: rand(-this.h, 0), v: rand(600, 900) });
      if (this.rain.length > want) this.rain.length = want;
      for (const d of this.rain) {
        d.y += d.v * dt; d.x -= d.v * 0.25 * dt;
        if (d.y > this.h) { d.y = rand(-60, 0); d.x = rand(0, this.w + 100); }
      }
      for (const b of this.bolts) b.life -= dt;
      this.bolts = this.bolts.filter((b) => b.life > 0);
      for (const p of this.sparks) { p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 300 * dt; p.life -= dt; }
      this.sparks = this.sparks.filter((p) => p.life > 0);
      for (const p of this.smoke) { p.y -= 30 * dt; p.x += 8 * dt; p.r += 12 * dt; p.life -= dt * 0.5; }
      this.smoke = this.smoke.filter((p) => p.life > 0);
      for (const p of this.people) {
        if (p.fried && Math.random() < dt * 3) {
          const { x, y, s } = this.pos(p);
          this.smoke.push({ x: x + rand(-6, 6) * s, y: y - 52 * s, r: 4 * s, life: 1 });
        }
        if (p.charge > 0.3 && Math.random() < dt * 20 * p.charge) {
          const { x, y, s } = this.pos(p);
          this.sparks.push({ x: x + rand(-14, 14) * s, y: y - rand(10, 50) * s, vx: rand(-60, 60), vy: rand(-80, 0), life: 0.25 });
        }
      }
      // distant sheet lightning while the storm is up
      if (this.storm > 0.8 && !this.busyStrike && Math.random() < dt * 0.35) {
        this.flashA = Math.max(this.flashA, 0.25);
        S.rumble();
      }
    }

    say(text, x, y, dur = 1.6) { this.bubble = { text, x, y, until: this.time + dur }; }

    async play(winners, onPick) {
      const { tl } = this;
      S.rumble();
      await tl.tween(2, (t) => { this.storm = t; this.rainAmt = t; });
      for (let i = 0; i < winners.length; i++) {
        const target = this.people.find((p) => p.name === winners[i]);
        if (!target) continue;
        const pool = this.people.filter((p) => !p.fried);
        const decoys = pool.filter((p) => !winners.includes(p.name));
        const fake = RH.settings.drama && decoys.length && Math.random() < 0.65 ? pick(decoys) : null;
        await this.hop(pool, fake || target);
        if (fake) {
          await this.chargeUp(fake, 0.9);
          // The decoy pops an umbrella; the bolt hits it and jumps to the real target.
          fake.umbrella = 0.01;
          await tl.tween(0.3, (t) => (fake.umbrella = t));
          const fp = this.pos(fake);
          this.say(pick(['Có ô rồi nhé! 😎', 'Hụt rồi nha!', 'Né! 🌂']), fp.x, fp.y - 120 * fp.s);
          await tl.wait(0.4);
          const tipY = fp.y - 92 * fp.s;
          this.strikeAt(fp.x, tipY, false);
          fake.charge = 0;
          this.cursor = target;
          await tl.wait(0.35);
          S.uhoh();
          const tp = this.pos(target);
          this.bolts.push({ parts: makeBolt(fp.x, tipY, tp.x, tp.y - 50 * tp.s, 40), life: 0.45 });
          S.crackle();
          await this.chargeUp(target, 0.5);
        } else {
          await this.chargeUp(target, 1.1);
        }
        const tp = this.pos(target);
        this.strikeAt(tp.x, tp.y - 30 * tp.s, true);
        target.charge = 0;
        target.fried = 1;
        target.hot = true;
        this.cursor = null;
        for (let k = 0; k < 24; k++) this.sparks.push({ x: tp.x, y: tp.y - 30 * tp.s, vx: rand(-220, 220), vy: rand(-260, -40), life: rand(0.3, 0.7) });
        S.ding();
        onPick(target.name, i);
        await tl.wait(1.3);
        if (fake) fake.umbrella = 0;
      }
      // Storm clears, rainbow appears.
      await tl.tween(1.6, (t) => { this.storm = 1 - t; this.rainAmt = 1 - t; this.clear = t; });
      await tl.wait(0.4);
    }

    // Static charge hops between students, slowing down until it lands.
    async hop(pool, land) {
      const hops = Math.min(14, Math.max(6, pool.length));
      let prev = null;
      for (let k = 0; k < hops; k++) {
        let p = pick(pool);
        if (pool.length > 1) while (p === prev) p = pick(pool);
        if (k === hops - 1) p = land;
        prev = p;
        this.cursor = p;
        S.crackle();
        await this.tl.wait(0.07 + Math.pow(k / hops, 2.2) * 0.45);
      }
      this.cursor = land;
    }

    async chargeUp(p, dur) {
      S.noise(dur, { vol: 0.08, freq: 3000, type: 'bandpass', attack: dur * 0.8 });
      await this.tl.tween(dur, (t) => (p.charge = t));
    }

    strikeAt(x, y, big) {
      this.busyStrike = true;
      this.bolts.push({ parts: makeBolt(x + rand(-80, 80), -10, x, y, big ? 90 : 60), life: 0.55 });
      this.flashA = 1;
      S.thunder();
      RH.fx.flash();
      RH.fx.shake(big ? 2 : 1);
      setTimeout(() => (this.busyStrike = false), 1500);
    }

    // ---------- drawing ----------
    draw(ctx, w, h) {
      const st = this.storm;
      const sky = ctx.createLinearGradient(0, 0, 0, h * HORIZON);
      const mix = (a, b, t) => `rgb(${a.map((v, i) => Math.round(lerp(v, b[i], t))).join(',')})`;
      sky.addColorStop(0, mix([118, 190, 240], [28, 32, 52], st));
      sky.addColorStop(1, mix([210, 236, 255], [70, 76, 100], st));
      ctx.fillStyle = sky;
      ctx.fillRect(0, 0, w, h * HORIZON + 2);
      if (this.clear > 0) this.drawRainbow(ctx, w, h);
      this.drawClouds(ctx, w, h, st);
      // hills + field
      ctx.fillStyle = mix([120, 190, 110], [55, 85, 60], st);
      ctx.beginPath();
      ctx.moveTo(0, h * HORIZON + 20);
      for (let x = 0; x <= w; x += 20) ctx.lineTo(x, h * HORIZON + Math.sin(x * 0.008) * 18);
      ctx.lineTo(w, h); ctx.lineTo(0, h); ctx.fill();
      const field = ctx.createLinearGradient(0, h * 0.5, 0, h);
      field.addColorStop(0, mix([140, 205, 120], [62, 98, 66], st));
      field.addColorStop(1, mix([110, 180, 95], [44, 72, 50], st));
      ctx.fillStyle = field;
      ctx.fillRect(0, h * 0.5, w, h * 0.5);
      // lone tree + flagpole for scale
      this.drawTree(ctx, w * 0.93, h * 0.5, h / 500, st);

      const list = this.people.slice().sort((a, b) => a.fy - b.fy);
      for (const p of list) this.drawPerson(ctx, p);
      for (const p of this.smoke) {
        ctx.fillStyle = `rgba(90,90,90,${0.5 * p.life})`;
        ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2); ctx.fill();
      }
      // rain
      if (this.rain.length) {
        ctx.strokeStyle = 'rgba(200,215,255,0.45)';
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        for (const d of this.rain) { ctx.moveTo(d.x, d.y); ctx.lineTo(d.x - 5, d.y + 18); }
        ctx.stroke();
      }
      for (const b of this.bolts) this.drawBolt(ctx, b);
      for (const p of this.sparks) {
        ctx.fillStyle = `rgba(255,${230 + Math.random() * 25},120,${Math.min(1, p.life * 3)})`;
        ctx.fillRect(p.x - 1.5, p.y - 1.5, 3, 3);
      }
      for (const p of list) this.drawTag(ctx, p);
      if (this.cursor) this.drawCursor(ctx, this.cursor);
      if (this.flashA > 0) {
        ctx.fillStyle = `rgba(235,240,255,${this.flashA * 0.75})`;
        ctx.fillRect(0, 0, w, h);
      }
      if (this.bubble && this.time < this.bubble.until) {
        const b = this.bubble;
        RH.util.bubble(ctx, b.x + 30, b.y - 10, b.text, 16, b.x, b.y + 16);
      }
    }

    drawClouds(ctx, w, h, st) {
      for (let layer = 0; layer < 2; layer++) {
        const a = layer ? st : 0.35 + st * 0.5;
        if (a <= 0) continue;
        ctx.fillStyle = layer ? `rgba(45,50,70,${a})` : `rgba(${Math.round(lerp(255, 90, st))},${Math.round(lerp(255, 96, st))},${Math.round(lerp(255, 118, st))},${a})`;
        const n = 7;
        const yb = h * (layer ? 0.06 : 0.12) * (layer ? lerp(-1.5, 1, st) : 1);
        for (let i = 0; i < n + 1; i++) {
          const x = ((i / n) * (w + 200) + this.time * (layer ? 14 : 6)) % (w + 200) - 100;
          const r = h * (layer ? 0.11 : 0.07);
          ctx.beginPath();
          ctx.arc(x, yb, r, 0, Math.PI * 2);
          ctx.arc(x + r * 0.9, yb - r * 0.3, r * 1.1, 0, Math.PI * 2);
          ctx.arc(x + r * 1.9, yb, r * 0.9, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    }

    drawRainbow(ctx, w, h) {
      const cols = ['#ff5a5a', '#ffa94d', '#ffe066', '#69db7c', '#4dabf7', '#9775fa'];
      ctx.save();
      ctx.globalAlpha = this.clear * 0.55;
      ctx.lineWidth = h * 0.018;
      cols.forEach((c, i) => {
        ctx.strokeStyle = c;
        ctx.beginPath();
        ctx.arc(w * 0.55, h * 0.6, h * 0.5 - i * h * 0.018, Math.PI, 0);
        ctx.stroke();
      });
      ctx.restore();
    }

    drawTree(ctx, x, y, s, st) {
      ctx.fillStyle = '#5a3d27';
      ctx.fillRect(x - 5 * s, y - 70 * s, 10 * s, 70 * s);
      ctx.fillStyle = st > 0.5 ? '#2f5a39' : '#3f8f4f';
      for (const [dx, dy, r] of [[0, -95, 30], [-24, -75, 22], [24, -75, 22]]) {
        ctx.beginPath(); ctx.arc(x + dx * s + Math.sin(this.time * 2) * st * 3, y + dy * s, r * s, 0, Math.PI * 2); ctx.fill();
      }
    }

    drawPerson(ctx, p) {
      const { x, y, s } = this.pos(p);
      const charge = p.charge;
      const rainy = this.rainAmt > 0.3 && !p.umbrella;
      const up = charge > 0.2 || p.fried;
      RH.art.student(ctx, x, y, s, p.look, {
        t: this.time, shake: charge > 0 ? Math.sin(this.time * 60) * charge * 1.5 : 0,
        arms: up ? 'up' : rainy ? 'shield' : 'down', expr: up || this.storm > 0.6 ? 'scared' : 'normal',
        hairUp: p.fried ? 0 : charge, fried: !!p.fried,
      });
      if (p.umbrella) {
        const k = ease.outBack(Math.min(1, p.umbrella));
        ctx.save();
        ctx.translate(x, y);
        ctx.strokeStyle = '#333'; ctx.lineWidth = 2 * s;
        ctx.beginPath(); ctx.moveTo(10 * s, -30 * s); ctx.lineTo(10 * s, -92 * s); ctx.stroke();
        ctx.fillStyle = '#ff4d6d';
        ctx.beginPath(); ctx.ellipse(10 * s, -78 * s, 30 * s * k, 16 * s * k, 0, Math.PI, 0); ctx.fill();
        ctx.fillStyle = '#ffd23f';
        ctx.beginPath(); ctx.moveTo(10 * s, -94 * s); ctx.lineTo(10 * s, -78 * s); ctx.lineTo(10 * s + 15 * s * k, -78 * s); ctx.fill();
        ctx.restore();
      }
    }

    drawTag(ctx, p) {
      const { x, y, s } = this.pos(p);
      const fs = clamp(12 * s, 10, 17) * (p.hot ? 1.2 : 1);
      ctx.font = font(fs, 800);
      const label = (p.fried ? '⚡ ' : '') + p.label;
      const tw = ctx.measureText(label).width + fs * 0.9;
      const ty = y - (p.umbrella ? 104 : 62) * s - fs * 1.5;
      ctx.fillStyle = p.hot ? '#ffd23f' : this.cursor === p ? '#fff3b0' : 'rgba(255,255,255,0.93)';
      roundRect(ctx, x - tw / 2, ty, tw, fs * 1.5, fs * 0.5); ctx.fill();
      ctx.fillStyle = '#1b2240';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(label, x, ty + fs * 0.78);
    }

    drawCursor(ctx, p) {
      const { x, y, s } = this.pos(p);
      ctx.save();
      ctx.strokeStyle = `rgba(255,240,120,${0.6 + 0.4 * Math.sin(this.time * 30)})`;
      ctx.lineWidth = 3;
      ctx.shadowColor = '#ffe066';
      ctx.shadowBlur = 14;
      ctx.beginPath(); ctx.ellipse(x, y, 22 * s, 7 * s, 0, 0, Math.PI * 2); ctx.stroke();
      // little zigzag above the head
      ctx.beginPath();
      const top = y - 80 * s - (p.umbrella ? 40 * s : 0);
      ctx.moveTo(x - 4 * s, top - 18 * s); ctx.lineTo(x + 3 * s, top - 9 * s); ctx.lineTo(x - 2 * s, top - 7 * s); ctx.lineTo(x + 4 * s, top + 2 * s);
      ctx.stroke();
      ctx.restore();
    }

    drawBolt(ctx, b) {
      const a = Math.min(1, b.life * 3) * (Math.random() < 0.15 ? 0.4 : 1);
      ctx.save();
      ctx.lineJoin = 'round';
      ctx.lineCap = 'round';
      for (const [width, color] of [[14, `rgba(140,170,255,${0.25 * a})`], [6, `rgba(190,210,255,${0.7 * a})`], [2.2, `rgba(255,255,255,${a})`]]) {
        ctx.strokeStyle = color;
        for (const part of b.parts) {
          ctx.lineWidth = width * part.w;
          ctx.beginPath();
          part.pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
          ctx.stroke();
        }
      }
      ctx.restore();
    }
  }

  RH.games.push(new LightningGame());
})(window.RH);
