// Zombie classroom: lights go out, a zombie shuffles between the desks and bites the chosen ones.
(function (RH) {
  const { rand, pick, lerp, ease, roundRect, fitText, short, font, clamp } = RH.util;
  const S = RH.sound;
  const ZSKIN = '#9ccf7f';

  class ZombieGame {
    constructor() {
      this.id = 'zombie';
      this.name = 'Zombie';
      this.icon = '🧟';
      this.tl = new RH.Timeline();
      this.time = 0;
      this.w = 800; this.h = 500;
      this.students = [];
      this.texts = [];
      this.bats = [];
    }

    setup(names) {
      this.tl.clear();
      this.students = names.map((name, i) => ({
        name, label: short(name), i, look: RH.art.look(),
        bitten: 0, duck: 0, scared: Math.random() < 0.3,
      }));
      this.dark = 0;
      this.door = 0;
      this.z = { x: 0, y: 0, visible: false, dir: 1, lunge: 0, moving: false, dizzy: 0 };
      this.texts = [];
      this.bubble = null;
    }

    resize(w, h) {
      const g0 = this.geoCache;
      this.w = w; this.h = h;
      if (g0 && this.z.visible) {
        const g = this.geo();
        this.z.x = g.ax + ((this.z.x - g0.ax) / g0.aw) * g.aw;
        this.z.y = g.ay + ((this.z.y - g0.ay) / g0.ah) * g.ah;
      }
    }

    geo() {
      const { w, h } = this;
      const n = Math.max(1, this.students.length);
      const cols = clamp(Math.ceil(Math.sqrt(n * (w / h) * 0.9)), 1, 8);
      const rows = Math.ceil(n / cols);
      const ax = w * 0.14, aw = w * 0.82, ay = h * 0.4, ah = h * 0.56;
      const cw = aw / cols, ch = ah / rows;
      const s = clamp(Math.min(cw / 95, ch / 70), 0.45, 1.4);
      this.geoCache = { cols, rows, ax, aw, ay, ah, cw, ch, s, wall: h * 0.3, doorX: w * 0.065 };
      return this.geoCache;
    }

    seat(i, g = this.geo()) {
      const r = Math.floor(i / g.cols), c = i % g.cols;
      return { r, c, x: g.ax + (c + 0.5) * g.cw, y: g.ay + (r + 0.62) * g.ch };
    }

    update(dt) {
      this.time += dt;
      this.tl.update(dt);
      const z = this.z;
      if (z.moving) z.phase = (z.phase || 0) + dt * 7;
      z.dizzy = Math.max(0, z.dizzy - dt);
      for (const t of this.texts) t.life -= dt;
      this.texts = this.texts.filter((t) => t.life > 0);
      if (this.dark > 0.5 && Math.random() < dt * 0.25 && this.bats.length < 3) {
        this.bats.push({ x: -30, y: rand(this.h * 0.05, this.h * 0.25), v: rand(120, 200), ph: rand(0, 6) });
      }
      for (const b of this.bats) b.x += b.v * dt;
      this.bats = this.bats.filter((b) => b.x < this.w + 40);
    }

    say(text, dur = 1.4) { this.bubble = { text, until: this.time + dur }; }
    pop(text, x, y, color = '#ff3b5c') { this.texts.push({ text, x, y, color, life: 1 }); }

    walkTo(x, y) {
      const z = this.z, g = this.geo();
      const sx = z.x, sy = z.y;
      const d = Math.hypot(x - sx, y - sy);
      if (d < 1) return Promise.resolve();
      if (Math.abs(x - sx) > 2) z.dir = Math.sign(x - sx);
      z.moving = true;
      return this.tl.tween(d / (130 * g.s + 40), (t) => { z.x = lerp(sx, x, t); z.y = lerp(sy, y, t); }).then(() => (z.moving = false));
    }

    // Walk along the aisles (never through desks) to stand next to a seat.
    async goTo(st) {
      const g = this.geo(), z = this.z;
      const sp = this.seat(st.i, g);
      const left = g.ax + sp.c * g.cw, right = left + g.cw;
      const ax = Math.abs(z.x - left) <= Math.abs(z.x - right) ? left : right;
      const gapRow = clamp(Math.round((z.y - g.ay) / g.ch), 0, g.rows);
      await this.walkTo(z.x, g.ay + gapRow * g.ch);
      await this.walkTo(ax, g.ay + gapRow * g.ch);
      await this.walkTo(ax, sp.y + 2);
      z.dir = sp.x > z.x ? 1 : -1;
    }

    async lunge() {
      S.chomp();
      await this.tl.tween(0.35, (t) => (this.z.lunge = Math.sin(Math.PI * t)));
    }

    async play(winners, onPick) {
      const g = this.geo(), z = this.z;
      // Lights flicker and die.
      await this.tl.tween(1.2, (t) => (this.dark = t < 0.85 ? (Math.random() < 0.5 ? 0.9 : 0.1) * t : t));
      this.dark = 1;
      await this.tl.tween(0.6, (t) => (this.door = t));
      z.x = g.doorX; z.y = g.wall + 6; z.visible = true; z.dir = 1;
      S.groan();
      this.say('Grrr… bài cũ…');
      await this.walkTo(g.doorX, g.ay);
      for (let i = 0; i < winners.length; i++) {
        const target = this.students.find((s) => s.name === winners[i]);
        if (!target) continue;
        if (RH.settings.drama && Math.random() < 0.7) {
          const decoys = this.students.filter((s) => !s.bitten && !winners.includes(s.name));
          if (decoys.length) await this.fakeOut(pick(decoys));
        }
        await this.goTo(target);
        await this.tl.wait(0.25);
        await this.lunge();
        target.bitten = 1;
        RH.fx.shake(2);
        const sp = this.seat(target.i, g);
        this.pop('CHOMP!', sp.x, sp.y - 60 * g.s);
        S.ding();
        onPick(target.name, i);
        await this.tl.wait(0.7);
      }
      // Leave the way it came.
      const gapRow = clamp(Math.round((z.y - g.ay) / g.ch), 0, g.rows);
      await this.walkTo(z.x, g.ay + gapRow * g.ch);
      if (gapRow !== 0) await this.walkTo(g.ax, g.ay + gapRow * g.ch);
      await this.walkTo(g.ax, g.ay);
      await this.walkTo(g.doorX, g.ay);
      await this.walkTo(g.doorX, g.wall + 6);
      z.visible = false;
      await this.tl.tween(0.4, (t) => (this.door = 1 - t));
      await this.tl.tween(0.6, (t) => (this.dark = 1 - t));
    }

    // Lunges at someone else who ducks under the desk just in time.
    async fakeOut(d) {
      await this.goTo(d);
      await this.tl.wait(0.3);
      const sp = this.seat(d.i, this.geo());
      const duck = this.tl.tween(0.18, (t) => (d.duck = t));
      await this.lunge();
      await duck;
      this.pop('HỤT!', sp.x, sp.y - 50 * this.geo().s, '#ffd23f');
      S.uhoh();
      this.z.dizzy = 1;
      this.say(pick(['Ơ… đâu rồi?', 'Grr… trượt!', 'Né giỏi đấy…']));
      await this.tl.wait(1.0);
      await this.tl.tween(0.3, (t) => (d.duck = 1 - t));
    }

    // ---------- drawing ----------
    draw(ctx, w, h) {
      const g = this.geo();
      const { s } = g;
      this.drawRoom(ctx, g);
      // depth-sorted seats + zombie
      const items = this.students.map((st) => ({ y: this.seat(st.i, g).y, st }));
      if (this.z.visible) items.push({ y: this.z.y + 1, zombie: true });
      items.sort((a, b) => a.y - b.y);
      for (const it of items) it.zombie ? this.drawZombie(ctx, g) : this.drawSeat(ctx, it.st, g);

      if (this.dark > 0) {
        const z = this.z;
        const cx = z.visible ? z.x : w * 0.5, cy = z.visible ? z.y - 30 * s : h * 0.6;
        const grd = ctx.createRadialGradient(cx, cy, 20 * s, cx, cy, Math.max(160 * s, 120));
        grd.addColorStop(0, 'rgba(6,10,24,0)');
        grd.addColorStop(1, `rgba(6,10,24,${0.78 * this.dark})`);
        ctx.fillStyle = grd;
        ctx.fillRect(0, 0, w, h);
        for (const b of this.bats) this.drawBat(ctx, b);
      }
      // name tags stay readable in the dark
      for (const st of this.students) this.drawTag(ctx, st, g);
      for (const t of this.texts) {
        const k = 1 - t.life;
        ctx.save();
        ctx.globalAlpha = Math.min(1, t.life * 2);
        ctx.font = font(26 * s + 8, 800);
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.lineWidth = 6;
        ctx.strokeStyle = '#1b2240';
        ctx.strokeText(t.text, t.x, t.y - k * 30);
        ctx.fillStyle = t.color;
        ctx.fillText(t.text, t.x, t.y - k * 30);
        ctx.restore();
      }
      if (this.z.visible && this.bubble && this.time < this.bubble.until) {
        const z = this.z;
        RH.util.bubble(ctx, z.x + 40 * s, z.y - 110 * s, this.bubble.text, Math.max(13, 16 * s), z.x + 8 * s, z.y - 80 * s);
      }
    }

    drawRoom(ctx, g) {
      const { w, h } = this, { s, wall } = g;
      ctx.fillStyle = '#5f8f8a';
      ctx.fillRect(0, 0, w, wall);
      ctx.fillStyle = '#4e7a75';
      ctx.fillRect(0, wall - 8, w, 8);
      const fl = ctx.createLinearGradient(0, wall, 0, h);
      fl.addColorStop(0, '#b98a5a');
      fl.addColorStop(1, '#d4a571');
      ctx.fillStyle = fl;
      ctx.fillRect(0, wall, w, h - wall);
      ctx.strokeStyle = 'rgba(80,50,20,0.15)';
      ctx.lineWidth = 1;
      for (let y = wall + 18; y < h; y += 22) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke(); }
      // blackboard
      const bw = w * 0.44, bh = wall * 0.62, bx = w * 0.5 - bw / 2, by = wall * 0.14;
      ctx.fillStyle = '#8a5a35';
      ctx.fillRect(bx - 8, by - 8, bw + 16, bh + 16);
      ctx.fillStyle = '#2f4f3f';
      ctx.fillRect(bx, by, bw, bh);
      ctx.fillStyle = 'rgba(255,255,255,0.88)';
      ctx.font = font(clamp(bh * 0.22, 12, 30), 700);
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('KIỂM TRA BÀI CŨ', bx + bw / 2, by + bh * 0.4);
      ctx.font = font(clamp(bh * 0.13, 9, 18), 500);
      ctx.fillText('Ai sẽ là người tiếp theo… 🎃', bx + bw / 2, by + bh * 0.72);
      // pumpkins on the ledge
      ctx.font = font(clamp(bh * 0.28, 14, 34), 400);
      ctx.fillText('🎃', bx + 18, by + bh + 2);
      ctx.fillText('🎃', bx + bw - 18, by + bh + 2);
      // window with moon
      const wx = w * 0.82, wy = wall * 0.15, ww = w * 0.12, wh = wall * 0.6;
      ctx.fillStyle = '#1d2a4d';
      ctx.fillRect(wx, wy, ww, wh);
      ctx.fillStyle = '#fff6c9';
      ctx.beginPath(); ctx.arc(wx + ww * 0.65, wy + wh * 0.35, Math.min(ww, wh) * 0.2, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = '#e8e2d6';
      ctx.lineWidth = 4;
      ctx.strokeRect(wx, wy, ww, wh);
      ctx.beginPath(); ctx.moveTo(wx + ww / 2, wy); ctx.lineTo(wx + ww / 2, wy + wh); ctx.stroke();
      // door
      const dx = g.doorX, dw = Math.max(36, w * 0.07), dh = wall * 0.8;
      ctx.fillStyle = '#1a1414';
      ctx.fillRect(dx - dw / 2, wall - dh, dw, dh);
      ctx.fillStyle = '#9b6b43';
      const open = this.door;
      ctx.fillRect(dx - dw / 2, wall - dh, dw * (1 - open * 0.8), dh);
      ctx.fillStyle = '#ffd23f';
      ctx.beginPath(); ctx.arc(dx - dw / 2 + dw * (1 - open * 0.8) - 6, wall - dh / 2, 3, 0, Math.PI * 2); ctx.fill();
      // cobwebs
      ctx.strokeStyle = 'rgba(255,255,255,0.35)';
      ctx.lineWidth = 1;
      for (const [cx, sx] of [[0, 1], [w, -1]]) {
        for (let r = 15; r <= 60; r += 15) { ctx.beginPath(); ctx.arc(cx, 0, r, sx > 0 ? 0 : Math.PI / 2, sx > 0 ? Math.PI / 2 : Math.PI); ctx.stroke(); }
        for (let a = 0; a <= 4; a++) {
          const t = (a / 4) * (Math.PI / 2);
          ctx.beginPath(); ctx.moveTo(cx, 0); ctx.lineTo(cx + sx * Math.cos(t) * 60, Math.sin(t) * 60); ctx.stroke();
        }
      }
    }

    drawSeat(ctx, st, g) {
      const { s, cw } = g;
      const sp = this.seat(st.i, g);
      const shake = this.dark > 0.5 && !st.bitten ? Math.sin(this.time * 35 + st.i) * 1.2 : 0;
      const x = sp.x + shake, y = sp.y;
      const sink = st.duck * 22 * s;
      // chair back
      ctx.fillStyle = '#6d4a2d';
      ctx.fillRect(x - 13 * s, y - 34 * s, 26 * s, 6 * s);
      RH.art.bust(ctx, x, y - 8 * s + sink, s, st.look, {
        zombie: !!st.bitten, expr: this.dark > 0.5 ? 'scared' : 'normal', t: this.time,
      });
      // desk in front
      const dw = Math.min(cw * 0.62, 70 * s);
      ctx.fillStyle = '#a8794b';
      ctx.fillRect(x - dw / 2, y - 14 * s, dw, 9 * s);
      ctx.fillStyle = '#8a5f37';
      ctx.fillRect(x - dw / 2, y - 5 * s, dw, 10 * s);
      ctx.fillStyle = '#f4f1e8';
      ctx.fillRect(x - dw * 0.2, y - 13 * s, dw * 0.25, 6 * s);
    }

    drawTag(ctx, st, g) {
      const { s } = g;
      const sp = this.seat(st.i, g);
      const fs = clamp(11 * s + 2, 10, 16);
      ctx.font = font(fs, 800);
      const label = fitText(ctx, (st.bitten ? '🧟 ' : '') + st.label, g.cw - 6);
      const tw = ctx.measureText(label).width + fs * 0.8;
      const y = sp.y - 50 * s - fs * 1.5 + st.duck * 22 * s;
      ctx.globalAlpha = this.dark > 0 ? 0.92 : 1;
      ctx.fillStyle = st.bitten ? '#ffd23f' : '#fff';
      roundRect(ctx, sp.x - tw / 2, y, tw, fs * 1.45, fs * 0.45); ctx.fill();
      ctx.fillStyle = '#1b2240';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(label, sp.x, y + fs * 0.75);
      ctx.globalAlpha = 1;
    }

    drawZombie(ctx, g) {
      const z = this.z, s = g.s * 1.15;
      const bob = z.moving ? Math.abs(Math.sin(z.phase)) * 3 * s : 0;
      const sway = z.moving ? Math.sin(z.phase) * 0.08 : Math.sin(this.time * 2) * 0.04;
      ctx.save();
      ctx.translate(z.x + z.dir * z.lunge * 18 * s, z.y - bob);
      ctx.fillStyle = 'rgba(0,0,0,0.25)';
      ctx.beginPath(); ctx.ellipse(0, bob, 14 * s, 4 * s, 0, 0, Math.PI * 2); ctx.fill();
      ctx.scale(z.dir, 1);
      ctx.rotate(sway);
      ctx.lineCap = 'round';
      // legs (one dragging)
      ctx.strokeStyle = '#3b4a5a';
      ctx.lineWidth = 6 * s;
      const step = z.moving ? Math.sin(z.phase) * 6 * s : 0;
      ctx.beginPath(); ctx.moveTo(-3 * s, -26 * s); ctx.lineTo(-5 * s + step, 0); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(4 * s, -26 * s); ctx.lineTo(6 * s - step, 0); ctx.stroke();
      // torso (torn shirt)
      ctx.fillStyle = '#7d8f7a';
      ctx.beginPath();
      ctx.moveTo(-10 * s, -52 * s); ctx.lineTo(10 * s, -52 * s); ctx.lineTo(11 * s, -24 * s);
      ctx.lineTo(6 * s, -28 * s); ctx.lineTo(2 * s, -23 * s); ctx.lineTo(-3 * s, -28 * s); ctx.lineTo(-10 * s, -24 * s);
      ctx.closePath(); ctx.fill();
      // arms forward
      ctx.strokeStyle = ZSKIN;
      ctx.lineWidth = 5 * s;
      const reach = 22 * s + z.lunge * 10 * s;
      ctx.beginPath(); ctx.moveTo(4 * s, -48 * s); ctx.lineTo(4 * s + reach, -46 * s + Math.sin(this.time * 3) * 2 * s); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(4 * s, -42 * s); ctx.lineTo(4 * s + reach - 3 * s, -39 * s + Math.cos(this.time * 3) * 2 * s); ctx.stroke();
      // head
      ctx.fillStyle = ZSKIN;
      ctx.beginPath(); ctx.arc(3 * s, -61 * s, 10 * s, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#4a5a3a';
      ctx.beginPath(); ctx.arc(1 * s, -66 * s, 9 * s, Math.PI * 1.05, Math.PI * 1.9); ctx.fill();
      ctx.fillStyle = '#ff3b3b';
      ctx.beginPath(); ctx.arc(6 * s, -62 * s, 2 * s, 0, Math.PI * 2); ctx.arc(11 * s, -62 * s, 1.6 * s, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = '#2d3a22';
      ctx.lineWidth = 1.5 * s;
      ctx.beginPath(); ctx.moveTo(5 * s, -55 * s); ctx.lineTo(12 * s, -55 * s + z.lunge * 3 * s); ctx.stroke();
      ctx.restore();
      if (z.dizzy > 0) {
        ctx.font = font(18 * s, 400);
        ctx.textAlign = 'center';
        ctx.fillText('💫', z.x + Math.cos(this.time * 8) * 10 * s, z.y - 80 * s);
      }
    }

    drawBat(ctx, b) {
      const flap = Math.sin(this.time * 18 + b.ph) * 6;
      ctx.fillStyle = '#0b0b12';
      ctx.beginPath();
      ctx.moveTo(b.x, b.y);
      ctx.quadraticCurveTo(b.x - 10, b.y - 8 - flap, b.x - 18, b.y + flap * 0.3);
      ctx.quadraticCurveTo(b.x - 9, b.y - 2, b.x, b.y + 4);
      ctx.quadraticCurveTo(b.x + 9, b.y - 2, b.x + 18, b.y + flap * 0.3);
      ctx.quadraticCurveTo(b.x + 10, b.y - 8 - flap, b.x, b.y);
      ctx.fill();
    }
  }

  RH.games.push(new ZombieGame());
})(window.RH);
