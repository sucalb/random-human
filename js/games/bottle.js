// Message in a bottle: bottles drift down the river; the first ones to wash ashore are chosen.
(function (RH) {
  const { rand, pick, shuffle, lerp, ease, roundRect, fitText, short, font, clamp } = RH.util;
  const S = RH.sound;
  const MAX_BOTTLES = 24;
  const GLASS = ['rgba(80,170,110,0.85)', 'rgba(150,100,50,0.85)', 'rgba(90,150,210,0.85)', 'rgba(200,220,230,0.8)'];

  class BottleGame {
    constructor() {
      this.id = 'bottle';
      this.name = 'Thả chai';
      this.icon = '🍾';
      this.tl = new RH.Timeline();
      this.time = 0;
      this.w = 800; this.h = 500;
      this.bottles = [];
      this.rocks = [];
      this.fx = [];
    }

    setup(names) {
      this.tl.clear();
      this.allNames = names.slice();
      this.total = names.length;
      this.makeBottles(names, []);
      this.running = false;
      this.t = 0;
      this.drop = 1;
      this.rocks = [{ fx: 0.33, fy: 0.22, r: 1 }, { fx: 0.58, fy: 0.8, r: 0.8 }];
      this.fx = [];
    }

    makeBottles(names, winners) {
      let list;
      if (names.length <= MAX_BOTTLES) list = shuffle(names);
      else list = shuffle(winners.concat(shuffle(names.filter((n) => !winners.includes(n))).slice(0, MAX_BOTTLES - winners.length)));
      const slots = shuffle(list.map((_, i) => (i + 0.5) / list.length));
      this.bottles = list.map((name, i) => ({
        name, label: short(name), yf: slots[i], amp: rand(0.008, 0.02), om: rand(0.6, 1.4), ph: rand(0, 6.28),
        T: 99, p: 0, idle: rand(0, 0.06), ang: rand(-0.3, 0.3), spin: rand(-0.6, 0.6), glass: pick(GLASS),
        delay: rand(0, 0.5), finished: false, rank: 0, beach: 0, popped: false,
      }));
    }

    resize(w, h) { this.w = w; this.h = h; }

    geo() {
      const { w, h } = this;
      const top = h * 0.15, bot = h * 0.9;
      const beachW = clamp(w * 0.13, 70, 150);
      const n = Math.max(1, this.bottles.length);
      const L = clamp(((bot - top) / n) * 1.6, 26, 54);
      return { top, bot, beachW, x0: clamp(w * 0.2, 110, 200), xf: w - beachW - L * 0.3, L };
    }

    by(b, t, g) {
      const tt = b.stuckAt !== undefined && t > b.stuckAt ? b.stuckAt : t;
      return g.top + 20 + b.yf * (g.bot - g.top - 40) + Math.sin(b.om * tt + b.ph) * b.amp * this.h * 3;
    }

    progress(b, t) {
      if (t >= b.T) return 1;
      if (b.fake) {
        if (t < b.tStall) {
          const x = t / b.tStall;
          return b.stallP * x + 0.02 * Math.sin(b.om * t + b.ph) * Math.sin(Math.PI * x);
        }
        const x = (t - b.tStall) / (b.T - b.tStall);
        return b.stallP + (1 - b.stallP) * x * x * x;
      }
      const x = t / b.T;
      const base = b.comeback ? Math.pow(x, 1.5) : x;
      return Math.max(0, base + b.amp * 3 * Math.sin(b.om * t + b.ph) * Math.sin(Math.PI * x));
    }

    update(dt) {
      if (this.running && this.done === 0) {
        const lead = this.bottles.find((b) => b.rank === 1);
        if (lead && lead.T - this.t > 0 && lead.T - this.t < 0.9) dt *= 0.35;
      }
      this.time += dt;
      this.tl.update(dt);
      for (const f of this.fx) f.life -= dt;
      this.fx = this.fx.filter((f) => f.life > 0);
      const g = this.geo();
      for (const b of this.bottles) {
        if (b.finished) {
          if (b.rank && b.beach < 1) {
            b.beach = Math.min(1, b.beach + dt / 1.1);
            if (b.beach > 0.55 && !b.popped) {
              b.popped = true;
              S.pop();
              RH.fx.shake(1);
              S.ding();
              this.onPick(b.name, b.rank - 1);
              if (++this.done === this.winnerCount) this.allDone();
            }
          }
          continue;
        }
        if (!this.running) { b.ang += Math.sin(this.time * b.om + b.ph) * dt * 0.2; continue; }
        b.p = this.progress(b, this.t);
        if (b.fake && this.t >= b.tStall) {
          if (!b.stalled) { b.stalled = true; S.uhoh(); }
          b.ang = Math.sin(this.time * 9) * 0.25 - 0.4;
        } else {
          b.ang += b.spin * dt;
        }
        if (this.t >= b.T) {
          b.finished = true;
          if (b.rank) S.splash();
        }
      }
      if (this.running) this.t += dt;
    }

    async play(winners, onPick) {
      this.makeBottles(this.allNames, winners);
      const g = this.geo();
      const base = 8, gap = 0.5;
      for (const b of this.bottles) {
        const wi = winners.indexOf(b.name);
        if (wi >= 0) { b.T = base + wi * gap + rand(0, 0.15); b.rank = wi + 1; }
        else b.T = base + winners.length * gap + rand(0.5, 3.5);
      }
      this.rocks = [{ fx: 0.33, fy: 0.22, r: 1 }, { fx: 0.58, fy: 0.8, r: 0.8 }];
      if (RH.settings.drama) {
        for (const b of this.bottles) b.comeback = !!b.rank;
        const others = shuffle(this.bottles.filter((b) => !b.rank));
        others.slice(0, this.bottles.length > 10 ? 2 : 1).forEach((b, i) => {
          b.fake = true;
          b.stallP = rand(0.8, 0.88);
          b.tStall = base * rand(0.62, 0.72) + i * 0.5;
          b.stuckAt = b.tStall;
          b.emoji = pick(['😵', '😱', '🙈', '🆘']);
          // The rock it will get stuck on.
          const x = g.x0 + b.stallP * (g.xf - g.x0) + g.L * 0.6;
          const y = this.by(b, b.tStall, g);
          this.rocks.push({ fx: x / this.w, fy: (y - g.top) / (g.bot - g.top), r: 0.9 });
        });
      }
      this.onPick = onPick;
      this.winnerCount = winners.length;
      this.done = 0;
      this.t = 0;
      // Bottles get tossed into the river.
      this.drop = 0;
      S.whoosh();
      await this.tl.tween(1.4, (t) => {
        this.drop = t;
        for (const b of this.bottles) {
          if (!b.splashed && t > b.delay + 0.45) {
            b.splashed = true;
            this.fx.push({ x: g.x0, y: this.by(b, 0, g), life: 0.6 });
          }
        }
      });
      S.splash();
      this.running = true;
      await new Promise((res) => (this.allDone = res));
      await this.tl.wait(1.4);
      this.running = false;
    }

    // ---------- drawing ----------
    draw(ctx, w, h) {
      const g = this.geo();
      const { top, bot, beachW } = g;
      // banks
      ctx.fillStyle = '#6cbf5f';
      ctx.fillRect(0, 0, w, top);
      ctx.fillRect(0, bot, w, h - bot);
      ctx.fillStyle = '#5aa94f';
      for (let i = 0; i < 14; i++) {
        const x = (i * 131) % w, y = ((i * 37) % Math.max(1, top - 20)) + 8;
        ctx.beginPath(); ctx.arc(x, y, 10 + (i % 3) * 4, 0, Math.PI * 2); ctx.fill();
      }
      ctx.fillStyle = '#ffe066';
      for (let i = 0; i < 18; i++) {
        ctx.beginPath(); ctx.arc((i * 97) % w, bot + 10 + ((i * 53) % Math.max(1, h - bot - 16)), 2.5, 0, Math.PI * 2); ctx.fill();
      }
      // river
      const water = ctx.createLinearGradient(0, top, 0, bot);
      water.addColorStop(0, '#3fa9d8');
      water.addColorStop(0.5, '#2d8fc7');
      water.addColorStop(1, '#3fa9d8');
      ctx.fillStyle = water;
      ctx.fillRect(0, top, w, bot - top);
      ctx.strokeStyle = 'rgba(255,255,255,0.22)';
      ctx.lineWidth = 2;
      ctx.lineCap = 'round';
      for (let i = 0; i < 70; i++) {
        const sp = 40 + (i % 4) * 15;
        const x = ((i * 173 + this.time * sp) % (w + 80)) - 40;
        const y = top + 6 + ((i * 97) % (bot - top - 12));
        ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + 18, y); ctx.stroke();
      }
      // beach on the right
      const bx = w - beachW;
      ctx.fillStyle = '#f2dca2';
      ctx.beginPath();
      ctx.moveTo(bx + 10, top);
      for (let y = top; y <= bot; y += 10) ctx.lineTo(bx + Math.sin(y * 0.05) * 8, y);
      ctx.lineTo(w, bot); ctx.lineTo(w, top); ctx.closePath(); ctx.fill();
      ctx.strokeStyle = `rgba(255,255,255,${0.6 + 0.3 * Math.sin(this.time * 2)})`;
      ctx.lineWidth = 4;
      ctx.beginPath();
      for (let y = top; y <= bot; y += 10) {
        const x = bx - 4 + Math.sin(y * 0.05) * 8 + Math.sin(this.time * 2) * 3;
        y === top ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
      }
      ctx.stroke();
      // flag
      const fxp = w - beachW * 0.35, fyp = top + 8;
      ctx.fillStyle = '#7a5537';
      ctx.fillRect(fxp, fyp, 3, 44);
      ctx.fillStyle = '#ff3b5c';
      ctx.beginPath(); ctx.moveTo(fxp + 3, fyp); ctx.lineTo(fxp + 30, fyp + 8 + Math.sin(this.time * 5) * 2); ctx.lineTo(fxp + 3, fyp + 16); ctx.fill();
      ctx.fillStyle = '#1b2240';
      ctx.font = font(13, 800);
      ctx.textAlign = 'center';
      ctx.fillText('BỜ', fxp + 2, fyp + 58);
      // start dock on the left
      ctx.fillStyle = '#9b6b43';
      ctx.fillRect(0, top + (bot - top) * 0.45, g.x0 - 30, 26);
      ctx.fillStyle = '#7a5233';
      for (let x = 6; x < g.x0 - 30; x += 16) ctx.fillRect(x, top + (bot - top) * 0.45, 3, 26);
      // rocks
      for (const r of this.rocks) {
        const x = r.fx * w, y = top + r.fy * (bot - top), rr = 15 * r.r * (h / 500);
        ctx.fillStyle = 'rgba(255,255,255,0.4)';
        ctx.beginPath(); ctx.ellipse(x - rr * 0.3, y + rr * 0.3, rr * 1.4, rr * 0.6, 0, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#7d848f';
        ctx.beginPath(); ctx.ellipse(x, y, rr, rr * 0.75, 0, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#a3a9b3';
        ctx.beginPath(); ctx.ellipse(x - rr * 0.25, y - rr * 0.25, rr * 0.45, rr * 0.3, 0, 0, Math.PI * 2); ctx.fill();
      }
      for (const f of this.fx) {
        const k = 1 - f.life / 0.6;
        ctx.strokeStyle = `rgba(255,255,255,${1 - k})`;
        ctx.lineWidth = 2;
        ctx.beginPath(); ctx.ellipse(f.x, f.y, 6 + k * 24, 3 + k * 9, 0, 0, Math.PI * 2); ctx.stroke();
      }

      const list = this.bottles.slice().sort((a, b) => a.yf - b.yf);
      for (const b of list) this.drawBottle(ctx, b, g);
      for (const b of list) if (b.popped) this.drawScroll(ctx, b, g);
    }

    bottlePos(b, g) {
      const racing = this.t > 0;
      let x = g.x0 + b.p * (g.xf - g.x0) + (racing ? 0 : Math.sin(this.time * b.om + b.ph) * 6 + b.idle * 100);
      let y = this.by(b, racing ? this.t : this.time * 0.3, g);
      let ang = b.ang;
      let lift = 0;
      if (this.drop < 1) {
        const k = clamp((this.drop - b.delay) / 0.45, 0, 1);
        x = lerp(g.x0 * 0.4, g.x0, k);
        lift = Math.sin(Math.PI * k) * 60 + (k === 0 ? 60 : 0);
        ang = k * 6;
      }
      if (b.finished && b.rank) {
        const k = ease.outCubic(b.beach);
        x = g.xf + k * g.beachW * 0.4;
        ang = lerp(b.ang, -0.25, k);
      }
      return { x, y: y - lift, ang };
    }

    drawBottle(ctx, b, g) {
      const { x, y, ang } = this.bottlePos(b, g);
      const L = g.L, H = L * 0.36;
      ctx.save();
      ctx.translate(x, y);
      ctx.fillStyle = 'rgba(0,40,80,0.18)';
      ctx.beginPath(); ctx.ellipse(0, H * 0.5, L * 0.55, H * 0.35, 0, 0, Math.PI * 2); ctx.fill();
      ctx.rotate(ang);
      ctx.fillStyle = b.glass;
      roundRect(ctx, -L / 2, -H / 2, L * 0.7, H, H * 0.45); ctx.fill();
      ctx.fillRect(L * 0.15, -H * 0.22, L * 0.26, H * 0.44);
      ctx.fillStyle = '#f6e7c1';
      ctx.fillRect(-L * 0.36, -H * 0.2, L * 0.44, H * 0.4);
      if (!b.popped) {
        ctx.fillStyle = '#a0703f';
        ctx.fillRect(L * 0.41, -H * 0.2, L * 0.1, H * 0.4);
      }
      ctx.fillStyle = 'rgba(255,255,255,0.55)';
      ctx.fillRect(-L * 0.4, -H * 0.38, L * 0.5, H * 0.12);
      ctx.restore();
      if (b.stalled && !b.finished) {
        const es = clamp(L * 0.6, 16, 28);
        ctx.fillStyle = '#fff';
        ctx.beginPath(); ctx.arc(x + L * 0.1, y - L * 0.6, es * 0.68, 0, Math.PI * 2); ctx.fill();
        ctx.font = font(es * 0.85, 400);
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(b.emoji, x + L * 0.1, y - L * 0.6 + 1);
      }
      if (b.popped) return;
      // name tag behind the bottle
      const fs = clamp(L * 0.34, 10, 16);
      ctx.font = font(fs, 800);
      const label = fitText(ctx, b.label, 150);
      const tw = ctx.measureText(label).width + fs * 0.8;
      const tx = x - L * 0.55 - tw, ty = y - fs * 0.75;
      ctx.fillStyle = 'rgba(255,255,255,0.92)';
      roundRect(ctx, tx, ty, tw, fs * 1.5, fs * 0.4); ctx.fill();
      ctx.fillStyle = '#1b2240';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ctx.fillText(label, tx + fs * 0.4, y + 1);
    }

    drawScroll(ctx, b, g) {
      const { x, y } = this.bottlePos(b, g);
      const k = ease.outBack(clamp((b.beach - 0.55) / 0.45, 0, 1));
      const fs = clamp(g.L * 0.4, 13, 20);
      ctx.font = font(fs, 800);
      const tw = ctx.measureText(b.name).width + fs * 1.6;
      const sw = tw * k, sh = fs * 2;
      const sx = clamp(x - sw / 2, 6, this.w - sw - 6), sy = y - g.L * 0.5 - sh;
      ctx.fillStyle = '#f6e7c1';
      roundRect(ctx, sx, sy, sw, sh, 4); ctx.fill();
      ctx.fillStyle = '#d9c08a';
      ctx.fillRect(sx - 3, sy - 2, 6, sh + 4);
      ctx.fillRect(sx + sw - 3, sy - 2, 6, sh + 4);
      if (k > 0.8) {
        ctx.fillStyle = '#5a3b1a';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(`${b.rank}. ${b.name}`, sx + sw / 2, sy + sh / 2 + 1);
      }
    }
  }

  RH.games.push(new BottleGame());
})(window.RH);
