// Mystery toilet: a few students go into the stalls, toilets flush one by one,
// and whoever doesn't come back out was flushed away.
(function (RH) {
  const { rand, pick, shuffle, lerp, ease, roundRect, clamp, short, font } = RH.util;
  const S = RH.sound;

  class ToiletGame {
    constructor() {
      this.id = 'toilet';
      this.name = 'Bồn cầu';
      this.icon = '🚽';
      this.tl = new RH.Timeline();
      this.time = 0;
      this.w = 800; this.h = 500;
      this.people = [];
      this.stalls = [];
      this.drops = [];
      this.texts = [];
    }

    setup(names) {
      this.tl.clear();
      this.people = names.map((name, i) => ({
        name, label: short(name), look: RH.art.look(), slot: i, state: 'queue', fx: 0, fy: 0, walking: false, phase: rand(0, 6),
        paper: false, alpha: 1,
      }));
      for (const p of this.people) Object.assign(p, this.slotPos(p.slot));
      const k = clamp(names.length, 1, 5);
      this.stalls = Array.from({ length: k }, () => ({ occ: null, open: 0, shake: 0, swirl: 0, flushed: null }));
      this.drops = [];
      this.texts = [];
      this.bubble = null;
    }

    resize(w, h) { this.w = w; this.h = h; }

    s() { return clamp(Math.min(this.w / 900, this.h / 520), 0.6, 1.5); }

    // Queue spots as fractions of the stage, in rows on the floor.
    slotPos(i) {
      const n = Math.max(1, this.people.length || 1);
      const cols = clamp(Math.ceil(n / 3), 4, 10);
      const rows = Math.ceil(n / cols);
      const r = Math.floor(i / cols), c = i % cols;
      const inRow = Math.min(cols, n - r * cols);
      return { fx: 0.08 + ((c + 0.5 + (cols - inRow) / 2) / cols) * 0.84, fy: 0.68 + (rows > 1 ? r / (rows - 1) : 0.5) * 0.24 };
    }

    stallGeo(i) {
      const { w, h } = this, s = this.s();
      const k = this.stalls.length;
      const sw = Math.min(w * 0.15, 140 * s), gap = 12 * s;
      const total = k * sw + (k - 1) * gap;
      const x = (w - total) / 2 + i * (sw + gap);
      const floor = h * 0.56, sh = h * 0.36;
      return { x, y: floor - sh, w: sw, h: sh, floor, doorX: x + sw / 2 };
    }

    update(dt) {
      this.time += dt;
      this.tl.update(dt);
      for (const p of this.people) if (p.walking) p.phase += dt * 9;
      for (const d of this.drops) { d.x += d.vx * dt; d.y += d.vy * dt; d.vy += 700 * dt; d.life -= dt; }
      this.drops = this.drops.filter((d) => d.life > 0);
      for (const t of this.texts) t.life -= dt;
      this.texts = this.texts.filter((t) => t.life > 0);
      for (const st of this.stalls) st.swirl += dt * 8;
    }

    walk(p, fx, fy, speed = 1) {
      const sx = p.fx, sy = p.fy;
      const d = Math.hypot((fx - sx) * this.w, (fy - sy) * this.h);
      p.walking = true;
      return this.tl.tween(Math.max(0.3, d / (150 * this.s() * speed)), (t) => {
        p.fx = lerp(sx, fx, t); p.fy = lerp(sy, fy, t);
      }).then(() => (p.walking = false));
    }

    door(st, to, dur = 0.25) {
      const from = st.open;
      return this.tl.tween(dur, (t) => (st.open = lerp(from, to, t)));
    }

    async enterStall(p, i, delay) {
      await this.tl.wait(delay);
      const g = this.stallGeo(i), st = this.stalls[i];
      p.state = 'walking';
      await this.walk(p, g.doorX / this.w, (g.floor + 4) / this.h, 1.3);
      await this.door(st, 1);
      await this.tl.tween(0.25, (t) => (p.alpha = 1 - t));
      p.state = 'inside';
      st.occ = p;
      await this.door(st, 0);
    }

    async leaveStall(i, withPaper) {
      const st = this.stalls[i], p = st.occ;
      await this.door(st, 1);
      p.state = 'walking';
      p.paper = withPaper;
      await this.tl.tween(0.2, (t) => (p.alpha = t));
      st.occ = null;
      this.door(st, 0, 0.3);
      const home = this.slotPos(p.slot);
      this.walk(p, home.fx, home.fy, 1.1).then(() => { p.state = 'queue'; });
    }

    async shakeStall(st, dur, amp) {
      await this.tl.tween(dur, (t) => (st.shake = amp * Math.sin(t * Math.PI)));
      st.shake = 0;
    }

    splash(i, n = 16) {
      const g = this.stallGeo(i);
      for (let k = 0; k < n; k++) {
        this.drops.push({ x: g.doorX + rand(-g.w * 0.3, g.w * 0.3), y: g.y + 4, vx: rand(-90, 90), vy: rand(-260, -80), life: rand(0.6, 1) });
      }
    }

    async play(winners, onPick) {
      for (let wi = 0; wi < winners.length; wi++) {
        const target = this.people.find((p) => p.name === winners[wi] && p.state === 'queue');
        if (!target) continue;
        const others = shuffle(this.people.filter((p) => p.state === 'queue' && p !== target && !winners.includes(p.name)));
        const occupants = shuffle([target, ...others.slice(0, this.stalls.length - 1)]);
        for (const st of this.stalls) { st.flushed = null; st.open = 0; }
        await Promise.all(occupants.map((p, i) => this.enterStall(p, i, i * 0.25)));
        this.bubble = { text: '🤫 …', until: this.time + 1 };
        await this.tl.wait(0.9);

        const order = shuffle(occupants.map((_, i) => i).filter((i) => occupants[i] !== target));
        const fakeAt = RH.settings.drama && order.length ? Math.floor(Math.random() * order.length) : -1;
        for (let k = 0; k < order.length; k++) {
          const i = order[k];
          const st = this.stalls[i];
          if (k === fakeAt) {
            // Sounds like the big one… but they walk out, toilet paper stuck to a shoe.
            S.flush(true);
            this.splash(i, 10);
            await this.shakeStall(st, 1.2, 5);
            await this.tl.wait(0.3);
            S.uhoh();
            await this.leaveStall(i, true);
            const g = this.stallGeo(i);
            this.bubble = { text: pick(['Phù… suýt nữa! 😮‍💨', 'Thoát rồi! 🧻', 'Ai dội mạnh thế?!']), x: g.doorX, y: g.y - 10, until: this.time + 1.6 };
            await this.tl.wait(0.9);
          } else {
            S.flush(false);
            await this.shakeStall(st, 0.5, 1.5);
            await this.tl.wait(0.25);
            await this.leaveStall(i, false);
            await this.tl.wait(0.35);
          }
        }
        // The last stall: the real flush.
        const ti = occupants.indexOf(target);
        const st = this.stalls[ti];
        await this.tl.wait(0.5);
        S.flush(true);
        RH.fx.shake(2);
        this.splash(ti, 26);
        await this.shakeStall(st, 1.4, 7);
        st.occ = null;
        st.flushed = target;
        target.state = 'flushed';
        await this.door(st, 1, 0.35);
        st.swirlStart = this.time;
        await this.tl.wait(1.1);
        const g = this.stallGeo(ti);
        this.texts.push({ text: '🌀 CUỐN TRÔI!', x: g.doorX, y: g.y - 6, life: 1.4 });
        target.state = 'gone';
        S.ding();
        onPick(target.name, wi);
        await this.tl.wait(1.3);
        st.flushed = null;
        await this.door(st, 0);
        // wait for everyone to get back in line
        await this.tl.wait(0.6);
      }
    }

    // ---------- drawing ----------
    draw(ctx, w, h) {
      const s = this.s();
      const floorY = h * 0.56;
      // tiled wall
      ctx.fillStyle = '#d7eef2';
      ctx.fillRect(0, 0, w, floorY);
      ctx.strokeStyle = 'rgba(120,170,180,0.35)';
      ctx.lineWidth = 1;
      const tile = 26 * s;
      for (let y = 0; y < floorY; y += tile) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke(); }
      for (let x = 0; x < w; x += tile) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, floorY); ctx.stroke(); }
      ctx.fillStyle = '#5fb3c2';
      ctx.fillRect(0, floorY - h * 0.08, w, 6 * s);
      // sign
      ctx.fillStyle = '#1b5e9b';
      roundRect(ctx, w / 2 - 90 * s, h * 0.035, 180 * s, 30 * s, 8 * s); ctx.fill();
      ctx.fillStyle = '#fff';
      ctx.font = font(15 * s, 800);
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('🚻 NHÀ VỆ SINH', w / 2, h * 0.035 + 15 * s);
      // floor
      const ft = 34 * s;
      for (let y = floorY, r = 0; y < h; y += ft, r++) {
        for (let x = 0, c = 0; x < w; x += ft, c++) {
          ctx.fillStyle = (r + c) % 2 ? '#e9eef2' : '#cfd8df';
          ctx.fillRect(x, y, ft, ft);
        }
      }
      ctx.fillStyle = 'rgba(0,0,0,0.08)';
      ctx.fillRect(0, floorY, w, 6 * s);
      // puddle under flooded stalls
      this.stalls.forEach((st, i) => this.drawStall(ctx, st, i));
      for (const d of this.drops) {
        ctx.fillStyle = `rgba(90,170,230,${Math.min(1, d.life * 2)})`;
        ctx.beginPath(); ctx.ellipse(d.x, d.y, 2.5, 4, 0, 0, Math.PI * 2); ctx.fill();
      }
      // people in line / walking
      const vis = this.people.filter((p) => p.state === 'queue' || p.state === 'walking').sort((a, b) => a.fy - b.fy);
      for (const p of vis) {
        const x = p.fx * w, y = p.fy * h, ps = s * (0.85 + (p.fy - 0.56) * 1.1);
        RH.art.student(ctx, x, y, ps, p.look, { phase: p.phase, t: this.time, arms: p.walking ? 'swing' : 'down', alpha: p.alpha, expr: p.paper ? 'happy' : 'normal' });
        if (p.paper) {
          ctx.fillStyle = '#fff';
          ctx.strokeStyle = '#ccc';
          ctx.beginPath();
          ctx.moveTo(x + 3 * ps, y - 1);
          for (let k = 1; k <= 6; k++) ctx.lineTo(x + 3 * ps - k * 7 * ps, y + Math.sin(this.time * 6 + k) * 2 * ps);
          ctx.lineTo(x - 39 * ps, y + 4 * ps);
          for (let k = 6; k >= 1; k--) ctx.lineTo(x + 3 * ps - k * 7 * ps, y + 4 * ps + Math.sin(this.time * 6 + k) * 2 * ps);
          ctx.closePath(); ctx.fill(); ctx.stroke();
        }
      }
      for (const p of vis) {
        const x = p.fx * w, y = p.fy * h, ps = s * (0.85 + (p.fy - 0.56) * 1.1);
        RH.art.tag(ctx, x, y - 50 * ps, p.label, ps, false, p.alpha);
      }
      for (const t of this.texts) {
        ctx.save();
        ctx.globalAlpha = Math.min(1, t.life * 2);
        ctx.font = font(28 * s, 800);
        ctx.textAlign = 'center';
        ctx.lineWidth = 6;
        ctx.strokeStyle = '#1b2240';
        ctx.strokeText(t.text, t.x, t.y - (1.4 - t.life) * 30);
        ctx.fillStyle = '#4dd0ff';
        ctx.fillText(t.text, t.x, t.y - (1.4 - t.life) * 30);
        ctx.restore();
      }
      if (this.bubble && this.time < this.bubble.until) {
        const b = this.bubble;
        const bx = b.x ?? w / 2, by = b.y ?? h * 0.14;
        RH.util.bubble(ctx, bx, by - 22, b.text, Math.max(13, 16 * s), b.x !== undefined ? bx : undefined, by);
      }
    }

    drawStall(ctx, st, i) {
      const g = this.stallGeo(i), s = this.s();
      ctx.save();
      ctx.translate(Math.sin(this.time * 50) * st.shake, 0);
      // partition walls
      ctx.fillStyle = '#7a8fa6';
      ctx.fillRect(g.x - 4 * s, g.y, 6 * s, g.h);
      ctx.fillRect(g.x + g.w - 2 * s, g.y, 6 * s, g.h);
      // inside
      ctx.fillStyle = '#7f9fae';
      ctx.fillRect(g.x + 2 * s, g.y + 8 * s, g.w - 4 * s, g.h - 8 * s);
      this.drawToilet(ctx, st, g, s);
      // door (hinged on the left, swings toward us)
      const dw = (g.w - 6 * s) * (1 - st.open * 0.82);
      const dy = g.y + 10 * s, dh = g.h - 18 * s;
      ctx.fillStyle = '#4f9fd1';
      roundRect(ctx, g.x + 2 * s, dy, dw, dh, 4 * s); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.18)';
      ctx.fillRect(g.x + 2 * s, dy, dw, 6 * s);
      if (st.open < 0.5) {
        ctx.fillStyle = '#e8eef3';
        ctx.beginPath(); ctx.arc(g.x + dw - 8 * s, dy + dh / 2, 3.5 * s, 0, Math.PI * 2); ctx.fill();
        ctx.font = font(15 * s, 800);
        ctx.fillStyle = 'rgba(255,255,255,0.85)';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(String(i + 1), g.x + dw / 2, dy + dh * 0.3);
      }
      // occupied / free light
      const busy = !!st.occ;
      ctx.fillStyle = busy ? '#ff4d5e' : '#2fd17c';
      ctx.beginPath(); ctx.arc(g.doorX, g.y - 2 * s, 6 * s, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = busy ? 'rgba(255,77,94,0.3)' : 'rgba(47,209,124,0.3)';
      ctx.beginPath(); ctx.arc(g.doorX, g.y - 2 * s, 11 * s, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
    }

    drawToilet(ctx, st, g, s) {
      const cx = g.doorX, by = g.floor - 26 * s;
      ctx.fillStyle = '#fbfdff';
      ctx.strokeStyle = '#5d7684';
      ctx.lineWidth = 1.5;
      roundRect(ctx, cx - 16 * s, by - 46 * s, 32 * s, 24 * s, 5 * s); ctx.fill(); ctx.stroke();
      ctx.fillRect(cx - 12 * s, by - 8 * s, 24 * s, 30 * s);
      ctx.strokeRect(cx - 12 * s, by - 8 * s, 24 * s, 30 * s);
      ctx.beginPath(); ctx.ellipse(cx, by - 8 * s, 26 * s, 12 * s, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#7cc6f2';
      ctx.beginPath(); ctx.ellipse(cx, by - 9 * s, 19 * s, 8 * s, 0, 0, Math.PI * 2); ctx.fill();
      if (st.flushed) {
        // swirl with the name tag spinning down the drain
        ctx.strokeStyle = 'rgba(255,255,255,0.8)';
        ctx.lineWidth = 2;
        for (let k = 0; k < 3; k++) {
          ctx.beginPath();
          ctx.ellipse(cx, by - 9 * s, (17 - k * 5) * s, (7 - k * 2) * s, 0, st.swirl + k, st.swirl + k + 3.5);
          ctx.stroke();
        }
        const k = clamp((this.time - (st.swirlStart || this.time)) / 1.1, 0, 1);
        if (k < 1) {
          ctx.save();
          ctx.translate(cx + Math.cos(st.swirl) * 12 * s * (1 - k), by - 9 * s + Math.sin(st.swirl) * 4 * s * (1 - k));
          ctx.rotate(st.swirl);
          ctx.scale(1 - k * 0.9, 1 - k * 0.9);
          RH.art.tag(ctx, 0, 8, st.flushed.label, s * 1.1, true);
          ctx.restore();
        }
      }
    }
  }

  RH.games.push(new ToiletGame());
})(window.RH);
