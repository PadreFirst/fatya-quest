// Симулятор УЗИ: гель → датчик с конусом → три уровня TGC (зума)
// Механика поиска — как взлом замка: лампа ЛОКАЦИЯ ведёт к месту, стрелка УГОЛ
// честно показывает угол только рядом с целью, а «ПРИЖАТЬ» — это нажим отмычки.
const TGC_NAMES = ['Дальний', 'Средний', 'Сильный'];
const CONE_HALF = 0.52;  // полуугол сектора (~30°)
const FAST_SPEED = 650;  // px/s — выше датчик «теряет контакт» (трекбол можно гонять размашисто)
const SLOW_SPEED = 150;  // px/s — при нажиме датчик должен стоять
const TB_GAIN = 1.25;    // трекбол → смещение датчика
const KNOB_RATIO = 0.5;  // градусов луча на градус ручки
// sigma — радиус «тёплой зоны» в долях диагонали экрана, angRange — диапазон угла (°), need — порог успеха
const STAGE_TUNE = [
  { sigma: 0.10, angRange: 30, need: 0.70 },
  { sigma: 0.09, angRange: 28, need: 0.70 },
  { sigma: 0.08, angRange: 24, need: 0.72 },
];
const STAGE_MSG = [
  'Этап 1 из 3 · найди область интереса',
  'Этап 2 из 3 · TGC «Средний» — ищи дальше',
  'Этап 3 из 3 · TGC «Сильный» — найди точку',
];
const OUCH_MSG = [
  'Ай! 😖 Пациент ойкнул — давила мимо. Поправь место и угол',
  'Ой-ой! Это не там 🙈 Сдвинь датчик и подбери угол',
  'Пациент: «Доктор, можно понежнее?» 😅',
];
const SCAN_JOKES = [
  'Пациент, дышите… Не дышите! …Дышите.',
  'Гель холодный — комната вздрогнула',
  'ALARA соблюдён: MI 0.9 · TIs 0.3',
  'Акустическая тень от шкафа — вариант нормы',
  'Реверберация от стеклопакета, не пугайся',
  'Пациент не ел 8 часов — холодильник подтверждает',
  'В коридоре очередь: 14 человек, направлений ни у кого',
  'Заведующий просит не задерживаться 😅',
  'Описание займёт больше времени, чем исследование',
  'Мочевой пузырь не наполнен. Ой, это другой протокол',
  'Свет выключен, жалюзи закрыты — всё по канону',
  'Пациент спрашивает: «Ну что там, доктор?»',
];

const wrapDeg = v => ((v + 180) % 360 + 360) % 360 - 180;

// ---------- трекбол: шар с царапинами, крутится в 3D ----------
class Trackball {
  constructor(canvas, onRoll) {
    this.c = canvas; this.ctx = canvas.getContext('2d'); this.onRoll = onRoll;
    this.M = [1, 0, 0, 0, 1, 0, 0, 0, 1];
    this.vx = 0; this.vy = 0; this.drag = null; this.n = 0;
    const rv = () => {
      let x, y, z, d;
      do { x = rnd(-1, 1); y = rnd(-1, 1); z = rnd(-1, 1); d = Math.hypot(x, y, z); } while (d > 1 || d < 0.1);
      return [x / d, y / d, z / d];
    };
    this.dots = Array.from({ length: 190 }, () => ({ v: rv(), s: rnd(0.5, 1.4), b: Math.random() }));
    this.scratches = Array.from({ length: 34 }, () => {
      const u = rv(); let t = rv();
      const dt = u[0] * t[0] + u[1] * t[1] + u[2] * t[2];
      t = [t[0] - dt * u[0], t[1] - dt * u[1], t[2] - dt * u[2]];
      const tl = Math.hypot(...t); t = t.map(x => x / tl);
      const len = rnd(0.12, 0.6), n = 8, pts = [];
      for (let k = 0; k <= n; k++) {
        const a = (k / n - 0.5) * len;
        pts.push([u[0] * Math.cos(a) + t[0] * Math.sin(a), u[1] * Math.cos(a) + t[1] * Math.sin(a), u[2] * Math.cos(a) + t[2] * Math.sin(a)]);
      }
      return { pts, w: rnd(0.5, 1.3), a: rnd(0.25, 0.65) };
    });
    const pos = e => { const r = this.c.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; };
    canvas.addEventListener('pointerdown', e => {
      e.preventDefault();
      try { canvas.setPointerCapture(e.pointerId); } catch (_) {}
      this.drag = { id: e.pointerId, ...pos(e), t: performance.now() };
      this.vx = this.vy = 0;
    });
    canvas.addEventListener('pointermove', e => {
      if (!this.drag || e.pointerId !== this.drag.id) return;
      e.preventDefault();
      const p = pos(e), now = performance.now();
      const dx = p.x - this.drag.x, dy = p.y - this.drag.y, dt = Math.max(8, now - this.drag.t) / 1000;
      this.roll(dx, dy); this.onRoll(dx, dy);
      this.vx = this.vx * 0.5 + (dx / dt) * 0.5; this.vy = this.vy * 0.5 + (dy / dt) * 0.5;
      this.drag.x = p.x; this.drag.y = p.y; this.drag.t = now;
    });
    const up = e => {
      if (!this.drag || e.pointerId !== this.drag.id) return;
      if (performance.now() - this.drag.t > 90) this.vx = this.vy = 0;
      this.drag = null;
    };
    canvas.addEventListener('pointerup', up);
    canvas.addEventListener('pointercancel', up);
  }

  size() {
    const r = this.c.getBoundingClientRect();
    if (!r.width) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const w = Math.round(r.width * dpr);
    if (this.c.width !== w) { this.c.width = w; this.c.height = Math.round(r.height * dpr); }
    this.dpr = dpr; this.W = r.width; this.r = r.width * 0.4;
  }

  roll(dx, dy) {
    const r = this.r || 40;
    const ay = dx / r, ax = dy / r;
    const cy = Math.cos(ay), sy = Math.sin(ay), cx = Math.cos(ax), sx = Math.sin(ax);
    const Ry = [cy, 0, sy, 0, 1, 0, -sy, 0, cy];
    const Rx = [1, 0, 0, 0, cx, sx, 0, -sx, cx];
    this.M = this.mul(Rx, this.mul(Ry, this.M));
    if (++this.n % 60 === 0) this.ortho();
  }
  mul(a, b) {
    const o = new Array(9);
    for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) o[i * 3 + j] = a[i * 3] * b[j] + a[i * 3 + 1] * b[3 + j] + a[i * 3 + 2] * b[6 + j];
    return o;
  }
  ortho() {
    const m = this.M;
    let a = [m[0], m[1], m[2]], b = [m[3], m[4], m[5]];
    const na = Math.hypot(...a); a = a.map(x => x / na);
    const d = a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
    b = [b[0] - d * a[0], b[1] - d * a[1], b[2] - d * a[2]];
    const nb = Math.hypot(...b); b = b.map(x => x / nb);
    const c = [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
    this.M = [...a, ...b, ...c];
  }
  ap(v) { const m = this.M; return [m[0] * v[0] + m[1] * v[1] + m[2] * v[2], m[3] * v[0] + m[4] * v[1] + m[5] * v[2], m[6] * v[0] + m[7] * v[1] + m[8] * v[2]]; }

  update(dt) {
    if (this.drag) return;
    if (Math.abs(this.vx) + Math.abs(this.vy) > 6) {
      const dx = this.vx * dt, dy = this.vy * dt;
      this.roll(dx, dy); this.onRoll(dx, dy);
      const k = Math.exp(-dt * 4.5); this.vx *= k; this.vy *= k;
    } else { this.vx = this.vy = 0; }
  }

  render() {
    if (!this.W) this.size();
    if (!this.W) return;
    const ctx = this.ctx, W = this.W, r = this.r, cx = W / 2, cy = W / 2;
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    ctx.clearRect(0, 0, W, W);
    // ободок
    let g = ctx.createRadialGradient(cx, cy, r, cx, cy, r + 10);
    g.addColorStop(0, '#050608'); g.addColorStop(0.35, '#444a57'); g.addColorStop(0.7, '#20232b'); g.addColorStop(1, '#0d0e12');
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(cx, cy, r + 10, 0, TAU); ctx.fill();
    // шар
    g = ctx.createRadialGradient(cx - r * 0.35, cy - r * 0.38, r * 0.08, cx, cy, r);
    g.addColorStop(0, '#6d9fd1'); g.addColorStop(0.45, '#2b5687'); g.addColorStop(1, '#0b1a30');
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(cx, cy, r, 0, TAU); ctx.fill();
    ctx.save(); ctx.beginPath(); ctx.arc(cx, cy, r, 0, TAU); ctx.clip();
    for (const d of this.dots) {
      const w = this.ap(d.v);
      if (w[2] <= 0) continue;
      const a = 0.12 + 0.6 * w[2];
      ctx.fillStyle = d.b > 0.82 ? `rgba(230,245,255,${a})` : `rgba(10,20,40,${a * 0.9})`;
      ctx.beginPath(); ctx.arc(cx + w[0] * r, cy + w[1] * r, d.s * (0.45 + 0.55 * w[2]), 0, TAU); ctx.fill();
    }
    ctx.lineCap = 'round';
    for (const s of this.scratches) {
      const ws = s.pts.map(p => this.ap(p));
      for (let i = 1; i < ws.length; i++) {
        const a = ws[i - 1], b = ws[i];
        if (a[2] <= 0 || b[2] <= 0) continue;
        ctx.strokeStyle = `rgba(215,235,255,${s.a * (0.2 + 0.8 * Math.min(a[2], b[2]))})`;
        ctx.lineWidth = s.w;
        ctx.beginPath(); ctx.moveTo(cx + a[0] * r, cy + a[1] * r); ctx.lineTo(cx + b[0] * r, cy + b[1] * r); ctx.stroke();
      }
    }
    ctx.lineCap = 'butt';
    g = ctx.createRadialGradient(cx, cy, r * 0.55, cx, cy, r);
    g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(0,0,0,.6)');
    ctx.fillStyle = g; ctx.fillRect(cx - r, cy - r, r * 2, r * 2);
    g = ctx.createRadialGradient(cx - r * 0.38, cy - r * 0.45, 0, cx - r * 0.38, cy - r * 0.45, r * 0.45);
    g.addColorStop(0, 'rgba(255,255,255,.7)'); g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g; ctx.fillRect(cx - r, cy - r, r * 2, r * 2);
    ctx.restore();
    ctx.beginPath(); ctx.arc(cx, cy, r + 0.5, 0, TAU); ctx.strokeStyle = 'rgba(0,0,0,.8)'; ctx.lineWidth = 2; ctx.stroke();
  }
}

class Scanner {
  constructor(root, opts) {
    this.root = root; this.opts = opts;
    this.canvas = root.querySelector('#scan-canvas');
    this.ctx = this.canvas.getContext('2d');
    this.viewEl = root.querySelector('.scan-view');
    this.banner = root.querySelector('.scan-banner');
    this.popup = root.querySelector('.scan-popup');
    this.knob = root.querySelector('.knob');
    this.vuC = root.querySelector('.vu-c');
    this.vuX = this.vuC.getContext('2d');
    this.led = root.querySelector('.led');
    this.tgcTrack = root.querySelector('.tgc-track');
    this.tgcCap = root.querySelector('.tgc-cap');
    this.tgcLbls = [...root.querySelectorAll('.tgc-lbls span')];
    this.pressBtn = root.querySelector('.press-btn');
    this.rollAcc = 0; this.rollSpd = 0;
    this.tb = new Trackball(root.querySelector('.trackball'), (dx, dy) => { this.rollAcc += Math.hypot(dx, dy); this.moveProbe(dx * TB_GAIN, dy * TB_GAIN); });
    this.noise = Array.from({ length: 5 }, () => this.makeNoise(160));
    this.pats = new WeakMap();
    this.mask = document.createElement('canvas');
    this.mctx = this.mask.getContext('2d', { willReadFrequently: true });
    this.layer = document.createElement('canvas');
    this.lctx = this.layer.getContext('2d');
    this.running = false;
    this.angle = 0; this.knobDeg = 0;
    this.needle = 0; this.needleV = 0;
    this.bind();
  }

  makeNoise(size) {
    const c = document.createElement('canvas'); c.width = c.height = size;
    const x = c.getContext('2d');
    const d = x.createImageData(size, size);
    for (let yy = 0; yy < size; yy++) {
      const streak = Math.random() < 0.04 ? rnd(40, 90) : 0;
      for (let xx = 0; xx < size; xx++) {
        const i = (yy * size + xx) * 4;
        const v = Math.min(255, Math.pow(Math.random(), 1.4) * 230 + streak);
        d.data[i] = v; d.data[i + 1] = v; d.data[i + 2] = v; d.data[i + 3] = 255;
      }
    }
    x.putImageData(d, 0, 0);
    return c;
  }

  patterns(ctx) {
    let p = this.pats.get(ctx);
    if (!p) { p = this.noise.map(n => ctx.createPattern(n, 'repeat')); this.pats.set(ctx, p); }
    return p;
  }

  drawNoise(ctx, alpha, r, frozen) {
    const pats = this.patterns(ctx);
    const pat = pats[frozen ? 0 : (Math.random() * pats.length) | 0];
    const ox = frozen ? 0 : Math.random() * 160, oy = frozen ? 0 : Math.random() * 160;
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.beginPath(); ctx.rect(r.x, r.y, r.w, r.h); ctx.clip();
    ctx.translate(r.x - ox, r.y - oy);
    ctx.scale(1.4, 1.4);
    ctx.fillStyle = pat;
    ctx.fillRect(0, 0, (r.w + ox) / 1.4 + 2, (r.h + oy) / 1.4 + 2);
    ctx.restore();
    if (!frozen && Math.random() < 0.25) {
      ctx.fillStyle = `rgba(255,255,255,${alpha * 0.12})`;
      ctx.fillRect(r.x, r.y + Math.random() * r.h, r.w, rnd(1, 4));
    }
  }

  // ---------- ввод ----------
  bind() {
    const c = this.canvas;
    const pos = e => { const r = c.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; };
    // экран — только для геля
    c.addEventListener('pointerdown', e => {
      e.preventDefault();
      if (!this.running || this.mode !== 'gel') return;
      try { c.setPointerCapture(e.pointerId); } catch (_) {}
      this.ptr = { id: e.pointerId, ...pos(e), t: performance.now() };
      this.paint(this.ptr.x, this.ptr.y, this.ptr.x, this.ptr.y); this.touched = true;
    });
    c.addEventListener('pointermove', e => {
      if (!this.ptr || e.pointerId !== this.ptr.id || !this.running) return;
      e.preventDefault();
      const p = pos(e), now = performance.now();
      if (this.mode === 'gel') {
        this.paint(this.ptr.x, this.ptr.y, p.x, p.y);
        this.gelSpeed = Math.hypot(p.x - this.ptr.x, p.y - this.ptr.y) / (Math.max(1, now - this.ptr.t) / 1000);
      }
      this.ptr.x = p.x; this.ptr.y = p.y; this.ptr.t = now;
    });
    const up = e => { if (this.ptr && e.pointerId === this.ptr.id) { this.ptr = null; this.gelSpeed = 0; } };
    c.addEventListener('pointerup', up);
    c.addEventListener('pointercancel', up);

    // ручка угла — крутится по кругу
    let kAng = null;
    const kAngle = e => { const r = this.knob.getBoundingClientRect(); return Math.atan2(e.clientY - (r.top + r.height / 2), e.clientX - (r.left + r.width / 2)); };
    this.knob.addEventListener('pointerdown', e => {
      e.preventDefault(); kAng = kAngle(e);
      try { this.knob.setPointerCapture(e.pointerId); } catch (_) {}
    });
    this.knob.addEventListener('pointermove', e => {
      if (kAng === null) return;
      e.preventDefault();
      const a = kAngle(e);
      let d = a - kAng; d = Math.atan2(Math.sin(d), Math.cos(d));
      kAng = a;
      const deg = d * 180 / Math.PI;
      this.knobDeg += deg;
      this.knob.style.transform = `rotate(${this.knobDeg}deg)`;
      this.setAngle(this.angle + deg * KNOB_RATIO);
    });
    const kup = () => { kAng = null; };
    this.knob.addEventListener('pointerup', kup);
    this.knob.addEventListener('pointercancel', kup);

    // слайдер TGC
    let tDrag = false;
    const tPos = e => { const r = this.tgcTrack.getBoundingClientRect(); return clamp((e.clientX - r.left) / r.width, 0, 1); };
    this.tgcTrack.addEventListener('pointerdown', e => {
      e.preventDefault(); tDrag = true; tLast = -1; this.tgcCap.classList.add('drag'); Sound.fx.tick();
      try { this.tgcTrack.setPointerCapture(e.pointerId); } catch (_) {}
      this.tgcCap.style.left = tPos(e) * 100 + '%';
    });
    let tLast = -1;
    this.tgcTrack.addEventListener('pointermove', e => {
      if (!tDrag) return;
      e.preventDefault();
      const v = tPos(e), i = Math.round(v * 2);
      this.tgcCap.style.left = v * 100 + '%';
      if (i !== tLast) { if (tLast !== -1) { Sound.fx.tick(); Haptic.select(); } tLast = i; }
    });
    const tup = e => {
      if (!tDrag) return;
      tDrag = false; this.tgcCap.classList.remove('drag');
      const i = Math.round(tPos(e) * 2);
      if (i === this.tgc) this.placeTgcCap(); else this.setTgc(i);
    };
    this.tgcTrack.addEventListener('pointerup', tup);
    this.tgcTrack.addEventListener('pointercancel', tup);
    this.tgcLbls.forEach(l => l.addEventListener('click', () => this.setTgc(Number(l.dataset.tgc))));

    // ПРИЖАТЬ
    const pd = e => { e.preventDefault(); Sound.init(); if (this.mode !== 'probe') { Sound.fx.miss(); return; } this.pressing = true; this.pressBtn.classList.add('on'); Sound.fx.pressStart(); Haptic.impact('rigid'); };
    const pu = () => { if (this.pressing) Sound.fx.swipe(); this.pressing = false; this.pressBtn.classList.remove('on'); };
    this.pressBtn.addEventListener('pointerdown', pd);
    this.pressBtn.addEventListener('pointerup', pu);
    this.pressBtn.addEventListener('pointercancel', pu);
    this.pressBtn.addEventListener('pointerleave', pu);
    this.pressBtn.addEventListener('contextmenu', e => e.preventDefault());

    this.root.querySelector('[data-act="scanok"]').addEventListener('click', () => this.startProbe());
    window.addEventListener('resize', () => { if (this.running) { this.resize(); this.tb.size(); this.sizeVu(); } });
  }

  setAngle(v) {
    v = wrapDeg(v);
    const before = Math.floor(this.angle / 3), after = Math.floor(v / 3);
    this.angle = v;
    if (before !== after) { Haptic.select(); Sound.fx.tick(); }
  }

  placeTgcCap() {
    this.tgcCap.style.left = this.tgc * 50 + '%';
    this.tgcLbls.forEach(l => l.classList.toggle('on', Number(l.dataset.tgc) === this.tgc));
  }

  setTgc(i) {
    if (!this.running) return;
    if (i === this.tgc) { this.placeTgcCap(); return; }
    this.tgc = i;
    this.placeTgcCap();
    Sound.fx.detent(); Haptic.impact('medium');
    this.vTarget = this.calcView();
    this.prog = 0; this.strain = 0;
  }

  moveProbe(dx, dy) {
    if (this.mode !== 'probe' || !this.content) return;
    const cr = this.content;
    const nx = clamp(this.px + dx, cr.x + 4, cr.x + cr.w - 4), ny = clamp(this.py + dy, cr.y + 4, cr.y + cr.h - 4);
    this.movedAcc += Math.hypot(nx - this.px, ny - this.py);
    this.px = nx; this.py = ny;
  }

  // ---------- старт/стоп ----------
  start(room, saved) {
    this.room = room;
    this.img = room.imgEl;
    this.locks = (saved && saved.locks) || 0;
    this.tgc = 0; this.placeTgcCap();
    this.angle = 0; this.knobDeg = 0; this.knob.style.transform = 'rotate(0deg)';
    this.running = true;
    this.mode = saved && saved.gel ? 'probe' : 'gel';
    this.t = 0; this.q = 1; this.spd = 0; this.movedAcc = 0;
    this.prog = 0; this.strain = 0; this.cool = 0; this.ouchT = 0; this.ouches = 0; this.pressing = false;
    this.pressBtn.classList.remove('on');
    this.lockFlash = 0; this.ledPh = 0; this.ledB = 0; this.ledHue = 30; this.blinkUp = false;
    this.jokeI = (Math.random() * SCAN_JOKES.length) | 0; this.jokeT = 0;
    this.gelCov = 0; this.covT = 0; this.touched = false; this.gelSpeed = 0;
    this.popup.classList.add('hidden');
    this.resize(true);
    this.tb.size(); this.sizeVu();
    this.vTarget = this.calcView();
    this.vCur = { ...this.vTarget };
    const sp = this.i2s(this.fit(this.vCur), room.start.x, room.start.y);
    this.px = sp.x; this.py = sp.y;
    if (this.mode === 'gel') this.showBanner('Нанеси гель, размазывая пальцем 👆');
    else this.showBanner('');
    Sound.loop('hum', { brown: true, filter: 'lowpass', freq: 220 }, 0.06);
    Sound.loop('hum2', { osc: 'sine', freq: 100 }, 0.012);
    this.last = performance.now();
    if (!this.raf) this.loop();
  }

  stop() {
    this.running = false;
    Sound.gelStop();
    ['hum', 'hum2', 'roll', 'press', 'strain', 'static'].forEach(k => Sound.loopStop(k));
    if (this.raf) cancelAnimationFrame(this.raf);
    this.raf = null;
    clearTimeout(this.doneT);
  }

  resize(clearMask) {
    const r = this.viewEl.getBoundingClientRect();
    if (!r.width || !r.height) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    this.dpr = dpr; this.W = r.width; this.H = r.height;
    this.canvas.width = Math.round(r.width * dpr); this.canvas.height = Math.round(r.height * dpr);
    this.layer.width = this.canvas.width; this.layer.height = this.canvas.height;
    this.content = { x: 8, y: 32, w: this.W - 16, h: this.H - 32 - 24 };
    this.coneL = Math.max(110, Math.min(this.content.w, this.content.h) * 0.43);
    this.r0 = 14;
    const MS = 3;
    const old = this.mask.width ? (() => { const c = document.createElement('canvas'); c.width = this.mask.width; c.height = this.mask.height; c.getContext('2d').drawImage(this.mask, 0, 0); return c; })() : null;
    this.mask.width = Math.ceil(this.W / MS); this.mask.height = Math.ceil(this.H / MS);
    this.mctx.setTransform(1 / MS, 0, 0, 1 / MS, 0, 0);
    if (old && !clearMask) this.mctx.drawImage(old, 0, 0, this.W, this.H);
    if (this.room && !clearMask) this.vTarget = this.calcView();
  }

  sizeVu() {
    const r = this.vuC.getBoundingClientRect();
    if (!r.width) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    this.vuC.width = Math.round(r.width * dpr); this.vuC.height = Math.round(r.height * dpr);
    this.vuW = r.width; this.vuH = r.height; this.vuDpr = dpr;
  }

  // ---------- геометрия вида ----------
  fullRect() { return { x: 0, y: 0, w: this.img.naturalWidth, h: this.img.naturalHeight }; }

  fit(v) {
    const c = this.content;
    const s = Math.min(c.w / v.w, c.h / v.h);
    const dw = v.w * s, dh = v.h * s;
    return { v, s, dx: c.x + (c.w - dw) / 2, dy: c.y + (c.h - dh) / 2, dw, dh };
  }
  i2s(f, ix, iy) { return { x: f.dx + (ix - f.v.x) * f.s, y: f.dy + (iy - f.v.y) * f.s }; }
  s2i(f, sx, sy) { return { x: f.v.x + (sx - f.dx) / f.s, y: f.v.y + (sy - f.dy) / f.s }; }

  zoomAround(parent, z) {
    const f = this.fit(this.vCur || this.fullRect());
    const dir = this.dir();
    const foc = this.s2i(f, this.px + dir.x * this.coneL * 0.55, this.py + dir.y * this.coneL * 0.55);
    const w = parent.w / z, h = parent.h / z;
    return {
      x: clamp(foc.x - w / 2, parent.x, parent.x + parent.w - w),
      y: clamp(foc.y - h / 2, parent.y, parent.y + parent.h - h), w, h,
    };
  }

  calcView() {
    const full = this.fullRect(), R1 = this.room.R1, R2 = this.room.R2;
    if (this.tgc === 0) return full;
    if (this.tgc === 1) return this.locks >= 1 ? { ...R1 } : this.zoomAround(full, 2.6);
    if (this.locks >= 2) return { ...R2 };
    return this.locks >= 1 ? this.zoomAround(R1, 2.2) : this.zoomAround(full, 5);
  }

  theta() { return Math.PI / 2 + this.angle * Math.PI / 180; }
  dir() { const th = this.theta(); return { x: Math.cos(th), y: Math.sin(th) }; }

  // цель текущего этапа на экране и «акустическое окно» — где должен стоять датчик
  stageTarget(f) {
    const r = this.room, st = this.locks;
    const T = st === 0 ? this.i2s(f, r.R1.x + r.R1.w / 2, r.R1.y + r.R1.h / 2)
      : st === 1 ? this.i2s(f, r.R2.x + r.R2.w / 2, r.R2.y + r.R2.h / 2)
        : this.i2s(f, r.P.x, r.P.y);
    const A = r.angles[st];
    const th = Math.PI / 2 + A * Math.PI / 180;
    const d = this.coneL * 0.55;
    return { T, A, win: { x: T.x - Math.cos(th) * d, y: T.y - Math.sin(th) * d } };
  }

  sectorPath(ctx, L) {
    const th = this.theta();
    L = L || this.coneL;
    ctx.beginPath();
    ctx.arc(this.px, this.py, L, th - CONE_HALF, th + CONE_HALF);
    ctx.arc(this.px, this.py, this.r0, th + CONE_HALF, th - CONE_HALF, true);
    ctx.closePath();
  }

  // ---------- гель ----------
  paint(x0, y0, x1, y1) {
    const m = this.mctx, R = 34;
    const d = Math.hypot(x1 - x0, y1 - y0), n = Math.max(1, Math.ceil(d / 8));
    for (let i = 0; i <= n; i++) {
      const x = x0 + (x1 - x0) * i / n, y = y0 + (y1 - y0) * i / n;
      const g = m.createRadialGradient(x, y, 0, x, y, R);
      g.addColorStop(0, 'rgba(0,0,0,1)'); g.addColorStop(0.55, 'rgba(0,0,0,.9)'); g.addColorStop(1, 'rgba(0,0,0,0)');
      m.fillStyle = g;
      m.beginPath(); m.arc(x, y, R, 0, TAU); m.fill();
    }
  }

  measureGel() {
    const f = this.fit(this.vCur), MS = this.W / this.mask.width;
    const x0 = Math.max(0, Math.floor(f.dx / MS)), y0 = Math.max(0, Math.floor(f.dy / MS));
    const w = Math.min(this.mask.width - x0, Math.floor(f.dw / MS)), h = Math.min(this.mask.height - y0, Math.floor(f.dh / MS));
    if (w <= 0 || h <= 0) return 0;
    const data = this.mctx.getImageData(x0, y0, w, h).data;
    let on = 0, tot = 0;
    for (let i = 3; i < data.length; i += 8) { tot++; if (data[i] > 110) on++; }
    return on / tot;
  }

  startProbe() {
    if (this.mode !== 'popup') return;
    Haptic.impact('medium');
    this.popup.classList.add('hidden');
    this.mode = 'probe';
    this.opts.onSave({ gel: true, locks: this.locks });
  }

  showBanner(text, kind) {
    if (this.bannerText === text && this.bannerKind === kind) return;
    this.bannerText = text; this.bannerKind = kind;
    if (!text) { this.banner.classList.add('hidden'); return; }
    this.banner.textContent = text;
    this.banner.classList.toggle('good', kind === 'good');
    this.banner.classList.toggle('bad', kind === 'bad');
    this.banner.classList.remove('hidden');
  }

  // ---------- логика ----------
  update(dt) {
    this.t += dt;
    const k = 1 - Math.exp(-dt * 7);
    for (const key of ['x', 'y', 'w', 'h']) this.vCur[key] += (this.vTarget[key] - this.vCur[key]) * k;
    this.jokeT += dt;
    if (this.jokeT > 8) { this.jokeT = 0; this.jokeI = (this.jokeI + 1) % SCAN_JOKES.length; }
    this.lockFlash = Math.max(0, this.lockFlash - dt / 1.6);
    this.tb.update(dt);
    this.rollSpd += (this.rollAcc / Math.max(dt, 0.001) - this.rollSpd) * (1 - Math.exp(-dt * 12));
    this.rollAcc = 0;
    Sound.loop('roll', { filter: 'bandpass', freq: 300, q: 1.2 }, Math.min(0.22, this.rollSpd / 1500), 200 + Math.min(900, this.rollSpd * 0.8));
    Sound.loop('static', { filter: 'highpass', freq: 3500, q: 0.7 }, this.mode === 'probe' ? 0.12 * (1 - this.q) : 0);

    if (this.mode === 'gel') {
      Sound.gel(this.ptr ? Math.min(1, (this.gelSpeed || 0) / 900) : 0);
      this.covT += dt;
      if (this.covT > 0.25) {
        this.covT = 0;
        this.gelCov = this.measureGel();
        this.showBanner(`Нанеси гель, размазывая пальцем 👆  ${Math.min(80, Math.round(this.gelCov * 100))}/80%`);
        if (this.gelCov >= 0.8) {
          this.mode = 'reveal'; this.revealT = 0;
          Sound.gelStop(); Sound.fx.whoosh(); Haptic.notify('success');
          this.showBanner('');
        }
      }
    } else if (this.mode === 'reveal') {
      this.revealT += dt / 0.7;
      const m = this.mctx;
      m.save(); m.setTransform(1, 0, 0, 1, 0, 0); m.globalAlpha = 0.18; m.fillStyle = '#000'; m.fillRect(0, 0, this.mask.width, this.mask.height); m.restore();
      if (this.revealT >= 1) {
        m.save(); m.setTransform(1, 0, 0, 1, 0, 0); m.globalAlpha = 1; m.fillRect(0, 0, this.mask.width, this.mask.height); m.restore();
        this.mode = 'popup';
        this.popup.classList.remove('hidden');
        const inner = this.popup.querySelector('.popup-inner');
        inner.style.animation = 'none'; void inner.offsetWidth; inner.style.animation = '';
        Sound.fx.pop();
      }
    } else if (this.mode === 'probe') {
      this.updateProbe(dt);
    }
    this.updateIndicators(dt);
  }

  updateProbe(dt) {
    const speed = this.movedAcc / Math.max(dt, 0.001);
    this.movedAcc = 0;
    this.spd += (speed - this.spd) * (1 - Math.exp(-dt * 10));
    const fast = this.spd > FAST_SPEED;
    this.q = clamp(this.q + (fast ? -dt * 2.8 : dt * 1.2), 0.08, 1);
    this.cool = Math.max(0, this.cool - dt);
    this.ouchT = Math.max(0, this.ouchT - dt);
    this.shake = Math.max(0, (this.shake || 0) - dt * 3);

    const f = this.fit(this.vCur);
    const stage = this.locks, tune = STAGE_TUNE[stage];
    const match = this.tgc === stage;
    const cr = this.content, diag = Math.hypot(cr.w, cr.h);
    let Lc = 0, Lw = 0, Linf = 0, Ac = 0;
    if (match) {
      const st = this.stageTarget(f);
      const d = Math.hypot(this.px - st.win.x, this.py - st.win.y);
      Lc = Math.exp(-Math.pow(d / (tune.sigma * diag), 2));
      Lw = Math.exp(-Math.pow(d / (0.34 * diag), 2));
      Linf = Math.exp(-Math.pow(d / (0.17 * diag), 2));
      Ac = Math.max(0, 1 - Math.abs(wrapDeg(this.angle - st.A)) / tune.angRange);
    }
    this.Lc = Lc; this.Lw = Lw; this.Linf = Linf; this.Ac = Ac;
    const cap = Lc * Ac, success = match && cap >= tune.need;

    // нажим — как поворот замка отмычкой
    const canPress = this.pressing && this.cool <= 0 && this.q > 0.6 && this.spd < SLOW_SPEED;
    let pressState = '';
    if (canPress) {
      const goal = success ? 1.02 : Math.min(0.9, cap / tune.need * 0.85);
      if (this.prog < goal) {
        this.prog = Math.min(goal, this.prog + dt * (success ? 0.7 : 0.9));
        this.strain = Math.max(0, this.strain - dt);
        pressState = success ? 'give' : 'push';
      } else {
        this.strain += dt;
        this.shake = Math.min(1, this.strain);
        pressState = 'stuck';
        if (this.strain > 1.1) this.ouch();
      }
      if (this.prog >= 1) { this.onLock(f); return; }
    } else {
      this.prog = Math.max(0, this.prog - dt * 1.6);
      this.strain = Math.max(0, this.strain - dt * 2);
    }
    Sound.loop('press', { osc: 'triangle', freq: 220 }, pressState === 'give' || pressState === 'push' ? 0.09 : 0, 200 + 700 * this.prog);
    Sound.loop('strain', { filter: 'bandpass', freq: 160, q: 7 }, pressState === 'stuck' ? 0.35 * Math.min(1, this.strain + 0.3) : 0, 130 + 70 * Math.sin(this.t * 23));

    let hint = '', kind = '';
    if (this.ouchT > 0) { hint = this.ouchMsg; kind = 'bad'; }
    else if (!match) {
      hint = this.tgc > stage
        ? `Здесь пусто 🤷 Сначала найди область на TGC «${TGC_NAMES[stage]}»`
        : `Область зафиксирована ✅ Переключи TGC на «${TGC_NAMES[stage]}»`;
    }
    else if (fast) hint = '🐢 Медленнее — датчик теряет контакт с гелем';
    else if (this.pressing && this.spd >= SLOW_SPEED) hint = 'Датчик съезжает — не двигай его, пока прижимаешь';
    else if (pressState === 'give') { hint = 'Поддаётся… держи! ✨'; kind = 'good'; }
    else if (pressState === 'push') hint = 'Прижимаю…';
    else if (pressState === 'stuck') { hint = 'Не поддаётся… 😬 отпусти и поправь'; kind = 'bad'; }
    else hint = STAGE_MSG[stage];
    this.showBanner(hint, kind);
  }

  ouch() {
    this.cool = 1.4; this.prog = 0; this.strain = 0; this.shake = 0;
    this.ouches++;
    this.ouchMsg = OUCH_MSG[(this.ouches - 1) % OUCH_MSG.length];
    this.ouchT = 2.2;
    const a = rnd(0, TAU), d = rnd(26, 46);
    this.moveProbe(Math.cos(a) * d, Math.sin(a) * d);
    this.movedAcc = 0;
    this.setAngle(this.angle + rnd(-8, 8));
    Sound.loop('press', { osc: 'triangle', freq: 220 }, 0); Sound.loop('strain', { filter: 'bandpass', freq: 160, q: 7 }, 0);
    Sound.fx.ouch(); Sound.fx.miss(); Haptic.notify('error');
    this.flashBad = 1;
  }

  updateIndicators(dt) {
    const probe = this.mode === 'probe';
    const match = probe && this.tgc === this.locks;
    // лампа ЛОКАЦИЯ: частота мигания растёт по мере приближения
    const Lw = match ? this.Lw : 0, Lc = match ? this.Lc : 0;
    const rate = probe ? (match ? 0.55 + 6.5 * Math.pow(Lw, 1.6) : 0.35) : 0;
    const prevPh = this.ledPh;
    this.ledPh += dt * rate;
    if (Math.floor(this.ledPh) !== Math.floor(prevPh) && match && Lw <= 0.25) Sound.fx.ledTick();
    if (Math.floor(this.ledPh) !== Math.floor(prevPh) && match && Lw > 0.25) {
      Sound.fx.beep(Lw * 0.6);
      if (Lw > 0.45) Haptic.impact('soft');
    }
    const s = 0.5 + 0.5 * Math.sin(this.ledPh * TAU);
    const blink = Lc > 0.8 ? 0.75 + 0.25 * s : Math.pow(s, 3);
    this.ledB = probe ? 0.08 + 0.92 * blink * (0.35 + 0.65 * Lw) : 0.04;
    this.ledHue = Lc > 0.55 ? 128 : 18 + 26 * Lw;
    const hsl = `hsl(${this.ledHue},100%,${30 + 40 * this.ledB}%)`;
    this.led.style.background = `radial-gradient(circle at 35% 30%, hsl(${this.ledHue},100%,${55 + 40 * this.ledB}%), ${hsl} 55%, hsl(${this.ledHue},90%,${10 + 15 * this.ledB}%))`;
    this.led.style.boxShadow = `0 0 ${4 + 22 * this.ledB}px ${2 + 6 * this.ledB}px hsla(${this.ledHue},100%,55%,${0.15 + 0.7 * this.ledB}), inset 0 -2px 3px rgba(0,0,0,.5)`;

    // стрелка УГОЛ: правдива только рядом с целью
    const wander = 0.38 + 0.2 * Math.sin(this.t * 1.7) + 0.12 * Math.sin(this.t * 4.1 + 1.3) + rnd(-0.05, 0.05);
    const target = match ? this.Linf * this.Ac + (1 - this.Linf) * wander : probe ? 0.04 : 0;
    this.needleV += (target - this.needle) * 70 * dt;
    this.needleV *= Math.exp(-dt * 10);
    this.needle = clamp(this.needle + this.needleV * dt, -0.03, 1.03);
    this.renderVu();
  }

  onLock(f) {
    Sound.loop('press', { osc: 'triangle', freq: 220 }, 0); Sound.loop('strain', { filter: 'bandpass', freq: 160, q: 7 }, 0);
    this.prog = 0; this.strain = 0; this.pressing = false; this.pressBtn.classList.remove('on');
    this.lockFlash = 1;
    this.locks++;
    Sound.fx.lock(); Haptic.notify('success');
    this.opts.onSave({ gel: true, locks: this.locks });
    if (this.locks >= 3) {
      this.mode = 'freeze';
      this.freezeT = 0;
      this.freezeP = this.i2s(f, this.room.P.x, this.room.P.y);
      Sound.fx.freeze();
      this.showBanner(`❄ FREEZE · ${this.room.prizeText}`, 'good');
      this.doneT = setTimeout(() => { if (this.running) this.opts.onFound(); }, 3000);
    }
  }

  // ---------- отрисовка ----------
  renderVu() {
    if (!this.vuW) return;
    const x = this.vuX, W = this.vuW, H = this.vuH;
    x.setTransform(this.vuDpr, 0, 0, this.vuDpr, 0, 0);
    const lit = this.mode === 'probe' || this.mode === 'freeze';
    let g = x.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, lit ? '#fbefc9' : '#8d8670'); g.addColorStop(1, lit ? '#e2c98a' : '#6c6550');
    x.fillStyle = g; x.fillRect(0, 0, W, H);
    const cx = W / 2, cy = H * 1.12, R = H * 0.92;
    const a0 = -Math.PI / 2 - 0.85, a1 = -Math.PI / 2 + 0.85;
    x.lineWidth = 5;
    x.strokeStyle = 'rgba(0,0,0,.2)'; x.beginPath(); x.arc(cx, cy, R * 0.86, a0, a1); x.stroke();
    x.strokeStyle = '#2f9e5b'; x.beginPath(); x.arc(cx, cy, R * 0.86, a0 + (a1 - a0) * 0.8, a1); x.stroke();
    x.strokeStyle = '#2b2418'; x.lineWidth = 1;
    for (let i = 0; i <= 10; i++) {
      const a = a0 + (a1 - a0) * i / 10, l = i % 5 ? 0.07 : 0.13;
      x.beginPath(); x.moveTo(cx + Math.cos(a) * R * 0.92, cy + Math.sin(a) * R * 0.92);
      x.lineTo(cx + Math.cos(a) * R * (0.92 - l), cy + Math.sin(a) * R * (0.92 - l)); x.stroke();
    }
    x.fillStyle = '#3a3122'; x.font = '800 8px Manrope, sans-serif';
    x.textAlign = 'left'; x.fillText('МИМО', 6, H - 6);
    x.textAlign = 'right'; x.fillStyle = '#1f6b3d'; x.fillText('ТОЧНО', W - 6, H - 6);
    x.textAlign = 'center'; x.fillStyle = '#3a3122'; x.font = '900 9px Manrope, sans-serif'; x.fillText('УГОЛ', cx, 11);
    const a = a0 + (a1 - a0) * clamp(this.needle, 0, 1);
    x.strokeStyle = '#b3122e'; x.lineWidth = 1.6;
    x.beginPath(); x.moveTo(cx, cy); x.lineTo(cx + Math.cos(a) * R * 0.95, cy + Math.sin(a) * R * 0.95); x.stroke();
    x.fillStyle = '#1a1a1a'; x.beginPath(); x.arc(cx, H, 6, Math.PI, 0); x.fill();
    g = x.createLinearGradient(0, 0, 0, H * 0.5);
    g.addColorStop(0, 'rgba(255,255,255,.35)'); g.addColorStop(1, 'rgba(255,255,255,0)');
    x.fillStyle = g; x.fillRect(0, 0, W, H * 0.5);
    x.textAlign = 'left';
  }

  render() {
    const ctx = this.ctx, W = this.W, H = this.H;
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, H);
    const cr = this.content;
    const f = this.fit(this.vCur);
    const frozen = this.mode === 'freeze';

    if (this.mode === 'gel' || this.mode === 'reveal' || this.mode === 'popup') {
      const L = this.lctx;
      L.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
      L.globalCompositeOperation = 'source-over';
      L.clearRect(0, 0, W, H);
      L.globalAlpha = 0.2;
      L.drawImage(this.img, f.v.x, f.v.y, f.v.w, f.v.h, f.dx, f.dy, f.dw, f.dh);
      L.globalAlpha = 1;
      this.drawNoise(L, 0.85, cr);
      L.fillStyle = 'rgba(120,220,255,.07)'; L.fillRect(cr.x, cr.y, cr.w, cr.h);
      L.globalCompositeOperation = 'destination-in';
      L.drawImage(this.mask, 0, 0, W, H);
      L.globalCompositeOperation = 'source-over';
      ctx.drawImage(this.layer, 0, 0, W, H);
      if (this.mode === 'gel' && this.gelCov < 0.04 && !this.touched) {
        const a = this.t * 2.2;
        ctx.font = '40px sans-serif'; ctx.textAlign = 'center';
        ctx.globalAlpha = 0.85;
        ctx.fillText('👆', cr.x + cr.w / 2 + Math.cos(a) * 60, cr.y + cr.h / 2 + Math.sin(a * 2) * 40);
        ctx.globalAlpha = 1; ctx.textAlign = 'left';
      }
    } else {
      this.drawNoise(ctx, 0.26, cr, frozen);
      const sh = (this.shake || 0) * 3;
      ctx.save();
      if (sh) ctx.translate(rnd(-sh, sh), rnd(-sh, sh));
      const press = this.prog || 0;
      const L = this.coneL * (1 - 0.05 * press);
      this.sectorPath(ctx, L); ctx.clip();
      ctx.fillStyle = '#050505'; ctx.fillRect(-10, -10, W + 20, H + 20);
      ctx.save();
      ctx.beginPath(); ctx.rect(f.dx, f.dy, f.dw, f.dh); ctx.clip();
      ctx.globalAlpha = 0.25 + 0.75 * this.q;
      ctx.drawImage(this.img, f.v.x, f.v.y, f.v.w, f.v.h, f.dx, f.dy, f.dw, f.dh);
      ctx.globalAlpha = 1;
      ctx.restore();
      this.drawNoise(ctx, (0.16 + (1 - this.q) * 0.75) * (1 - 0.7 * press), { x: 0, y: 0, w: W, h: H }, frozen);
      const g = ctx.createRadialGradient(this.px, this.py, this.r0, this.px, this.py, L);
      g.addColorStop(0, 'rgba(255,255,255,.08)'); g.addColorStop(0.45, 'rgba(0,0,0,0)'); g.addColorStop(1, `rgba(0,0,0,${0.55 - 0.3 * press})`);
      ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
      ctx.restore();
      ctx.strokeStyle = 'rgba(140,210,255,.28)'; ctx.lineWidth = 1;
      this.sectorPath(ctx, L); ctx.stroke();
      if (this.lockFlash > 0 && this.locks < 3) {
        ctx.save();
        ctx.globalAlpha = Math.min(1, this.lockFlash * 1.5);
        ctx.font = '800 22px Unbounded, sans-serif'; ctx.textAlign = 'center';
        ctx.fillStyle = '#7dffb0'; ctx.shadowColor = '#000'; ctx.shadowBlur = 8;
        ctx.fillText('✓ ЗАФИКСИРОВАНО', cr.x + cr.w / 2, cr.y + cr.h * 0.5 - (1 - this.lockFlash) * 30);
        ctx.restore();
      }
      this.drawRoi(ctx, f);
      if (frozen) this.drawCalipers(ctx);
      this.drawProbe(ctx, this.theta());
      if (press > 0.01) {
        const col = this.strain > 0.05 ? `rgb(255,${Math.round(180 - 140 * Math.min(1, this.strain))},60)` : '#6dff9a';
        ctx.beginPath(); ctx.arc(this.px, this.py, 30, -Math.PI / 2, -Math.PI / 2 + press * TAU);
        ctx.strokeStyle = col; ctx.lineWidth = 4; ctx.lineCap = 'round'; ctx.stroke(); ctx.lineCap = 'butt';
      }
      if (this.flashBad > 0.02) {
        ctx.strokeStyle = `rgba(255,40,70,${this.flashBad})`; ctx.lineWidth = 10; ctx.strokeRect(cr.x, cr.y, cr.w, cr.h);
        this.flashBad *= 0.92;
      }
    }
    this.drawHud(ctx, f);
  }

  // найденные области — жёлтая пунктирная рамка ROI, как на аппарате
  drawRoi(ctx, f) {
    const regs = [this.room.R1, this.room.R2].slice(0, Math.min(2, this.locks));
    if (!regs.length) return;
    const cr = this.content;
    ctx.save();
    ctx.beginPath(); ctx.rect(cr.x, cr.y, cr.w, cr.h); ctx.clip();
    regs.forEach((g, i) => {
      const a = this.i2s(f, g.x, g.y), b = this.i2s(f, g.x + g.w, g.y + g.h);
      const fresh = i === this.locks - 1 ? this.lockFlash : 0;
      const al = 0.55 + 0.45 * fresh * (0.5 + 0.5 * Math.sin(this.t * 14));
      ctx.strokeStyle = `rgba(255,214,70,${al})`; ctx.fillStyle = `rgba(255,214,70,${al})`;
      ctx.lineWidth = 1.5 + fresh * 1.5;
      ctx.setLineDash([5, 5]);
      ctx.strokeRect(a.x + 1, a.y + 1, b.x - a.x - 2, b.y - a.y - 2);
      ctx.setLineDash([]);
      const c = 9;
      ctx.lineWidth = 2.5;
      [[a.x, a.y, 1, 1], [b.x, a.y, -1, 1], [a.x, b.y, 1, -1], [b.x, b.y, -1, -1]].forEach(([x, y, sx, sy]) => {
        ctx.beginPath(); ctx.moveTo(x + sx * 1, y + sy * (c + 1)); ctx.lineTo(x + sx * 1, y + sy * 1); ctx.lineTo(x + sx * (c + 1), y + sy * 1); ctx.stroke();
      });
      ctx.font = '700 10px "JetBrains Mono", monospace';
      ctx.fillText(`ROI ${i + 1}`, Math.max(cr.x + 4, a.x + 5), Math.max(cr.y + 12, a.y + 14));
    });
    ctx.restore();
  }

  drawCalipers(ctx) {
    const f = this.fit(this.vCur), r = this.room, hw = r.objW / 2;
    this.freezeT = (this.freezeT || 0) + 1 / 60;
    const k = Math.min(1, this.freezeT / 0.6);
    const A = this.i2s(f, r.P.x - hw * k, r.P.y), B = this.i2s(f, r.P.x + hw * k, r.P.y);
    const ax = A.x, ay = A.y, bx = B.x, by = B.y;
    ctx.strokeStyle = '#ffe14d'; ctx.fillStyle = '#ffe14d'; ctx.lineWidth = 1.5;
    const plus = (x, y) => { ctx.beginPath(); ctx.moveTo(x - 6, y); ctx.lineTo(x + 6, y); ctx.moveTo(x, y - 6); ctx.lineTo(x, y + 6); ctx.stroke(); };
    plus(ax, ay); plus(bx, by);
    ctx.setLineDash([3, 4]); ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(bx, by); ctx.stroke(); ctx.setLineDash([]);
    ctx.font = '700 12px "JetBrains Mono", monospace';
    ctx.fillText(`D1 ${(r.objW * 0.05 * k).toFixed(1)} cm`, bx + 10, by + 4);
    ctx.font = '800 20px Unbounded, sans-serif'; ctx.textAlign = 'center'; ctx.fillStyle = '#7fe9ff';
    ctx.fillText('❄ FREEZE', this.content.x + this.content.w / 2, this.content.y + 30);
    ctx.textAlign = 'left';
  }

  drawProbe(ctx, th) {
    const a = CONE_HALF, r0 = this.r0;
    ctx.save();
    ctx.translate(this.px, this.py);
    ctx.rotate(th - Math.PI / 2);
    ctx.beginPath(); ctx.moveTo(0, -44); ctx.bezierCurveTo(0, -70, 20, -78, 10, -120);
    ctx.strokeStyle = '#2b2f3a'; ctx.lineWidth = 5; ctx.lineCap = 'round'; ctx.stroke(); ctx.lineCap = 'butt';
    const fx = r0 * Math.sin(a), fy = r0 * Math.cos(a);
    ctx.beginPath();
    ctx.moveTo(fx, fy);
    ctx.arc(0, 0, r0, Math.PI / 2 - a, Math.PI / 2 + a);
    ctx.lineTo(-16, -2); ctx.lineTo(-13, -30); ctx.quadraticCurveTo(-11, -44, -5, -46);
    ctx.lineTo(5, -46); ctx.quadraticCurveTo(11, -44, 13, -30); ctx.lineTo(16, -2);
    ctx.closePath();
    const g = ctx.createLinearGradient(-16, 0, 16, 0);
    g.addColorStop(0, '#9aa4b0'); g.addColorStop(0.4, '#ffffff'); g.addColorStop(1, '#8a94a0');
    ctx.fillStyle = g; ctx.fill();
    ctx.strokeStyle = 'rgba(30,40,60,.7)'; ctx.lineWidth = 1; ctx.stroke();
    ctx.beginPath(); ctx.arc(0, 0, r0, Math.PI / 2 - a + 0.05, Math.PI / 2 + a - 0.05);
    ctx.strokeStyle = '#27406e'; ctx.lineWidth = 4; ctx.stroke();
    ctx.fillStyle = '#4f5f7d'; rrect(ctx, -12, -28, 24, 12, 3); ctx.fill();
    ctx.beginPath(); ctx.arc(-15, -8, 3, 0, TAU); ctx.fillStyle = '#35a2ff'; ctx.fill();
    // светодиод на датчике повторяет лампу ЛОКАЦИЯ
    const b = this.ledB || 0;
    ctx.save();
    ctx.shadowColor = `hsla(${this.ledHue},100%,60%,${b})`; ctx.shadowBlur = 4 + 14 * b;
    ctx.beginPath(); ctx.arc(0, -37, 3.2, 0, TAU);
    ctx.fillStyle = `hsl(${this.ledHue},100%,${22 + 50 * b}%)`; ctx.fill();
    ctx.restore();
    ctx.restore();
  }

  drawHud(ctx, f) {
    const W = this.W, H = this.H;
    ctx.font = '10px "JetBrains Mono", monospace';
    ctx.fillStyle = 'rgba(200,225,255,.85)';
    ctx.textBaseline = 'top';
    ctx.fillText(`FATYA-SCAN 3000 · B-MODE · ${this.room.patient}`, 8, 5);
    const z = (this.fullRect().w / f.v.w);
    ctx.fillText(`TGC ${TGC_NAMES[this.tgc]}  x${z.toFixed(1)}  F 5.0MHz  MI 0.9  TIs 0.3`, 8, 18);
    ctx.textAlign = 'right';
    ctx.fillText(new Date().toLocaleTimeString('ru-RU'), W - 44, 5);
    ctx.fillText(`${this.locks}/3 ✓`, W - 44, 18);
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
    ctx.fillStyle = 'rgba(160,190,230,.75)';
    ctx.font = '11px "JetBrains Mono", monospace';
    const txt = this.mode === 'freeze' ? `▸ Заключение: ${this.room.conclusion}` : `▸ ${SCAN_JOKES[this.jokeI]}`;
    ctx.fillText(txt, 8, H - 8, W - 16);
  }

  loop() {
    if (!this.running) { this.raf = null; return; }
    const now = performance.now();
    const dt = Math.min(0.05, (now - this.last) / 1000);
    this.last = now;
    if (this.W && this.img) { this.update(dt); this.render(); this.tb.render(); }
    this.raf = requestAnimationFrame(() => this.loop());
  }
}
