// Shared student artwork + a wandering crowd, used by the schoolyard games.
(function (RH) {
  const { rand, pick, clamp, roundRect, short, font } = RH.util;
  const SKIN = ['#f9dcc0', '#f5d0a9', '#eebb8d', '#e3ad80', '#d49a6a', '#b97a4f'];
  const HAIR = ['#1d1d1d', '#151515', '#2b1d14', '#3a2a1e', '#5a3a22', '#7a4a26'];
  const DYED = ['#b5651d', '#8e3b46', '#4a5ea8', '#d9a441'];
  const BOY_HAIR = ['short', 'spiky', 'side', 'buzz', 'curly', 'bowl', 'mohawk'];
  const GIRL_HAIR = ['long', 'ponytail', 'bob', 'bun', 'pigtails', 'long'];
  const BRIGHT = ['#ff5c8a', '#ffa94d', '#ffd43b', '#51cf66', '#339af0', '#845ef7', '#f06595', '#20c997'];
  const JACKETS = ['#2b3a67', '#5c677d', '#7b2d3b', '#2f6f4f', '#3d5a80'];
  const PANTS = ['#1f2a5a', '#1f2a5a', '#2b2d42', '#22303c'];

  function mixColor(a, b, t) {
    const pa = parseInt(a.slice(1), 16), pb = parseInt(b.slice(1), 16);
    const c = [16, 8, 0].map((sh) => Math.round(((pa >> sh) & 255) * (1 - t) + ((pb >> sh) & 255) * t));
    return `rgb(${c.join(',')})`;
  }
  const chance = (p) => Math.random() < p;

  // Head centred at (0, cy) with radius r, in the caller's coordinate space.
  // opts: { expr: 'normal'|'scared'|'happy', swell, fried, hairUp, zombie, t }
  function head(ctx, cy, r, look, opts = {}) {
    const { expr = 'normal', swell = 0, fried = false, hairUp = 0, zombie = false, t = 0 } = opts;
    const skin = zombie ? '#9ccf7f' : fried ? '#6b5a4a' : swell > 0.05 ? mixColor(look.skin, '#ff8a7a', Math.min(1, swell)) : look.skin;
    const hair = fried ? '#111' : look.hair;
    const st = look.hairStyle;
    // hair behind the face
    if (!fried && hairUp < 0.2) {
      ctx.fillStyle = hair;
      if (st === 'long') { roundRect(ctx, -r * 1.08, cy - r * 0.9, r * 2.16, r * 2.5, r * 0.8); ctx.fill(); }
      if (st === 'bob') { roundRect(ctx, -r * 1.15, cy - r * 0.95, r * 2.3, r * 1.75, r * 0.7); ctx.fill(); }
      if (st === 'ponytail') { ctx.beginPath(); ctx.ellipse(r * 1.05, cy + r * 0.2, r * 0.38, r * 0.85, -0.3, 0, Math.PI * 2); ctx.fill(); }
      if (st === 'pigtails') for (const sg of [-1, 1]) { ctx.beginPath(); ctx.ellipse(sg * r * 1.15, cy + r * 0.35, r * 0.36, r * 0.7, sg * 0.3, 0, Math.PI * 2); ctx.fill(); }
      if (st === 'bun') { ctx.beginPath(); ctx.arc(0, cy - r * 1.05, r * 0.5, 0, Math.PI * 2); ctx.fill(); }
    }
    // face
    ctx.fillStyle = skin;
    ctx.beginPath(); ctx.arc(0, cy, r, 0, Math.PI * 2); ctx.fill();
    if (look.blush && !zombie && !fried) {
      ctx.fillStyle = 'rgba(255,120,140,0.35)';
      ctx.beginPath(); ctx.arc(-r * 0.55, cy + r * 0.3, r * 0.2, 0, 7); ctx.arc(r * 0.55, cy + r * 0.3, r * 0.2, 0, 7); ctx.fill();
    }
    if (swell > 0.3) {
      ctx.fillStyle = '#ff5c5c';
      for (const [bx, by] of [[-0.45, -0.1], [0.4, 0.2], [0.1, -0.5], [-0.1, 0.45]]) {
        ctx.beginPath(); ctx.arc(bx * r, cy + by * r, r * 0.22 * swell, 0, Math.PI * 2); ctx.fill();
      }
    }
    // front hair
    ctx.fillStyle = hair;
    if (fried) {
      for (let i = 0; i < 9; i++) {
        const a = Math.PI + (i / 8) * Math.PI;
        ctx.beginPath(); ctx.arc(Math.cos(a) * r * 1.2, cy - r * 0.3 + Math.sin(a) * r * 1.2, r * 0.75, 0, Math.PI * 2); ctx.fill();
      }
    } else if (hairUp >= 0.2) {
      ctx.strokeStyle = hair;
      ctx.lineWidth = Math.max(1, r * 0.25);
      for (let i = 0; i < 9; i++) {
        const a = Math.PI * 1.1 + (i / 8) * Math.PI * 0.8, len = r * (0.8 + hairUp * 1.2);
        ctx.beginPath();
        ctx.moveTo(Math.cos(a) * r * 0.9, cy + Math.sin(a) * r * 0.9);
        ctx.lineTo(Math.cos(a) * (r + len), cy + Math.sin(a) * (r + len));
        ctx.stroke();
      }
    } else {
      const capY = cy - r * 0.2;
      if (st === 'buzz') {
        ctx.globalAlpha *= 0.7;
        ctx.beginPath(); ctx.arc(0, cy - r * 0.05, r * 1.0, Math.PI * 1.08, Math.PI * 1.92); ctx.fill();
        ctx.globalAlpha /= 0.7;
      } else if (st === 'curly') {
        for (let i = 0; i < 7; i++) {
          const a = Math.PI * 1.05 + (i / 6) * Math.PI * 0.9;
          ctx.beginPath(); ctx.arc(Math.cos(a) * r * 0.95, cy - r * 0.1 + Math.sin(a) * r * 0.95, r * 0.42, 0, 7); ctx.fill();
        }
      } else if (st === 'bowl') {
        ctx.beginPath(); ctx.arc(0, cy - r * 0.1, r * 1.1, Math.PI, 0); ctx.lineTo(r * 1.1, cy - r * 0.05); ctx.lineTo(-r * 1.1, cy - r * 0.05); ctx.fill();
      } else {
        ctx.beginPath(); ctx.arc(0, capY, r * 1.06, Math.PI * 1.02, Math.PI * 1.98); ctx.fill();
        if (st === 'spiky') {
          for (let i = 0; i < 5; i++) {
            const x = -r * 0.8 + i * r * 0.4;
            ctx.beginPath(); ctx.moveTo(x - r * 0.25, capY - r * 0.6); ctx.lineTo(x, capY - r * 1.45); ctx.lineTo(x + r * 0.25, capY - r * 0.6); ctx.fill();
          }
        }
        if (st === 'mohawk') { roundRect(ctx, -r * 0.22, capY - r * 1.55, r * 0.44, r * 0.9, r * 0.2); ctx.fill(); }
        if (st === 'side') { ctx.beginPath(); ctx.ellipse(-r * 0.35, cy - r * 0.55, r * 0.75, r * 0.3, -0.35, 0, 7); ctx.fill(); }
        if (look.girl) { ctx.beginPath(); ctx.ellipse(r * 0.25, cy - r * 0.58, r * 0.7, r * 0.28, 0.25, 0, 7); ctx.fill(); }
      }
    }
    // face details
    const ey = cy + r * 0.02, ex = r * 0.38;
    if (zombie) {
      ctx.fillStyle = '#c0392b';
      ctx.beginPath(); ctx.arc(-ex, ey, r * 0.17, 0, 7); ctx.arc(ex, ey, r * 0.17, 0, 7); ctx.fill();
    } else if (expr === 'scared' || fried) {
      ctx.fillStyle = '#fff';
      ctx.beginPath(); ctx.arc(-ex, ey, r * 0.22, 0, 7); ctx.arc(ex, ey, r * 0.22, 0, 7); ctx.fill();
      ctx.fillStyle = '#222';
      ctx.beginPath(); ctx.arc(-ex, ey, r * 0.1, 0, 7); ctx.arc(ex, ey, r * 0.1, 0, 7); ctx.fill();
      ctx.beginPath(); ctx.ellipse(0, cy + r * 0.5, r * 0.17, r * 0.22 + Math.sin(t * 20) * r * 0.04, 0, 0, 7); ctx.fill();
    } else {
      ctx.fillStyle = '#222';
      ctx.beginPath(); ctx.arc(-ex, ey, r * 0.12, 0, 7); ctx.arc(ex, ey, r * 0.12, 0, 7); ctx.fill();
      ctx.strokeStyle = '#7a3b2e';
      ctx.lineWidth = Math.max(0.8, r * 0.1);
      ctx.beginPath(); ctx.arc(0, cy + r * 0.3, r * (expr === 'happy' ? 0.32 : 0.22), 0.2 * Math.PI, 0.8 * Math.PI); ctx.stroke();
    }
    if (look.glasses && !zombie) {
      ctx.strokeStyle = look.glasses;
      ctx.lineWidth = Math.max(0.8, r * 0.12);
      ctx.beginPath(); ctx.arc(-ex, ey, r * 0.27, 0, 7); ctx.moveTo(ex + r * 0.27, ey); ctx.arc(ex, ey, r * 0.27, 0, 7);
      ctx.moveTo(-ex + r * 0.27, ey); ctx.lineTo(ex - r * 0.27, ey); ctx.stroke();
    }
    // headwear
    if (!fried && hairUp < 0.2) {
      if (look.hat === 'cap') {
        ctx.fillStyle = look.hatColor;
        ctx.beginPath(); ctx.arc(0, cy - r * 0.3, r * 1.05, Math.PI, 0); ctx.fill();
        ctx.fillRect(0, cy - r * 0.38, r * 1.75, r * 0.26);
        ctx.fillStyle = 'rgba(255,255,255,0.5)';
        ctx.beginPath(); ctx.arc(0, cy - r * 1.3, r * 0.14, 0, 7); ctx.fill();
      } else if (look.hat === 'beanie') {
        ctx.fillStyle = look.hatColor;
        ctx.beginPath(); ctx.arc(0, cy - r * 0.25, r * 1.08, Math.PI, 0); ctx.fill();
        ctx.fillStyle = 'rgba(255,255,255,0.35)';
        ctx.fillRect(-r * 1.08, cy - r * 0.45, r * 2.16, r * 0.3);
        ctx.fillStyle = look.hatColor;
        ctx.beginPath(); ctx.arc(0, cy - r * 1.4, r * 0.28, 0, 7); ctx.fill();
      } else if (look.bow) {
        ctx.fillStyle = look.bow;
        const bx = r * 0.7, by = cy - r * 0.85;
        ctx.beginPath(); ctx.moveTo(bx, by); ctx.lineTo(bx - r * 0.45, by - r * 0.3); ctx.lineTo(bx - r * 0.45, by + r * 0.3); ctx.fill();
        ctx.beginPath(); ctx.moveTo(bx, by); ctx.lineTo(bx + r * 0.45, by - r * 0.3); ctx.lineTo(bx + r * 0.45, by + r * 0.3); ctx.fill();
        ctx.beginPath(); ctx.arc(bx, by, r * 0.13, 0, 7); ctx.fill();
      } else if (look.headband) {
        ctx.strokeStyle = look.headband;
        ctx.lineWidth = r * 0.22;
        ctx.beginPath(); ctx.arc(0, cy - r * 0.05, r * 1.0, Math.PI * 1.1, Math.PI * 1.9); ctx.stroke();
      }
    }
  }

  RH.art = {
    look() {
      const girl = chance(0.5);
      const hat = chance(0.14) ? pick(['cap', 'beanie']) : null;
      return {
        girl,
        skin: pick(SKIN),
        hair: chance(0.08) ? pick(DYED) : pick(HAIR),
        hairStyle: pick(girl ? GIRL_HAIR : BOY_HAIR),
        glasses: chance(0.22) ? pick(['#222', '#222', '#8e3b46', '#2f6db5']) : null,
        hat, hatColor: pick(BRIGHT),
        bow: girl && !hat && chance(0.35) ? pick(BRIGHT) : null,
        headband: girl && !hat && chance(0.2) ? pick(BRIGHT) : null,
        blush: chance(0.3),
        scarf: chance(0.22),
        pack: chance(0.38) ? pick(BRIGHT) : null,
        jacket: chance(0.18) ? pick(JACKETS) : null,
        pants: pick(PANTS),
        shoes: pick(['#222', '#fff', '#c0392b', '#2f6db5']),
        height: rand(0.9, 1.06),
        width: rand(0.9, 1.15),
      };
    },

    head,

    // Full standing student, feet at (x, y).
    // pose: { phase, arms: 'swing'|'up'|'down'|'shield', expr, swell, fried, hairUp, zombie, rot, alpha, shake, t, noShadow, kick }
    student(ctx, x, y, s, look, pose = {}) {
      const { phase = 0, arms = 'swing', rot = 0, alpha = 1, shake = 0, t = 0 } = pose;
      const k = s * (look.height || 1), wk = look.width || 1;
      ctx.save();
      ctx.globalAlpha *= alpha;
      ctx.translate(x + shake, y);
      if (!pose.noShadow) {
        ctx.fillStyle = 'rgba(0,0,0,0.16)';
        ctx.beginPath(); ctx.ellipse(0, 0, 9 * s, 2.5 * s, 0, 0, Math.PI * 2); ctx.fill();
      }
      ctx.rotate(rot);
      ctx.lineCap = 'round';
      const swing = pose.kick ? Math.sin(t * 22) * 0.7 : Math.sin(phase) * 0.55;
      const pants = pose.fried ? '#2a2a2a' : look.pants || '#1f2a5a';
      // backpack behind the body
      if (look.pack) {
        ctx.fillStyle = look.pack;
        roundRect(ctx, -9 * k * wk, -32 * k, 18 * k * wk, 15 * k, 4 * k); ctx.fill();
      }
      // legs + shoes
      ctx.strokeStyle = pants;
      ctx.lineWidth = 4 * k;
      for (const sg of [1, -1]) {
        const fx = Math.sin(swing * sg) * 9 * k;
        ctx.beginPath(); ctx.moveTo(sg * 1.5 * k, -18 * k); ctx.lineTo(fx, -2 * k); ctx.stroke();
        ctx.fillStyle = look.shoes || '#222';
        ctx.beginPath(); ctx.ellipse(fx + 1.5 * k, -1 * k, 3.2 * k, 1.8 * k, 0, 0, 7); ctx.fill();
      }
      if (look.girl) {
        ctx.fillStyle = pants;
        ctx.beginPath();
        ctx.moveTo(-6 * k * wk, -22 * k); ctx.lineTo(6 * k * wk, -22 * k); ctx.lineTo(9 * k * wk, -12 * k); ctx.lineTo(-9 * k * wk, -12 * k);
        ctx.fill();
      }
      // arms
      const skin = pose.zombie ? '#9ccf7f' : pose.fried ? '#6b5a4a' : look.skin;
      const sleeve = look.jacket;
      ctx.lineWidth = 3.2 * k;
      for (const sg of [1, -1]) {
        ctx.strokeStyle = sleeve || skin;
        ctx.beginPath(); ctx.moveTo(sg * 4 * k * wk, -31 * k);
        let hx, hy;
        if (arms === 'up') { hx = sg * 10 * k; hy = -46 * k + Math.sin(t * 14 + sg) * 2 * k; }
        else if (arms === 'shield') { hx = sg * 4 * k; hy = -48 * k; }
        else if (arms === 'down') { hx = sg * 6 * k * wk; hy = -19 * k; }
        else { hx = Math.sin(-swing * sg) * 8 * k + sg * 2 * k; hy = -19 * k; }
        ctx.lineTo(hx, hy);
        ctx.stroke();
        ctx.fillStyle = skin;
        ctx.beginPath(); ctx.arc(hx, hy, 1.8 * k, 0, 7); ctx.fill();
      }
      // torso
      ctx.fillStyle = pose.fried ? '#4a4a4a' : look.jacket || '#fff';
      roundRect(ctx, -6.5 * k * wk, -33 * k, 13 * k * wk, 15 * k, 3.5 * k); ctx.fill();
      if (!look.jacket) {
        ctx.strokeStyle = '#c9d1df';
        ctx.lineWidth = 1;
        ctx.stroke();
      } else {
        ctx.fillStyle = '#fff';
        ctx.beginPath(); ctx.moveTo(-2.5 * k, -33 * k); ctx.lineTo(2.5 * k, -33 * k); ctx.lineTo(0, -27 * k); ctx.fill();
      }
      if (look.pack) {
        ctx.strokeStyle = look.pack;
        ctx.lineWidth = 1.6 * k;
        ctx.beginPath(); ctx.moveTo(-4 * k, -33 * k); ctx.lineTo(-4.5 * k, -22 * k); ctx.moveTo(4 * k, -33 * k); ctx.lineTo(4.5 * k, -22 * k); ctx.stroke();
      }
      if (look.scarf && !pose.fried) {
        ctx.fillStyle = '#e03131';
        ctx.beginPath(); ctx.moveTo(-4 * k, -33 * k); ctx.lineTo(4 * k, -33 * k); ctx.lineTo(1 * k, -25 * k); ctx.lineTo(-1 * k, -25 * k); ctx.fill();
      }
      const hr = 6.2 * k * (1 + (pose.swell || 0) * 0.7);
      head(ctx, -33 * k - hr + 0.5 * k, hr, look, { ...pose, expr: pose.expr });
      ctx.restore();
    },

    // Head and shoulders only (people seated behind desks or in windows); (x, y) is the bottom of the shoulders.
    bust(ctx, x, y, s, look, opts = {}) {
      ctx.save();
      ctx.translate(x, y);
      const top = opts.zombie ? '#c9d6c0' : look.jacket || '#fff';
      ctx.fillStyle = top;
      roundRect(ctx, -12 * s, -20 * s, 24 * s, 22 * s, 6 * s); ctx.fill();
      if (look.scarf && !opts.zombie) {
        ctx.fillStyle = '#e03131';
        ctx.beginPath(); ctx.moveTo(-5 * s, -20 * s); ctx.lineTo(5 * s, -20 * s); ctx.lineTo(1 * s, -10 * s); ctx.lineTo(-1 * s, -10 * s); ctx.fill();
      }
      head(ctx, -28 * s, 9 * s, look, opts);
      ctx.restore();
    },

    // Name pill whose bottom edge sits at y.
    tag(ctx, x, y, label, s, hot = false, alpha = 1) {
      const fs = clamp(11 * s, 10, 16) * (hot ? 1.25 : 1);
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.font = font(fs, 800);
      const tw = ctx.measureText(label).width + fs * 0.9, th = fs * 1.5;
      roundRect(ctx, x - tw / 2, y - th, tw, th, th * 0.38);
      ctx.fillStyle = hot ? '#ffd23f' : 'rgba(255,255,255,0.94)';
      ctx.fill();
      ctx.strokeStyle = hot ? '#b8860b' : 'rgba(30,40,80,0.3)';
      ctx.lineWidth = 1;
      ctx.stroke();
      ctx.fillStyle = '#1b2240';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(label, x, y - th / 2 + 1);
      ctx.restore();
    },
  };

  // Sky, school building and yard. Ground starts at h * 0.6.
  RH.art.schoolyard = function (ctx, w, h, time) {
    const ground = h * 0.6, s = h / 500;
    const sky = ctx.createLinearGradient(0, 0, 0, ground);
    sky.addColorStop(0, '#7cc6f2');
    sky.addColorStop(1, '#d9f1ff');
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, w, ground);
    ctx.fillStyle = 'rgba(255,246,190,0.9)';
    ctx.beginPath(); ctx.arc(w * 0.88, h * 0.1, 26 * s, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#fff';
    for (const [cx, cy, k] of [[0.2, 0.08, 1], [0.6, 0.05, 1.3]]) {
      const x = ((cx * w + time * 5 * k) % (w + 200)) - 100, y = cy * h, r = 18 * s * k;
      ctx.beginPath(); ctx.arc(x, y, r, 0, 7); ctx.arc(x + r, y - r * 0.4, r * 1.2, 0, 7); ctx.arc(x + r * 2.2, y, r, 0, 7); ctx.fill();
    }
    // building
    const top = h * 0.3, bw = w * 0.86, bx = (w - bw) / 2;
    ctx.fillStyle = '#f4e4c1';
    ctx.fillRect(bx, top, bw, ground - top);
    ctx.fillStyle = '#c0533f';
    ctx.fillRect(bx - 10, top - 10 * s, bw + 20, 12 * s);
    ctx.fillStyle = '#e8d3a6';
    ctx.fillRect(bx, (top + ground) / 2 - 2 * s, bw, 5 * s);
    const cols = Math.floor(bw / (46 * s));
    for (let r = 0; r < 2; r++) {
      for (let c = 0; c < cols; c++) {
        const wx = bx + 14 * s + c * ((bw - 28 * s) / cols), wy = top + 12 * s + r * ((ground - top) / 2);
        if (r === 1 && Math.abs(c - (cols - 1) / 2) < 1) continue;
        ctx.fillStyle = '#8fc3df';
        ctx.fillRect(wx, wy, 26 * s, ((ground - top) / 2) - 26 * s);
        ctx.fillStyle = 'rgba(255,255,255,0.45)';
        ctx.fillRect(wx, wy, 26 * s, 3 * s);
      }
    }
    // door + sign
    ctx.fillStyle = '#7a5537';
    ctx.fillRect(w / 2 - 26 * s, ground - 50 * s, 52 * s, 50 * s);
    ctx.fillStyle = '#1b5e9b';
    roundRect(ctx, w / 2 - 110 * s, top - 34 * s, 220 * s, 24 * s, 5 * s); ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.font = font(11 * s, 800);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('TRƯỜNG THPT RANDOM HUMAN', w / 2, top - 22 * s);
    // yard
    const yard = ctx.createLinearGradient(0, ground, 0, h);
    yard.addColorStop(0, '#d9cfbd');
    yard.addColorStop(1, '#e9e1d2');
    ctx.fillStyle = yard;
    ctx.fillRect(0, ground, w, h - ground);
    ctx.fillStyle = '#c4b8a2';
    ctx.fillRect(0, ground, w, 4 * s);
    ctx.strokeStyle = 'rgba(255,255,255,0.6)';
    ctx.lineWidth = 3 * s;
    ctx.beginPath(); ctx.ellipse(w / 2, h * 0.82, w * 0.12, h * 0.06, 0, 0, Math.PI * 2); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(w / 2, ground + 10 * s); ctx.lineTo(w / 2, h); ctx.stroke();
  };

  RH.art.tree = function (ctx, x, y, s, sway = 0) {
    ctx.fillStyle = '#6b4a2f';
    ctx.fillRect(x - 7 * s, y - 120 * s, 14 * s, 120 * s);
    ctx.fillStyle = '#3f8f4f';
    for (const [dx, dy, r] of [[0, -150, 48], [-40, -120, 36], [40, -122, 38], [-15, -185, 34], [25, -170, 30]]) {
      ctx.beginPath(); ctx.arc(x + dx * s + sway, y + dy * s, r * s, 0, Math.PI * 2); ctx.fill();
    }
    ctx.fillStyle = 'rgba(255,255,255,0.1)';
    ctx.beginPath(); ctx.arc(x - 20 * s + sway, y - 170 * s, 16 * s, 0, Math.PI * 2); ctx.fill();
  };

  // Students wandering inside a horizontal band (fractions of canvas height).
  RH.Crowd = class {
    constructor(y0, y1) { this.y0 = y0; this.y1 = y1; this.people = []; }

    set(names, w) {
      this.people = names.map((name) => ({
        name, label: short(name), look: RH.art.look(), x: rand(20, w - 20), ny: rand(this.y0, this.y1),
        dir: Math.random() < 0.5 ? -1 : 1, speed: rand(18, 40), phase: rand(0, 6), vy: 0, state: 'walk',
      }));
    }

    resize(k) { for (const p of this.people) p.x *= k; }

    scale(p, h) { return (0.75 + ((p.ny - this.y0) / (this.y1 - this.y0)) * 0.45) * (h / 500); }

    // threat: { x, y, r } — walkers within r run away from it.
    update(dt, w, h, panic = false, threat = null) {
      for (const p of this.people) {
        if (p.state !== 'walk') continue;
        const sp = p.speed * (panic ? 2.8 : 1);
        if (threat && Math.hypot(p.x - threat.x, p.ny * h - threat.y) < threat.r) p.dir = p.x < threat.x ? -1 : 1;
        else if (Math.random() < dt * (panic ? 1 : 0.06)) p.dir *= -1;
        if (Math.random() < dt * 0.3) p.vy = rand(-0.02, 0.02);
        p.x += p.dir * sp * dt;
        p.phase += dt * sp * 0.16;
        p.ny = clamp(p.ny + p.vy * dt * (panic ? 3 : 1), this.y0, this.y1);
        if (p.x < 14) { p.x = 14; p.dir = 1; }
        if (p.x > w - 14) { p.x = w - 14; p.dir = -1; }
      }
    }

    sorted() { return this.people.slice().sort((a, b) => a.ny - b.ny); }
  };
})(window.RH);
