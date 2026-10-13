// Этап 2 · Фармакология: «Антибиотик» — режем бактерии свайпом (по мотивам Fruit Ninja)
const AB_TARGET = 30;
const AB_LIVES = 3;
const AB_TYPES = {
  staph: { bad: true, name: 'S. aureus', juice: ['#a77bff', '#6a35c9', '#d6c2ff'] },
  strep: { bad: true, name: 'S. pyogenes', juice: ['#a77bff', '#6a35c9', '#d6c2ff'] },
  coli: { bad: true, name: 'E. coli', juice: ['#ff8fb3', '#d1406f', '#ffd0df'] },
  spiro: { bad: true, name: 'T. pallidum', juice: ['#ff8fb3', '#d1406f', '#ffd0df'] },
  rbc: { bad: false, name: 'эритроцит', juice: ['#ff3b4f', '#b3001b'], msg: 'Это свой эритроцит! 🙈' },
  wbc: { bad: false, name: 'лейкоцит', juice: ['#efe4ff', '#8e6ad1'], msg: 'Это лейкоцит — он за нас! 🙈' },
  virus: { bad: false, name: 'вирус', juice: ['#8be06f', '#3f8f2b'], msg: 'Вирус! На вирусы антибиотики не действуют 🦠' },
};
const AB_BAD = ['staph', 'strep', 'coli', 'spiro'];
const AB_GOOD = ['rbc', 'wbc', 'virus'];

class AntibioticGame {
  constructor(root, opts) {
    this.root = root; this.opts = opts;
    this.canvas = root.querySelector('canvas');
    this.ctx = this.canvas.getContext('2d');
    this.bar = root.querySelector('.ab-bar i');
    this.count = root.querySelector('.ab-count');
    this.lives = root.querySelector('.ab-lives');
    this.toastEl = root.querySelector('.k-toast');
    this.card = root.querySelector('.k-card');
    this.cardBtn = this.card.querySelector('button');
    this.cardBtn.addEventListener('click', () => { Haptic.impact('light'); const cb = this.cardCb; this.card.classList.add('hidden'); this.cardCb = null; cb && cb(); });
    this.running = false;
    const pos = e => { const r = this.canvas.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top, t: performance.now() }; };
    this.canvas.addEventListener('pointerdown', e => {
      e.preventDefault(); Sound.init();
      try { this.canvas.setPointerCapture(e.pointerId); } catch (_) {}
      this.ptr = { id: e.pointerId, ...pos(e) };
      this.swipeKills = 0; this.swiped = 0;
      this.trail.push({ x: this.ptr.x, y: this.ptr.y, life: 0.18 });
    });
    this.canvas.addEventListener('pointermove', e => {
      if (!this.ptr || e.pointerId !== this.ptr.id) return;
      e.preventDefault();
      const p = pos(e);
      this.cut(this.ptr, p);
      this.ptr = { id: this.ptr.id, ...p };
    });
    const up = e => { if (this.ptr && e.pointerId === this.ptr.id) { this.endSwipe(); this.ptr = null; } };
    this.canvas.addEventListener('pointerup', up);
    this.canvas.addEventListener('pointercancel', up);
    window.addEventListener('resize', () => { if (this.running) this.resize(); });
  }

  start() {
    this.running = true;
    this.resize();
    this.reset();
    this.showCard({
      ico: '💊', title: 'Курс антибиотика',
      text: `Свайпай по бактериям, чтобы их уничтожить — нужно ${AB_TARGET}. Не задевай свои клетки (эритроциты, лейкоциты) и вирусы: на них антибиотик не действует. ${AB_LIVES} ошибки — курс заново.`,
      btn: 'Назначить!',
    }, () => { this.phase = 'play'; });
    this.last = performance.now();
    if (!this.raf) this.loop();
  }

  stop() { this.running = false; if (this.raf) cancelAnimationFrame(this.raf); this.raf = null; }

  resize() {
    const r = this.canvas.getBoundingClientRect();
    if (!r.width) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    this.dpr = dpr; this.W = r.width; this.H = r.height;
    this.canvas.width = Math.round(r.width * dpr); this.canvas.height = Math.round(r.height * dpr);
    this.r = Math.max(24, Math.min(this.W, this.H) * 0.08);
    this.g = this.H * 1.05;
    this.buildBg();
  }

  reset() {
    this.objs = []; this.pieces = []; this.parts = []; this.texts = []; this.trail = this.trail || [];
    this.killed = 0; this.livesLeft = AB_LIVES; this.spawnT = 0.5; this.t = 0; this.flash = 0;
    this.phase = 'ready';
    this.hud();
  }

  hud() {
    this.count.textContent = `${this.killed}/${AB_TARGET}`;
    this.bar.style.width = `${Math.min(100, this.killed / AB_TARGET * 100)}%`;
    this.lives.innerHTML = '';
    for (let i = 0; i < AB_LIVES; i++) {
      const s = document.createElement('span');
      s.textContent = '💊';
      if (i >= this.livesLeft) s.className = 'lost';
      this.lives.appendChild(s);
    }
  }

  toast(text, ms = 1300) {
    this.toastEl.textContent = text;
    this.toastEl.classList.add('show');
    clearTimeout(this.toastT);
    this.toastT = setTimeout(() => this.toastEl.classList.remove('show'), ms);
  }

  showCard({ ico, title, text, btn }, cb) {
    this.card.querySelector('.k-card-ico').textContent = ico;
    this.card.querySelector('h2').textContent = title;
    this.card.querySelector('p').textContent = text;
    this.cardBtn.textContent = btn;
    this.cardCb = cb;
    const inner = this.card.querySelector('.k-card-inner');
    inner.style.animation = 'none'; void inner.offsetWidth; inner.style.animation = '';
    this.card.classList.remove('hidden');
    Sound.fx.pop();
  }

  buildBg() {
    const W = this.W, H = this.H, dpr = this.dpr;
    const c = this.bgC || (this.bgC = document.createElement('canvas'));
    c.width = Math.round(W * dpr); c.height = Math.round(H * dpr);
    const x = c.getContext('2d');
    x.setTransform(dpr, 0, 0, dpr, 0, 0);
    let g = x.createRadialGradient(W / 2, H / 2, 10, W / 2, H / 2, Math.max(W, H) * 0.8);
    g.addColorStop(0, '#1d2a3d'); g.addColorStop(1, '#070b12');
    x.fillStyle = g; x.fillRect(0, 0, W, H);
    // чашка Петри с агаром
    const R = Math.min(W, H) * 0.62, cx = W / 2, cy = H * 0.55;
    g = x.createRadialGradient(cx - R * 0.2, cy - R * 0.25, R * 0.1, cx, cy, R);
    g.addColorStop(0, 'rgba(232,190,110,.32)'); g.addColorStop(0.8, 'rgba(190,130,60,.22)'); g.addColorStop(1, 'rgba(120,80,30,.15)');
    x.fillStyle = g; x.beginPath(); x.arc(cx, cy, R, 0, TAU); x.fill();
    x.strokeStyle = 'rgba(220,240,255,.25)'; x.lineWidth = 6; x.beginPath(); x.arc(cx, cy, R, 0, TAU); x.stroke();
    x.strokeStyle = 'rgba(255,255,255,.35)'; x.lineWidth = 2; x.beginPath(); x.arc(cx, cy, R - 8, Math.PI * 1.1, Math.PI * 1.55); x.stroke();
    for (let i = 0; i < 40; i++) {
      const a = rnd(0, TAU), d = Math.sqrt(Math.random()) * R * 0.9, rr = rnd(2, 7);
      x.fillStyle = `rgba(255,240,200,${rnd(0.05, 0.16)})`;
      x.beginPath(); x.arc(cx + Math.cos(a) * d, cy + Math.sin(a) * d, rr, 0, TAU); x.fill();
    }
    // диски с антибиотиками (тест на чувствительность)
    [[0.25, 0.35, 'AMC'], [0.72, 0.42, 'CRO'], [0.5, 0.78, 'VA']].forEach(([px, py, lab]) => {
      const X = cx + (px - 0.5) * R * 1.6, Y = cy + (py - 0.5) * R * 1.6;
      x.fillStyle = 'rgba(255,255,255,.06)'; x.beginPath(); x.arc(X, Y, R * 0.18, 0, TAU); x.fill();
      x.fillStyle = 'rgba(255,255,255,.55)'; x.beginPath(); x.arc(X, Y, 9, 0, TAU); x.fill();
      x.fillStyle = 'rgba(30,40,60,.8)'; x.font = '700 7px Manrope, sans-serif'; x.textAlign = 'center'; x.fillText(lab, X, Y + 2.5);
    });
    x.textAlign = 'left';
  }

  // ---------- рисование микробов ----------
  drawObj(ctx, o) {
    const r = this.r;
    switch (o.type) {
      case 'staph': {
        for (const [px, py, s] of o.cells) {
          const g = ctx.createRadialGradient(px - s * 0.3, py - s * 0.35, s * 0.1, px, py, s);
          g.addColorStop(0, '#d2b8ff'); g.addColorStop(0.55, '#7f4fd6'); g.addColorStop(1, '#3d1a7d');
          ctx.fillStyle = g; ctx.beginPath(); ctx.arc(px, py, s, 0, TAU); ctx.fill();
        }
        break;
      }
      case 'strep': {
        for (const [px, py, s] of o.cells) {
          const g = ctx.createRadialGradient(px - s * 0.3, py - s * 0.35, s * 0.1, px, py, s);
          g.addColorStop(0, '#cdb0ff'); g.addColorStop(0.6, '#7446cc'); g.addColorStop(1, '#391877');
          ctx.fillStyle = g; ctx.beginPath(); ctx.ellipse(px, py, s, s * 0.88, 0, 0, TAU); ctx.fill();
        }
        break;
      }
      case 'coli': {
        ctx.strokeStyle = 'rgba(255,190,210,.7)'; ctx.lineWidth = 1.4;
        for (let k = 0; k < 5; k++) {
          const sx = (k % 2 ? 1 : -1) * r * 0.9, sy = (k - 2) * r * 0.16;
          ctx.beginPath(); ctx.moveTo(sx, sy);
          for (let i = 1; i <= 10; i++) ctx.lineTo(sx + Math.sign(sx) * i * r * 0.08, sy + Math.sin(i * 1.3 + this.t * 9 + k) * r * 0.08);
          ctx.stroke();
        }
        rrect(ctx, -r, -r * 0.42, r * 2, r * 0.84, r * 0.42);
        const g = ctx.createLinearGradient(0, -r * 0.42, 0, r * 0.42);
        g.addColorStop(0, '#ffc2d5'); g.addColorStop(0.5, '#ec6b95'); g.addColorStop(1, '#a12c57');
        ctx.fillStyle = g; ctx.fill();
        ctx.fillStyle = 'rgba(120,20,60,.35)';
        for (let i = 0; i < 6; i++) { ctx.beginPath(); ctx.arc(-r * 0.6 + i * r * 0.24, Math.sin(i * 2.1) * r * 0.15, r * 0.06, 0, TAU); ctx.fill(); }
        ctx.strokeStyle = 'rgba(255,255,255,.5)'; ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.moveTo(-r * 0.7, -r * 0.26); ctx.lineTo(r * 0.6, -r * 0.26); ctx.stroke();
        break;
      }
      case 'spiro': {
        ctx.beginPath();
        for (let i = 0; i <= 60; i++) {
          const u = i / 60, x = -r * 1.1 + u * r * 2.2, y = Math.sin(u * TAU * 3.5) * r * 0.3;
          i ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
        }
        ctx.lineCap = 'round'; ctx.lineJoin = 'round';
        ctx.strokeStyle = '#7a1f45'; ctx.lineWidth = r * 0.26; ctx.stroke();
        ctx.strokeStyle = '#ff86ad'; ctx.lineWidth = r * 0.16; ctx.stroke();
        ctx.lineCap = 'butt';
        break;
      }
      case 'rbc': {
        const g = ctx.createRadialGradient(0, 0, 0, 0, 0, r);
        g.addColorStop(0, '#e9767c'); g.addColorStop(0.45, '#c52c3a'); g.addColorStop(0.85, '#db4552'); g.addColorStop(1, '#7d0a16');
        ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, r, 0, TAU); ctx.fill();
        break;
      }
      case 'wbc': {
        const g = ctx.createRadialGradient(-r * 0.3, -r * 0.3, 0, 0, 0, r);
        g.addColorStop(0, '#fbf6ff'); g.addColorStop(1, '#c9b5ea');
        ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, r, 0, TAU); ctx.fill();
        ctx.fillStyle = 'rgba(160,120,210,.5)';
        for (let i = 0; i < 16; i++) { const a = i * 2.4, d = r * (0.3 + (i % 4) * 0.15); ctx.beginPath(); ctx.arc(Math.cos(a) * d, Math.sin(a) * d, 1.4, 0, TAU); ctx.fill(); }
        ctx.fillStyle = '#5b2e9a';
        [[-0.35, -0.1], [0.05, -0.32], [0.35, 0.05], [0.0, 0.3]].forEach(([x, y]) => { ctx.beginPath(); ctx.ellipse(x * r, y * r, r * 0.22, r * 0.17, x + y, 0, TAU); ctx.fill(); });
        ctx.strokeStyle = '#5b2e9a'; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(-0.35 * r, -0.1 * r); ctx.lineTo(0.05 * r, -0.32 * r); ctx.lineTo(0.35 * r, 0.05 * r); ctx.lineTo(0, 0.3 * r); ctx.stroke();
        break;
      }
      case 'virus': {
        ctx.strokeStyle = '#4c8f3a'; ctx.lineWidth = 2.2;
        for (let i = 0; i < 14; i++) {
          const a = i / 14 * TAU;
          ctx.beginPath(); ctx.moveTo(Math.cos(a) * r * 0.7, Math.sin(a) * r * 0.7); ctx.lineTo(Math.cos(a) * r * 1.05, Math.sin(a) * r * 1.05); ctx.stroke();
          ctx.fillStyle = '#ff5a4a'; ctx.beginPath(); ctx.arc(Math.cos(a) * r * 1.08, Math.sin(a) * r * 1.08, r * 0.1, 0, TAU); ctx.fill();
        }
        const g = ctx.createRadialGradient(-r * 0.25, -r * 0.25, 0, 0, 0, r * 0.75);
        g.addColorStop(0, '#c7f5a6'); g.addColorStop(1, '#4f9a3c');
        ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, r * 0.75, 0, TAU); ctx.fill();
        ctx.fillStyle = 'rgba(30,80,20,.35)';
        for (let i = 0; i < 6; i++) { ctx.beginPath(); ctx.arc(Math.cos(i * 1.7) * r * 0.4, Math.sin(i * 1.7) * r * 0.4, r * 0.09, 0, TAU); ctx.fill(); }
        break;
      }
    }
  }

  makeObj(type) {
    const r = this.r, o = { type, alive: true };
    if (type === 'staph') o.cells = [[0, 0, r * 0.42], ...Array.from({ length: 6 }, (_, i) => { const a = i / 6 * TAU + rnd(-0.2, 0.2); return [Math.cos(a) * r * 0.58, Math.sin(a) * r * 0.58, r * rnd(0.33, 0.42)]; })];
    if (type === 'strep') o.cells = Array.from({ length: 6 }, (_, i) => [-r * 1.05 + i * r * 0.42, Math.sin(i * 0.9) * r * 0.2, r * 0.24]);
    return o;
  }

  spawnWave() {
    const W = this.W, H = this.H, prog = this.killed / AB_TARGET;
    let n = 1 + (Math.random() < 0.55 ? 1 : 0) + (prog > 0.3 && Math.random() < 0.5 ? 1 : 0) + (prog > 0.6 && Math.random() < 0.4 ? 1 : 0);
    for (let i = 0; i < n; i++) {
      const friendly = Math.random() < 0.16 + 0.12 * prog;
      const type = friendly ? AB_GOOD[(Math.random() * AB_GOOD.length) | 0] : AB_BAD[(Math.random() * AB_BAD.length) | 0];
      const o = this.makeObj(type);
      o.x = rnd(W * 0.15, W * 0.85); o.y = H + this.r * 1.5;
      const apex = H * rnd(0.42, 0.72);
      o.vy = -Math.sqrt(2 * this.g * apex);
      o.vx = (W / 2 - o.x) * rnd(0.25, 0.75) / 1.3;
      o.rot = rnd(0, TAU); o.vr = rnd(-2.5, 2.5);
      o.delay = i * rnd(0.12, 0.3);
      this.objs.push(o);
    }
    Sound.fx.launch();
  }

  // ---------- свайп ----------
  cut(a, b) {
    const dx = b.x - a.x, dy = b.y - a.y, len = Math.hypot(dx, dy);
    if (len < 2) return;
    this.trail.push({ x: b.x, y: b.y, life: 0.18 });
    this.swiped += len;
    if (this.swiped > 60 && !this.swipeSound) { this.swipeSound = true; Sound.fx.swipe(); }
    if (this.phase !== 'play') return;
    const speed = len / Math.max(0.008, (b.t - a.t) / 1000);
    if (speed < 120) return;
    for (const o of this.objs) {
      if (!o.alive || o.delay > 0) continue;
      const t = clamp(((o.x - a.x) * dx + (o.y - a.y) * dy) / (len * len), 0, 1);
      const px = a.x + dx * t, py = a.y + dy * t;
      if (Math.hypot(o.x - px, o.y - py) < this.r * 1.05) this.slice(o, dx / len, dy / len);
    }
  }

  endSwipe() {
    if (this.swipeKills >= 3) {
      const t = this.swipeKills >= 5 ? 'Ударная доза!' : 'Широкий спектр!';
      this.texts.push({ x: this.W / 2, y: this.H * 0.3, text: `Комбо ×${this.swipeKills}! ${t}`, life: 1.4, big: true });
      Sound.fx.combo(this.swipeKills); Haptic.notify('success');
    }
    this.swipeKills = 0; this.swiped = 0; this.swipeSound = false;
  }

  slice(o, ux, uy) {
    o.alive = false;
    const nx = -uy, ny = ux;
    for (const side of [1, -1]) {
      this.pieces.push({ type: o.type, cells: o.cells, x: o.x, y: o.y, vx: o.vx + nx * side * 110 + ux * 60, vy: o.vy * 0.4 + ny * side * 110 - 60,
        rot: o.rot, vr: o.vr + side * rnd(2, 5), cutA: Math.atan2(ny, nx) - o.rot, side, life: 1.6 });
    }
    const T = AB_TYPES[o.type];
    for (let i = 0; i < 16; i++) {
      const a = rnd(0, TAU), v = rnd(60, 320);
      this.parts.push({ x: o.x, y: o.y, vx: Math.cos(a) * v + ux * 100, vy: Math.sin(a) * v - 80, r: rnd(1.5, 4.5), c: T.juice[i % T.juice.length], life: rnd(0.4, 0.9), max: 0.9 });
    }
    if (T.bad) {
      this.killed++; this.swipeKills++;
      Sound.fx.slice(); Haptic.impact('light');
      this.texts.push({ x: o.x, y: o.y - this.r, text: '+1', life: 0.7 });
      this.hud();
      if (this.killed >= AB_TARGET) this.win();
    } else {
      this.livesLeft--; this.flash = 1;
      Sound.fx.slice(); Sound.fx.ouch(); Haptic.notify('error');
      this.toast(T.msg);
      this.hud();
      if (this.livesLeft <= 0) {
        this.phase = 'fail';
        setTimeout(() => this.toast('Курс прерван — резистентность! Начинаем заново 💊', 1600), 600);
        setTimeout(() => { if (!this.running) return; this.reset(); this.phase = 'play'; }, 2300);
      }
    }
  }

  win() {
    this.phase = 'win';
    Sound.fx.win(); Haptic.notify('success');
    if (window.App) App.confetti(this.W / 2, this.H * 0.4, ['#a77bff', '#ff8fb3', '#2fe0c4', '#fff']);
    setTimeout(() => {
      if (!this.running) return;
      this.showCard({ ico: '🏆', title: 'Инфекция побеждена!', text: 'Посев стерилен, резистентности ноль. Клинический фармаколог одобрительно кивает.', btn: 'Дальше' }, () => this.opts.onDone());
    }, 1300);
  }

  // ---------- цикл ----------
  update(dt) {
    this.t += dt;
    this.flash *= Math.exp(-dt * 5);
    if (this.phase === 'play') {
      this.spawnT -= dt;
      if (this.spawnT <= 0) { this.spawnWave(); this.spawnT = rnd(1.1, 1.7) - 0.35 * (this.killed / AB_TARGET); }
    }
    for (const o of this.objs) {
      if (o.delay > 0) { o.delay -= dt; continue; }
      o.vy += this.g * dt; o.x += o.vx * dt; o.y += o.vy * dt; o.rot += o.vr * dt;
    }
    this.objs = this.objs.filter(o => o.alive && !(o.vy > 0 && o.y > this.H + this.r * 2));
    for (const p of this.pieces) { p.vy += this.g * dt; p.x += p.vx * dt; p.y += p.vy * dt; p.rot += p.vr * dt; p.life -= dt; }
    this.pieces = this.pieces.filter(p => p.life > 0 && p.y < this.H + this.r * 3);
    for (const p of this.parts) { p.vy += 700 * dt; p.x += p.vx * dt; p.y += p.vy * dt; p.life -= dt; }
    this.parts = this.parts.filter(p => p.life > 0);
    for (const t of this.texts) { t.y -= 40 * dt; t.life -= dt; }
    this.texts = this.texts.filter(t => t.life > 0);
    for (const p of this.trail) p.life -= dt;
    this.trail = this.trail.filter(p => p.life > 0).slice(-24);
  }

  render() {
    const ctx = this.ctx, W = this.W, H = this.H;
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    ctx.drawImage(this.bgC, 0, 0, W, H);
    for (const o of this.objs) {
      if (o.delay > 0) continue;
      ctx.save(); ctx.translate(o.x, o.y); ctx.rotate(o.rot); this.drawObj(ctx, o); ctx.restore();
      ctx.fillStyle = 'rgba(255,255,255,.6)'; ctx.font = 'italic 600 10px Manrope, sans-serif'; ctx.textAlign = 'center';
      ctx.fillText(AB_TYPES[o.type].name, o.x, o.y + this.r * 1.45);
    }
    for (const p of this.pieces) {
      ctx.save();
      ctx.globalAlpha = Math.min(1, p.life * 1.5);
      ctx.translate(p.x, p.y); ctx.rotate(p.rot);
      ctx.rotate(p.cutA);
      ctx.beginPath();
      if (p.side > 0) ctx.rect(0, -this.r * 2, this.r * 2, this.r * 4); else ctx.rect(-this.r * 2, -this.r * 2, this.r * 2, this.r * 4);
      ctx.clip();
      ctx.rotate(-p.cutA);
      this.drawObj(ctx, p);
      ctx.restore();
    }
    for (const p of this.parts) {
      ctx.globalAlpha = clamp(p.life / p.max, 0, 1);
      ctx.fillStyle = p.c; ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, TAU); ctx.fill();
    }
    ctx.globalAlpha = 1;
    // след «лезвия»
    if (this.trail.length > 1) {
      ctx.lineCap = 'round'; ctx.lineJoin = 'round';
      for (let i = 1; i < this.trail.length; i++) {
        const a = this.trail[i - 1], b = this.trail[i], k = b.life / 0.18;
        ctx.strokeStyle = `rgba(160,240,255,${k * 0.9})`; ctx.lineWidth = 2 + 7 * k;
        ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
        ctx.strokeStyle = `rgba(255,255,255,${k})`; ctx.lineWidth = 1 + 2.5 * k;
        ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
      }
      ctx.lineCap = 'butt';
    }
    for (const t of this.texts) {
      ctx.globalAlpha = clamp(t.life * 1.5, 0, 1);
      ctx.font = t.big ? '800 22px Unbounded, sans-serif' : '800 16px Manrope, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillStyle = t.big ? '#ffd166' : '#7dffb0'; ctx.shadowColor = '#000'; ctx.shadowBlur = 6;
      ctx.fillText(t.text, t.x, t.y);
      ctx.shadowBlur = 0;
    }
    ctx.globalAlpha = 1; ctx.textAlign = 'left';
    if (this.flash > 0.02) { ctx.fillStyle = `rgba(255,30,60,${this.flash * 0.35})`; ctx.fillRect(0, 0, W, H); }
  }

  loop() {
    if (!this.running) { this.raf = null; return; }
    const now = performance.now();
    const dt = Math.min(0.033, (now - this.last) / 1000);
    this.last = now;
    if (this.W) { this.update(dt); this.render(); }
    this.raf = requestAnimationFrame(() => this.loop());
  }
}
