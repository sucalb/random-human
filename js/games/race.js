// Duck race: the chosen ones finish first, in order. Finish times are fixed before the start.
(function (RH) {
  const { rand, shuffle, short, font, fitText, roundRect, clamp } = RH.util;
  const S = RH.sound;
  const MAX_RACERS = 20;
  // Duck breeds: body, head, beak, wing shade, plus a size factor.
  const BREEDS = [
    { body: '#ffd43b', head: '#ffd43b', beak: '#ff8c2b', wing: '#f5b800', k: 1 },        // rubber duck
    { body: '#ff8fab', head: '#ff8fab', beak: '#ff922b', wing: '#f06595', k: 1 },        // pink rubber duck
    { body: '#74c0fc', head: '#74c0fc', beak: '#ffa94d', wing: '#4dabf7', k: 1 },        // blue rubber duck
    { body: '#f8f9fa', head: '#f8f9fa', beak: '#ff922b', wing: '#dee2e6', k: 1.05 },     // white duck
    { body: '#a07855', head: '#2f9e44', beak: '#fcc419', wing: '#6c4f35', k: 1.05, ring: true }, // mallard
    { body: '#ffe8a3', head: '#ffe8a3', beak: '#fd7e14', wing: '#ffd56b', k: 0.8 },      // duckling
    { body: '#343a40', head: '#343a40', beak: '#e03131', wing: '#212529', k: 1.1, swan: true }, // black swan
    { body: '#fff', head: '#fff', beak: '#f08c00', wing: '#e9ecef', k: 1.15, swan: true },     // white swan
  ];
  const ACCESSORIES = [null, null, 'shades', 'tophat', 'bow', 'cap', 'flower', 'headphones', 'party'];
  const MEDALS = ['#ffd43b', '#ced4da', '#e8a46b'];

  class RaceGame {
    constructor() {
      this.id = 'race';
      this.name = 'Đua vịt';
      this.icon = '🦆';
      this.tl = new RH.Timeline();
      this.racers = [];
      this.time = 0;
      this.w = 800; this.h = 500;
      this.countText = '';
      this.countScale = 0;
    }

    setup(names) {
      this.tl.clear();
      this.allNames = names.slice();
      this.total = names.length;
      this.makeRacers(names, []);
      this.running = false;
      this.raceT = 0;
      this.countText = '';
    }

    makeRacers(names, winners) {
      let list;
      if (names.length <= MAX_RACERS) list = shuffle(names);
      else list = shuffle(winners.concat(shuffle(names.filter((n) => !winners.includes(n))).slice(0, MAX_RACERS - winners.length)));
      this.racers = list.map((name) => ({
        name, label: short(name), p: 0, T: 99, amp: rand(0.04, 0.08), om: rand(0.9, 2.1), ph: rand(0, 6.28),
        finished: false, rank: 0, bob: rand(0, 6.28),
        breed: BREEDS[Math.floor(Math.random() * BREEDS.length)],
        acc: ACCESSORIES[Math.floor(Math.random() * ACCESSORIES.length)],
        accColor: ['#ff4d6d', '#845ef7', '#339af0', '#20c997', '#ffa94d'][Math.floor(Math.random() * 5)],
      }));
    }

    resize(w, h) { this.w = w; this.h = h; }

    progress(r, t) {
      if (t >= r.T) return 1 + Math.min(0.035, (t - r.T) * 0.05);
      if (r.fake) {
        // Sprints ahead, stalls right before the line, then dawdles in late.
        if (t < r.tStall) {
          const x = t / r.tStall;
          return r.stallP * x + 0.03 * Math.sin(r.om * t + r.ph) * Math.sin(Math.PI * x);
        }
        const x = (t - r.tStall) / (r.T - r.tStall);
        return r.stallP + (1 - r.stallP) * x * x * x;
      }
      const x = t / r.T;
      const base = r.comeback ? Math.pow(x, 1.6) : x;
      return Math.max(0, base + r.amp * Math.sin(r.om * t + r.ph) * Math.sin(Math.PI * x));
    }

    update(dt) {
      if (this.running && this.finishedWinners === 0) {
        const lead = this.racers.find((r) => r.winRank === 1);
        if (lead && lead.T - this.raceT > 0 && lead.T - this.raceT < 0.9) dt *= 0.35;
      }
      this.time += dt;
      this.tl.update(dt);
      this.countScale = Math.max(0, this.countScale - dt * 1.4);
      if (!this.running) return;
      this.raceT += dt;
      for (const r of this.racers) {
        r.p = this.progress(r, this.raceT);
        if (r.fake && !r.stalled && this.raceT >= r.tStall) { r.stalled = true; S.uhoh(); }
        if (!r.finished && this.raceT >= r.T) {
          r.finished = true;
          if (r.winRank) {
            r.rank = r.winRank;
            this.finishedWinners++;
            RH.fx.shake(1);
            S.ding();
            this.onPick(r.name, r.rank - 1);
            if (this.finishedWinners === this.winnerCount) this.allDone();
          }
        }
      }
    }

    async play(winners, onPick) {
      this.makeRacers(this.allNames, winners);
      // Winners finish first, in pick order; everyone else is noticeably slower.
      const base = 7.5, gap = 0.45;
      for (const r of this.racers) {
        const wi = winners.indexOf(r.name);
        if (wi >= 0) { r.T = base + wi * gap + rand(0, 0.12); r.winRank = wi + 1; }
        else r.T = base + winners.length * gap + rand(0.35, 3);
      }
      if (RH.settings.drama) {
        for (const r of this.racers) r.comeback = !!r.winRank;
        const others = shuffle(this.racers.filter((r) => !r.winRank));
        others.slice(0, this.racers.length > 10 ? 2 : 1).forEach((r, i) => {
          r.fake = true;
          r.stallP = rand(0.9, 0.95);
          r.tStall = base * rand(0.7, 0.8) + i * 0.4;
          r.emoji = ['😴', '🍞', '🤔', '🐛', '📱'][Math.floor(Math.random() * 5)];
        });
      }
      this.onPick = onPick;
      this.winnerCount = winners.length;
      this.finishedWinners = 0;
      for (const c of ['3', '2', '1']) {
        this.countText = c; this.countScale = 1; S.beep();
        await this.tl.wait(0.8);
      }
      this.countText = 'XUẤT PHÁT!'; this.countScale = 1; S.go();
      this.raceT = 0;
      this.running = true;
      await new Promise((res) => (this.allDone = res));
      await this.tl.wait(1.2);
      this.running = false;
    }

    geom(w, h) {
      const top = clamp(h * 0.13, 50, 84), bottom = 12;
      const n = Math.max(1, this.racers.length);
      const laneH = (h - top - bottom) / n;
      const x0 = clamp(w * 0.2, 110, 200), xf = w - 50;
      return { top, laneH, x0, xf };
    }

    draw(ctx, w, h) {
      const water = ctx.createLinearGradient(0, 0, 0, h);
      water.addColorStop(0, '#4dc0e8');
      water.addColorStop(1, '#2477b3');
      ctx.fillStyle = water;
      ctx.fillRect(0, 0, w, h);
      const { top, laneH, x0, xf } = this.geom(w, h);

      // grandstand bank with a cheering crowd and bunting
      ctx.fillStyle = '#5bbf63';
      ctx.fillRect(0, 0, w, top - 4);
      ctx.fillStyle = '#4aa653';
      ctx.fillRect(0, top - 10, w, 6);
      const crowd = ['#ff6b6b', '#ffd43b', '#4dabf7', '#da77f2', '#fff', '#ffa94d', '#38d9a9'];
      const hr = clamp(top * 0.13, 5, 10);
      for (let i = 0, x = hr; x < w; i++, x += hr * 2.3) {
        const jump = this.running ? Math.abs(Math.sin(this.time * 7 + i * 1.7)) * hr * 0.8 : 0;
        const y = top - 10 - hr * 1.6 - jump - (i % 2) * hr * 0.9;
        ctx.fillStyle = crowd[i % crowd.length];
        roundRect(ctx, x - hr, y + hr * 0.6, hr * 2, hr * 2, hr * 0.6); ctx.fill();
        ctx.fillStyle = '#f5d0a9';
        ctx.beginPath(); ctx.arc(x, y, hr * 0.75, 0, Math.PI * 2); ctx.fill();
      }
      ctx.strokeStyle = 'rgba(255,255,255,0.7)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(0, 8);
      for (let x = 0; x <= w; x += 40) ctx.quadraticCurveTo(x + 20, 16, x + 40, 8);
      ctx.stroke();
      for (let x = 10, i = 0; x < w; x += 20, i++) {
        ctx.fillStyle = crowd[i % crowd.length];
        ctx.beginPath(); ctx.moveTo(x - 6, 10); ctx.lineTo(x + 6, 10); ctx.lineTo(x, 22); ctx.fill();
      }
      if (this.total > this.racers.length) {
        ctx.fillStyle = 'rgba(15,20,48,0.6)';
        ctx.font = font(12, 700);
        const info = `${this.racers.length}/${this.total} vịt ngẫu nhiên`;
        const iw = ctx.measureText(info).width + 16;
        roundRect(ctx, w - iw - 10, top - 32, iw, 22, 11); ctx.fill();
        ctx.fillStyle = '#fff';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(info, w - iw / 2 - 10, top - 20);
      }

      // ripples
      ctx.strokeStyle = 'rgba(255,255,255,0.18)';
      ctx.lineWidth = 2;
      for (let i = 0; i < 40; i++) {
        const x = ((i * 137.5 + this.time * 20) % (w + 60)) - 30;
        const y = top + ((i * 71.3) % (h - top));
        ctx.beginPath(); ctx.arc(x, y, 10, Math.PI * 1.15, Math.PI * 1.85); ctx.stroke();
      }

      // start + finish lines
      ctx.fillStyle = 'rgba(255,255,255,0.8)';
      ctx.fillRect(x0 - 2, top, 3, h - top);
      const sq = 8;
      for (let y = top, j = 0; y < h; y += sq, j++) {
        for (let k = 0; k < 2; k++) {
          ctx.fillStyle = (j + k) % 2 ? '#111' : '#fff';
          ctx.fillRect(xf + k * sq, y, sq, sq);
        }
      }

      // lanes
      this.racers.forEach((r, i) => {
        const cy = top + laneH * (i + 0.5);
        if (i > 0) {
          const ly = top + laneH * i;
          for (let x = 0; x < w; x += 16) {
            ctx.fillStyle = (x / 16) % 2 ? '#ff6b6b' : '#fff';
            ctx.beginPath(); ctx.arc(x + 8, ly, clamp(laneH * 0.07, 1.5, 3.5), 0, Math.PI * 2); ctx.fill();
          }
        }
        const s = clamp(laneH * 0.85, 12, 52);
        const x = x0 + r.p * (xf - x0);
        const y = cy + Math.sin(this.time * 4 + r.bob) * s * 0.05 + s * 0.12;
        // wake
        if (this.running && !r.finished) {
          ctx.fillStyle = 'rgba(255,255,255,0.35)';
          ctx.beginPath(); ctx.ellipse(x - s * 0.6, y + s * 0.2, s * 0.6, s * 0.1, 0, 0, Math.PI * 2); ctx.fill();
        }
        this.drawDuck(ctx, x, y, s, r);
        if (r.stalled && !r.finished) {
          const es = clamp(laneH * 1.1, 18, 34);
          const ex = Math.min(x + s * 0.9 + es * 0.6, w - es * 0.7), ey = cy - Math.abs(Math.sin(this.time * 4)) * es * 0.2;
          ctx.fillStyle = '#fff';
          ctx.beginPath(); ctx.arc(ex, ey, es * 0.68, 0, Math.PI * 2); ctx.fill();
          ctx.strokeStyle = '#1b2240'; ctx.lineWidth = 2; ctx.stroke();
          ctx.font = font(es * 0.85, 400);
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(r.emoji, ex, ey + 1);
        }
        // name tag behind the duck
        const fs = clamp(laneH * 0.42, 9, 17);
        ctx.font = font(fs, 800);
        const label = fitText(ctx, r.label, x0 - 20 + r.p * (xf - x0) * 0.5);
        const tw = ctx.measureText(label).width + fs * 0.8;
        const tx = x - s * 0.62 - tw, ty = cy - fs * 0.75;
        ctx.fillStyle = r.rank ? '#ffd23f' : 'rgba(255,255,255,0.92)';
        roundRect(ctx, tx, ty, tw, fs * 1.5, fs * 0.4); ctx.fill();
        ctx.fillStyle = '#1b2240';
        ctx.textAlign = 'left';
        ctx.fillText(label, tx + fs * 0.4, cy + 1);
        if (r.rank) {
          const rr = clamp(laneH * 0.36, 8, 16);
          const bx = Math.min(x + s * 0.7, w - rr - 2);
          ctx.fillStyle = MEDALS[r.rank - 1] || '#74c0fc';
          ctx.beginPath(); ctx.arc(bx, cy, rr, 0, Math.PI * 2); ctx.fill();
          ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; ctx.stroke();
          ctx.fillStyle = '#1b2240';
          ctx.font = font(rr * 1.1, 800);
          ctx.textAlign = 'center';
          ctx.fillText(r.rank, bx, cy + 1);
        }
      });

      // crown over whoever is leading right now
      if (this.running) {
        let lead = null;
        this.racers.forEach((r, i) => { if (!r.finished && (!lead || r.p > lead.r.p)) lead = { r, i }; });
        if (lead && !this.racers.some((r) => r.rank)) {
          const s = clamp(laneH * 0.85, 12, 52);
          const x = x0 + lead.r.p * (xf - x0);
          ctx.font = font(clamp(laneH * 0.8, 14, 30), 400);
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText('👑', x + s * 0.3, top + laneH * (lead.i + 0.5) - s * 0.7 - Math.abs(Math.sin(this.time * 6)) * 3);
        }
      }

      if (this.countScale > 0 && this.countText) {
        const k = this.countScale;
        ctx.save();
        ctx.globalAlpha = Math.min(1, k * 2);
        ctx.translate(w / 2, h / 2);
        ctx.scale(1 + (1 - k) * 0.6, 1 + (1 - k) * 0.6);
        ctx.font = font(Math.min(w, h) * 0.18, 800);
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.lineWidth = 10;
        ctx.strokeStyle = '#1b2240';
        ctx.strokeText(this.countText, 0, 0);
        ctx.fillStyle = '#ffd23f';
        ctx.fillText(this.countText, 0, 0);
        ctx.restore();
      }
    }

    drawDuck(ctx, x, y, s0, r) {
      const b = r.breed, s = s0 * b.k;
      ctx.save();
      ctx.translate(x, y);
      // tail
      ctx.fillStyle = b.body;
      ctx.beginPath(); ctx.moveTo(-s * 0.45, -s * 0.1); ctx.lineTo(-s * 0.66, -s * 0.38); ctx.lineTo(-s * 0.3, -s * 0.2); ctx.fill();
      // body + wing
      ctx.beginPath(); ctx.ellipse(0, 0, s * 0.52, s * 0.28, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = b.wing;
      const flap = this.running && !r.finished ? Math.sin(this.time * 14 + r.bob) * 0.15 : 0;
      ctx.beginPath(); ctx.ellipse(-s * 0.06, -s * 0.02, s * 0.26, s * 0.13, -0.2 + flap, 0, Math.PI * 2); ctx.fill();
      // neck + head (swans get a long curved neck)
      const hx = s * (b.swan ? 0.36 : 0.33), hy = -s * (b.swan ? 0.62 : 0.33), hr = s * (b.swan ? 0.16 : 0.21);
      if (b.swan) {
        ctx.strokeStyle = b.head;
        ctx.lineWidth = s * 0.13;
        ctx.lineCap = 'round';
        ctx.beginPath(); ctx.moveTo(s * 0.3, -s * 0.05); ctx.quadraticCurveTo(s * 0.18, -s * 0.5, hx, hy); ctx.stroke();
      }
      ctx.fillStyle = b.head;
      ctx.beginPath(); ctx.arc(hx, hy, hr, 0, Math.PI * 2); ctx.fill();
      if (b.ring) {
        ctx.fillStyle = '#fff';
        ctx.fillRect(hx - hr * 0.8, hy + hr * 0.75, hr * 1.4, hr * 0.25);
      }
      ctx.fillStyle = b.beak;
      ctx.beginPath(); ctx.moveTo(hx + hr * 0.75, hy - hr * 0.15); ctx.lineTo(hx + hr * 1.9, hy + hr * 0.15); ctx.lineTo(hx + hr * 0.75, hy + hr * 0.45); ctx.fill();
      // eye (sleepy when stalled)
      ctx.fillStyle = b.body === '#343a40' ? '#fff' : '#111';
      if (r.stalled && !r.finished) {
        ctx.strokeStyle = ctx.fillStyle; ctx.lineWidth = Math.max(1, s * 0.03);
        ctx.beginPath(); ctx.moveTo(hx + hr * 0.1, hy - hr * 0.2); ctx.lineTo(hx + hr * 0.55, hy - hr * 0.2); ctx.stroke();
      } else {
        ctx.beginPath(); ctx.arc(hx + hr * 0.35, hy - hr * 0.25, Math.max(1.2, hr * 0.17), 0, Math.PI * 2); ctx.fill();
      }
      this.drawAccessory(ctx, r, hx, hy, hr);
      // waterline
      ctx.fillStyle = 'rgba(36,119,179,0.55)';
      ctx.fillRect(-s * 0.62, s * 0.14, s * 1.24, s * 0.16);
      ctx.restore();
    }

    drawAccessory(ctx, r, hx, hy, hr) {
      const c = r.accColor;
      switch (r.acc) {
        case 'shades':
          ctx.fillStyle = '#111';
          ctx.fillRect(hx - hr * 0.15, hy - hr * 0.45, hr * 0.95, hr * 0.42);
          ctx.fillRect(hx - hr * 0.7, hy - hr * 0.35, hr * 0.6, hr * 0.12);
          break;
        case 'tophat':
          ctx.fillStyle = '#212529';
          ctx.fillRect(hx - hr * 0.85, hy - hr * 0.95, hr * 1.7, hr * 0.22);
          ctx.fillRect(hx - hr * 0.55, hy - hr * 1.9, hr * 1.1, hr * 1.0);
          ctx.fillStyle = c;
          ctx.fillRect(hx - hr * 0.55, hy - hr * 1.12, hr * 1.1, hr * 0.2);
          break;
        case 'bow':
          ctx.fillStyle = c;
          ctx.beginPath(); ctx.moveTo(hx - hr * 0.2, hy - hr * 0.9); ctx.lineTo(hx - hr * 0.8, hy - hr * 1.3); ctx.lineTo(hx - hr * 0.8, hy - hr * 0.5); ctx.fill();
          ctx.beginPath(); ctx.moveTo(hx - hr * 0.2, hy - hr * 0.9); ctx.lineTo(hx + hr * 0.4, hy - hr * 1.3); ctx.lineTo(hx + hr * 0.4, hy - hr * 0.5); ctx.fill();
          break;
        case 'cap':
          ctx.fillStyle = c;
          ctx.beginPath(); ctx.arc(hx, hy - hr * 0.35, hr * 0.85, Math.PI, 0); ctx.fill();
          ctx.fillRect(hx, hy - hr * 0.45, hr * 1.4, hr * 0.22);
          break;
        case 'flower':
          ctx.fillStyle = c;
          for (let i = 0; i < 5; i++) {
            const a = (i / 5) * Math.PI * 2;
            ctx.beginPath(); ctx.arc(hx - hr * 0.3 + Math.cos(a) * hr * 0.32, hy - hr * 0.95 + Math.sin(a) * hr * 0.32, hr * 0.22, 0, 7); ctx.fill();
          }
          ctx.fillStyle = '#ffd43b';
          ctx.beginPath(); ctx.arc(hx - hr * 0.3, hy - hr * 0.95, hr * 0.18, 0, 7); ctx.fill();
          break;
        case 'headphones':
          ctx.strokeStyle = '#343a40';
          ctx.lineWidth = Math.max(1.2, hr * 0.18);
          ctx.beginPath(); ctx.arc(hx, hy, hr * 1.08, Math.PI * 1.05, Math.PI * 1.95); ctx.stroke();
          ctx.fillStyle = c;
          ctx.beginPath(); ctx.ellipse(hx - hr * 0.95, hy, hr * 0.25, hr * 0.38, 0, 0, 7); ctx.fill();
          break;
        case 'party':
          ctx.fillStyle = c;
          ctx.beginPath(); ctx.moveTo(hx - hr * 0.6, hy - hr * 0.75); ctx.lineTo(hx + hr * 0.4, hy - hr * 0.75); ctx.lineTo(hx - hr * 0.15, hy - hr * 2.1); ctx.fill();
          ctx.fillStyle = '#ffd43b';
          ctx.beginPath(); ctx.arc(hx - hr * 0.15, hy - hr * 2.1, hr * 0.2, 0, 7); ctx.fill();
          break;
      }
    }
  }

  RH.games.push(new RaceGame());
})(window.RH);
