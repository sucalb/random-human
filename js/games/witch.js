// Witch: a witch on a broomstick casts a spell orb that weaves between students
// and turns the chosen ones into frogs.
(function (RH) {
  const { rand, pick, shuffle, lerp, ease, clamp, font } = RH.util;
  const S = RH.sound;

  class WitchGame {
    constructor() {
      this.id = 'witch';
      this.name = 'Phù thuỷ';
      this.icon = '🧙';
      this.tl = new RH.Timeline();
      this.time = 0;
      this.w = 800; this.h = 500;
      this.people = [];
      this.sparks = [];
      this.smoke = [];
      this.texts = [];
      const r = RH.util.seeded(42);
      this.stars = Array.from({ length: 80 }, () => ({ x: r(), y: r() * 0.45, s: r() * 1.6 + 0.4, tw: r() * 6 }));
      this.shrooms = Array.from({ length: 9 }, () => ({ x: r(), y: 0.5 + r() * 0.45, k: 0.7 + r() * 0.6, c: r() < 0.5 ? '#ff6b9a' : '#9b7bff' }));
      this.flies = Array.from({ length: 16 }, () => ({ x: r(), y: 0.45 + r() * 0.5, ph: r() * 6 }));
    }

    setup(names) {
      this.tl.clear();
      const r = RH.util.seeded(names.length * 13 + 1);
      const n = names.length;
      const cols = clamp(Math.ceil(Math.sqrt(n * 2.2)), 1, 9);
      const rows = Math.ceil(n / cols);
      this.people = shuffle(names).map((name, i) => {
        const row = Math.floor(i / cols), col = i % cols;
        const inRow = Math.min(cols, n - row * cols);
        return {
          name, label: RH.util.short(name), look: RH.art.look(),
          fx: (col + 0.5 + (cols - inRow) / 2) / cols + (r() - 0.5) * 0.04,
          fy: rows === 1 ? 0.5 : row / (rows - 1) + (r() - 0.5) * 0.06,
          frog: 0, dizzy: 0, hot: false, hopT: r() * 3,
        };
      });
      this.witch = { x: this.w * 0.3, y: this.h * 0.16, dir: 1, mode: 'fly', cast: 0 };
      this.orb = null;
      this.sparks = [];
      this.smoke = [];
      this.texts = [];
      this.bubble = null;
      this.glow = 0;
    }

    resize(w, h) { this.w = w; this.h = h; }

    sc() { return clamp(Math.min(this.w / 900, this.h / 520), 0.6, 1.5); }

    pos(p) {
      const fy = clamp(p.fy, 0, 1);
      return { x: this.w * (0.06 + clamp(p.fx, 0, 1) * 0.88), y: this.h * (0.58 + fy * 0.34), s: (0.75 + fy * 0.45) * this.sc() };
    }

    chest(p) { const q = this.pos(p); return { x: q.x, y: q.y - 30 * q.s }; }

    update(dt) {
      this.time += dt;
      this.tl.update(dt);
      const wi = this.witch;
      if (wi.mode === 'fly') {
        const nx = this.w / 2 + Math.cos(this.time * 0.45) * this.w * 0.36;
        if (Math.abs(nx - wi.x) > 0.3) wi.dir = Math.sign(nx - wi.x);
        wi.x = nx;
        wi.y = this.h * 0.16 + Math.sin(this.time * 1.3) * this.h * 0.03;
      }
      if (this.orb) {
        const o = this.orb;
        if (Math.random() < 0.9) this.sparks.push({ x: o.x + rand(-4, 4), y: o.y + rand(-4, 4), vx: rand(-20, 20), vy: rand(-20, 20), life: 0.6, c: pick(['#c3fae8', '#e599f7', '#fff3bf']) });
      }
      for (const p of this.sparks) { p.x += p.vx * dt; p.y += p.vy * dt; p.life -= dt; }
      this.sparks = this.sparks.filter((p) => p.life > 0);
      for (const p of this.smoke) { p.x += p.vx * dt; p.y += p.vy * dt; p.r += 30 * dt; p.life -= dt * 1.2; }
      this.smoke = this.smoke.filter((p) => p.life > 0);
      for (const t of this.texts) t.life -= dt;
      this.texts = this.texts.filter((t) => t.life > 0);
      for (const p of this.people) {
        p.hopT += dt;
        p.dizzy = Math.max(0, p.dizzy - dt);
      }
      this.glow = Math.max(0, this.glow - dt * 2);
    }

    wandTip() {
      const wi = this.witch, s = this.sc();
      return { x: wi.x + wi.dir * 36 * s, y: wi.y - 32 * s };
    }

    async play(winners, onPick) {
      const { tl } = this;
      const wi = this.witch;
      S.cackle();
      this.say('Hihihi… ai sẽ thành ếch đây?');
      await tl.wait(1.2);
      for (let i = 0; i < winners.length; i++) {
        const target = this.people.find((p) => p.name === winners[i]);
        if (!target) continue;
        await this.hover();
        const pool = this.people.filter((p) => !p.frog);
        const decoys = pool.filter((p) => !winners.includes(p.name));
        const fake = RH.settings.drama && decoys.length && Math.random() < 0.65 ? pick(decoys) : null;
        await this.cast(pool, fake || target, 8);
        if (fake) {
          await this.transform(fake, true);
          await tl.wait(0.7);
          S.uhoh();
          this.say(pick(['Ối, đọc nhầm thần chú!', 'Khoan… không phải bạn này!', 'Abraca… ơ sai rồi!']));
          await tl.wait(0.8);
          this.burst(this.pos(fake).x, this.pos(fake).y - 15 * this.pos(fake).s, '#b197fc');
          S.poof();
          fake.frog = 0;
          fake.dizzy = 1.6;
          await tl.wait(0.6);
          await this.cast(pool.filter((p) => p !== fake), target, 3);
        }
        await this.transform(target, false);
        target.hot = true;
        S.ding();
        onPick(target.name, i);
        await tl.wait(1.2);
        wi.mode = 'fly';
        await tl.wait(0.6);
      }
      S.cackle();
      this.say('Hẹn gặp lại~ 🧹');
      await tl.wait(1.2);
    }

    say(text, dur = 1.8) { this.bubble = { text, until: this.time + dur }; }

    async hover() {
      const wi = this.witch;
      wi.mode = 'cast';
      const sx = wi.x, sy = wi.y;
      const tx = clamp(sx, this.w * 0.2, this.w * 0.8), ty = this.h * 0.15;
      await this.tl.tween(0.6, (t) => { const k = ease.inOut(t); wi.x = lerp(sx, tx, k); wi.y = lerp(sy, ty, k); });
    }

    // Orb hops between students, slowing down, and lands on `land`.
    async cast(pool, land, hops) {
      const wi = this.witch;
      await this.tl.tween(0.35, (t) => (wi.cast = Math.sin(Math.PI * t)));
      S.zap();
      const tip = this.wandTip();
      this.orb = { x: tip.x, y: tip.y };
      this.glow = 1;
      let prev = null;
      for (let k = 0; k < hops; k++) {
        let p = k === hops - 1 ? land : pick(pool);
        if (k < hops - 1 && pool.length > 2) while (p === prev || p === land) p = pick(pool);
        prev = p;
        const o = this.orb, sx = o.x, sy = o.y;
        const dur = 0.22 + Math.pow(k / hops, 2) * 0.55;
        S.crackle();
        await this.tl.tween(dur, (t) => {
          const c = this.chest(p);
          o.x = lerp(sx, c.x, ease.inOut(t));
          o.y = lerp(sy, c.y, ease.inOut(t)) - Math.sin(Math.PI * t) * 40;
        });
      }
      this.orb = null;
    }

    async transform(p, temporary) {
      const q = this.pos(p);
      this.burst(q.x, q.y - 15 * q.s, '#9775fa');
      S.poof();
      RH.fx.shake(temporary ? 1 : 2);
      p.frog = 1;
      p.hopT = 0;
      await this.tl.wait(0.25);
      S.ribbit();
      this.texts.push({ text: 'Ộp!', x: q.x, y: q.y - 50 * q.s, life: 1 });
    }

    burst(x, y, color) {
      for (let i = 0; i < 14; i++) {
        const a = (i / 14) * Math.PI * 2;
        this.smoke.push({ x, y, vx: Math.cos(a) * 70, vy: Math.sin(a) * 50 - 20, r: 8, life: 1, c: color });
      }
      for (let i = 0; i < 16; i++) this.sparks.push({ x, y, vx: rand(-160, 160), vy: rand(-180, 40), life: 0.7, c: pick(['#fff3bf', '#e599f7', '#c3fae8']) });
    }

    // ---------- drawing ----------
    draw(ctx, w, h) {
      const s = this.sc();
      const sky = ctx.createLinearGradient(0, 0, 0, h * 0.55);
      sky.addColorStop(0, '#1a0b3d');
      sky.addColorStop(0.6, '#4b1f74');
      sky.addColorStop(1, '#8a3f8f');
      ctx.fillStyle = sky;
      ctx.fillRect(0, 0, w, h * 0.56);
      for (const st of this.stars) {
        ctx.globalAlpha = 0.5 + 0.5 * Math.sin(this.time * 2 + st.tw);
        ctx.fillStyle = '#fff';
        ctx.fillRect(st.x * w, st.y * h, st.s, st.s);
      }
      ctx.globalAlpha = 1;
      // moon
      const mx = w * 0.78, my = h * 0.17, mr = 46 * s;
      const mg = ctx.createRadialGradient(mx, my, mr * 0.5, mx, my, mr * 2.4);
      mg.addColorStop(0, 'rgba(255,240,180,0.45)');
      mg.addColorStop(1, 'rgba(255,240,180,0)');
      ctx.fillStyle = mg;
      ctx.beginPath(); ctx.arc(mx, my, mr * 2.4, 0, 7); ctx.fill();
      ctx.fillStyle = '#fff1b8';
      ctx.beginPath(); ctx.arc(mx, my, mr, 0, 7); ctx.fill();
      ctx.fillStyle = 'rgba(220,200,140,0.6)';
      for (const [dx, dy, r] of [[-0.3, -0.2, 0.18], [0.25, 0.15, 0.13], [-0.05, 0.4, 0.1]]) { ctx.beginPath(); ctx.arc(mx + dx * mr, my + dy * mr, r * mr, 0, 7); ctx.fill(); }
      // hills + spooky trees
      ctx.fillStyle = '#2a1546';
      ctx.beginPath(); ctx.moveTo(0, h * 0.56);
      for (let x = 0; x <= w; x += 20) ctx.lineTo(x, h * 0.5 + Math.sin(x * 0.006 + 1) * h * 0.04);
      ctx.lineTo(w, h * 0.56); ctx.fill();
      this.drawDeadTree(ctx, w * 0.06, h * 0.56, s * 1.2);
      this.drawDeadTree(ctx, w * 0.95, h * 0.56, s);
      // ground
      const g = ctx.createLinearGradient(0, h * 0.55, 0, h);
      g.addColorStop(0, '#24453e');
      g.addColorStop(1, '#1b332d');
      ctx.fillStyle = g;
      ctx.fillRect(0, h * 0.55, w, h * 0.45);
      for (const m of this.shrooms) this.drawShroom(ctx, m.x * w, m.y * h, m.k * s, m.c);
      // fireflies
      for (const f of this.flies) {
        const fx = f.x * w + Math.sin(this.time * 0.7 + f.ph) * 20, fy = f.y * h + Math.cos(this.time * 0.9 + f.ph) * 10;
        ctx.fillStyle = `rgba(220,255,140,${0.4 + 0.4 * Math.sin(this.time * 3 + f.ph)})`;
        ctx.beginPath(); ctx.arc(fx, fy, 2, 0, 7); ctx.fill();
      }

      const list = this.people.slice().sort((a, b) => a.fy - b.fy);
      for (const p of list) {
        const q = this.pos(p);
        if (p.frog) this.drawFrog(ctx, q.x, q.y, q.s, p);
        else {
          RH.art.student(ctx, q.x, q.y, q.s, p.look, {
            t: this.time, arms: this.orb ? 'up' : 'down', expr: this.orb || p.dizzy ? 'scared' : 'normal',
            rot: p.dizzy ? Math.sin(this.time * 8) * 0.12 : 0,
          });
          if (p.dizzy) {
            ctx.font = `${Math.round(16 * q.s)}px serif`;
            ctx.textAlign = 'center';
            ctx.fillText('💫', q.x + Math.cos(this.time * 8) * 8 * q.s, q.y - 58 * q.s);
          }
        }
      }
      for (const p of this.smoke) {
        ctx.fillStyle = p.c;
        ctx.globalAlpha = Math.max(0, p.life) * 0.6;
        ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, 7); ctx.fill();
      }
      ctx.globalAlpha = 1;
      for (const p of list) {
        const q = this.pos(p);
        RH.art.tag(ctx, q.x, q.y - (p.frog ? 30 : 54) * q.s, (p.frog ? '🐸 ' : '') + p.label, q.s, p.hot);
      }
      this.drawWitch(ctx, s);
      if (this.orb) {
        const o = this.orb;
        const og = ctx.createRadialGradient(o.x, o.y, 1, o.x, o.y, 22 * s);
        og.addColorStop(0, 'rgba(255,255,255,1)');
        og.addColorStop(0.35, 'rgba(180,255,220,0.9)');
        og.addColorStop(1, 'rgba(160,90,255,0)');
        ctx.fillStyle = og;
        ctx.beginPath(); ctx.arc(o.x, o.y, 22 * s, 0, 7); ctx.fill();
      }
      for (const p of this.sparks) {
        ctx.fillStyle = p.c;
        ctx.globalAlpha = Math.min(1, p.life * 2);
        this.star(ctx, p.x, p.y, 3);
      }
      ctx.globalAlpha = 1;
      for (const t of this.texts) {
        ctx.save();
        ctx.globalAlpha = Math.min(1, t.life * 2);
        ctx.font = font(26 * s, 800);
        ctx.textAlign = 'center';
        ctx.lineWidth = 6;
        ctx.strokeStyle = '#1b2240';
        ctx.strokeText(t.text, t.x, t.y - (1 - t.life) * 30);
        ctx.fillStyle = '#8ce99a';
        ctx.fillText(t.text, t.x, t.y - (1 - t.life) * 30);
        ctx.restore();
      }
      if (this.bubble && this.time < this.bubble.until) {
        const wi = this.witch;
        RH.util.bubble(ctx, wi.x + 30, wi.y - 72 * s, this.bubble.text, Math.max(13, 16 * s), wi.x + 4, wi.y - 46 * s);
      }
    }

    star(ctx, x, y, r) {
      ctx.beginPath();
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2, rr = i % 2 ? r * 0.4 : r;
        i ? ctx.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr) : ctx.moveTo(x + rr, y);
      }
      ctx.fill();
    }

    drawDeadTree(ctx, x, y, s) {
      ctx.strokeStyle = '#140a26';
      ctx.lineCap = 'round';
      ctx.lineWidth = 10 * s;
      ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + 4 * s, y - 110 * s); ctx.stroke();
      ctx.lineWidth = 5 * s;
      for (const [a, b, c, d] of [[2, -70, 40, -105], [3, -85, -32, -125], [4, -100, 22, -145], [3, -55, -38, -75]]) {
        ctx.beginPath(); ctx.moveTo(x + a * s, y + b * s); ctx.lineTo(x + c * s, y + d * s); ctx.stroke();
      }
    }

    drawShroom(ctx, x, y, s, c) {
      ctx.fillStyle = '#efe6d8';
      ctx.fillRect(x - 3 * s, y - 10 * s, 6 * s, 10 * s);
      ctx.fillStyle = c;
      ctx.beginPath(); ctx.ellipse(x, y - 10 * s, 11 * s, 7 * s, 0, Math.PI, 0); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.8)';
      ctx.beginPath(); ctx.arc(x - 4 * s, y - 13 * s, 1.6 * s, 0, 7); ctx.arc(x + 3 * s, y - 15 * s, 1.3 * s, 0, 7); ctx.fill();
    }

    drawFrog(ctx, x, y, s, p) {
      const hop = Math.max(0, Math.sin((p.hopT % 2.2) * Math.PI / 0.4)) * ((p.hopT % 2.2) < 0.4 ? 1 : 0);
      const k = s * 1.3;
      ctx.save();
      ctx.translate(x, y - hop * 14 * s);
      ctx.fillStyle = 'rgba(0,0,0,0.2)';
      ctx.beginPath(); ctx.ellipse(0, hop * 14 * s, 12 * k, 3 * k, 0, 0, 7); ctx.fill();
      ctx.fillStyle = '#3fae54';
      // back legs
      ctx.beginPath(); ctx.ellipse(-10 * k, -3 * k, 6 * k, 4 * k, 0.4, 0, 7); ctx.ellipse(10 * k, -3 * k, 6 * k, 4 * k, -0.4, 0, 7); ctx.fill();
      // body
      ctx.fillStyle = '#51cf66';
      ctx.beginPath(); ctx.ellipse(0, -9 * k, 12 * k, 9 * k, 0, 0, 7); ctx.fill();
      ctx.fillStyle = '#b2f2bb';
      ctx.beginPath(); ctx.ellipse(0, -6 * k, 7 * k, 5 * k, 0, 0, 7); ctx.fill();
      // eyes
      for (const sg of [-1, 1]) {
        ctx.fillStyle = '#51cf66';
        ctx.beginPath(); ctx.arc(sg * 6 * k, -17 * k, 4.5 * k, 0, 7); ctx.fill();
        ctx.fillStyle = '#fff';
        ctx.beginPath(); ctx.arc(sg * 6 * k, -17.5 * k, 3.2 * k, 0, 7); ctx.fill();
        ctx.fillStyle = '#111';
        ctx.beginPath(); ctx.arc(sg * 6 * k + 0.5 * k, -17.5 * k, 1.5 * k, 0, 7); ctx.fill();
      }
      // keep their glasses / bow so you can tell who it was
      if (p.look.glasses) {
        ctx.strokeStyle = p.look.glasses;
        ctx.lineWidth = 1.2 * k;
        ctx.beginPath(); ctx.arc(-6 * k, -17.5 * k, 3.8 * k, 0, 7); ctx.moveTo(9.8 * k, -17.5 * k); ctx.arc(6 * k, -17.5 * k, 3.8 * k, 0, 7); ctx.stroke();
      }
      if (p.look.bow || p.look.hat) {
        ctx.fillStyle = p.look.bow || p.look.hatColor;
        ctx.beginPath(); ctx.arc(0, -21 * k, 2.6 * k, 0, 7); ctx.fill();
      }
      ctx.strokeStyle = '#2b8a3e';
      ctx.lineWidth = 1.2 * k;
      ctx.beginPath(); ctx.arc(0, -10 * k, 5 * k, 0.15 * Math.PI, 0.85 * Math.PI); ctx.stroke();
      ctx.restore();
    }

    drawWitch(ctx, s) {
      const wi = this.witch;
      ctx.save();
      ctx.translate(wi.x, wi.y);
      ctx.scale(wi.dir * s, s);
      ctx.rotate(Math.sin(this.time * 2) * 0.05);
      // broom
      ctx.strokeStyle = '#8b5a2b';
      ctx.lineWidth = 3.5;
      ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(-34, 6); ctx.lineTo(38, -2); ctx.stroke();
      ctx.strokeStyle = '#e0b44f';
      ctx.lineWidth = 2;
      for (let i = -5; i <= 5; i++) { ctx.beginPath(); ctx.moveTo(-32, 6); ctx.lineTo(-56, 6 + i * 2.6 + Math.sin(this.time * 20 + i) * 1.5); ctx.stroke(); }
      ctx.fillStyle = '#7a3e12';
      ctx.fillRect(-34, 2, 6, 8);
      // cape
      ctx.fillStyle = '#3b1d5e';
      ctx.beginPath();
      ctx.moveTo(-2, -28);
      ctx.quadraticCurveTo(-26, -20 + Math.sin(this.time * 6) * 3, -34, -4 + Math.sin(this.time * 6 + 1) * 4);
      ctx.lineTo(-6, 0); ctx.fill();
      // dress
      ctx.fillStyle = '#6f2dbd';
      ctx.beginPath(); ctx.moveTo(-4, -30); ctx.lineTo(8, -30); ctx.lineTo(14, 4); ctx.lineTo(-12, 4); ctx.fill();
      // legs + boots
      ctx.strokeStyle = '#222';
      ctx.lineWidth = 3;
      ctx.beginPath(); ctx.moveTo(4, 2); ctx.lineTo(10, 14); ctx.stroke();
      ctx.fillStyle = '#222';
      ctx.beginPath(); ctx.ellipse(13, 15, 5, 2.5, 0, 0, 7); ctx.fill();
      // arm + wand
      const lift = wi.cast * 0.9;
      ctx.strokeStyle = '#6f2dbd';
      ctx.lineWidth = 4;
      ctx.beginPath(); ctx.moveTo(4, -24); ctx.lineTo(18, -22 - lift * 10); ctx.stroke();
      ctx.strokeStyle = '#3a2410';
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(18, -22 - lift * 10); ctx.lineTo(34, -30 - lift * 16); ctx.stroke();
      ctx.fillStyle = this.glow > 0 || wi.cast > 0 ? '#fff3bf' : '#c3fae8';
      this.star(ctx, 35, -31 - lift * 16, 4 + wi.cast * 4 + this.glow * 6);
      // hair
      ctx.fillStyle = '#ff7b2e';
      ctx.beginPath(); ctx.moveTo(-6, -40); ctx.quadraticCurveTo(-18, -26, -12, -16); ctx.lineTo(-2, -30); ctx.fill();
      // head
      ctx.fillStyle = '#9ad48a';
      ctx.beginPath(); ctx.arc(2, -38, 8, 0, 7); ctx.fill();
      ctx.beginPath(); ctx.moveTo(8, -40); ctx.lineTo(16, -35); ctx.lineTo(8, -35); ctx.fill();
      ctx.fillStyle = '#111';
      ctx.beginPath(); ctx.arc(5, -40, 1.3, 0, 7); ctx.fill();
      ctx.strokeStyle = '#111';
      ctx.lineWidth = 1;
      ctx.beginPath(); ctx.arc(5, -33, 3, 0.1, Math.PI * 0.8); ctx.stroke();
      // hat
      ctx.fillStyle = '#1b1030';
      ctx.beginPath(); ctx.ellipse(1, -44, 15, 3.5, -0.1, 0, 7); ctx.fill();
      ctx.beginPath(); ctx.moveTo(-8, -45); ctx.lineTo(9, -46); ctx.quadraticCurveTo(0, -60, -14, -70); ctx.quadraticCurveTo(-5, -58, -8, -45); ctx.fill();
      ctx.fillStyle = '#b197fc';
      ctx.fillRect(-7, -49, 15, 3);
      ctx.restore();
    }
  }

  RH.games.push(new WitchGame());
})(window.RH);
