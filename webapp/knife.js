// Knife Hit в медицинском стиле
const TAU = Math.PI * 2;
const rnd = (a, b) => a + Math.random() * (b - a);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const normA = a => ((a % TAU) + TAU) % TAU;
const angDist = (a, b) => { const d = normA(a - b); return d > Math.PI ? TAU - d : d; };

function rrect(ctx, x, y, w, h, r) {
  r = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

// зернистая «спекл»-текстура как на УЗИ
function makeSpeckle(size, bright) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const x = c.getContext('2d');
  x.fillStyle = bright ? '#5a5a5a' : '#000';
  x.fillRect(0, 0, size, size);
  const n = size * size / (bright ? 10 : 7);
  for (let i = 0; i < n; i++) {
    const v = Math.floor(Math.pow(Math.random(), bright ? 0.8 : 1.8) * (bright ? 255 : 165));
    x.fillStyle = `rgba(${v},${v},${v},${bright ? 0.8 : 0.75})`;
    const px = Math.random() * size, py = Math.random() * size;
    x.beginPath();
    x.ellipse(px, py, rnd(0.8, 2.6), rnd(0.5, 1.2), 0, 0, TAU);
    x.fill();
  }
  return c;
}

// скальпель: кончик в (0,0), тело уходит вниз (+y)
function drawScalpel(ctx, L, W) {
  const bl = L * 0.4;
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.quadraticCurveTo(-W * 0.66, bl * 0.42, -W * 0.48, bl);
  ctx.lineTo(W * 0.3, bl);
  ctx.lineTo(W * 0.3, bl * 0.38);
  ctx.quadraticCurveTo(W * 0.28, bl * 0.1, 0, 0);
  let g = ctx.createLinearGradient(-W * 0.5, 0, W * 0.32, 0);
  g.addColorStop(0, '#f6f9fc'); g.addColorStop(0.35, '#ffffff'); g.addColorStop(0.7, '#aab5c1'); g.addColorStop(1, '#76838f');
  ctx.fillStyle = g; ctx.fill();
  ctx.lineWidth = 0.8; ctx.strokeStyle = 'rgba(30,40,55,.65)'; ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(-0.5, bl * 0.08);
  ctx.quadraticCurveTo(-W * 0.52, bl * 0.45, -W * 0.4, bl * 0.96);
  ctx.strokeStyle = 'rgba(255,255,255,.95)'; ctx.lineWidth = 1.2; ctx.stroke();
  rrect(ctx, -W * 0.08, bl * 0.6, W * 0.16, bl * 0.3, W * 0.08);
  ctx.fillStyle = 'rgba(50,60,75,.55)'; ctx.fill();
  // шейка
  ctx.fillStyle = '#8994a1';
  ctx.fillRect(-W * 0.2, bl, W * 0.4, L * 0.07);
  // ручка
  const hy = bl + L * 0.07;
  rrect(ctx, -W * 0.3, hy, W * 0.6, L - hy, W * 0.22);
  g = ctx.createLinearGradient(-W * 0.3, 0, W * 0.3, 0);
  g.addColorStop(0, '#7d8895'); g.addColorStop(0.35, '#eef2f6'); g.addColorStop(0.65, '#b7c0ca'); g.addColorStop(1, '#5a6470');
  ctx.fillStyle = g; ctx.fill();
  ctx.strokeStyle = 'rgba(30,40,55,.5)'; ctx.lineWidth = 0.8; ctx.stroke();
  ctx.strokeStyle = 'rgba(40,50,65,.45)'; ctx.lineWidth = 1;
  for (let y = hy + L * 0.05; y < hy + L * 0.3; y += 3.2) {
    ctx.beginPath(); ctx.moveTo(-W * 0.26, y); ctx.lineTo(W * 0.26, y); ctx.stroke();
  }
}

// полостной (трансвагинальный) датчик: кончик в (0,0), тело вниз
function drawProbe(ctx, L, W) {
  const sw = W * 0.56, tw = W * 0.82, hw = W * 1.15;
  // кабель
  ctx.beginPath();
  ctx.moveTo(0, L * 0.96);
  ctx.bezierCurveTo(W * 0.6, L * 1.08, -W * 0.5, L * 1.2, W * 0.3, L * 1.34);
  ctx.strokeStyle = '#2a2f3c'; ctx.lineWidth = W * 0.3; ctx.lineCap = 'round'; ctx.stroke();
  ctx.lineCap = 'butt';
  ctx.beginPath();
  ctx.moveTo(-tw / 2, L * 0.085);
  ctx.bezierCurveTo(-tw / 2, -L * 0.012, tw / 2, -L * 0.012, tw / 2, L * 0.085);
  ctx.lineTo(sw / 2, L * 0.17);
  ctx.lineTo(sw / 2, L * 0.57);
  ctx.lineTo(hw / 2, L * 0.66);
  ctx.lineTo(hw / 2, L * 0.9);
  ctx.quadraticCurveTo(hw / 2, L * 0.97, hw * 0.22, L * 0.97);
  ctx.lineTo(-hw * 0.22, L * 0.97);
  ctx.quadraticCurveTo(-hw / 2, L * 0.97, -hw / 2, L * 0.9);
  ctx.lineTo(-hw / 2, L * 0.66);
  ctx.lineTo(-sw / 2, L * 0.57);
  ctx.lineTo(-sw / 2, L * 0.17);
  ctx.closePath();
  const g = ctx.createLinearGradient(-hw / 2, 0, hw / 2, 0);
  g.addColorStop(0, '#aab3be'); g.addColorStop(0.35, '#ffffff'); g.addColorStop(0.7, '#dfe5ec'); g.addColorStop(1, '#8e98a4');
  ctx.fillStyle = g; ctx.fill();
  ctx.strokeStyle = 'rgba(50,60,80,.55)'; ctx.lineWidth = 0.9; ctx.stroke();
  // линза
  ctx.beginPath();
  ctx.ellipse(0, L * 0.03, tw * 0.36, L * 0.026, 0, 0, TAU);
  ctx.fillStyle = '#26406e'; ctx.fill();
  ctx.beginPath();
  ctx.ellipse(-tw * 0.1, L * 0.024, tw * 0.12, L * 0.008, 0, 0, TAU);
  ctx.fillStyle = 'rgba(160,200,255,.7)'; ctx.fill();
  // рукоять с грипом
  ctx.fillStyle = '#4f5f7d';
  rrect(ctx, -hw / 2 + 1, L * 0.72, hw - 2, L * 0.12, 3); ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,.18)'; ctx.lineWidth = 1;
  for (let y = L * 0.735; y < L * 0.83; y += 3) { ctx.beginPath(); ctx.moveTo(-hw / 2 + 2, y); ctx.lineTo(hw / 2 - 2, y); ctx.stroke(); }
  // метка ориентации
  ctx.beginPath(); ctx.arc(hw / 2, L * 0.685, W * 0.13, 0, TAU); ctx.fillStyle = '#35a2ff'; ctx.fill();
}

const KNIFE_LEVELS = [
  {
    kind: 'rbc', item: 'scalpel', count: 14, name: 'Эритроцит', ico: '🩸',
    title: 'Уровень 1 из 3 · Эритроцит',
    text: 'Воткни 14 скальпелей в эритроцит — тапай по экрану. Попадёшь в уже воткнутый скальпель — уровень начнётся заново.',
    winTitle: 'Эритроцит препарирован!',
    speed: t => 1.3 + 0.2 * Math.sin(t * 0.6), obstacles: [],
  },
  {
    kind: 'gb', item: 'scalpel', count: 18, name: 'Желчный пузырь', ico: '🟢',
    title: 'Уровень 2 из 3 · Желчный пузырь',
    text: 'Нужно 18 скальпелей. Пузырь плавно меняет направление вращения, а камни внутри не дремлют.',
    winTitle: 'Холецистэктомия удалась!',
    speed: t => 1.7 * Math.sin(t * 0.7 + 0.25) + 0.25, obstacles: [],
  },
  {
    kind: 'cyst', item: 'probe', count: 12, name: 'Киста', ico: '⚫',
    title: 'Уровень 3 из 3 · Киста',
    text: 'Анэхогенная, с дорсальным усилением — почти как ты любишь. Вместо скальпелей полостные датчики: 12 штук. Киста резко меняет направление, а на стенке — папиллярный компонент с кровотоком (подсвечен красным, мерцает в допплере). Его не задевать!',
    winTitle: 'Киста повержена, компонент цел!',
    speed: t => 2.0 * Math.tanh(7 * Math.sin(t * 0.8 + 0.3)), obstacles: [1.2, 4.1],
    zone: { a: 2.55, half: 0.28 }, // папиллярный компонент — попадать нельзя
  },
];

class KnifeGame {
  constructor(root, opts) {
    this.root = root; this.opts = opts;
    this.canvas = root.querySelector('#knife-canvas');
    this.ctx = this.canvas.getContext('2d');
    this.hudCount = root.querySelector('.k-count');
    this.hudName = root.querySelector('.k-name');
    this.hudLv = [...root.querySelectorAll('.k-lv')];
    this.toastEl = root.querySelector('.k-toast');
    this.card = root.querySelector('.k-card');
    this.cardBtn = this.card.querySelector('button');
    this.cardBtn.addEventListener('click', () => { Haptic.impact('light'); const cb = this.cardCb; this.hideCard(); cb && cb(); });
    this.running = false;
    this.phase = 'idle';
    this.particles = []; this.pieces = []; this.flyers = [];
    this.speckle = makeSpeckle(256, false);
    this.speckleBright = makeSpeckle(128, true);
    this.rbcSprite = this.makeRbcSprite();
    this.canvas.addEventListener('pointerdown', e => { e.preventDefault(); this.throwKnife(); });
    window.addEventListener('resize', () => { if (this.running) this.resize(); });
  }

  makeRbcSprite() {
    const c = document.createElement('canvas'); c.width = c.height = 64;
    const x = c.getContext('2d');
    const g = x.createRadialGradient(32, 32, 0, 32, 32, 30);
    g.addColorStop(0, '#d9616a'); g.addColorStop(0.5, '#b0202e'); g.addColorStop(0.85, '#d23a47'); g.addColorStop(1, 'rgba(110,0,15,0)');
    x.fillStyle = g; x.beginPath(); x.arc(32, 32, 30, 0, TAU); x.fill();
    return c;
  }

  // ---------- жизненный цикл ----------
  start(levelIdx) {
    this.running = true;
    this.levelIdx = levelIdx;
    this.level = KNIFE_LEVELS[levelIdx];
    this.resize();
    this.resetLevel();
    this.updateHudLevels();
    this.showCard({ ico: this.level.ico, title: this.level.title, text: this.level.text, btn: 'Поехали!' }, () => { this.phase = 'play'; });
    this.last = performance.now();
    if (!this.raf) this.loop();
  }

  stop() {
    this.running = false;
    if (this.raf) cancelAnimationFrame(this.raf);
    this.raf = null;
  }

  resize() {
    const r = this.canvas.getBoundingClientRect();
    if (!r.width || !r.height) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    this.dpr = dpr;
    this.W = r.width; this.H = r.height;
    this.canvas.width = Math.round(r.width * dpr);
    this.canvas.height = Math.round(r.height * dpr);
    this.R = Math.min(this.W * 0.28, this.H * 0.165);
    this.cx = this.W / 2;
    this.cy = this.H * 0.37;
    this.KL = this.R * 1.08;
    this.KW = Math.max(12, this.R * 0.15);
    this.baseY = this.H - Math.max(118, this.H * 0.2);
    this.gap = 0.15; // минимальный угловой зазор между ножами (рад)
    if (this.level) this.buildBg();
  }

  resetLevel() {
    const L = this.level;
    this.rot = rnd(0, TAU);
    this.t = 0;
    this.stuck = L.obstacles.map(a => ({ a, obstacle: true }));
    this.left = L.count;
    this.flying = null;
    this.falling = null;
    this.spawn = 1;
    this.bounce = 0;
    this.flash = 0;
    this.hitFlash = 0;
    this.pieces = []; this.flyers = [];
    this.phase = this.phase === 'play' ? 'play' : 'ready';
    this.thrownOnce = this.levelIdx > 0;
    this.buildTarget();
    this.buildBg();
    this.renderCount();
  }

  buildTarget() {
    const R = this.R;
    if (this.level.kind === 'rbc') {
      this.spots = Array.from({ length: 22 }, () => {
        const a = rnd(0, TAU), d = Math.sqrt(Math.random()) * R * 0.92;
        return { x: Math.cos(a) * d, y: Math.sin(a) * d, r: rnd(R * 0.03, R * 0.1), dark: Math.random() < 0.5 };
      });
    } else if (this.level.kind === 'gb') {
      this.veins = Array.from({ length: 9 }, () => {
        let a = rnd(0, TAU), rr = rnd(R * 0.88, R * 0.97);
        const pts = [];
        for (let i = 0; i < 6; i++) { pts.push([Math.cos(a) * rr, Math.sin(a) * rr]); a += rnd(0.06, 0.14); rr = clamp(rr + rnd(-R * 0.04, R * 0.04), R * 0.86, R * 0.985); }
        return pts;
      });
      const Ri = R * 0.84;
      this.Ri = Ri;
      this.stones = Array.from({ length: 6 }, (_, i) => {
        const r = R * rnd(0.075, 0.125);
        const n = 7, verts = [];
        for (let k = 0; k < n; k++) verts.push(rnd(0.78, 1.1));
        const hue = Math.random();
        return {
          x: rnd(-Ri * 0.5, Ri * 0.5), y: Ri * 0.55 - (i % 2) * r * 2, vx: 0, vy: 0, r, verts, ang: rnd(0, TAU), spin: 0,
          c1: hue < 0.4 ? '#d7b46a' : hue < 0.75 ? '#9a6b33' : '#6f7a3a',
          c2: hue < 0.4 ? '#7d5a22' : hue < 0.75 ? '#4a2d12' : '#353d18',
        };
      });
      this.slosh = 3;
      this.bubbles = Array.from({ length: 7 }, () => ({ x: rnd(-Ri * 0.7, Ri * 0.7), y: rnd(0, Ri), r: rnd(1.5, 3.5), v: rnd(10, 25) }));
    } else {
      const z = this.level.zone;
      this.papilla = [];
      const n = 22;
      for (let i = 0; i <= n; i++) {
        const u = i / n, a = z.a - z.half * 0.9 + u * z.half * 1.8;
        const bump = Math.pow(Math.sin(u * Math.PI), 0.45) * (0.2 + 0.045 * Math.sin(u * 13)) + 0.012 * Math.sin(u * 37);
        this.papilla.push([Math.cos(a) * R * (0.9 - bump), Math.sin(a) * R * (0.9 - bump)]);
      }
      this.flow = Array.from({ length: 12 }, () => {
        const a = z.a + rnd(-z.half * 0.6, z.half * 0.6), d = R * rnd(0.7, 0.86);
        return { x: Math.cos(a) * d, y: Math.sin(a) * d, r: rnd(1.6, 3.4), ph: rnd(0, TAU) };
      });
      this.echoes = Array.from({ length: 14 }, () => {
        const a = rnd(0, TAU), d = Math.sqrt(Math.random()) * R * 0.75;
        return { x: Math.cos(a) * d, y: Math.sin(a) * d, r: rnd(0.6, 1.6), v: rnd(60, 140) };
      });
    }
  }

  buildBg() {
    const W = this.W, H = this.H, dpr = this.dpr;
    const c = this.bgC || (this.bgC = document.createElement('canvas'));
    c.width = Math.round(W * dpr); c.height = Math.round(H * dpr);
    const x = c.getContext('2d');
    x.setTransform(dpr, 0, 0, dpr, 0, 0);
    const kind = this.level.kind;
    if (kind === 'rbc') {
      const g = x.createRadialGradient(W / 2, H * 0.38, 10, W / 2, H * 0.45, H * 0.8);
      g.addColorStop(0, '#5b0b16'); g.addColorStop(0.55, '#2a040b'); g.addColorStop(1, '#0c0104');
      x.fillStyle = g; x.fillRect(0, 0, W, H);
      this.cells = Array.from({ length: 16 }, () => ({ x: rnd(0, W), y: rnd(0, H), r: rnd(8, 30), vx: rnd(4, 14), vy: rnd(-6, 6), a: rnd(0.12, 0.3) }));
    } else if (kind === 'gb') {
      const g = x.createRadialGradient(W / 2, H * 0.38, 10, W / 2, H * 0.45, H * 0.8);
      g.addColorStop(0, '#4a1d14'); g.addColorStop(0.6, '#25100b'); g.addColorStop(1, '#0d0504');
      x.fillStyle = g; x.fillRect(0, 0, W, H);
      // печёночные дольки
      x.strokeStyle = 'rgba(255,170,140,.06)'; x.lineWidth = 1;
      const s = 26;
      for (let yy = -s; yy < H + s; yy += s * 1.5) {
        for (let xx = -s; xx < W + s; xx += s * Math.sqrt(3)) {
          const ox = (Math.round(yy / (s * 1.5)) % 2) * s * Math.sqrt(3) / 2;
          x.beginPath();
          for (let k = 0; k < 6; k++) { const a = Math.PI / 6 + k * Math.PI / 3; x.lineTo(xx + ox + Math.cos(a) * s, yy + Math.sin(a) * s); }
          x.closePath(); x.stroke();
          x.fillStyle = 'rgba(120,30,40,.25)'; x.beginPath(); x.arc(xx + ox, yy, 2, 0, TAU); x.fill();
        }
      }
    } else {
      x.fillStyle = '#000'; x.fillRect(0, 0, W, H);
      const ax = W / 2, ay = H * 0.07, rr = H * 0.8, ha = 0.72, r0 = H * 0.035;
      const fan = new Path2D();
      fan.arc(ax, ay, rr, Math.PI / 2 - ha, Math.PI / 2 + ha);
      fan.arc(ax, ay, r0, Math.PI / 2 + ha, Math.PI / 2 - ha, true);
      fan.closePath();
      this.fan = fan;
      x.save(); x.clip(fan);
      x.fillStyle = x.createPattern(this.speckle, 'repeat'); x.fillRect(0, 0, W, H);
      let g = x.createRadialGradient(ax, ay, r0, ax, ay, rr);
      g.addColorStop(0, 'rgba(255,255,255,.12)'); g.addColorStop(0.35, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(0,0,0,.55)');
      x.fillStyle = g; x.fillRect(0, 0, W, H);
      // дорсальное акустическое усиление
      const R = this.R, cx = this.cx, cy = this.cy;
      g = x.createLinearGradient(0, cy, 0, cy + rr * 0.6);
      g.addColorStop(0, 'rgba(255,255,255,.22)'); g.addColorStop(1, 'rgba(255,255,255,0)');
      x.fillStyle = g; x.fillRect(cx - R * 0.86, cy, R * 1.72, H);
      // латеральные тени
      g = x.createLinearGradient(0, cy, 0, cy + rr * 0.7);
      g.addColorStop(0, 'rgba(0,0,0,.85)'); g.addColorStop(1, 'rgba(0,0,0,0)');
      x.fillStyle = g;
      x.fillRect(cx - R - 2, cy, R * 0.13, H);
      x.fillRect(cx + R - R * 0.13 + 2, cy, R * 0.13, H);
      x.restore();
      x.strokeStyle = 'rgba(255,255,255,.12)'; x.lineWidth = 1; x.stroke(fan);
      // шкала глубины
      x.fillStyle = 'rgba(255,255,255,.55)'; x.font = '10px "JetBrains Mono", monospace';
      for (let i = 0; i <= 10; i++) {
        const yy = ay + r0 + (rr * 0.92 - r0) * i / 10;
        x.fillRect(W - 18, yy, i % 5 ? 4 : 8, 1);
        if (i % 5 === 0) x.fillText(String(i), W - 30, yy + 4);
      }
      x.fillStyle = 'rgba(200,220,255,.7)'; x.font = '11px "JetBrains Mono", monospace';
      x.fillText('FATYA-SCAN · TV 7.5 MHz', 10, H * 0.14);
      x.fillText('Gn 52  DR 66  FR 28', 10, H * 0.14 + 15);
      x.fillText('MI 0.7  TIs 0.2', 10, H * 0.14 + 30);
      x.textAlign = 'right';
      x.fillText('O-RADS US: 4?', W - 36, H * 0.14);
      x.fillText('CDI: +', W - 36, H * 0.14 + 15);
      x.textAlign = 'left';
    }
  }

  // ---------- HUD ----------
  renderCount() {
    const L = this.level;
    this.hudCount.innerHTML = '';
    for (let i = 0; i < L.count; i++) this.hudCount.appendChild(document.createElement('i'));
    this.updateCount();
    this.hudName.textContent = L.name;
  }
  updateCount() {
    const used = this.level.count - this.left;
    [...this.hudCount.children].forEach((el, i) => el.classList.toggle('used', i >= this.level.count - used));
  }
  updateHudLevels() {
    this.hudLv.forEach((el, i) => {
      el.classList.toggle('done', i < this.levelIdx);
      el.classList.toggle('cur', i === this.levelIdx);
    });
  }
  toast(text, ms = 1100) {
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
  hideCard() { this.card.classList.add('hidden'); this.cardCb = null; }

  // ---------- игра ----------
  throwKnife() {
    if (this.phase !== 'play' || this.flying || this.left <= 0 || this.spawn < 0.6) return;
    Sound.init();
    this.flying = { y: this.baseY, vy: -Math.max(2200, this.H * 3.4) };
    this.left--;
    this.spawn = 0;
    this.thrownOnce = true;
    this.updateCount();
    Sound.fx.throw();
    Haptic.impact('light');
  }

  onHit() {
    const local = normA(Math.PI / 2 - this.rot);
    const hitStuck = this.stuck.some(s => angDist(s.a, local) < this.gap);
    const z = this.level.zone;
    const hitZone = z && angDist(z.a, local) < z.half + this.gap * 0.4;
    if (hitStuck || hitZone) {
      this.phase = 'fail';
      this.falling = { x: this.cx, y: this.cy + this.R + 8, vx: rnd(-260, 260), vy: 380, r: 0, spin: rnd(9, 14) * (Math.random() < 0.5 ? -1 : 1) };
      this.flying = null;
      this.flash = 1;
      Sound.fx.clang();
      Haptic.notify('error');
      this.toast(hitZone ? 'Задела папиллярный компонент! 🩸 Заново' : this.level.item === 'probe' ? 'Датчики столкнулись! Заново 🙈' : 'Дзынь! Скальпели столкнулись. Заново 🙈', 1300);
      setTimeout(() => { if (!this.running) return; this.phase = 'play'; this.resetLevel(); }, 1250);
      return;
    }
    this.stuck.push({ a: local });
    this.flying = null;
    this.bounce = 1;
    this.hitFlash = 1;
    Sound.fx.hit(this.level.kind);
    Haptic.impact('medium');
    this.spray(this.cx, this.cy + this.R, 14);
    if (this.level.kind === 'gb') {
      const k = this.R / 110;
      this.stones.forEach(s => { s.vy -= rnd(260, 520) * k; s.vx += rnd(-170, 170) * k; });
      this.slosh += 10;
    }
    if (this.level.kind === 'cyst') this.echoes.forEach(e => { e.x += rnd(-3, 3); e.y += rnd(-3, 3); });
    const userStuck = this.stuck.filter(s => !s.obstacle).length;
    if (userStuck >= this.level.count) this.win();
  }

  spray(x, y, n) {
    const cols = { rbc: ['#ff3b4f', '#b3001b', '#ff8a9a'], gb: ['#ead04d', '#9ec44a', '#c9a22e'], cyst: ['#ffffff', '#b8c4d6', '#8fa3c0'] }[this.level.kind];
    for (let i = 0; i < n; i++) {
      const a = rnd(0.15, Math.PI - 0.15), v = rnd(120, 420);
      this.particles.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v * 0.6, life: rnd(0.4, 0.8), max: 0.8, r: rnd(1.5, 4), c: cols[i % cols.length] });
    }
  }

  win() {
    this.phase = 'win';
    Sound.fx.burst();
    setTimeout(() => Sound.fx.win(), 250);
    Haptic.notify('success');
    const n = 7;
    this.pieces = Array.from({ length: n }, (_, i) => {
      const a0 = (i / n) * TAU, a1 = ((i + 1) / n) * TAU, am = (a0 + a1) / 2 + this.rot;
      const v = rnd(160, 300);
      return { a0, a1, x: 0, y: 0, vx: Math.cos(am) * v, vy: Math.sin(am) * v - 120, r: 0, spin: rnd(-4, 4), rot0: this.rot };
    });
    this.flyers = this.stuck.map(s => {
      const am = s.a + this.rot, v = rnd(260, 420);
      return { ang: am, x: this.cx + Math.cos(am) * (this.R - this.embed()), y: this.cy + Math.sin(am) * (this.R - this.embed()), vx: Math.cos(am) * v, vy: Math.sin(am) * v - 150, r: 0, spin: rnd(-9, 9) };
    });
    this.spray(this.cx, this.cy, 30);
    if (window.App) App.confetti(this.cx, this.cy);
    setTimeout(() => {
      if (!this.running) return;
      const last = this.levelIdx === KNIFE_LEVELS.length - 1;
      this.showCard({ ico: last ? '🏆' : '🎉', title: this.level.winTitle, text: last ? 'Все три уровня пройдены. Руки хирурга подтверждены!' : 'Отличная точность! Следующий пациент уже ждёт.', btn: 'Дальше' },
        () => this.opts.onLevelDone(this.levelIdx));
    }, 1500);
  }

  embed() { return this.level.item === 'probe' ? this.KL * 0.12 : this.KL * 0.24; }

  update(dt) {
    this.t += dt;
    const omega = this.level.speed(this.t);
    this.omega = omega;
    if (this.phase !== 'win') this.rot += omega * dt;
    this.spawn = Math.min(1, this.spawn + dt / 0.14);
    this.bounce *= Math.exp(-dt * 12);
    this.flash *= Math.exp(-dt * 5);
    this.hitFlash *= Math.exp(-dt * 10);

    if (this.flying) {
      this.flying.y += this.flying.vy * dt;
      if (this.flying.y <= this.cy + this.R - this.embed() * 0.2) this.onHit();
    }
    if (this.falling) {
      const f = this.falling;
      f.vy += 1500 * dt; f.x += f.vx * dt; f.y += f.vy * dt; f.r += f.spin * dt;
      if (f.y > this.H + 200) this.falling = null;
    }
    for (const p of this.particles) { p.vy += 900 * dt; p.x += p.vx * dt; p.y += p.vy * dt; p.life -= dt; }
    this.particles = this.particles.filter(p => p.life > 0);
    for (const p of this.pieces) { p.vy += 700 * dt; p.x += p.vx * dt; p.y += p.vy * dt; p.r += p.spin * dt; }
    for (const f of this.flyers) { f.vy += 900 * dt; f.x += f.vx * dt; f.y += f.vy * dt; f.r += f.spin * dt; }

    if (this.level.kind === 'gb') this.updateStones(dt, omega);
    if (this.level.kind === 'rbc' && this.cells) {
      for (const c of this.cells) { c.x += c.vx * dt; c.y += c.vy * dt; if (c.x > this.W + 40) c.x = -40; if (c.y < -40) c.y = this.H + 40; if (c.y > this.H + 40) c.y = -40; }
    }
  }

  updateStones(dt, omega) {
    const Ri = this.Ri, st = this.stones;
    const g = 820 * (this.R / 110);
    const drag = Math.exp(-1.6 * dt);
    this.slosh = 3 + (this.slosh - 3) * Math.exp(-1.3 * dt);
    for (const s of st) {
      s.vy += g * dt;
      s.vx *= drag; s.vy *= drag;
      s.x += s.vx * dt; s.y += s.vy * dt;
      const d = Math.hypot(s.x, s.y), max = Ri - s.r;
      if (d > max) {
        const nx = s.x / d, ny = s.y / d;
        s.x = nx * max; s.y = ny * max;
        const vn = s.vx * nx + s.vy * ny;
        if (vn > 0) { s.vx -= 1.3 * vn * nx; s.vy -= 1.3 * vn * ny; }
        const tx = -ny, ty = nx;
        const vt = s.vx * tx + s.vy * ty;
        const dv = (omega * Ri - vt) * Math.min(1, 5 * dt);
        s.vx += dv * tx; s.vy += dv * ty;
        s.spin = vt / s.r;
      }
      s.ang += s.spin * dt;
      s.spin *= Math.exp(-0.5 * dt);
    }
    for (let i = 0; i < st.length; i++) for (let j = i + 1; j < st.length; j++) {
      const a = st[i], b = st[j];
      const dx = b.x - a.x, dy = b.y - a.y, d = Math.hypot(dx, dy) || 0.01, m = a.r + b.r;
      if (d < m) {
        const p = (m - d) / 2, nx = dx / d, ny = dy / d;
        a.x -= nx * p; a.y -= ny * p; b.x += nx * p; b.y += ny * p;
        const rv = (b.vx - a.vx) * nx + (b.vy - a.vy) * ny;
        if (rv < 0) { a.vx += rv * nx * 0.5; a.vy += rv * ny * 0.5; b.vx -= rv * nx * 0.5; b.vy -= rv * ny * 0.5; }
      }
    }
    for (const b of this.bubbles) { b.y -= b.v * dt; if (b.y < -Ri * 0.15) { b.y = Ri * 0.8; b.x = rnd(-Ri * 0.6, Ri * 0.6); } }
  }

  // ---------- отрисовка ----------
  drawItem(ctx) {
    if (this.level.item === 'probe') drawProbe(ctx, this.KL, this.KW);
    else drawScalpel(ctx, this.KL, this.KW);
  }

  drawTarget(ctx) {
    const k = this.level.kind;
    if (k === 'rbc') this.drawRbc(ctx);
    else if (k === 'gb') this.drawGb(ctx);
    else this.drawCyst(ctx);
    if (this.hitFlash > 0.02) {
      ctx.beginPath(); ctx.arc(0, 0, this.R, 0, TAU);
      ctx.fillStyle = `rgba(255,255,255,${this.hitFlash * 0.18})`; ctx.fill();
    }
  }

  drawRbc(ctx) {
    const R = this.R;
    ctx.save();
    ctx.shadowColor = 'rgba(0,0,0,.55)'; ctx.shadowBlur = R * 0.3; ctx.shadowOffsetY = R * 0.08;
    ctx.beginPath(); ctx.arc(0, 0, R, 0, TAU); ctx.fillStyle = '#8e0f1c'; ctx.fill();
    ctx.restore();
    const g = ctx.createRadialGradient(0, 0, 0, 0, 0, R);
    g.addColorStop(0, '#e77a7e'); g.addColorStop(0.3, '#d4505a'); g.addColorStop(0.58, '#b01f2c');
    g.addColorStop(0.8, '#cf3542'); g.addColorStop(0.92, '#e65863'); g.addColorStop(1, '#7d0a16');
    ctx.beginPath(); ctx.arc(0, 0, R, 0, TAU); ctx.fillStyle = g; ctx.fill();
    ctx.save();
    ctx.clip();
    ctx.rotate(this.rot);
    for (const s of this.spots) {
      ctx.beginPath(); ctx.arc(s.x, s.y, s.r, 0, TAU);
      ctx.fillStyle = s.dark ? 'rgba(90,0,12,.2)' : 'rgba(255,210,210,.14)'; ctx.fill();
    }
    ctx.beginPath(); ctx.ellipse(R * 0.06, 0, R * 0.5, R * 0.46, 0, 0, TAU);
    ctx.strokeStyle = 'rgba(120,0,18,.35)'; ctx.lineWidth = R * 0.07; ctx.stroke();
    ctx.restore();
    const h = ctx.createRadialGradient(-R * 0.38, -R * 0.42, 0, -R * 0.38, -R * 0.42, R * 0.6);
    h.addColorStop(0, 'rgba(255,255,255,.4)'); h.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = h; ctx.beginPath(); ctx.arc(0, 0, R, 0, TAU); ctx.fill();
    ctx.beginPath(); ctx.arc(0, 0, R * 0.95, Math.PI * 1.05, Math.PI * 1.45);
    ctx.strokeStyle = 'rgba(255,255,255,.35)'; ctx.lineWidth = 2.5; ctx.lineCap = 'round'; ctx.stroke(); ctx.lineCap = 'butt';
  }

  drawGb(ctx) {
    const R = this.R, Ri = this.Ri, t = this.t;
    ctx.save();
    ctx.shadowColor = 'rgba(0,0,0,.6)'; ctx.shadowBlur = R * 0.3; ctx.shadowOffsetY = R * 0.08;
    ctx.beginPath(); ctx.arc(0, 0, R, 0, TAU); ctx.fillStyle = '#3d6a2a'; ctx.fill();
    ctx.restore();
    let g = ctx.createRadialGradient(0, 0, Ri * 0.9, 0, 0, R);
    g.addColorStop(0, '#2c5a26'); g.addColorStop(0.5, '#6f9c45'); g.addColorStop(1, '#2d4f1d');
    ctx.beginPath(); ctx.arc(0, 0, R, 0, TAU); ctx.fillStyle = g; ctx.fill();
    ctx.save(); ctx.rotate(this.rot);
    ctx.strokeStyle = 'rgba(150,30,45,.65)'; ctx.lineWidth = 1.4;
    for (const v of this.veins) { ctx.beginPath(); v.forEach(([x, y], i) => i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)); ctx.stroke(); }
    ctx.fillStyle = 'rgba(220,255,180,.25)';
    for (let i = 0; i < 10; i++) { const a = i * 0.63; ctx.beginPath(); ctx.arc(Math.cos(a) * R * 0.92, Math.sin(a) * R * 0.92, 1.3, 0, TAU); ctx.fill(); }
    ctx.restore();
    // полость
    ctx.save();
    ctx.beginPath(); ctx.arc(0, 0, Ri, 0, TAU); ctx.clip();
    g = ctx.createLinearGradient(0, -Ri, 0, Ri);
    g.addColorStop(0, '#1e3418'); g.addColorStop(1, '#0d1a0b');
    ctx.fillStyle = g; ctx.fillRect(-Ri, -Ri, Ri * 2, Ri * 2);
    for (const s of this.stones) {
      ctx.save(); ctx.translate(s.x, s.y); ctx.rotate(s.ang);
      ctx.beginPath();
      s.verts.forEach((k, i) => { const a = i / s.verts.length * TAU; const px = Math.cos(a) * s.r * k, py = Math.sin(a) * s.r * k; i ? ctx.lineTo(px, py) : ctx.moveTo(px, py); });
      ctx.closePath();
      const sg = ctx.createRadialGradient(-s.r * 0.3, -s.r * 0.3, 0, 0, 0, s.r * 1.1);
      sg.addColorStop(0, s.c1); sg.addColorStop(1, s.c2);
      ctx.fillStyle = sg; ctx.fill();
      ctx.strokeStyle = 'rgba(0,0,0,.4)'; ctx.lineWidth = 1; ctx.stroke();
      ctx.restore();
    }
    const tilt = clamp((this.omega || 0) * 0.07, -0.25, 0.25);
    const y0 = -Ri * 0.08, A = this.slosh;
    const wave = x => y0 + A * Math.sin(x * 0.05 + t * 3.1) + A * 0.6 * Math.sin(x * 0.085 - t * 2.3) + tilt * x;
    ctx.beginPath();
    ctx.moveTo(-Ri, wave(-Ri));
    for (let x = -Ri; x <= Ri; x += 5) ctx.lineTo(x, wave(x));
    ctx.lineTo(Ri, Ri); ctx.lineTo(-Ri, Ri); ctx.closePath();
    g = ctx.createLinearGradient(0, -Ri * 0.2, 0, Ri);
    g.addColorStop(0, 'rgba(240,205,70,.72)'); g.addColorStop(1, 'rgba(165,120,25,.88)');
    ctx.fillStyle = g; ctx.fill();
    ctx.beginPath();
    for (let x = -Ri; x <= Ri; x += 5) x === -Ri ? ctx.moveTo(x, wave(x)) : ctx.lineTo(x, wave(x));
    ctx.strokeStyle = 'rgba(255,245,170,.85)'; ctx.lineWidth = 2; ctx.stroke();
    ctx.fillStyle = 'rgba(255,250,200,.5)';
    for (const b of this.bubbles) if (b.y > wave(b.x) + 4) { ctx.beginPath(); ctx.arc(b.x, b.y, b.r, 0, TAU); ctx.fill(); }
    ctx.restore();
    ctx.beginPath(); ctx.arc(0, 0, Ri, 0, TAU); ctx.strokeStyle = 'rgba(0,0,0,.4)'; ctx.lineWidth = 3; ctx.stroke();
    const h = ctx.createRadialGradient(-R * 0.4, -R * 0.45, 0, -R * 0.4, -R * 0.45, R * 0.7);
    h.addColorStop(0, 'rgba(255,255,255,.35)'); h.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = h; ctx.beginPath(); ctx.arc(0, 0, R, 0, TAU); ctx.fill();
  }

  drawCyst(ctx) {
    const R = this.R;
    ctx.save();
    ctx.rotate(this.rot);
    // стенка — тонкая эхогенная капсула
    ctx.beginPath(); ctx.arc(0, 0, R, 0, TAU); ctx.arc(0, 0, R * 0.9, 0, TAU, true);
    ctx.fillStyle = ctx.createPattern(this.speckleBright, 'repeat'); ctx.fill();
    ctx.beginPath(); ctx.arc(0, 0, R * 0.955, 0, TAU);
    ctx.strokeStyle = 'rgba(255,255,255,.55)'; ctx.lineWidth = 2; ctx.stroke();
    // анэхогенное содержимое
    const g = ctx.createRadialGradient(0, 0, 0, 0, 0, R * 0.9);
    g.addColorStop(0, '#060606'); g.addColorStop(0.85, '#0b0b0b'); g.addColorStop(1, '#2a2a2a');
    ctx.beginPath(); ctx.arc(0, 0, R * 0.9, 0, TAU); ctx.fillStyle = g; ctx.fill();
    // тонкая перегородка и взвесь
    ctx.beginPath(); ctx.moveTo(-R * 0.86, R * 0.2); ctx.quadraticCurveTo(-R * 0.3, -R * 0.05, R * 0.15, -R * 0.86);
    ctx.strokeStyle = 'rgba(210,210,210,.5)'; ctx.lineWidth = 1.4; ctx.stroke();
    for (const e of this.echoes) {
      ctx.fillStyle = `rgba(${e.v},${e.v},${e.v},.8)`;
      ctx.beginPath(); ctx.ellipse(e.x, e.y, e.r * 1.6, e.r, 0, 0, TAU); ctx.fill();
    }
    // папиллярный компонент с кровотоком — зона, куда нельзя
    const z = this.level.zone;
    if (z) {
      ctx.beginPath();
      this.papilla.forEach(([x, y], i) => i ? ctx.lineTo(x, y) : ctx.moveTo(x, y));
      ctx.arc(0, 0, R * 0.9, z.a + z.half * 0.9, z.a - z.half * 0.9, true);
      ctx.closePath();
      ctx.fillStyle = '#9a9a9a'; ctx.fill();
      ctx.fillStyle = ctx.createPattern(this.speckleBright, 'repeat'); ctx.globalAlpha = 0.85; ctx.fill(); ctx.globalAlpha = 1;
      ctx.strokeStyle = 'rgba(255,255,255,.6)'; ctx.lineWidth = 1.2; ctx.stroke();
      for (const f of this.flow) {
        const k = 0.5 + 0.5 * Math.sin(this.t * 7 + f.ph);
        ctx.globalAlpha = 0.35 + 0.65 * k;
        ctx.fillStyle = f.ph > Math.PI ? '#ff2a2a' : '#2a7bff';
        ctx.beginPath(); ctx.ellipse(f.x, f.y, f.r * 1.4, f.r, f.ph, 0, TAU); ctx.fill();
      }
      ctx.globalAlpha = 1;
      const pulse = 0.45 + 0.35 * Math.sin(this.t * 5);
      ctx.beginPath(); ctx.arc(0, 0, R + 4, z.a - z.half, z.a + z.half);
      ctx.strokeStyle = `rgba(255,60,85,${pulse})`; ctx.lineWidth = 8; ctx.lineCap = 'round'; ctx.stroke(); ctx.lineCap = 'butt';
    }
    ctx.restore();
  }

  render() {
    const ctx = this.ctx, dpr = this.dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const W = this.W, H = this.H;
    ctx.drawImage(this.bgC, 0, 0, W, H);
    const kind = this.level.kind;
    if (kind === 'rbc' && this.cells) {
      for (const c of this.cells) { ctx.globalAlpha = c.a; ctx.drawImage(this.rbcSprite, c.x - c.r, c.y - c.r, c.r * 2, c.r * 2); }
      ctx.globalAlpha = 1;
    }
    if (kind === 'cyst' && this.fan) {
      ctx.save(); ctx.clip(this.fan);
      ctx.globalAlpha = 0.1;
      const ox = Math.floor(Math.random() * 256), oy = Math.floor(Math.random() * 256);
      ctx.translate(-ox, -oy);
      ctx.fillStyle = ctx.createPattern(this.speckle, 'repeat'); ctx.fillRect(0, 0, W + 256, H + 256);
      ctx.restore();
    }
    const cx = this.cx, cy = this.cy - this.bounce * 7;
    const embed = this.embed();

    if (this.phase !== 'win') {
      for (const s of this.stuck) {
        ctx.save();
        ctx.translate(cx, cy); ctx.rotate(s.a + this.rot); ctx.translate(this.R - embed, 0); ctx.rotate(-Math.PI / 2);
        this.drawItem(ctx);
        ctx.restore();
      }
      ctx.save(); ctx.translate(cx, cy); this.drawTarget(ctx); ctx.restore();
    } else {
      for (const p of this.pieces) {
        ctx.save();
        ctx.translate(cx + p.x, cy + p.y); ctx.rotate(p.r);
        ctx.beginPath(); ctx.moveTo(0, 0); ctx.arc(0, 0, this.R + 2, p.a0 + p.rot0, p.a1 + p.rot0); ctx.closePath(); ctx.clip();
        this.drawTarget(ctx);
        ctx.restore();
      }
      for (const f of this.flyers) {
        ctx.save(); ctx.translate(f.x, f.y); ctx.rotate(f.ang - Math.PI / 2 + f.r); this.drawItem(ctx); ctx.restore();
      }
    }

    if (this.flying) { ctx.save(); ctx.translate(cx, this.flying.y); this.drawItem(ctx); ctx.restore(); }
    if (this.phase === 'play' || this.phase === 'ready') {
      if (this.left > 0 && !this.flying) {
        const e = this.spawn;
        ctx.save(); ctx.globalAlpha = e; ctx.translate(cx, this.baseY + (1 - e) * 50); this.drawItem(ctx); ctx.restore();
      }
    }
    if (this.falling) {
      const f = this.falling;
      ctx.save(); ctx.translate(f.x, f.y); ctx.rotate(f.r); this.drawItem(ctx); ctx.restore();
    }
    for (const p of this.particles) {
      ctx.globalAlpha = clamp(p.life / p.max, 0, 1);
      ctx.fillStyle = p.c; ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, TAU); ctx.fill();
    }
    ctx.globalAlpha = 1;
    if (!this.thrownOnce && this.phase === 'play') {
      const a = 0.55 + 0.45 * Math.sin(this.t * 5);
      ctx.fillStyle = `rgba(255,255,255,${a})`;
      ctx.font = '700 16px Manrope, sans-serif'; ctx.textAlign = 'center';
      ctx.fillText('👆 тапни, чтобы бросить', W / 2, this.baseY - 24);
      ctx.textAlign = 'left';
    }
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
