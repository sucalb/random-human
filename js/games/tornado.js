// Tornado: a twister crosses the farm, chases students and spins the chosen ones up into the sky.
(function (RH) {
  const { rand, pick, lerp, ease, clamp, font, roundRect } = RH.util;
  const S = RH.sound;
  const BAND = [0.68, 0.95];
  const ANIMALS = ['🐄', '🐖', '🐔', '🐑', '🐐', '🐓', '🦆', '🐕'];
  const DEBRIS = ['🍂', '🍃', '📄', '🍂', '🧢', '🌾', '📄', '🍃'];

  class TornadoGame {
    constructor() {
      this.id = 'tornado';
      this.name = 'Lốc xoáy';
      this.icon = '🌪️';
      this.tl = new RH.Timeline();
      this.crowd = new RH.Crowd(BAND[0], BAND[1]);
      this.time = 0;
      this.w = 800; this.h = 500;
      this.debris = [];
      this.texts = [];
    }

    setup(names) {
      this.tl.clear();
      S.wind(false);
      this.crowd.set(names, this.w);
      for (const p of this.crowd.people) { p.spin = 0; p.dizzy = 0; }
      this.animals = Array.from({ length: 6 }, (_, i) => ({
        e: ANIMALS[i % ANIMALS.length], x: rand(30, this.w - 30), ny: rand(0.64, 0.72), dir: Math.random() < 0.5 ? -1 : 1,
        speed: rand(8, 20), state: 'walk', spin: 0,
      }));
      this.tw = { x: this.w * 0.5, strength: 0, target: null };
      this.storm = 0;
      this.debris = [];
      this.texts = [];
      this.bubble = null;
    }

    resize(w, h) {
      const k = w / this.w;
      this.crowd.resize(k);
      for (const a of this.animals || []) a.x *= k;
      if (this.tw) this.tw.x *= k;
      this.w = w; this.h = h;
    }

    sc() { return clamp(Math.min(this.w / 900, this.h / 520), 0.6, 1.5); }
    groundY() { return this.h * 0.86; }

    // Funnel centre and radius at height fraction f (0 = ground, 1 = top of screen).
    funnel(f) {
      const tw = this.tw, s = this.sc();
      const x = tw.x + Math.sin(this.time * 2 + f * 4) * f * 30 * s + f * f * 40 * s;
      const y = lerp(this.groundY(), -30, f);
      const r = (14 + Math.pow(f, 1.5) * 150) * s * tw.strength;
      return { x, y, r };
    }

    update(dt) {
      this.time += dt;
      this.tl.update(dt);
      const tw = this.tw, s = this.sc();
      const active = tw.strength > 0.3;
      this.crowd.update(dt, this.w, this.h, active, active ? { x: tw.x, y: this.groundY(), r: 220 * s } : null);
      for (const a of this.animals) {
        if (a.state !== 'walk') continue;
        if (active && Math.abs(a.x - tw.x) < 200 * s) a.dir = a.x < tw.x ? -1 : 1;
        a.x += a.dir * a.speed * (active ? 4 : 1) * dt;
        if (a.x < 20 || a.x > this.w - 20) a.dir *= -1;
        a.x = clamp(a.x, 20, this.w - 20);
      }
      // steer toward the current target
      if (tw.target) {
        const tx = typeof tw.target === 'number' ? tw.target : tw.target.x;
        const d = tx - tw.x;
        tw.x += Math.sign(d) * Math.min(Math.abs(d), 150 * s * dt);
      }
      // debris orbiting the funnel
      const want = Math.round(28 * tw.strength);
      while (this.debris.length < want) this.debris.push({ e: pick(DEBRIS), a: rand(0, 6.28), f: rand(0, 0.9), sp: rand(3, 6), size: rand(12, 20) });
      if (this.debris.length > want) this.debris.length = want;
      for (const d of this.debris) { d.a += d.sp * dt; d.f += dt * 0.12; if (d.f > 1) d.f = 0; }
      for (const t of this.texts) t.life -= dt;
      this.texts = this.texts.filter((t) => t.life > 0);
      for (const p of this.crowd.people) p.dizzy = Math.max(0, p.dizzy - dt);
    }

    async play(winners, onPick) {
      const { tl } = this, tw = this.tw;
      S.wind(true, 0.2);
      await tl.tween(1.4, (t) => (this.storm = t));
      tw.x = rand(this.w * 0.3, this.w * 0.7);
      S.wind(true, 0.8);
      await tl.tween(1.4, (t) => (tw.strength = ease.outCubic(t)));
      // the first victim is always a cow, for science
      const cow = this.animals.find((a) => a.e === '🐄');
      if (cow) {
        tw.target = cow;
        await this.until(() => Math.abs(cow.x - tw.x) < 20, 4);
        await this.suck(cow, 1, true);
      }
      for (let i = 0; i < winners.length; i++) {
        const target = this.crowd.people.find((p) => p.name === winners[i] && p.state === 'walk');
        if (!target) continue;
        for (let k = 0; k < 2; k++) {
          tw.target = rand(this.w * 0.1, this.w * 0.9);
          await tl.wait(1.1);
        }
        if (RH.settings.drama && Math.random() < 0.7) {
          const decoys = this.crowd.people.filter((p) => p.state === 'walk' && !winners.includes(p.name));
          if (decoys.length) await this.fakeOut(pick(decoys));
        }
        tw.target = target;
        await this.until(() => Math.abs(target.x - tw.x) < 18, 5);
        S.wind(true, 1);
        await this.suck(target, 1, false);
        target.state = 'gone';
        RH.fx.shake(2);
        S.ding();
        onPick(target.name, i);
        S.wind(true, 0.8);
        await tl.wait(0.8);
      }
      tw.target = this.w + 300;
      await tl.wait(1.2);
      S.wind(true, 0.2);
      await tl.tween(1.2, (t) => { tw.strength = 1 - t; this.storm = 1 - t; });
      S.wind(false);
    }

    async until(fn, max) {
      let t = 0;
      while (!fn() && t < max) { await this.tl.wait(0.05); t += 0.05; }
    }

    // Spin something up the funnel to height fraction `top`.
    async suck(obj, top, isAnimal) {
      obj.state = 'sucked';
      obj.lift = 0;
      obj.orbitA = 0;
      await this.tl.tween(top >= 1 ? 1.8 : 1.1, (t) => { obj.lift = ease.inCubic(t) * top; obj.orbitA = t * 18; });
      if (isAnimal) {
        obj.state = 'gone';
        this.texts.push({ text: 'Moooo~', x: this.funnel(0.8).x, y: 60, life: 1.2, color: '#fff' });
      }
    }

    // Lifts a decoy halfway, then spits them out onto the hay bale.
    async fakeOut(d) {
      const tw = this.tw;
      tw.target = d;
      await this.until(() => Math.abs(d.x - tw.x) < 18, 4);
      await this.suck(d, 0.45, false);
      S.uhoh();
      const start = this.objPos(d);
      const hay = this.hayPos();
      d.state = 'flung';
      tw.target = null;
      await this.tl.tween(1.1, (t) => {
        d.fx = lerp(start.x, hay.x, t);
        d.fy = lerp(start.y, hay.y, t) - Math.sin(Math.PI * t) * 80;
        d.spin = t * 12;
      });
      RH.fx.shake(1);
      d.state = 'walk';
      d.x = hay.x;
      d.ny = clamp(hay.y / this.h + 0.06, BAND[0], BAND[1]);
      d.speed = 0;
      d.dizzy = 2.4;
      d.spin = 0;
      this.bubble = { text: pick(['Phù! Rơi vào đống rơm 🌾', 'Chóng mặt quá… 😵‍💫', 'Hú hồn!']), x: hay.x, y: hay.y - 60, until: this.time + 1.8 };
      await this.tl.wait(1.2);
      d.speed = 30;
    }

    hayPos() { return { x: this.w * 0.82, y: this.h * 0.66 }; }

    objPos(o) {
      if (o.state === 'flung') return { x: o.fx, y: o.fy };
      const f = this.funnel(Math.max(0.02, o.lift));
      const a = o.orbitA;
      return { x: f.x + Math.cos(a) * f.r * 0.8, y: f.y + Math.sin(a) * f.r * 0.15, front: Math.sin(a) > 0 };
    }

    // ---------- drawing ----------
    draw(ctx, w, h) {
      const s = this.sc(), st = this.storm;
      const sky = ctx.createLinearGradient(0, 0, 0, h * 0.62);
      const mix = (a, b) => `rgb(${a.map((v, i) => Math.round(lerp(v, b[i], st))).join(',')})`;
      sky.addColorStop(0, mix([120, 196, 240], [58, 70, 72]));
      sky.addColorStop(1, mix([220, 240, 250], [120, 138, 118]));
      ctx.fillStyle = sky;
      ctx.fillRect(0, 0, w, h * 0.62);
      // hills, fields
      ctx.fillStyle = mix([150, 205, 120], [90, 120, 80]);
      ctx.beginPath(); ctx.moveTo(0, h * 0.62);
      for (let x = 0; x <= w; x += 20) ctx.lineTo(x, h * 0.55 + Math.sin(x * 0.005) * h * 0.03);
      ctx.lineTo(w, h * 0.62); ctx.fill();
      this.drawBarn(ctx, w * 0.1, h * 0.62, s);
      this.drawWindmill(ctx, w * 0.62, h * 0.58, s * 0.8);
      const field = ctx.createLinearGradient(0, h * 0.6, 0, h);
      field.addColorStop(0, mix([196, 214, 120], [130, 140, 90]));
      field.addColorStop(1, mix([214, 190, 110], [140, 125, 85]));
      ctx.fillStyle = field;
      ctx.fillRect(0, h * 0.6, w, h * 0.4);
      // fence
      ctx.fillStyle = '#e8d8b8';
      for (let x = 10; x < w; x += 46 * s) ctx.fillRect(x, h * 0.6 - 18 * s, 5 * s, 22 * s);
      ctx.fillRect(0, h * 0.6 - 14 * s, w, 3 * s);
      ctx.fillRect(0, h * 0.6 - 6 * s, w, 3 * s);
      // hay bale
      const hay = this.hayPos();
      ctx.fillStyle = '#e6b84f';
      roundRect(ctx, hay.x - 40 * s, hay.y - 22 * s, 80 * s, 34 * s, 10 * s); ctx.fill();
      ctx.strokeStyle = 'rgba(160,110,30,0.6)';
      ctx.lineWidth = 2;
      for (let i = -2; i <= 2; i++) { ctx.beginPath(); ctx.moveTo(hay.x + i * 14 * s, hay.y - 20 * s); ctx.lineTo(hay.x + i * 14 * s, hay.y + 10 * s); ctx.stroke(); }

      // animals (emoji)
      for (const a of this.animals) {
        if (a.state !== 'walk') continue;
        ctx.save();
        ctx.translate(a.x, a.ny * h);
        ctx.scale(-a.dir, 1);
        ctx.font = `${Math.round(26 * s)}px serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'bottom';
        ctx.fillText(a.e, 0, 0);
        ctx.restore();
      }

      const tw = this.tw;
      // debris behind the funnel
      if (tw.strength > 0) this.drawDebris(ctx, false);
      for (const o of [...this.animals, ...this.crowd.people]) if (o.state === 'sucked' && !this.objPos(o).front) this.drawSucked(ctx, o);
      if (tw.strength > 0) this.drawFunnel(ctx, s);

      const ppl = this.crowd.sorted();
      for (const p of ppl) {
        if (p.state === 'gone' || p.state === 'sucked') continue;
        const ps = this.crowd.scale(p, h);
        if (p.state === 'flung') {
          RH.art.student(ctx, p.fx, p.fy, ps, p.look, { t: this.time, kick: true, arms: 'up', expr: 'scared', rot: p.spin, noShadow: true });
          continue;
        }
        RH.art.student(ctx, p.x, p.ny * h, ps, p.look, {
          phase: p.phase, t: this.time, arms: tw.strength > 0.3 ? 'up' : 'swing',
          expr: tw.strength > 0.3 || p.dizzy ? 'scared' : 'normal', rot: p.dizzy ? Math.sin(this.time * 7) * 0.15 : 0,
        });
        if (p.dizzy) {
          ctx.font = `${Math.round(16 * ps)}px serif`;
          ctx.textAlign = 'center';
          ctx.fillText('💫', p.x + Math.cos(this.time * 8) * 8 * ps, p.ny * h - 58 * ps);
        }
      }
      for (const o of [...this.animals, ...this.crowd.people]) if (o.state === 'sucked' && this.objPos(o).front) this.drawSucked(ctx, o);
      if (tw.strength > 0) this.drawDebris(ctx, true);
      for (const p of ppl) {
        if (p.state === 'gone' || p.state === 'sucked' || p.state === 'flung') continue;
        const ps = this.crowd.scale(p, h);
        RH.art.tag(ctx, p.x, p.ny * h - 52 * ps, p.label, ps, tw.target === p);
      }
      // wind streaks
      if (st > 0) {
        ctx.strokeStyle = `rgba(255,255,255,${0.25 * st})`;
        ctx.lineWidth = 1.5;
        for (let i = 0; i < 24; i++) {
          const x = ((i * 157 + this.time * 500) % (w + 200)) - 100, y = (i * 73) % h;
          ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + 40, y + 4); ctx.stroke();
        }
      }
      for (const t of this.texts) {
        ctx.save();
        ctx.globalAlpha = Math.min(1, t.life * 2);
        ctx.font = font(22 * s, 800);
        ctx.textAlign = 'center';
        ctx.lineWidth = 5;
        ctx.strokeStyle = '#1b2240';
        ctx.strokeText(t.text, t.x, t.y);
        ctx.fillStyle = t.color;
        ctx.fillText(t.text, t.x, t.y);
        ctx.restore();
      }
      if (this.bubble && this.time < this.bubble.until) {
        const b = this.bubble;
        RH.util.bubble(ctx, b.x, b.y - 20, b.text, Math.max(13, 16 * s), b.x, b.y);
      }
    }

    drawFunnel(ctx, s) {
      const N = 28, a = this.tw.strength;
      // dust at the base
      const base = this.funnel(0);
      ctx.fillStyle = `rgba(150,120,80,${0.35 * a})`;
      for (let i = 0; i < 6; i++) {
        const ang = this.time * 3 + i;
        ctx.beginPath(); ctx.arc(base.x + Math.cos(ang) * 40 * s * a, base.y + Math.sin(ang) * 6 * s, 22 * s * a, 0, 7); ctx.fill();
      }
      for (let i = 0; i <= N; i++) {
        const f = i / N, p = this.funnel(f);
        ctx.fillStyle = `rgba(${110 + f * 30},${115 + f * 30},${125 + f * 25},${0.32 * a})`;
        ctx.beginPath(); ctx.ellipse(p.x, p.y, p.r, p.r * 0.28 + 4, 0, 0, 7); ctx.fill();
        ctx.strokeStyle = `rgba(230,235,240,${0.4 * a})`;
        ctx.lineWidth = 2;
        const rot = -this.time * 7 + i * 0.6;
        ctx.beginPath(); ctx.ellipse(p.x, p.y, p.r * 0.9, p.r * 0.25 + 3, 0, rot, rot + 1.4); ctx.stroke();
      }
    }

    drawDebris(ctx, front) {
      for (const d of this.debris) {
        if ((Math.sin(d.a) > 0) !== front) continue;
        const p = this.funnel(d.f);
        ctx.save();
        ctx.translate(p.x + Math.cos(d.a) * p.r * 1.05, p.y + Math.sin(d.a) * p.r * 0.25);
        ctx.rotate(d.a * 2);
        ctx.font = `${Math.round(d.size * this.sc())}px serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(d.e, 0, 0);
        ctx.restore();
      }
    }

    drawSucked(ctx, o) {
      const { x, y } = this.objPos(o);
      const s = this.sc() * (1 - o.lift * 0.5);
      if (o.e) {
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(o.orbitA * 1.5);
        ctx.font = `${Math.round(28 * s)}px serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(o.e, 0, 0);
        ctx.restore();
        return;
      }
      RH.art.student(ctx, x, y + 20 * s, s, o.look, { t: this.time, kick: true, arms: 'up', expr: 'scared', rot: o.orbitA * 1.3, noShadow: true });
      RH.art.tag(ctx, x, y - 34 * s, o.label, s * 1.1, true);
    }

    drawBarn(ctx, x, y, s) {
      const bw = 120 * s, bh = 80 * s;
      ctx.fillStyle = '#b23a32';
      ctx.fillRect(x - bw / 2, y - bh, bw, bh);
      ctx.fillStyle = '#8f2b25';
      ctx.beginPath(); ctx.moveTo(x - bw / 2 - 8 * s, y - bh); ctx.lineTo(x, y - bh - 46 * s); ctx.lineTo(x + bw / 2 + 8 * s, y - bh); ctx.fill();
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 3 * s;
      ctx.strokeRect(x - 22 * s, y - 50 * s, 44 * s, 50 * s);
      ctx.beginPath(); ctx.moveTo(x - 22 * s, y - 50 * s); ctx.lineTo(x + 22 * s, y); ctx.moveTo(x + 22 * s, y - 50 * s); ctx.lineTo(x - 22 * s, y); ctx.stroke();
      ctx.fillStyle = '#fff';
      ctx.beginPath(); ctx.arc(x, y - bh - 18 * s, 8 * s, 0, 7); ctx.fill();
    }

    drawWindmill(ctx, x, y, s) {
      ctx.fillStyle = '#e9e2d0';
      ctx.beginPath(); ctx.moveTo(x - 14 * s, y); ctx.lineTo(x - 7 * s, y - 80 * s); ctx.lineTo(x + 7 * s, y - 80 * s); ctx.lineTo(x + 14 * s, y); ctx.fill();
      ctx.save();
      ctx.translate(x, y - 80 * s);
      ctx.rotate(this.time * (0.6 + this.storm * 6));
      ctx.fillStyle = '#fff';
      for (let i = 0; i < 4; i++) { ctx.rotate(Math.PI / 2); ctx.fillRect(-3 * s, 0, 6 * s, 46 * s); }
      ctx.restore();
    }
  }

  RH.games.push(new TornadoGame());
})(window.RH);
