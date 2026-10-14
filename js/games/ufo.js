// UFO abduction: a street full of students, night falls, a UFO beams the chosen ones up.
(function (RH) {
  const { rand, pick, clamp, lerp, ease, roundRect, seeded, short, font } = RH.util;
  const S = RH.sound;

  const SHOPS = [
    ['BÁNH MÌ', '#e2583e'], ['TRÀ SỮA', '#3c8d5a'], ['HỚT TÓC', '#2f6db5'], ['BÚN CHẢ', '#d99a1b'],
    ['PHỞ BÒ', '#c0392b'], ['CƠM TẤM', '#8e44ad'], ['KEM', '#e06b93'], ['NHÀ SÁCH', '#16a085'],
    ['CÀ PHÊ', '#6d4c41'], ['ĐIỆN THOẠI', '#34495e'], ['TẠP HOÁ', '#d35400'],
  ];
  const WALLS = ['#f3e3c7', '#e9d6d2', '#d8e4ea', '#efe6cf', '#e3dccd', '#f2d9c0', '#dfe7d6', '#ece0e8'];
  const VEH = ['#e74c3c', '#f4f6f7', '#3498db', '#f1c40f', '#95a5a6', '#2ecc71', '#e67e22'];

  // Layout as fractions of canvas height.
  const GROUND = 0.46, ROAD_T = 0.5, ROAD_B = 0.66, WALK_MIN = 0.71, WALK_MAX = 0.95;
  const LANES = [{ y: 0.555, dir: -1 }, { y: 0.625, dir: 1 }];

  class UFOGame {
    constructor() {
      this.id = 'ufo';
      this.name = 'UFO';
      this.icon = '🛸';
      this.tl = new RH.Timeline();
      this.w = 800; this.h = 500;
      this.time = 0;
      this.people = [];
      this.vehicles = [];
      this.buildCity();
      this.reset();
    }

    reset() {
      this.night = 0;
      this.panic = false;
      this.ufo = { x: -300, y: -300, tilt: 0, visible: false };
      this.beam = 0;      // 0..1 opacity
      this.beamWide = 1;  // 0.35 = searchlight, 1 = tractor beam
      this.beamTarget = null;
      this.bubble = null;
      this.count = 0;
      this.total = 0;
    }

    buildCity() {
      const r = seeded(11);
      this.buildings = [];
      let x = -0.01, i = 0;
      while (x < 1.02) {
        const bw = 0.075 + r() * 0.05;
        this.buildings.push({
          x, w: bw, h: 0.17 + r() * 0.17, wall: WALLS[i % WALLS.length], shop: SHOPS[i % SHOPS.length],
          seed: Math.floor(r() * 1e6), roof: r() < 0.5,
        });
        x += bw + 0.003;
        i++;
      }
      this.trees = [0.13, 0.41, 0.69, 0.93].map((t) => ({ x: t + r() * 0.03, s: 0.9 + r() * 0.3 }));
      this.lamps = [0.05, 0.27, 0.5, 0.73, 0.96];
      this.stars = Array.from({ length: 70 }, () => ({ x: r(), y: r() * 0.3, s: r() * 1.4 + 0.4, tw: r() * 6 }));
      this.clouds = [{ x: 0.12, y: 0.07, s: 1 }, { x: 0.52, y: 0.04, s: 1.3 }, { x: 0.83, y: 0.11, s: 0.9 }];
    }

    setup(names) {
      this.tl.clear();
      this.reset();
      const { w } = this;
      this.people = names.map((name) => this.makePerson(name, rand(20, w - 20)));
      this.vehicles = [];
      for (const lane of LANES) {
        const n = Math.max(2, Math.round(w / 260));
        for (let i = 0; i < n; i++) this.vehicles.push(this.makeVehicle(lane, (i + rand(0, 0.6)) * (w / n)));
      }
    }

    makePerson(name, x) {
      return {
        name, label: short(name), x, ny: rand(WALK_MIN, WALK_MAX), dir: Math.random() < 0.5 ? -1 : 1,
        speed: rand(18, 42), phase: rand(0, 6), vy: rand(-0.01, 0.01), look: RH.art.look(),
        state: 'walk', lift: 0, alpha: 1,
      };
    }

    makeVehicle(lane, x) {
      return { lane, x, type: Math.random() < 0.55 ? 'moto' : 'car', color: pick(VEH), speed: rand(55, 110) };
    }

    resize(w, h) {
      const k = w / this.w;
      for (const p of this.people) p.x *= k;
      for (const v of this.vehicles) v.x *= k;
      this.ufo.x *= k;
      this.w = w; this.h = h;
    }

    update(dt) {
      this.time += dt;
      this.tl.update(dt);
      const { w } = this;
      for (const p of this.people) {
        if (p.state !== 'walk') continue;
        const sp = p.speed * (this.panic ? 2.6 : 1);
        p.x += p.dir * sp * dt;
        p.phase += dt * sp * 0.16;
        p.ny = clamp(p.ny + p.vy * dt * (this.panic ? 3 : 1), WALK_MIN, WALK_MAX);
        if (Math.random() < dt * (this.panic ? 1.2 : 0.06)) p.dir *= -1;
        if (Math.random() < dt * 0.3) p.vy = rand(-0.02, 0.02);
        if (p.x < 14) { p.x = 14; p.dir = 1; }
        if (p.x > w - 14) { p.x = w - 14; p.dir = -1; }
      }
      for (const v of this.vehicles) {
        v.x += v.lane.dir * v.speed * dt * (this.h / 500);
        if (v.x < -120 || v.x > w + 120) {
          Object.assign(v, this.makeVehicle(v.lane, v.lane.dir > 0 ? -100 - rand(0, 200) : w + 100 + rand(0, 200)));
        }
      }
    }

    // ---------- choreography ----------
    async play(winners, onPick) {
      const { tl } = this;
      this.total = winners.length;
      this.count = 0;
      await tl.tween(1.1, (t) => (this.night = t));
      S.ufo();
      this.panic = true;
      const u = this.ufo;
      u.visible = true;
      u.x = this.w / 2;
      const hoverY = () => this.h * 0.17;
      await tl.tween(1.4, (t) => (u.y = lerp(-140, hoverY(), ease.outBack(t, 1.2))));

      for (let i = 0; i < winners.length; i++) {
        const p = this.people.find((q) => q.name === winners[i] && q.state === 'walk');
        if (!p) continue;
        // Searchlight sweep over a couple of decoys for suspense.
        await this.searchlight();
        const sweeps = 2 + Math.floor(Math.random() * 2);
        for (let s = 0; s < sweeps; s++) await this.moveUfo(rand(this.w * 0.1, this.w * 0.9), 0.55);
        if (RH.settings.drama && Math.random() < 0.7) {
          const decoys = this.people.filter((q) => q.state === 'walk' && !winners.includes(q.name));
          if (decoys.length) await this.fakeOut(pick(decoys));
        }
        p.state = 'caught';
        await this.moveUfo(() => p.x, 0.8);
        this.beamTarget = p;
        await tl.tween(0.25, (t) => (this.beam = lerp(0.5, 0, t)));
        // Tractor beam.
        this.beamWide = 1;
        S.beam();
        await tl.tween(0.35, (t) => (this.beam = t));
        p.state = 'lift';
        await tl.tween(1.5, (t) => (p.lift = ease.inOut(t)));
        p.state = 'gone';
        RH.fx.shake(1);
        this.count++;
        S.ding();
        onPick(p.name, i);
        await tl.tween(0.3, (t) => (this.beam = 1 - t));
        this.beamTarget = null;
        await tl.wait(0.35);
      }

      await tl.wait(0.4);
      S.whoosh();
      const sx = u.x, sy = u.y;
      await tl.tween(1.1, (t) => {
        const e = ease.inCubic(t);
        u.x = lerp(sx, this.w + 260, e);
        u.y = lerp(sy, -200, e);
        u.tilt = 0.35 * e;
      });
      u.visible = false;
      u.tilt = 0;
      this.panic = false;
      await tl.tween(0.9, (t) => (this.night = 1 - t));
    }

    async searchlight() {
      this.beamWide = 0.35;
      this.beamTarget = null;
      await this.tl.tween(0.3, (t) => (this.beam = t * 0.5));
    }

    // Beam up the wrong person halfway, sputter, drop them, carry on.
    async fakeOut(d) {
      const { tl } = this;
      d.state = 'caught';
      await this.moveUfo(() => d.x, 0.8);
      this.beamTarget = d;
      await tl.tween(0.25, (t) => (this.beam = lerp(0.5, 0, t)));
      this.beamWide = 1;
      S.beam();
      await tl.tween(0.35, (t) => (this.beam = t));
      d.state = 'lift';
      const peak = rand(0.25, 0.4);
      await tl.tween(1.0, (t) => (d.lift = peak * ease.outCubic(t)));
      await tl.wait(0.25);
      S.uhoh();
      this.say(pick(['Ơ… nhầm rồi!', 'Không phải bạn này!', 'Hmm… thả ra!', 'Ủa, ai đây?']));
      await tl.tween(0.5, (t) => (this.beam = (Math.sin(t * 45) > 0 ? 1 : 0.15) * (1 - t)));
      this.beam = 0;
      await tl.tween(0.35, (t) => (d.lift = peak * (1 - ease.inCubic(t))));
      d.lift = 0;
      d.state = 'walk';
      d.dir = d.x < this.w / 2 ? -1 : 1;
      await tl.wait(0.6);
      await this.searchlight();
    }

    say(text, dur = 1.8) { this.bubble = { text, until: this.time + dur }; }

    moveUfo(target, dur) {
      const u = this.ufo;
      const sx = u.x;
      const getX = typeof target === 'function' ? target : () => target;
      return this.tl.tween(dur, (t) => {
        const e = ease.inOut(t);
        u.x = lerp(sx, getX(), e);
        u.tilt = Math.sin(t * Math.PI) * 0.12 * Math.sign(getX() - sx);
      });
    }

    // ---------- drawing ----------
    draw(ctx, w, h) {
      const n = this.night;
      this.drawSky(ctx, w, h, n);
      this.drawBuildings(ctx, w, h);
      this.drawStreet(ctx, w, h);
      for (const v of this.vehicles) this.drawVehicle(ctx, v, h);
      for (const t of this.trees) this.drawTree(ctx, t.x * w, GROUND * h + 6, t.s * h / 500);
      for (const lx of this.lamps) this.drawLampPost(ctx, lx * w, h);

      if (n > 0) {
        ctx.fillStyle = `rgba(14,18,58,${0.5 * n})`;
        ctx.fillRect(0, 0, w, h);
        this.drawLitWindows(ctx, w, h, n);
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        for (const lx of this.lamps) {
          const x = lx * w, y = ROAD_T * h - h * 0.15;
          const g = ctx.createRadialGradient(x, y, 2, x, y, h * 0.16);
          g.addColorStop(0, `rgba(255,230,150,${0.9 * n})`);
          g.addColorStop(1, 'rgba(255,200,100,0)');
          ctx.fillStyle = g;
          ctx.beginPath(); ctx.arc(x, y, h * 0.16, 0, Math.PI * 2); ctx.fill();
        }
        for (const v of this.vehicles) {
          const s = h / 500, hx = v.x + v.lane.dir * (v.type === 'car' ? 32 : 16) * s, hy = v.lane.y * h - 10 * s;
          const g = ctx.createRadialGradient(hx, hy, 1, hx, hy, 34 * s);
          g.addColorStop(0, `rgba(255,245,200,${0.8 * n})`);
          g.addColorStop(1, 'rgba(255,240,180,0)');
          ctx.fillStyle = g;
          ctx.beginPath(); ctx.arc(hx, hy, 34 * s, 0, Math.PI * 2); ctx.fill();
        }
        ctx.restore();
      }

      const sorted = this.people.filter((p) => p.state !== 'gone' && p.state !== 'lift').sort((a, b) => a.ny - b.ny);
      for (const p of sorted) this.drawPersonAt(ctx, p, h);

      if (this.ufo.visible && this.beam > 0) this.drawBeam(ctx, w, h);
      for (const p of this.people) if (p.state === 'lift') this.drawPersonAt(ctx, p, h);
      if (this.ufo.visible) this.drawUFO(ctx, this.ufo.x, this.ufo.y, this.ufoSize());
      if (this.ufo.visible && this.bubble && this.time < this.bubble.until) this.drawBubble(ctx, w);
    }

    drawBubble(ctx, w) {
      const S0 = this.ufoSize(), u = this.ufo;
      const fs = Math.max(13, S0 * 0.08);
      ctx.font = font(fs, 800);
      const tw = ctx.measureText(this.bubble.text).width + fs * 1.2, th = fs * 1.9;
      const right = u.x + S0 * 0.4 + tw < w - 8;
      const bx = right ? u.x + S0 * 0.4 : u.x - S0 * 0.4 - tw, by = u.y - S0 * 0.32 - th;
      const tailX = right ? bx + fs : bx + tw - fs;
      ctx.fillStyle = '#fff';
      roundRect(ctx, bx, by, tw, th, th * 0.4);
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(tailX - 6, by + th - 1);
      ctx.lineTo(right ? u.x + S0 * 0.22 : u.x - S0 * 0.22, u.y - S0 * 0.12);
      ctx.lineTo(tailX + 6, by + th - 1);
      ctx.fill();
      ctx.fillStyle = '#1b2240';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(this.bubble.text, bx + tw / 2, by + th / 2 + 1);
    }

    ufoSize() { return Math.min(this.w * 0.24, this.h * 0.42, 280); }

    drawSky(ctx, w, h, n) {
      const g = ctx.createLinearGradient(0, 0, 0, GROUND * h);
      const mix = (a, b) => `rgb(${a.map((v, i) => Math.round(lerp(v, b[i], n))).join(',')})`;
      g.addColorStop(0, mix([120, 196, 240], [18, 24, 70]));
      g.addColorStop(1, mix([214, 240, 255], [58, 60, 120]));
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, w, GROUND * h);
      if (n > 0) {
        for (const s of this.stars) {
          ctx.globalAlpha = n * (0.5 + 0.5 * Math.sin(this.time * 2 + s.tw));
          ctx.fillStyle = '#fff';
          ctx.fillRect(s.x * w, s.y * h, s.s, s.s);
        }
        ctx.globalAlpha = 1;
      }
      if (n < 1) {
        ctx.globalAlpha = 1 - n;
        ctx.fillStyle = '#fff';
        for (const c of this.clouds) {
          const x = ((c.x * w + this.time * 6 * c.s) % (w + 200)) - 100, y = c.y * h, s = c.s * h / 500;
          ctx.beginPath();
          ctx.arc(x, y, 22 * s, 0, Math.PI * 2);
          ctx.arc(x + 26 * s, y - 8 * s, 26 * s, 0, Math.PI * 2);
          ctx.arc(x + 54 * s, y, 20 * s, 0, Math.PI * 2);
          ctx.arc(x + 26 * s, y + 8 * s, 20 * s, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.globalAlpha = 1;
      }
    }

    eachWindow(b, w, h, fn) {
      const bx = b.x * w, bw = b.w * w, top = GROUND * h - b.h * h;
      const ws = Math.max(8, h * 0.022), gap = ws * 0.9;
      const cols = Math.max(1, Math.floor((bw - gap) / (ws + gap)));
      const rows = Math.max(0, Math.floor((b.h * h - h * 0.09) / (ws * 1.3 + gap)));
      const offX = bx + (bw - (cols * (ws + gap) - gap)) / 2;
      const r = seeded(b.seed);
      for (let j = 0; j < rows; j++)
        for (let i = 0; i < cols; i++) fn(offX + i * (ws + gap), top + gap * 1.4 + j * (ws * 1.3 + gap), ws, ws * 1.3, r());
    }

    drawBuildings(ctx, w, h) {
      const base = GROUND * h;
      for (const b of this.buildings) {
        const bx = b.x * w, bw = b.w * w, top = base - b.h * h;
        ctx.fillStyle = b.wall;
        ctx.fillRect(bx, top, bw, b.h * h);
        ctx.fillStyle = 'rgba(0,0,0,0.08)';
        ctx.fillRect(bx, top, bw, 4);
        if (b.roof) { ctx.fillStyle = '#b5564a'; ctx.fillRect(bx - 2, top - 4, bw + 4, 5); }
        this.eachWindow(b, w, h, (x, y, ww, wh) => {
          ctx.fillStyle = '#9fc3d6';
          ctx.fillRect(x, y, ww, wh);
          ctx.fillStyle = 'rgba(255,255,255,0.5)';
          ctx.fillRect(x, y, ww, 2);
        });
        // Shop front: sign, striped awning, door.
        const s = h / 500;
        const signH = 15 * s, awnH = 8 * s, signY = base - 40 * s;
        ctx.fillStyle = b.shop[1];
        ctx.fillRect(bx + 3, signY, bw - 6, signH);
        ctx.fillStyle = '#fff';
        ctx.font = font(Math.max(7, 9 * s), 800);
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(RH.util.fitText(ctx, b.shop[0], bw - 10), bx + bw / 2, signY + signH / 2 + 1);
        const stripes = Math.max(3, Math.round(bw / (10 * s)));
        for (let i = 0; i < stripes; i++) {
          ctx.fillStyle = i % 2 ? '#fff' : b.shop[1];
          ctx.fillRect(bx + 3 + (i * (bw - 6)) / stripes, signY + signH, (bw - 6) / stripes + 0.5, awnH);
        }
        ctx.fillStyle = '#5b4a3c';
        ctx.fillRect(bx + bw * 0.15, signY + signH + awnH, bw * 0.7, base - (signY + signH + awnH));
        ctx.fillStyle = 'rgba(255,255,255,0.15)';
        ctx.fillRect(bx + bw * 0.2, signY + signH + awnH + 3, bw * 0.6, 3);
      }
    }

    drawLitWindows(ctx, w, h, n) {
      for (const b of this.buildings) {
        this.eachWindow(b, w, h, (x, y, ww, wh, r) => {
          if (r < 0.45) return;
          ctx.fillStyle = `rgba(255,214,120,${n * (0.6 + r * 0.4)})`;
          ctx.fillRect(x, y, ww, wh);
        });
      }
    }

    drawStreet(ctx, w, h) {
      ctx.fillStyle = '#d6cdbb';
      ctx.fillRect(0, GROUND * h, w, (ROAD_T - GROUND) * h);
      ctx.fillStyle = '#b9ae98';
      ctx.fillRect(0, ROAD_T * h - 3, w, 3);
      ctx.fillStyle = '#5e6572';
      ctx.fillRect(0, ROAD_T * h, w, (ROAD_B - ROAD_T) * h);
      ctx.strokeStyle = '#f2f2f2';
      ctx.lineWidth = Math.max(2, h * 0.005);
      ctx.setLineDash([h * 0.05, h * 0.04]);
      ctx.beginPath();
      ctx.moveTo(0, ((ROAD_T + ROAD_B) / 2) * h);
      ctx.lineTo(w, ((ROAD_T + ROAD_B) / 2) * h);
      ctx.stroke();
      ctx.setLineDash([]);
      // Zebra crossing
      ctx.fillStyle = 'rgba(255,255,255,0.85)';
      const cx = w * 0.72, sw = h * 0.016;
      for (let y = ROAD_T * h + 4; y < ROAD_B * h - 4; y += sw * 2) ctx.fillRect(cx, y, w * 0.07, sw);
      // Plaza
      ctx.fillStyle = '#b9ae98';
      ctx.fillRect(0, ROAD_B * h, w, 4);
      const g = ctx.createLinearGradient(0, ROAD_B * h, 0, h);
      g.addColorStop(0, '#e6dfcf');
      g.addColorStop(1, '#efe9dc');
      ctx.fillStyle = g;
      ctx.fillRect(0, ROAD_B * h + 4, w, h);
      ctx.strokeStyle = 'rgba(0,0,0,0.05)';
      ctx.lineWidth = 1;
      for (let x = 0; x < w; x += h * 0.08) {
        ctx.beginPath(); ctx.moveTo(x, ROAD_B * h + 4); ctx.lineTo(x - h * 0.05, h); ctx.stroke();
      }
      // Bus stop
      const bx = w * 0.035, by = ROAD_B * h - 2, s = h / 500;
      ctx.fillStyle = '#2d6cb5';
      ctx.fillRect(bx, by - 44 * s, 34 * s, 10 * s);
      ctx.fillStyle = '#fff';
      ctx.font = font(7 * s, 800);
      ctx.textAlign = 'center';
      ctx.fillText('XE BUÝT', bx + 17 * s, by - 39 * s);
      ctx.fillStyle = '#777';
      ctx.fillRect(bx + 15 * s, by - 34 * s, 3 * s, 34 * s);
    }

    drawTree(ctx, x, y, s) {
      ctx.fillStyle = '#7a5537';
      ctx.fillRect(x - 3 * s, y - 34 * s, 6 * s, 34 * s);
      ctx.fillStyle = '#3f9b4f';
      ctx.beginPath();
      ctx.arc(x, y - 48 * s, 18 * s, 0, Math.PI * 2);
      ctx.arc(x - 14 * s, y - 38 * s, 13 * s, 0, Math.PI * 2);
      ctx.arc(x + 14 * s, y - 38 * s, 13 * s, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.12)';
      ctx.beginPath(); ctx.arc(x - 6 * s, y - 54 * s, 8 * s, 0, Math.PI * 2); ctx.fill();
    }

    drawLampPost(ctx, x, h) {
      const base = ROAD_T * h, top = base - h * 0.15;
      ctx.strokeStyle = '#4a5160';
      ctx.lineWidth = Math.max(2, h * 0.005);
      ctx.beginPath();
      ctx.moveTo(x, base); ctx.lineTo(x, top); ctx.lineTo(x + h * 0.02, top);
      ctx.stroke();
      ctx.fillStyle = this.night > 0.3 ? '#fff3c4' : '#cfd5de';
      ctx.beginPath(); ctx.arc(x + h * 0.022, top + 3, h * 0.008, 0, Math.PI * 2); ctx.fill();
    }

    drawVehicle(ctx, v, h) {
      const s = h / 500, y = v.lane.y * h, d = v.lane.dir;
      ctx.save();
      ctx.translate(v.x, y);
      ctx.scale(d, 1);
      ctx.fillStyle = 'rgba(0,0,0,0.18)';
      ctx.beginPath(); ctx.ellipse(0, 2 * s, (v.type === 'car' ? 32 : 16) * s, 3 * s, 0, 0, Math.PI * 2); ctx.fill();
      if (v.type === 'car') {
        ctx.fillStyle = v.color;
        roundRect(ctx, -32 * s, -18 * s, 64 * s, 14 * s, 4 * s); ctx.fill();
        roundRect(ctx, -18 * s, -29 * s, 34 * s, 13 * s, 5 * s); ctx.fill();
        ctx.fillStyle = '#bfe3f5';
        ctx.fillRect(-14 * s, -26 * s, 12 * s, 8 * s);
        ctx.fillRect(1 * s, -26 * s, 12 * s, 8 * s);
        ctx.fillStyle = '#ffe28a';
        ctx.fillRect(28 * s, -15 * s, 4 * s, 4 * s);
        ctx.fillStyle = '#222';
        for (const wx of [-20, 20]) { ctx.beginPath(); ctx.arc(wx * s, -3 * s, 5.5 * s, 0, Math.PI * 2); ctx.fill(); }
        ctx.fillStyle = '#999';
        for (const wx of [-20, 20]) { ctx.beginPath(); ctx.arc(wx * s, -3 * s, 2.2 * s, 0, Math.PI * 2); ctx.fill(); }
      } else {
        ctx.fillStyle = '#222';
        for (const wx of [-11, 12]) { ctx.beginPath(); ctx.arc(wx * s, -4 * s, 5 * s, 0, Math.PI * 2); ctx.fill(); }
        ctx.fillStyle = v.color;
        roundRect(ctx, -14 * s, -14 * s, 26 * s, 8 * s, 3 * s); ctx.fill();
        ctx.fillRect(8 * s, -20 * s, 3 * s, 8 * s);
        // rider
        ctx.fillStyle = '#3b5998';
        ctx.fillRect(-6 * s, -28 * s, 8 * s, 14 * s);
        ctx.fillStyle = '#f5d0a9';
        ctx.beginPath(); ctx.arc(-2 * s, -32 * s, 4.5 * s, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = v.color === '#f4f6f7' ? '#e74c3c' : '#f4f6f7';
        ctx.beginPath(); ctx.arc(-2 * s, -33 * s, 5 * s, Math.PI, 0); ctx.fill();
      }
      ctx.restore();
    }

    drawPersonAt(ctx, p, h) {
      const k = (p.ny - WALK_MIN) / (WALK_MAX - WALK_MIN);
      let s = (0.75 + k * 0.45) * (h / 500);
      let x = p.x, y = p.ny * h, rot = 0, shake = 0, phase = p.phase, alpha = 1;
      if (p.state === 'caught') shake = Math.sin(this.time * 40) * 1.5;
      if (p.state === 'lift') {
        const u = this.ufo, l = p.lift;
        x = lerp(p.x, u.x, l);
        y = lerp(p.ny * h, u.y + this.ufoSize() * 0.12 + 46 * s * (1 - 0.6 * l), l);
        s *= 1 - 0.6 * l;
        rot = Math.sin(this.time * 5) * 0.4 * l;
        phase = this.time * 12;
        alpha = l > 0.85 ? (1 - l) / 0.15 : 1;
      }
      const scared = (this.panic && p.state === 'walk') || p.state !== 'walk';
      RH.art.student(ctx, x, y, s, p.look, {
        phase, rot, alpha, shake, t: this.time, noShadow: p.state === 'lift',
        arms: scared ? 'up' : 'swing', expr: scared ? 'scared' : 'normal',
      });
      if (alpha > 0.05) this.drawTag(ctx, p, x + shake, y - 50 * s, s);
    }

    drawTag(ctx, p, x, y, s) {
      const hot = p.state === 'caught' || p.state === 'lift';
      const fs = Math.max(10, (hot ? 15 : 11) * s * (p.state === 'lift' ? 1.6 : 1));
      ctx.font = font(fs, hot ? 800 : 700);
      const tw = ctx.measureText(p.label).width;
      const pw = tw + fs * 0.9, ph = fs * 1.5;
      ctx.save();
      if (p.state === 'lift') ctx.globalAlpha = p.lift > 0.85 ? (1 - p.lift) / 0.15 : 1;
      roundRect(ctx, x - pw / 2, y - ph, pw, ph, ph * 0.35);
      ctx.fillStyle = hot ? '#ffd23f' : 'rgba(255,255,255,0.95)';
      ctx.fill();
      ctx.strokeStyle = hot ? '#b8860b' : 'rgba(30,40,80,0.35)';
      ctx.lineWidth = 1;
      ctx.stroke();
      ctx.fillStyle = '#1b2240';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(p.label, x, y - ph / 2 + 1);
      ctx.restore();
    }

    drawBeam(ctx, w, h) {
      const u = this.ufo, S0 = this.ufoSize();
      const t = this.beamTarget;
      const gy = t ? t.ny * h + 4 : h * 0.83;
      const topW = S0 * 0.28 * this.beamWide, botW = S0 * (0.25 + 0.6 * this.beamWide);
      const flick = 0.85 + 0.15 * Math.sin(this.time * 30);
      const a = this.beam * flick;
      const top = u.y + S0 * 0.08;
      ctx.save();
      const g = ctx.createLinearGradient(0, top, 0, gy);
      g.addColorStop(0, `rgba(190,255,235,${0.75 * a})`);
      g.addColorStop(1, `rgba(140,255,210,${0.25 * a})`);
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.moveTo(u.x - topW / 2, top);
      ctx.lineTo(u.x + topW / 2, top);
      ctx.lineTo(u.x + botW / 2, gy);
      ctx.lineTo(u.x - botW / 2, gy);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = `rgba(200,255,235,${0.45 * a})`;
      ctx.beginPath(); ctx.ellipse(u.x, gy, botW / 2, botW * 0.1, 0, 0, Math.PI * 2); ctx.fill();
      if (this.beamWide > 0.9) {
        for (let i = 0; i < 18; i++) {
          const k = (this.time * 0.6 + i / 18) % 1;
          const py = lerp(gy, top, k);
          const spread = lerp(botW, topW, k) / 2;
          const px = u.x + Math.sin(i * 12.9898) * spread * 0.9;
          ctx.fillStyle = `rgba(255,255,255,${a * (1 - k)})`;
          ctx.beginPath(); ctx.arc(px, py, 1.8, 0, Math.PI * 2); ctx.fill();
        }
      }
      ctx.restore();
    }

    drawUFO(ctx, x, y, S0) {
      const t = this.time;
      ctx.save();
      ctx.translate(x, y + Math.sin(t * 2.2) * S0 * 0.015);
      ctx.rotate(this.ufo.tilt);
      // under glow
      const glow = ctx.createRadialGradient(0, S0 * 0.06, 2, 0, S0 * 0.06, S0 * 0.4);
      glow.addColorStop(0, 'rgba(160,255,230,0.55)');
      glow.addColorStop(1, 'rgba(160,255,230,0)');
      ctx.fillStyle = glow;
      ctx.beginPath(); ctx.ellipse(0, S0 * 0.06, S0 * 0.45, S0 * 0.14, 0, 0, Math.PI * 2); ctx.fill();
      // dome + alien
      const dg = ctx.createLinearGradient(0, -S0 * 0.24, 0, 0);
      dg.addColorStop(0, 'rgba(215,248,255,0.95)');
      dg.addColorStop(1, 'rgba(110,185,220,0.9)');
      ctx.fillStyle = '#7ed957';
      ctx.beginPath(); ctx.arc(0, -S0 * 0.08, S0 * 0.06, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#111';
      ctx.beginPath(); ctx.ellipse(-S0 * 0.022, -S0 * 0.085, S0 * 0.013, S0 * 0.02, 0.3, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.ellipse(S0 * 0.022, -S0 * 0.085, S0 * 0.013, S0 * 0.02, -0.3, 0, Math.PI * 2); ctx.fill();
      ctx.globalAlpha = 0.6;
      ctx.fillStyle = dg;
      ctx.beginPath(); ctx.ellipse(0, -S0 * 0.03, S0 * 0.17, S0 * 0.17, 0, Math.PI, 0); ctx.fill();
      ctx.globalAlpha = 1;
      ctx.fillStyle = 'rgba(255,255,255,0.7)';
      ctx.beginPath(); ctx.ellipse(-S0 * 0.07, -S0 * 0.12, S0 * 0.03, S0 * 0.015, -0.6, 0, Math.PI * 2); ctx.fill();
      // saucer
      const bg = ctx.createLinearGradient(0, -S0 * 0.08, 0, S0 * 0.08);
      bg.addColorStop(0, '#f2f5f8');
      bg.addColorStop(0.55, '#aab6c3');
      bg.addColorStop(1, '#6b7684');
      ctx.fillStyle = bg;
      ctx.beginPath(); ctx.ellipse(0, 0, S0 * 0.5, S0 * 0.1, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#56616e';
      ctx.beginPath(); ctx.ellipse(0, S0 * 0.06, S0 * 0.28, S0 * 0.05, 0, 0, Math.PI); ctx.fill();
      // rim lights
      const colors = ['#ff5a5a', '#ffd23f', '#5affc8', '#5ab4ff'];
      for (let i = 0; i < 10; i++) {
        const a = Math.PI * (0.08 + (i / 9) * 0.84);
        const lx = Math.cos(a) * S0 * 0.42, ly = Math.sin(a) * S0 * 0.06;
        ctx.fillStyle = colors[(i + Math.floor(t * 6)) % colors.length];
        ctx.beginPath(); ctx.arc(lx, ly, S0 * 0.017, 0, Math.PI * 2); ctx.fill();
      }
      // counter panel
      if (this.total > 0) {
        const txt = `${this.count}/${this.total}`;
        ctx.font = font(S0 * 0.065, 800);
        const tw = ctx.measureText(txt).width + S0 * 0.06;
        roundRect(ctx, -tw / 2, -S0 * 0.045, tw, S0 * 0.075, S0 * 0.02);
        ctx.fillStyle = '#1b2240';
        ctx.fill();
        ctx.fillStyle = '#5affc8';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(txt, 0, -S0 * 0.006);
      }
      ctx.restore();
    }
  }

  RH.games.push(new UFOGame());
})(window.RH);
