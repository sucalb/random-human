// Beehive: the hive falls, an angry swarm chases everyone and stings the chosen ones.
(function (RH) {
  const { rand, pick, lerp, ease, clamp, font } = RH.util;
  const S = RH.sound;
  const BAND = [0.66, 0.95];

  class BeesGame {
    constructor() {
      this.id = 'bees';
      this.name = 'Tổ ong';
      this.icon = '🐝';
      this.tl = new RH.Timeline();
      this.crowd = new RH.Crowd(BAND[0], BAND[1]);
      this.time = 0;
      this.w = 800; this.h = 500;
      this.bees = [];
      this.texts = [];
    }

    setup(names) {
      this.tl.clear();
      S.buzz(false);
      this.crowd.set(names, this.w);
      for (const p of this.crowd.people) { p.swell = 0; p.box = 0; }
      this.hive = { fall: 0, wobble: 0, broken: false };
      this.leader = { ...this.hivePos() };
      this.target = null;
      this.swarmR = 22;
      this.active = false;
      this.panic = false;
      this.bubble = null;
      this.texts = [];
      this.bees = Array.from({ length: 6 }, () => this.makeBee(this.leader));
    }

    makeBee(at) {
      return { x: at.x + rand(-10, 10), y: at.y + rand(-10, 10), vx: 0, vy: 0, a: rand(0, 6.28), om: rand(1.5, 3.5) * (Math.random() < 0.5 ? -1 : 1), rr: rand(0.5, 1.2) };
    }

    resize(w, h) {
      const k = w / this.w;
      this.crowd.resize(k);
      this.w = w; this.h = h;
    }

    s() { return clamp(Math.min(this.w / 900, this.h / 520), 0.6, 1.5); }
    treeX() { return this.w * 0.12; }
    hivePos() { const s = this.s(); return { x: this.treeX() + 46 * s, y: this.h * 0.62 - 104 * s }; }

    headOf(p) {
      const s = this.crowd.scale(p, this.h);
      return { x: p.x, y: p.ny * this.h - 42 * s };
    }

    update(dt) {
      this.time += dt;
      this.tl.update(dt);
      const L = this.leader;
      this.crowd.update(dt, this.w, this.h, this.panic, this.active ? { x: L.x, y: L.y, r: 190 * this.s() } : null);
      // leader steers toward its target
      if (this.target) {
        const t = typeof this.target === 'function' ? this.target() : this.headOf(this.target);
        const dx = t.x - L.x, dy = t.y - L.y, d = Math.hypot(dx, dy);
        const sp = 260 * this.s() * dt;
        if (d > 1) { L.x += (dx / d) * Math.min(d, sp); L.y += (dy / d) * Math.min(d, sp); }
      } else if (!this.active) {
        Object.assign(L, this.hiveTop());
      }
      for (const b of this.bees) {
        b.a += b.om * dt;
        const R = this.swarmR * b.rr * this.s();
        const tx = L.x + Math.cos(b.a) * R, ty = L.y + Math.sin(b.a) * R * 0.7;
        b.vx += (tx - b.x) * 14 * dt + rand(-300, 300) * dt;
        b.vy += (ty - b.y) * 14 * dt + rand(-300, 300) * dt;
        b.vx *= 0.9; b.vy *= 0.9;
        b.x += b.vx * dt; b.y += b.vy * dt;
      }
      for (const t of this.texts) t.life -= dt;
      this.texts = this.texts.filter((t) => t.life > 0);
    }

    hiveTop() {
      const p = this.hivePos();
      return { x: p.x, y: lerp(p.y, this.h * 0.64, this.hive.fall) - 10 };
    }

    async play(winners, onPick) {
      const { tl } = this;
      // the hive wobbles… and drops
      S.buzz(true, 0.2);
      await tl.tween(1.2, (t) => (this.hive.wobble = Math.sin(t * 30) * t));
      this.hive.wobble = 0;
      await tl.tween(0.5, (t) => (this.hive.fall = ease.inCubic(t)));
      this.hive.broken = true;
      RH.fx.shake(2);
      S.pop();
      this.pop('BỤP!', this.hiveTop().x, this.hiveTop().y - 20, '#ffd23f');
      const at = this.hiveTop();
      Object.assign(this.leader, at);
      for (let i = 0; i < 40; i++) this.bees.push(this.makeBee(at));
      this.active = true;
      this.panic = true;
      this.swarmR = 60;
      S.buzz(true, 0.6);
      await tl.wait(0.4);

      for (let i = 0; i < winners.length; i++) {
        const target = this.crowd.people.find((p) => p.name === winners[i] && p.state === 'walk');
        if (!target) continue;
        // chase a couple of random students first
        for (let k = 0; k < 2; k++) {
          const any = this.crowd.people.filter((p) => p.state === 'walk');
          this.target = pick(any);
          await tl.wait(1.1);
        }
        if (RH.settings.drama && Math.random() < 0.7) {
          const decoys = this.crowd.people.filter((p) => p.state === 'walk' && !winners.includes(p.name));
          if (decoys.length) await this.fakeOut(pick(decoys));
        }
        this.target = target;
        await this.until(() => this.near(target), 4);
        target.state = 'frozen';
        await this.attack(target);
        target.state = 'stung';
        RH.fx.shake(2);
        S.pop();
        const hp = this.headOf(target);
        this.pop('ĐỐT!', hp.x, hp.y - 40, '#ff4d5e');
        await tl.tween(0.45, (t) => (target.swell = ease.outBack(t, 3)));
        this.swarmR = 60;
        S.buzz(true, 0.6);
        S.ding();
        onPick(target.name, i);
        await tl.wait(0.9);
      }
      // the swarm flies off
      this.target = () => ({ x: this.w + 300, y: -150 });
      this.panic = false;
      await tl.wait(1.6);
      S.buzz(false);
    }

    near(p) {
      const hp = this.headOf(p);
      return Math.hypot(hp.x - this.leader.x, hp.y - this.leader.y) < 30;
    }

    async until(fn, max) {
      let t = 0;
      while (!fn() && t < max) { await this.tl.wait(0.05); t += 0.05; }
    }

    async attack(p) {
      S.buzz(true, 1);
      await this.tl.tween(0.9, (t) => (this.swarmR = lerp(60, 14, t)));
    }

    // Swarm closes in on a decoy, who hides under a cardboard box just in time.
    async fakeOut(d) {
      this.target = d;
      await this.until(() => this.near(d), 4);
      d.state = 'frozen';
      await this.attack(d);
      await this.tl.tween(0.3, (t) => (d.box = t));
      d.state = 'boxed';
      S.uhoh();
      RH.fx.shake(1);
      const hp = this.headOf(d);
      this.bubble = { text: pick(['Trốn trong thùng! 📦', 'Hehe, không đốt được!', 'Ong ơi đi đi~']), x: hp.x, y: hp.y - 60, until: this.time + 1.6 };
      this.swarmR = 110;
      S.buzz(true, 0.6);
      await this.tl.wait(1.0);
      this.swarmR = 60;
    }

    pop(text, x, y, color) { this.texts.push({ text, x, y, color, life: 1 }); }

    // ---------- drawing ----------
    draw(ctx, w, h) {
      const s = this.s();
      RH.art.schoolyard(ctx, w, h, this.time);
      const tx = this.treeX();
      RH.art.tree(ctx, tx, h * 0.62, s * 1.1, Math.sin(this.time) * 2 + this.hive.wobble * 3);
      this.drawHive(ctx, s);
      const ppl = this.crowd.sorted();
      for (const p of ppl) {
        const ps = this.crowd.scale(p, h), x = p.x, y = p.ny * h;
        if (p.state === 'boxed') { this.drawBox(ctx, x, y, ps, 1); continue; }
        RH.art.student(ctx, x, y, ps, p.look, {
          phase: p.phase, t: this.time, swell: p.swell,
          expr: this.panic || p.state !== 'walk' ? 'scared' : 'normal',
          arms: p.state === 'stung' ? 'up' : this.panic || p.state === 'frozen' ? 'up' : 'swing',
          shake: p.state === 'frozen' ? Math.sin(this.time * 40) * 1.5 : 0,
        });
        if (p.box > 0) this.drawBox(ctx, x, y, ps, p.box);
      }
      for (const p of ppl) {
        const ps = this.crowd.scale(p, h);
        const lift = p.state === 'boxed' ? 18 : 50 + p.swell * 8;
        RH.art.tag(ctx, p.x, p.ny * h - lift * ps, (p.swell > 0.5 ? '🐝 ' : '') + p.label, ps, p.state === 'stung' || p.state === 'frozen');
      }
      for (const b of this.bees) this.drawBee(ctx, b, s);
      for (const t of this.texts) {
        ctx.save();
        ctx.globalAlpha = Math.min(1, t.life * 2);
        ctx.font = font(28 * s, 800);
        ctx.textAlign = 'center';
        ctx.lineWidth = 6;
        ctx.strokeStyle = '#1b2240';
        ctx.strokeText(t.text, t.x, t.y - (1 - t.life) * 30);
        ctx.fillStyle = t.color;
        ctx.fillText(t.text, t.x, t.y - (1 - t.life) * 30);
        ctx.restore();
      }
      if (this.bubble && this.time < this.bubble.until) {
        const b = this.bubble;
        RH.util.bubble(ctx, b.x, b.y - 20, b.text, Math.max(13, 16 * s), b.x, b.y);
      }
    }

    drawHive(ctx, s) {
      const p = this.hivePos();
      const y = lerp(p.y, this.h * 0.64, this.hive.fall);
      const x = p.x + this.hive.wobble * 6;
      if (!this.hive.fall) {
        ctx.strokeStyle = '#5a3d27';
        ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(p.x, p.y - 30 * s); ctx.lineTo(x, y - 18 * s); ctx.stroke();
      }
      ctx.save();
      ctx.translate(x, y);
      if (this.hive.broken) ctx.rotate(1.2);
      const bands = ['#e0a526', '#f2bd3c', '#e0a526', '#f2bd3c', '#d39520'];
      bands.forEach((c, i) => {
        const r = (14 + Math.sin((i / 4) * Math.PI) * 10) * s;
        ctx.fillStyle = c;
        ctx.beginPath(); ctx.ellipse(0, (-16 + i * 8) * s, r, 6 * s, 0, 0, Math.PI * 2); ctx.fill();
      });
      ctx.fillStyle = '#3a2410';
      ctx.beginPath(); ctx.ellipse(0, 6 * s, 4 * s, 3 * s, 0, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
      if (this.hive.broken) {
        ctx.fillStyle = 'rgba(240,180,40,0.6)';
        ctx.beginPath(); ctx.ellipse(x + 10 * s, y + 6 * s, 26 * s, 5 * s, 0, 0, Math.PI * 2); ctx.fill();
      }
    }

    drawBox(ctx, x, y, s, k) {
      const bh = 52 * s, bw = 30 * s;
      const top = y - bh - (1 - k) * 140;
      ctx.fillStyle = '#c99a5b';
      ctx.fillRect(x - bw / 2, top, bw, bh);
      ctx.fillStyle = '#b5864a';
      ctx.fillRect(x - bw / 2, top, bw, 7 * s);
      ctx.fillStyle = '#e8d3a6';
      ctx.fillRect(x - 3 * s, top, 6 * s, bh);
      ctx.fillStyle = '#7a5a30';
      ctx.font = font(8 * s, 800);
      ctx.textAlign = 'center';
      ctx.fillText('FRAGILE', x, top + bh * 0.6);
    }

    drawBee(ctx, b, s) {
      const k = 1.5 * s;
      const dir = b.vx >= 0 ? 1 : -1;
      ctx.save();
      ctx.translate(b.x, b.y);
      ctx.scale(dir * k, k);
      ctx.fillStyle = 'rgba(255,255,255,0.75)';
      const flap = Math.sin(this.time * 60 + b.a) * 2;
      ctx.beginPath(); ctx.ellipse(-1, -5 - flap, 3.5, 2.5, -0.4, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.ellipse(2, -5 + flap, 3.5, 2.5, 0.4, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#ffcf1a';
      ctx.beginPath(); ctx.ellipse(0, 0, 5.5, 3.8, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#222';
      ctx.fillRect(-1.6, -3.6, 1.6, 7.2);
      ctx.fillRect(1.6, -3.4, 1.4, 6.8);
      ctx.beginPath(); ctx.moveTo(-5.5, 0); ctx.lineTo(-8, 0.6); ctx.lineTo(-5.2, 1.4); ctx.fill();
      ctx.restore();
    }
  }

  RH.games.push(new BeesGame());
})(window.RH);
