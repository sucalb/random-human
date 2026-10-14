// App shell: name list, settings, game switching, frame loop, result modal, confetti.
(function () {
  const U = RH.util, S = RH.sound;
  const KEY = 'randomhuman.v1';
  const MAX_PICK = 10;
  const AVATAR = [
    'linear-gradient(135deg,#ff6b6b,#ff8e53)', 'linear-gradient(135deg,#8b5cf6,#ff5c8a)', 'linear-gradient(135deg,#22c08a,#13a3a0)',
    'linear-gradient(135deg,#4dabf7,#748ffc)', 'linear-gradient(135deg,#ffa94d,#ffd23f)', 'linear-gradient(135deg,#da77f2,#748ffc)',
  ];
  const DESCS = {
    ufo: 'Đĩa bay hút ai lên?', wheel: 'Quay là trúng', race: 'Về nhất là lên bảng', slot: 'Kéo cần, xem tên',
    train: 'Toa nào dừng ở ga?', bottle: 'Chai nào dạt vào bờ trước?', zombie: 'Bị cắn là lên bảng', lightning: 'Sét đánh trúng ai?',
    eagle: 'Ai bị quắp đi?', toilet: 'Ai bị cuốn trôi?', bees: 'Ai bị ong đốt?',
    witch: 'Ai bị hoá ếch?', tornado: 'Ai bị cuốn lên trời?',
  };
  const DEFAULT_NAMES = [
    'Nguyễn Văn An', 'Trần Bảo Ngọc', 'Lê Hoàng Nam', 'Phạm Thu Trang', 'Võ Quốc Bảo', 'Hoàng Anh Thư',
    'Đặng Tuấn Kiệt', 'Bùi Khánh Linh', 'Ngô Đức Thịnh', 'Dương Ngọc Hân', 'Lý Thành Đạt', 'Huỳnh Mai Phương',
    'Phan Minh Khôi', 'Trương Gia Bảo', 'Đỗ Hà My', 'Vũ Nhật Minh', 'Mai Thanh Tâm', 'Hồ Quang Vinh',
    'Châu Ngọc Diệp', 'Tạ Minh Quân', 'La Bảo Trâm', 'Cao Hữu Phúc', 'Kiều Thảo Nhi', 'Lâm Tiến Dũng',
  ].join('\n');

  const st = {
    namesText: DEFAULT_NAMES,
    count: 1,
    removePicked: true,
    drama: true,
    sound: true,
    title: 'Mời các bạn lên bảng trả bài',
    game: 'ufo',
    picked: [],
    history: [],
  };
  try { Object.assign(st, JSON.parse(localStorage.getItem(KEY) || '{}')); } catch (e) { /* storage unavailable */ }
  const save = () => { try { localStorage.setItem(KEY, JSON.stringify(st)); } catch (e) { /* ignore */ } };

  const $ = (id) => document.getElementById(id);
  const el = {
    tabs: $('tabs'), cv: $('cv'), stage: $('stage'), chips: $('chips'), poolInfo: $('poolInfo'),
    resetPool: $('btnResetPool'), countVal: $('countVal'), minus: $('btnMinus'), plus: $('btnPlus'),
    start: $('btnStart'), sound: $('btnSound'), full: $('btnFull'), list: $('btnList'),
    drawer: $('drawer'), scrim: $('scrim'), closeDrawer: $('btnCloseDrawer'), names: $('names'),
    nameCount: $('nameCount'), file: $('file'), shuffleNames: $('btnShuffleNames'), optRemove: $('optRemove'), optDrama: $('optDrama'),
    optTitle: $('optTitle'), pickedList: $('pickedList'), resetPool2: $('btnResetPool2'), history: $('history'),
    clearHistory: $('btnClearHistory'), modal: $('modal'), resultTitle: $('resultTitle'), resultList: $('resultList'),
    again: $('btnAgain'), close: $('btnClose'), toast: $('toast'), fx: $('fx'),
    gameLabel: $('gameLabel'), reveal: $('reveal'), revealNum: $('revealNum'), revealName: $('revealName'), flash: $('flash'),
  };

  // ---------- screen effects used by games ----------
  RH.fx.shake = (level = 1) => {
    el.stage.classList.remove('shake-1', 'shake-2');
    void el.stage.offsetWidth;
    el.stage.classList.add(level > 1 ? 'shake-2' : 'shake-1');
  };
  RH.fx.flash = () => {
    el.flash.classList.remove('on');
    void el.flash.offsetWidth;
    el.flash.classList.add('on');
  };

  // Big name card shown over the stage each time someone is picked; queued so none are skipped.
  const revealQueue = [];
  let revealing = null;
  function queueReveal(name, i) {
    revealQueue.push({ name, i });
    if (!revealing) revealing = runReveals();
  }
  async function runReveals() {
    const wait = (ms) => new Promise((r) => setTimeout(r, ms));
    while (revealQueue.length) {
      const { name, i } = revealQueue.shift();
      el.revealNum.textContent = `Người thứ ${i + 1}`;
      el.revealName.textContent = name;
      el.reveal.classList.remove('hidden', 'out');
      await wait(revealQueue.length ? 900 : 1500);
      el.reveal.classList.add('out');
      await wait(330);
      el.reveal.classList.add('hidden');
    }
    revealing = null;
  }

  let busy = false;
  let game = RH.games.find((g) => g.id === st.game) || RH.games[0];

  // ---------- names ----------
  function parseNames(text) {
    const seen = new Map();
    const out = [];
    for (const raw of text.split(/\r?\n/)) {
      const line = raw.replace(/[,;\t]+$/, '').trim();
      if (!line) continue;
      const c = (seen.get(line) || 0) + 1;
      seen.set(line, c);
      out.push(c > 1 ? `${line} (${c})` : line);
    }
    return out;
  }
  const allNames = () => parseNames(st.namesText);
  const pool = () => {
    const names = allNames();
    return st.removePicked ? names.filter((n) => !st.picked.includes(n)) : names;
  };

  // ---------- canvas ----------
  const ctx = el.cv.getContext('2d');
  let W = 0, H = 0, dpr = 1;
  function resize() {
    const r = el.stage.getBoundingClientRect();
    dpr = Math.min(2, window.devicePixelRatio || 1);
    W = Math.max(1, r.width); H = Math.max(1, r.height);
    el.cv.width = Math.round(W * dpr);
    el.cv.height = Math.round(H * dpr);
    for (const g of RH.games) g.resize(W, H);
    fxResize();
  }

  let last = performance.now();
  function frame(now) {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    game.update(dt);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, W, H);
    game.draw(ctx, W, H);
    requestAnimationFrame(frame);
  }

  // ---------- UI rendering ----------
  function renderTabs() {
    el.tabs.innerHTML = '';
    for (const g of RH.games) {
      const b = document.createElement('button');
      b.className = 'tab' + (g === game ? ' active' : '');
      b.innerHTML = `<span class="ic">${g.icon}</span><span>${g.name}</span>`;
      b.title = DESCS[g.id] || g.name;
      b.disabled = busy && g !== game;
      b.onclick = () => selectGame(g);
      el.tabs.appendChild(b);
    }
    el.gameLabel.querySelector('.gl-icon').textContent = game.icon;
    el.gameLabel.querySelector('.gl-name').textContent = game.name;
    el.gameLabel.querySelector('.gl-desc').textContent = DESCS[game.id] || '';
    const active = el.tabs.querySelector('.tab.active');
    if (active) active.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  }

  function renderPool() {
    const all = allNames().length, p = pool().length;
    el.poolInfo.textContent = st.removePicked ? `Còn ${p}/${all} người chưa được chọn` : `${all} người trong danh sách`;
    el.resetPool.classList.toggle('hidden', !st.removePicked || !st.picked.length);
    el.countVal.textContent = st.count;
    el.minus.disabled = busy || st.count <= 1;
    el.plus.disabled = busy || st.count >= MAX_PICK;
    el.start.disabled = busy;
    el.nameCount.textContent = `(${all} người)`;
    el.pickedList.innerHTML = st.picked.length
      ? st.picked.map((n) => `<span class="tag">${esc(n)}</span>`).join('')
      : '<span class="empty">Chưa có ai.</span>';
  }

  function renderHistory() {
    const games = Object.fromEntries(RH.games.map((g) => [g.id, g]));
    el.history.innerHTML = st.history.length
      ? st.history.map((h) => {
        const g = games[h.game];
        const t = new Date(h.t).toLocaleString('vi-VN', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit' });
        return `<li><div class="meta">${t} · ${g ? g.icon + ' ' + g.name : ''}</div>${h.names.map(esc).join(', ')}</li>`;
      }).join('')
      : '<li class="empty">Chưa có lượt nào.</li>';
  }

  function esc(s) {
    return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }

  let toastTimer;
  function toast(msg) {
    el.toast.textContent = msg;
    el.toast.classList.remove('hidden');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.toast.classList.add('hidden'), 2600);
  }

  function setupGame() { game.setup(pool()); }

  function selectGame(g) {
    if (busy || g === game) return;
    game = g;
    st.game = g.id;
    save();
    el.chips.innerHTML = '';
    setupGame();
    renderTabs();
  }

  function setBusy(b) {
    busy = b;
    el.stage.classList.toggle('busy', b);
    renderTabs();
    renderPool();
  }

  // ---------- play ----------
  async function start() {
    if (busy) return;
    S.ctx(); // unlock audio on user gesture
    const p = pool();
    if (!p.length) {
      toast(st.removePicked && st.picked.length ? 'Tất cả đã được chọn — bấm "Làm mới" để chơi tiếp.' : 'Danh sách đang trống — mở 📋 Danh sách để thêm tên.');
      return;
    }
    const k = Math.min(st.count, p.length);
    if (k < st.count) toast(`Chỉ còn ${p.length} người nên chọn ${k} người.`);
    const winners = U.secureSample(p, k);
    closeDrawer();
    el.chips.innerHTML = '';
    setBusy(true);
    S.tension(true);
    try {
      await game.play(winners, (name, i) => { addChip(name, i); queueReveal(name, i); });
    } catch (e) {
      console.error(e);
    }
    S.tension(false);
    if (revealing) await revealing;
    if (st.removePicked) st.picked.push(...winners.filter((n) => !st.picked.includes(n)));
    st.history.unshift({ t: Date.now(), game: game.id, names: winners });
    st.history = st.history.slice(0, 50);
    save();
    renderHistory();
    showResult(winners);
  }

  function addChip(name, i) {
    const c = document.createElement('div');
    c.className = 'chip';
    c.innerHTML = `<span class="n">${i + 1}</span>${esc(name)}`;
    el.chips.appendChild(c);
  }

  function showResult(winners) {
    el.resultTitle.textContent = st.title || 'Kết quả';
    el.resultList.innerHTML = winners.map((n, i) => {
      const initial = n.trim().split(/\s+/).pop().charAt(0).toUpperCase();
      return `<li style="animation-delay:${i * 0.12}s"><span class="av" style="background:${AVATAR[i % AVATAR.length]}">${esc(initial)}</span>
        <div><div class="meta">Người thứ ${i + 1}</div><div class="nm">${esc(n)}</div></div></li>`;
    }).join('');
    el.modal.classList.remove('hidden');
    S.fanfare();
    confetti();
    el.again.focus();
  }

  function closeResult() {
    if (el.modal.classList.contains('hidden')) return;
    el.modal.classList.add('hidden');
    el.chips.innerHTML = '';
    setupGame();
    setBusy(false);
  }

  // ---------- drawer ----------
  function openDrawer() {
    if (busy) return;
    el.drawer.classList.add('open');
    el.drawer.setAttribute('aria-hidden', 'false');
    el.scrim.classList.remove('hidden');
  }
  function closeDrawer() {
    el.drawer.classList.remove('open');
    el.drawer.setAttribute('aria-hidden', 'true');
    el.scrim.classList.add('hidden');
  }

  function namesChanged() {
    const names = allNames();
    st.picked = st.picked.filter((n) => names.includes(n));
    save();
    renderPool();
    if (!busy) setupGame();
  }

  function resetPool() {
    if (busy) return;
    st.picked = [];
    save();
    renderPool();
    setupGame();
    toast('Đã làm mới — mọi người đều có thể được chọn lại.');
  }

  // ---------- confetti ----------
  const fctx = el.fx.getContext('2d');
  let parts = [], fxRunning = false;
  function fxResize() {
    el.fx.width = Math.round(innerWidth * dpr);
    el.fx.height = Math.round(innerHeight * dpr);
  }
  function confetti() {
    const cols = ['#ffd23f', '#ff6b6b', '#22b07d', '#4dabf7', '#da77f2', '#ffa94d'];
    for (let i = 0; i < 160; i++) {
      const side = i % 2 ? 1 : -1;
      parts.push({
        x: side > 0 ? -10 : innerWidth + 10, y: innerHeight * U.rand(0.5, 0.9),
        vx: side * U.rand(250, 650), vy: -U.rand(450, 900), r: U.rand(0, 6), vr: U.rand(-8, 8),
        w: U.rand(6, 11), h: U.rand(9, 16), c: U.pick(cols), life: U.rand(2.5, 3.8),
      });
    }
    if (!fxRunning) { fxRunning = true; let t0 = performance.now(); requestAnimationFrame(function step(now) {
      const dt = Math.min(0.05, (now - t0) / 1000); t0 = now;
      fctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      fctx.clearRect(0, 0, innerWidth, innerHeight);
      parts = parts.filter((p) => (p.life -= dt) > 0 && p.y < innerHeight + 40);
      for (const p of parts) {
        p.vy += 900 * dt; p.vx *= 0.99; p.x += p.vx * dt; p.y += p.vy * dt; p.r += p.vr * dt;
        fctx.save();
        fctx.translate(p.x, p.y);
        fctx.rotate(p.r);
        fctx.scale(1, Math.cos(p.r * 2));
        fctx.globalAlpha = Math.min(1, p.life);
        fctx.fillStyle = p.c;
        fctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
        fctx.restore();
      }
      if (parts.length) requestAnimationFrame(step);
      else { fxRunning = false; fctx.clearRect(0, 0, innerWidth, innerHeight); }
    }); }
  }

  // ---------- events ----------
  el.start.onclick = start;
  el.minus.onclick = () => { st.count = Math.max(1, st.count - 1); save(); renderPool(); };
  el.plus.onclick = () => { st.count = Math.min(MAX_PICK, st.count + 1); save(); renderPool(); };
  el.sound.onclick = () => {
    st.sound = S.enabled = !st.sound;
    el.sound.textContent = st.sound ? '🔊' : '🔇';
    save();
  };
  el.full.onclick = () => {
    if (document.fullscreenElement) document.exitFullscreen();
    else if (document.documentElement.requestFullscreen) document.documentElement.requestFullscreen();
  };
  el.list.onclick = openDrawer;
  el.closeDrawer.onclick = closeDrawer;
  el.scrim.onclick = closeDrawer;
  el.resetPool.onclick = resetPool;
  el.resetPool2.onclick = resetPool;
  el.clearHistory.onclick = () => { st.history = []; save(); renderHistory(); };
  el.again.onclick = () => { closeResult(); start(); };
  el.close.onclick = closeResult;
  el.modal.onclick = (e) => { if (e.target === el.modal) closeResult(); };

  let nameTimer;
  el.names.oninput = () => {
    st.namesText = el.names.value;
    el.nameCount.textContent = `(${allNames().length} người)`;
    clearTimeout(nameTimer);
    nameTimer = setTimeout(namesChanged, 350);
  };
  el.file.onchange = async () => {
    const f = el.file.files[0];
    if (!f) return;
    const text = await f.text();
    // CSV: take the first column of each row.
    const lines = text.split(/\r?\n/).map((l) => (f.name.toLowerCase().endsWith('.csv') ? l.split(/[,;]/)[0] : l).replace(/^"|"$/g, '').trim());
    st.namesText = el.names.value = lines.filter(Boolean).join('\n');
    el.file.value = '';
    namesChanged();
    toast(`Đã nhập ${allNames().length} tên từ ${f.name}`);
  };
  el.shuffleNames.onclick = () => {
    st.namesText = el.names.value = U.shuffle(allNames()).join('\n');
    namesChanged();
  };
  el.optRemove.onchange = () => { st.removePicked = el.optRemove.checked; namesChanged(); };
  el.optDrama.onchange = () => { st.drama = RH.settings.drama = el.optDrama.checked; save(); };
  el.optTitle.oninput = () => { st.title = el.optTitle.value; save(); };

  document.addEventListener('keydown', (e) => {
    const typing = /^(TEXTAREA|INPUT)$/.test(document.activeElement && document.activeElement.tagName);
    if (e.key === 'Escape') { closeDrawer(); closeResult(); return; }
    if (typing) return;
    const modalOpen = !el.modal.classList.contains('hidden');
    if ((e.key === ' ' || e.key === 'Enter') && !modalOpen && !el.drawer.classList.contains('open')) {
      e.preventDefault();
      start();
    } else if (e.key === 'Enter' && modalOpen && document.activeElement === document.body) {
      e.preventDefault();
      closeResult();
      start();
    }
  });

  // ---------- init ----------
  S.enabled = st.sound;
  el.sound.textContent = st.sound ? '🔊' : '🔇';
  el.names.value = st.namesText;
  el.optRemove.checked = st.removePicked;
  el.optDrama.checked = RH.settings.drama = st.drama;
  el.optTitle.value = st.title;
  new ResizeObserver(resize).observe(el.stage);
  resize();
  setupGame();
  renderTabs();
  renderPool();
  renderHistory();
  requestAnimationFrame(frame);
})();
