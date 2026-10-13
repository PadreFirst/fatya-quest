// Поток квеста, прогресс, переходы
const ROOMS = {
  1: {
    id: 1, preview: 'img/room1.jpg', us: 'img/room1_us.jpg', patient: 'Пациент: Комната 01',
    R1: { x: 680, y: 220, w: 310, h: 415 },   // кровать
    R2: { x: 700, y: 235, w: 170, h: 150 },   // изголовье, подушки
    P: { x: 777, y: 335 },                    // сердечко на передней левой подушке
    objW: 26,                                 // ширина сердечка на снимке (px) — под калиперы
    start: { x: 330, y: 140 },                // старт датчика — у стола, подальше от цели
    angles: [-35, 45, 15],                    // нужный угол луча на каждом из 3 этапов (0° — вниз)
  },
  2: {
    id: 2, preview: 'img/room2.jpg', us: 'img/room2_us.jpg', patient: 'Пациент: Комната 02',
    R1: { x: 745, y: 60, w: 265, h: 265 },    // прихожая
    R2: { x: 815, y: 180, w: 160, h: 140 },   // пол у двери
    P: { x: 866, y: 288 },                    // носочек возле тапок
    objW: 26,
    start: { x: 330, y: 560 },                // старт датчика — над диваном
    angles: [40, -30, -50],
  },
};
const PRIZES = [
  { text: 'сердечки 💗', conclusion: 'эхо-признаки сердечек. Рекомендовано: премия.' },
  { text: 'белые носочки 🧦', conclusion: 'эхо-признаки белых носочков. Рекомендовано: к главврачу.' },
];

const App = (() => {
  const $ = s => document.querySelector(s);
  const userId = (tg && tg.initDataUnsafe && tg.initDataUnsafe.user && tg.initDataUnsafe.user.id) || 'guest';
  const KEY = 'fatya_quest_v1';
  const LKEY = KEY + '_' + userId;
  const fresh = () => ({ step: 'splash', knifeLevel: 0, first: null, roomIdx: 0, scan: null, ts: 0 });
  let state = fresh();
  let knife, scanner, ab, cpr;
  const imgs = {};

  // ---------- прогресс (Telegram CloudStorage + localStorage) ----------
  const cloudOk = () => tg && tg.CloudStorage && tg.isVersionAtLeast && tg.isVersionAtLeast('6.9');
  function save() {
    state.ts = Date.now();
    const s = JSON.stringify(state);
    try { localStorage.setItem(LKEY, s); } catch (e) {}
    if (cloudOk()) { try { tg.CloudStorage.setItem(KEY, s, () => {}); } catch (e) {} }
  }
  function load() {
    return new Promise(res => {
      let local = null;
      try { local = JSON.parse(localStorage.getItem(LKEY) || 'null'); } catch (e) {}
      if (!cloudOk()) return res(local);
      let done = false;
      const fin = v => { if (!done) { done = true; res(v); } };
      setTimeout(() => fin(local), 2500);
      try {
        tg.CloudStorage.getItem(KEY, (err, val) => {
          let cloud = null;
          try { cloud = val ? JSON.parse(val) : null; } catch (e) {}
          if (cloud && (!local || (cloud.ts || 0) >= (local.ts || 0))) fin(cloud); else fin(local);
        });
      } catch (e) { fin(local); }
    });
  }

  // ---------- экраны ----------
  let cur = null;
  function show(id) {
    if (cur === id) return;
    document.querySelectorAll('.screen').forEach(s => s.classList.toggle('active', s.id === 's-' + id));
    if (cur && cur !== 'loading') Sound.fx.swoosh();
    cur = id;
    document.body.classList.toggle('scanning', id === 'scan');
    if (id !== 'knife' && knife) knife.stop();
    if (id !== 'scan' && scanner) scanner.stop();
    if (id !== 'ab' && ab) ab.stop();
    if (id !== 'cpr' && cpr) cpr.stop();
  }

  function goto(step, extra) {
    Object.assign(state, extra || {}, { step });
    save();
    render();
  }

  function roomOrder() {
    const first = state.first || 1;
    return [first, first === 1 ? 2 : 1];
  }

  function render() {
    const st = state.step;
    if (st === 'knife') {
      show('knife');
      requestAnimationFrame(() => knife.start(state.knifeLevel || 0));
    } else if (st === 'ab') {
      show('ab');
      requestAnimationFrame(() => ab.start());
    } else if (st === 'cpr') {
      show('cpr');
      requestAnimationFrame(() => cpr.start());
    } else if (st === 'scan') {
      show('scan');
      startScan();
    } else if (st === 'found1') {
      show('found1'); buildHearts(); setTimeout(() => confetti(innerWidth / 2, innerHeight * 0.35, ['#8b0a1a', '#ff4f7b', '#fff']), 200);
    } else if (st === 'found2') {
      show('found2'); setTimeout(() => confetti(innerWidth / 2, innerHeight * 0.35), 200);
    } else {
      show(st);
    }
  }

  function loadImg(src) {
    if (imgs[src]) return imgs[src];
    imgs[src] = new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = src; });
    return imgs[src];
  }

  async function startScan() {
    const roomId = roomOrder()[state.roomIdx || 0];
    const base = ROOMS[roomId];
    const img = await loadImg(base.us);
    const prize = PRIZES[state.roomIdx || 0];
    const room = { ...base, imgEl: img, prizeText: prize.text, conclusion: prize.conclusion };
    requestAnimationFrame(() => scanner.start(room, state.scan));
  }

  // ---------- переход «приблизить и затемнить» ----------
  function zoomFade(src, fromRect, done) {
    const z = $('#zoomer'), fade = $('#fade');
    z.style.transition = 'none';
    z.style.backgroundImage = `url(${src})`;
    const W = innerWidth, H = innerHeight;
    const r = fromRect || { left: W * 0.1, top: H * 0.25, width: W * 0.8, height: H * 0.5 };
    z.style.left = r.left + 'px'; z.style.top = r.top + 'px'; z.style.width = r.width + 'px'; z.style.height = r.height + 'px';
    z.style.right = 'auto'; z.style.bottom = 'auto';
    z.style.transform = 'none';
    z.style.display = 'block';
    void z.offsetWidth;
    const sc = Math.max(W / r.width, H / r.height) * 1.6;
    const tx = W / 2 - (r.left + r.width / 2), ty = H / 2 - (r.top + r.height / 2);
    z.style.transition = 'transform 1.1s cubic-bezier(.5,0,.3,1)';
    z.style.transform = `translate(${tx}px, ${ty}px) scale(${sc})`;
    Sound.fx.whoosh();
    Haptic.impact('heavy');
    setTimeout(() => fade.classList.add('on'), 500);        // через полсекунды — затемнение (0.8 c)
    setTimeout(() => {
      done();
      z.style.display = 'none';
      setTimeout(() => fade.classList.remove('on'), 150);
    }, 1350);
  }

  // ---------- украшения ----------
  function buildHearts() {
    const p = $('.hearts-panel');
    if (p.childElementCount) return;
    const heart = '<path d="M12 21s-7.5-4.6-10-9.3C.3 8.4 2 4.5 5.8 4.1 8.2 3.9 10.2 5.3 12 7.4c1.8-2.1 3.8-3.5 6.2-3.3 3.8.4 5.5 4.3 3.8 7.6C19.5 16.4 12 21 12 21z"/>';
    const spots = [[50, 50, 70], [22, 30, 44], [78, 28, 50], [18, 74, 38], [82, 74, 42], [36, 82, 26], [64, 84, 30], [50, 16, 28], [6, 50, 22], [94, 50, 24]];
    spots.forEach(([x, y, s], i) => {
      const el = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      el.setAttribute('viewBox', '0 0 24 24');
      el.innerHTML = heart;
      el.style.width = el.style.height = s + 'px';
      el.style.left = `calc(${x}% - ${s / 2}px)`; el.style.top = `calc(${y}% - ${s / 2}px)`;
      el.style.animationDelay = (i * 0.13) + 's';
      if (i % 3 === 1) el.style.fill = '#a0102a';
      if (i % 3 === 2) el.style.fill = '#6e0614';
      p.appendChild(el);
    });
  }

  function floaters() {
    const box = $('#floaters');
    const em = ['🩺', '💉', '🩸', '💊', '🫀', '🦷', '🧬', '🩻', '❤️', '🧪'];
    for (let i = 0; i < 14; i++) {
      const s = document.createElement('span');
      s.textContent = em[i % em.length];
      s.style.left = Math.random() * 100 + '%';
      s.style.fontSize = 16 + Math.random() * 18 + 'px';
      s.style.animationDuration = 9 + Math.random() * 10 + 's';
      s.style.animationDelay = -Math.random() * 18 + 's';
      box.appendChild(s);
    }
  }

  const fx = { parts: [], raf: null };
  function confetti(x, y, colors) {
    const c = $('#fx'), ctx = c.getContext('2d');
    const dpr = Math.min(2, devicePixelRatio || 1);
    c.width = innerWidth * dpr; c.height = innerHeight * dpr;
    const cols = colors || ['#ff4f7b', '#2fe0c4', '#ffd166', '#7b5cff', '#ffffff'];
    for (let i = 0; i < 120; i++) {
      const a = Math.random() * TAU, v = 200 + Math.random() * 520;
      fx.parts.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 300, r: Math.random() * TAU, vr: (Math.random() - 0.5) * 14,
        w: 5 + Math.random() * 6, h: 3 + Math.random() * 4, c: cols[i % cols.length], life: 1.8 + Math.random() });
    }
    let last = performance.now();
    const step = () => {
      const now = performance.now(), dt = Math.min(0.033, (now - last) / 1000); last = now;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, innerWidth, innerHeight);
      for (const p of fx.parts) {
        p.vy += 700 * dt; p.vx *= 0.99; p.x += p.vx * dt; p.y += p.vy * dt; p.r += p.vr * dt; p.life -= dt;
        ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.r); ctx.globalAlpha = Math.min(1, p.life);
        ctx.fillStyle = p.c; ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h); ctx.restore();
      }
      fx.parts = fx.parts.filter(p => p.life > 0 && p.y < innerHeight + 40);
      if (fx.parts.length) fx.raf = requestAnimationFrame(step); else { fx.raf = null; ctx.clearRect(0, 0, innerWidth, innerHeight); }
    };
    if (!fx.raf) fx.raf = requestAnimationFrame(step);
  }

  // ---------- действия ----------
  function tap() { Sound.init(); }

  const actions = {
    ready() { tap(); Sound.fx.fanfare(); goto('intro2'); },
    go() { tap(); goto('knife', { knifeLevel: 0 }); },
    usok() { tap(); goto('pick'); },
    abgo() { tap(); goto('ab'); },
    cprgo() { tap(); goto('cpr'); },
    scanok() {},
    nextroom() {
      tap();
      const next = roomOrder()[1];
      state.roomIdx = 1; state.scan = null; state.step = 'scan'; save();
      zoomFade(ROOMS[next].preview, null, () => render());
    },
    whatnext() { tap(); Sound.fx.fanfare(); goto('final'); },
    restart() {
      tap();
      state = fresh();
      save();
      $('.hearts-panel').innerHTML = '';
      render();
    },
  };

  function init() {
    if (tg) {
      try {
        tg.ready();
        tg.expand();
        if (tg.isVersionAtLeast('7.7') && tg.disableVerticalSwipes) tg.disableVerticalSwipes();
        if (tg.isVersionAtLeast('6.1')) { tg.setHeaderColor('#0b0f1d'); tg.setBackgroundColor('#0b0f1d'); }
        if (tg.isVersionAtLeast('7.10') && tg.setBottomBarColor) tg.setBottomBarColor('#0b0f1d');
      } catch (e) {}
    }
    floaters();
    document.addEventListener('click', e => {
      const b = e.target.closest('[data-act]');
      if (b && actions[b.dataset.act]) actions[b.dataset.act]();
    });
    document.querySelectorAll('.room-card').forEach(card => card.addEventListener('click', () => {
      tap();
      const id = Number(card.dataset.room);
      state.first = id; state.roomIdx = 0; state.scan = null; state.step = 'scan'; save();
      zoomFade(ROOMS[id].preview, card.querySelector('img').getBoundingClientRect(), () => render());
    }));
    const mute = $('#mute');
    try { if (localStorage.getItem('fq_muted') === '1') { Sound.setMuted(true); mute.textContent = '🔇'; } } catch (e) {}
    mute.addEventListener('click', () => {
      Sound.init();
      Sound.setMuted(!Sound.muted);
      mute.textContent = Sound.muted ? '🔇' : '🔊';
      try { localStorage.setItem('fq_muted', Sound.muted ? '1' : '0'); } catch (e) {}
    });
    document.addEventListener('pointerdown', () => Sound.init(), { once: true });
    // щелчок на любой кнопке (кроме тех, у которых свои звуки)
    document.addEventListener('pointerdown', e => {
      const b = e.target.closest('button, .room-card');
      if (!b || b.matches('.press-btn, .cpr-btn')) return;
      Sound.init(); Sound.fx.click(); Haptic.impact('light');
    }, true);
    document.addEventListener('gesturestart', e => e.preventDefault());

    knife = window.__knife = new KnifeGame($('#s-knife'), {
      onLevelDone(i) {
        if (i < KNIFE_LEVELS.length - 1) { state.knifeLevel = i + 1; save(); knife.start(i + 1); }
        else goto('abintro');
      },
    });
    ab = window.__ab = new AntibioticGame($('#s-ab'), { onDone() { goto('cprintro'); } });
    cpr = window.__cpr = new CprGame($('#s-cpr'), { onDone() { goto('usintro'); } });
    scanner = window.__scanner = new Scanner($('#s-scan'), {
      onSave(scan) { state.scan = scan; save(); },
      onFound() {
        Sound.fx.fanfare(); Haptic.notify('success');
        goto(state.roomIdx === 0 ? 'found1' : 'found2', { scan: null });
      },
    });

    // предзагрузка картинок
    Object.values(ROOMS).forEach(r => { loadImg(r.preview); loadImg(r.us); });

    const dbg = new URLSearchParams(location.search).get('step');
    load().then(saved => {
      if (saved && saved.step) state = Object.assign(fresh(), saved);
      if (dbg) { const [st, lv] = dbg.split(':'); state.step = st; if (st === 'knife') state.knifeLevel = Number(lv || 0); if (st === 'scan') { state.first = Number(lv || 1); state.roomIdx = 0; state.scan = null; } }
      setTimeout(render, 350);
    });
  }

  return { init, confetti, get state() { return state; } };
})();

window.App = App;
App.init();
