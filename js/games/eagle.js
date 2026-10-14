// Eagle: circles over the schoolyard, dives and carries off the chosen students.
(function (RH) {
  const { rand, pick, lerp, ease, clamp } = RH.util;
  const S = RH.sound;
  const BAND = [0.66, 0.95];

  const bez = (a, c, b, t) => (1 - t) * (1 - t) * a + 2 * (1 - t) * t * c + t * t * b;

  class EagleGame {
    constructor() {
      this.id = 'eagle';
      this.name = 'Đại bàng';
      this.icon = '🦅';
      this.tl = new RH.Timeline();
      this.crowd = new RH.Crowd(BAND[0], BAND[1]);
      this.time = 0;
      this.w = 800; this.h = 500;
      this.feathers = [];
    }

    setup(names) {
      this.tl.clear();
      this.crowd.set(names, this.w);
      this.e = { x: this.w * 0.3, y: this.h * 0.16, dir: 1, flapT: 0, tuck: 0, carry: null, mode: 'circle', ang: 0 };
      this.bag = null;
      this.panic = false;
      this.bubble = null;
      this.feathers = [];
    }

    resize(w, h) {
      const k = w / this.w;
      this.crowd.resize(k);
      if (this.e) this.e.x *= k;
      this.w = w; this.h = h;
    }

    es() { return clamp(Math.min(this.w / 900, this.h / 520), 0.6, 1.5); }

    circlePos(a) {
      return { x: this.w * 0.5 + Math.cos(a) * this.w * 0.32, y: this.h * 0.17 + Math.sin(a * 2) * this.h * 0.05 };
    }

    update(dt) {
      this.time += dt;
      this.tl.update(dt);
      const e = this.e, h = this.h;
      const threat = e.mode === 'dive' ? { x: e.x, y: e.y + 60, r: 170 * this.es() } : null;
      this.crowd.update(dt, this.w, h, this.panic, threat);
      if (e.mode === 'circle') {
        e.ang += dt * 0.7;
        const p = this.circlePos(e.ang);
        if (Math.abs(p.x - e.x) > 0.5) e.dir = Math.sign(p.x - e.x);
        e.x = p.x; e.y = p.y;
      }
      e.flapT += dt * (e.tuck > 0.5 ? 3 : e.carry ? 11 : 6);
      if (this.bag && !this.bag.held) {
        this.bag.vy += 900 * dt;
        this.bag.y += this.bag.vy * dt;
        this.bag.rot += dt * 6;
        if (this.bag.y > this.bag.floor) { this.bag.y = this.bag.floor; this.bag.vy *= -0.35; this.bag.rot = 0; }
      }
      for (const f of this.feathers) { f.x += f.vx * dt; f.y += f.vy * dt; f.vy = Math.min(40, f.vy + 40 * dt); f.rot += dt * 3; f.life -= dt * 0.4; }
      this.feathers = this.feathers.filter((f) => f.life > 0);
    }

    personTop(p) {
      const s = this.crowd.scale(p, this.h);
      return { x: p.x, y: p.ny * this.h - 46 * s, s };
    }

    async play(winners, onPick) {
      for (let i = 0; i < winners.length; i++) {
        const target = this.crowd.people.find((p) => p.name === winners[i] && p.state === 'walk');
        if (!target) continue;
        S.eagleCry();
        this.panic = true;
        await this.tl.wait(1.6);
        if (RH.settings.drama && Math.random() < 0.7) {
          const decoys = this.crowd.people.filter((p) => p.state === 'walk' && !winners.includes(p.name));
          if (decoys.length) await this.fakeSwoop(pick(decoys));
        }
        await this.dive(target);
        target.state = 'carried';
        this.e.carry = target;
        RH.fx.shake(1);
        this.puff();
        S.ding();
        onPick(target.name, i);
        // fly away with the student, then come back for the next one
        const e = this.e, sx = e.x, sy = e.y;
        const exitX = sx < this.w / 2 ? -160 : this.w + 160;
        e.dir = Math.sign(exitX - sx);
        await this.tl.tween(1.6, (t) => {
          const k = ease.inOut(t);
          e.x = lerp(sx, exitX, k);
          e.y = bez(sy, sy - this.h * 0.1, -120, k);
          e.tuck = 0;
        });
        target.state = 'gone';
        e.carry = null;
        if (i < winners.length - 1) await this.reenter();
      }
      this.panic = false;
      await this.reenter();
    }

    async dive(p) {
      const e = this.e;
      e.mode = 'dive';
      p.state = 'frozen';
      // brief hover before the plunge
      const hx = e.x, hy = e.y;
      await this.tl.tween(0.45, (t) => { e.y = hy - Math.sin(Math.PI * t) * 20; });
      S.whoosh();
      const sx = e.x, sy = e.y;
      e.dir = Math.sign(p.x - sx) || 1;
      await this.tl.tween(1.0, (t) => {
        const k = ease.inCubic(t);
        const tp = this.personTop(p);
        e.x = bez(sx, sx + (tp.x - sx) * 0.2, tp.x, k);
        e.y = bez(sy, tp.y - 10, tp.y - 24 * this.es(), k);
        e.tuck = Math.min(1, t * 2);
      });
      e.tuck = 0;
      e.mode = 'manual';
    }

    async fakeSwoop(d) {
      const e = this.e;
      await this.dive(d);
      // Grabs the backpack instead; the student runs off.
      const tp = this.personTop(d);
      this.bag = { x: e.x, y: e.y, held: true, vy: 0, rot: 0, floor: d.ny * this.h - 6 };
      d.state = 'walk';
      d.dir = d.x < this.w / 2 ? -1 : 1;
      d.speed = 70;
      this.puff();
      const sx = e.x, sy = e.y;
      const hx = clamp(sx + e.dir * 90, 60, this.w - 60), hy = this.h * 0.32;
      await this.tl.tween(0.9, (t) => {
        const k = ease.outCubic(t);
        e.x = lerp(sx, hx, k); e.y = lerp(sy, hy, k);
        this.bag.x = e.x; this.bag.y = e.y + 30 * this.es();
      });
      this.bubble = { text: pick(['Ơ… cặp sách à?', 'Nhầm rồi! 🎒', 'Cái gì đây?!']), until: this.time + 1.6 };
      S.uhoh();
      await this.tl.wait(0.8);
      this.bag.held = false;
      this.bag.floor = tp.y + 46 * tp.s - 4;
      await this.tl.wait(0.7);
      await this.backToCircle();
    }

    async backToCircle() {
      const e = this.e, sx = e.x, sy = e.y;
      e.ang = Math.atan2(0, 1) + (sx < this.w / 2 ? Math.PI : 0);
      const p = this.circlePos(e.ang);
      e.dir = Math.sign(p.x - sx) || e.dir;
      await this.tl.tween(0.9, (t) => { const k = ease.inOut(t); e.x = lerp(sx, p.x, k); e.y = lerp(sy, p.y, k); });
      e.mode = 'circle';
    }

    async reenter() {
      const e = this.e;
      e.mode = 'manual';
      const fromLeft = Math.random() < 0.5;
      e.x = fromLeft ? -140 : this.w + 140;
      e.y = this.h * 0.12;
      e.dir = fromLeft ? 1 : -1;
      e.ang = fromLeft ? Math.PI : 0;
      const p = this.circlePos(e.ang);
      const sx = e.x, sy = e.y;
      await this.tl.tween(1.2, (t) => { const k = ease.outCubic(t); e.x = lerp(sx, p.x, k); e.y = lerp(sy, p.y, k); });
      e.mode = 'circle';
    }

    puff() {
      for (let i = 0; i < 8; i++) {
        this.feathers.push({ x: this.e.x, y: this.e.y + 20, vx: rand(-60, 60), vy: rand(-60, 10), rot: rand(0, 6), life: 1 });
      }
    }

    // ---------- drawing ----------
    draw(ctx, w, h) {
      RH.art.schoolyard(ctx, w, h, this.time);
      RH.art.tree(ctx, w * 0.06, h * 0.62, h / 500, Math.sin(this.time) * 2);
      const e = this.e, es = this.es();
      // eagle shadow on the yard
      const hgt = clamp(1 - e.y / (h * 0.7), 0, 1);
      ctx.fillStyle = `rgba(0,0,0,${0.25 * (1 - hgt * 0.7)})`;
      ctx.beginPath(); ctx.ellipse(e.x, h * 0.93, 60 * es * (1 - hgt * 0.4), 8 * es, 0, 0, Math.PI * 2); ctx.fill();

      const ppl = this.crowd.sorted();
      for (const p of ppl) {
        if (p.state === 'gone' || p.state === 'carried') continue;
        const s = this.crowd.scale(p, h);
        const scared = this.panic && p.state === 'walk';
        RH.art.student(ctx, p.x, p.ny * h, s, p.look, {
          phase: p.phase, t: this.time, arms: scared || p.state === 'frozen' ? 'up' : 'swing',
          expr: scared || p.state === 'frozen' ? 'scared' : 'normal',
          shake: p.state === 'frozen' ? Math.sin(this.time * 40) * 1.5 : 0,
        });
      }
      if (this.bag) {
        ctx.save();
        ctx.translate(this.bag.x, this.bag.y);
        ctx.rotate(this.bag.rot);
        ctx.font = `${Math.round(26 * es)}px serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('🎒', 0, 0);
        ctx.restore();
      }
      for (const p of ppl) {
        if (p.state === 'gone' || p.state === 'carried') continue;
        const s = this.crowd.scale(p, h);
        RH.art.tag(ctx, p.x, p.ny * h - 50 * s, p.label, s, p.state === 'frozen');
      }
      if (e.carry) {
        const p = e.carry, s = 1.1 * es;
        RH.art.student(ctx, e.x + 4 * es, e.y + 62 * es, s, p.look, { t: this.time, kick: true, arms: 'up', expr: 'scared', rot: Math.sin(this.time * 5) * 0.15, noShadow: true });
      }
      this.drawEagle(ctx, e, es);
      if (e.carry) RH.art.tag(ctx, e.x, e.y + 92 * es, e.carry.label, 1.2 * es, true);
      for (const f of this.feathers) {
        ctx.save();
        ctx.globalAlpha = f.life;
        ctx.translate(f.x, f.y); ctx.rotate(f.rot);
        ctx.fillStyle = '#7a5230';
        ctx.beginPath(); ctx.ellipse(0, 0, 7, 2.5, 0, 0, Math.PI * 2); ctx.fill();
        ctx.restore();
      }
      if (this.bubble && this.time < this.bubble.until) {
        RH.util.bubble(ctx, e.x + 40, e.y - 60 * es, this.bubble.text, 16, e.x + 10, e.y - 22 * es);
      }
    }

    drawEagle(ctx, e, s) {
      const flap = Math.sin(e.flapT) * (1 - e.tuck);
      ctx.save();
      ctx.translate(e.x, e.y);
      ctx.scale(e.dir * s, s);
      ctx.rotate(e.tuck * 0.5);
      const wing = (color, off, k) => {
        const lift = flap * 62 * k;
        const fold = e.tuck;
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.moveTo(-14, -4 + off);
        ctx.lineTo(16, -6 + off);
        ctx.quadraticCurveTo(0 - fold * 20, -4 - lift * 0.7 + off, -18 - fold * 30, -8 - lift * (1 - fold * 0.8) + off);
        // feather fingers at the tip
        for (let i = 0; i < 4; i++) ctx.lineTo(-30 - fold * 34 - i * 7, -6 - lift * (1 - fold * 0.8) * (0.95 - i * 0.12) + off + i * 2);
        ctx.closePath();
        ctx.fill();
      };
      wing('#4a2f18', -4, 0.85);
      // tail
      ctx.fillStyle = '#f5f1e8';
      ctx.beginPath(); ctx.moveTo(-34, -2); ctx.lineTo(-58, -10); ctx.lineTo(-60, 6); ctx.lineTo(-34, 6); ctx.fill();
      // body
      ctx.fillStyle = '#6b4423';
      ctx.beginPath(); ctx.ellipse(-2, 0, 38, 15, -0.05, 0, Math.PI * 2); ctx.fill();
      // white head + hooked beak
      ctx.fillStyle = '#f7f4ec';
      ctx.beginPath(); ctx.arc(34, -8, 12, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#ffc107';
      ctx.beginPath(); ctx.moveTo(43, -11); ctx.quadraticCurveTo(56, -10, 54, -1); ctx.lineTo(44, -3); ctx.fill();
      ctx.fillStyle = '#111';
      ctx.beginPath(); ctx.arc(38, -11, 2, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = '#111';
      ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.moveTo(34, -15); ctx.lineTo(42, -13); ctx.stroke();
      // talons
      ctx.strokeStyle = '#e0a800';
      ctx.lineWidth = 3;
      const open = e.carry || this.bag?.held ? 1 : e.tuck;
      for (const dx of [-4, 6]) {
        ctx.beginPath(); ctx.moveTo(dx, 12); ctx.lineTo(dx + 2, 24 + open * 4); ctx.lineTo(dx + 7, 28 + open * 3); ctx.stroke();
      }
      wing('#7a5230', 0, 1);
      ctx.restore();
    }
  }

  RH.games.push(new EagleGame());
})(window.RH);
