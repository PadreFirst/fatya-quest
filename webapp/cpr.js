// Этап 3 · Реанимация: довести пациента до стабильного состояния (полоска «Состояние»)
// и дать разряд. Компрессии в ритм (по мотивам ритм-игр osu!/Piano Tiles), вдохи мешком
// Амбу и разряд — всё с узкими окнами. Ошибки и бездействие откатывают состояние назад,
// на нуле — асистолия.
const CPR_BPM = 110;
const CPR_I = 60 / CPR_BPM;        // интервал между компрессиями, с
const CPR_COUNT = 20;              // ударов в цикле, потом 2 вдоха и адреналин
const CPR_PERFECT = 0.06, CPR_GOOD = 0.11; // окна попадания по ритму, с
const BREATH_MIN = 0.85, BREATH_MAX = 1.15, BREATH_SCALE = 2.0, BREATH_RATE = 1.3; // окно вдоха (объём), скорость наполнения
const ADREN_SPEED = TAU * 0.65, ADREN_HALF = 0.4; // стрелка адреналина: оборотов/с, полуширина зелёного сектора (рад)
const SHOCK_MIN = 150, SHOCK_MAX = 200, SHOCK_SCALE = 360, SHOCK_RATE = 140; // Дж, Дж/с
const HP = { start: 35, goal: 74, decay: 0.6, perfect: 0.95, good: 0.6, bad: -3, miss: -1.5, breath: 5, breathBad: -6, adren: 8, adrenBad: -5, shockBad: -20 };
const ECG_HZ = 150;

class CprGame {
  constructor(root, opts) {
    this.root = root; this.opts = opts;
    this.canvas = root.querySelector('canvas');
    this.ctx = this.canvas.getContext('2d');
    this.btn = root.querySelector('.cpr-btn');
    this.toastEl = root.querySelector('.k-toast');
    this.card = root.querySelector('.k-card');
    this.cardBtn = this.card.querySelector('button');
    this.cardBtn.addEventListener('click', () => { Haptic.impact('light'); const cb = this.cardCb; this.card.classList.add('hidden'); this.cardCb = null; cb && cb(); });
    this.running = false;
    this.canvas.addEventListener('pointerdown', e => { e.preventDefault(); Sound.init(); this.tapChest(); });
    this.btn.addEventListener('pointerdown', e => { e.preventDefault(); Sound.init(); this.btnDown(); });
    const up = () => this.btnUp();
    this.btn.addEventListener('pointerup', up);
    this.btn.addEventListener('pointercancel', up);
    this.btn.addEventListener('pointerleave', up);
    this.btn.addEventListener('contextmenu', e => e.preventDefault());
    window.addEventListener('resize', () => { if (this.running) this.resize(); });
  }

  start() {
    this.running = true;
    this.resize();
    this.reset();
    this.showCard({
      ico: '🫀', title: 'Сердечно-лёгочная реанимация',
      text: `Доведи «Состояние пациента» до ${HP.goal}% — тогда понадобится дефибриллятор. Тапай по груди, когда кольцо совпадёт с руками (${CPR_BPM}/мин, как в «Stayin' Alive» 🕺). После ${CPR_COUNT} ударов — 2 вдоха мешком Амбу (держи и отпусти в зелёной зоне) и адреналин (останови стрелку в зелёном секторе). Разряд: держи — копится заряд, отпусти в зелёной зоне. Ошибки откатывают состояние назад, а на нуле пациента уже не спасти.`,
      btn: 'Начинаю СЛР!',
    }, () => this.beginComp());
    this.last = performance.now();
    if (!this.raf) this.loop();
  }

  stop() {
    this.running = false;
    ['breath', 'whine', 'flat'].forEach(k => Sound.loopStop(k));
    clearTimeout(this.timer);
    if (this.raf) cancelAnimationFrame(this.raf);
    this.raf = null;
  }

  resize() {
    const r = this.canvas.getBoundingClientRect();
    if (!r.width) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    this.dpr = dpr; this.W = r.width; this.H = r.height;
    this.canvas.width = Math.round(r.width * dpr); this.canvas.height = Math.round(r.height * dpr);
    this.mon = { x: 10, y: 10, w: this.W - 20, h: Math.max(100, this.H * 0.17) };
    this.hpBar = { x: 14, y: this.mon.y + this.mon.h + 10, w: this.W - 28, h: 16 };
    const top = this.hpBar.y + 46, bottom = this.H - 150;
    this.s = Math.min(this.W * 0.8, (bottom - top) * 0.95);
    this.cx = this.W / 2;
    this.cy = top + (bottom - top) * 0.55;
    this.ecgN = Math.round(ECG_HZ * 4);
    if (!this.ecg || this.ecg.length !== this.ecgN) this.ecg = new Float32Array(this.ecgN).fill(NaN);
  }

  reset() {
    this.t = 0; this.cycle = 0; this.mode = 'idle'; this.beat0 = 0;
    this.hp = HP.start; this.hpShown = HP.start; this.hpFlash = 0; this.hpTexts = [];
    this.press = 0; this.fill = 0; this.flash = 0; this.jolt = 0; this.padsT = 0;
    this.comps = []; this.consumed = new Set(); this.lastBeat = -1; this.nextJudge = 0;
    this.judges = []; this.crunched = false; this.holding = false; this.lastHold = 0; this.lastCharge = 0;
    this.ecgT = this.ecgT || 0; this.ecgW = this.ecgW || 0; this.alarmT = 1; this.roscT = null; this.deadT = null; this.lastR = -1;
    this.btn.classList.add('hidden');
    Sound.loopStop('flat');
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

  toast(text, ms = 1400) {
    this.toastEl.textContent = text;
    this.toastEl.classList.add('show');
    clearTimeout(this.toastT);
    this.toastT = setTimeout(() => this.toastEl.classList.remove('show'), ms);
  }

  judge(text, color) { this.judges.push({ text, color, life: 0.7 }); }

  setBtn(text, cls) {
    this.btn.textContent = text;
    this.btn.className = 'cpr-btn' + (cls ? ' ' + cls : '');
  }

  later(ms, fn) { clearTimeout(this.timer); this.timer = setTimeout(() => { if (this.running) fn(); }, ms); }

  // ---------- состояние пациента ----------
  active() { return ['comp', 'breath', 'adren', 'wait', 'analyze', 'charge', 'charging'].includes(this.mode); }

  heal(d, show = true) {
    if (!this.active()) return;
    this.hp = clamp(this.hp + d, 0, 100);
    if (show) this.hpTexts.push({ text: (d > 0 ? '+' : '') + (Math.round(d * 10) / 10), good: d > 0, life: 0.9 });
    if (d < 0 && show) this.hpFlash = 1;
    if (this.hp <= 0) this.die();
    else if (this.hp >= HP.goal && (this.mode === 'comp' || this.mode === 'breath' || this.mode === 'adren' || (this.mode === 'wait' && !this.lastCharge))) this.stabilized();
  }

  stabilized() {
    this.mode = 'stable';
    this.holding = false; this.btn.classList.remove('on'); Sound.loopStop('breath');
    this.btn.classList.add('hidden');
    Sound.fx.lock(); Haptic.notify('success');
    this.toast('Состояние стабилизировано! Готовь дефибриллятор ⚡', 1800);
    this.later(1300, () => this.beginAed());
  }

  die() {
    this.mode = 'dead';
    this.holding = false; this.btn.classList.remove('on'); Sound.loopStop('breath'); Sound.loopStop('whine');
    this.btn.classList.add('hidden');
    this.deadT = this.ecgT;
    Haptic.notify('error');
    Sound.loop('flat', { osc: 'sine', freq: 980 }, 0.07);
    this.later(2200, () => {
      Sound.loopStop('flat');
      this.showCard({ ico: '😔', title: 'Пациента не удалось спасти', text: 'Асистолия… Ритм сбился, а время шло. Ничего — реанимация командный спорт. Соберись: ритм, вдох в зелёную зону, разряд в зелёную зону.', btn: 'Ещё попытка' },
        () => { this.reset(); this.beginComp(); });
    });
  }

  // ---------- фазы ----------
  beginComp() {
    this.mode = 'comp'; this.cycle++; this.lastCharge = 0; this.breathTries = 0; this.lastHold = 0;
    this.beat0 = this.t + 1.2;
    this.consumed = new Set(); this.lastBeat = -1; this.nextJudge = 0;
    this.btn.classList.add('hidden');
    this.toast(`Цикл ${this.cycle}: ${CPR_COUNT} компрессий в ритм`, 1100);
  }

  beginBreath() {
    this.mode = 'breath'; this.breaths = 0; this.breathTries = 0; this.holding = false;
    this.setBtn('🫁 АМБУ — зажми и держи');
    this.toast('2 вдоха: отпусти, когда шкала в зелёной зоне', 1600);
    Sound.fx.pop();
  }

  beginAed() {
    this.mode = 'analyze'; this.anT = 0;
    this.btn.classList.add('hidden');
    this.toast('AED: анализ ритма… не прикасайтесь!', 1800);
    Sound.fx.ready();
  }

  tNow() { return this.t + (performance.now() - this.last) / 1000; }

  tapChest() {
    if (this.mode === 'adren') { this.stopSpinner(); return; }
    if (this.mode !== 'comp') return;
    const t = this.tNow();
    const k = clamp(Math.round((t - this.beat0) / CPR_I), 0, CPR_COUNT - 1);
    const dt = t - (this.beat0 + k * CPR_I);
    this.press = 1;
    this.comps.push(this.ecgT);
    if (this.consumed.has(k) || Math.abs(dt) > CPR_GOOD) {
      Sound.fx.thump(false); Sound.fx.miss(); Haptic.impact('light');
      this.judge(this.consumed.has(k) ? 'Слишком часто' : dt < 0 ? 'Рано' : 'Поздно', '#ff6b7f');
      this.heal(HP.bad);
      return;
    }
    this.consumed.add(k);
    const perfect = Math.abs(dt) <= CPR_PERFECT;
    Sound.fx.thump(true); Haptic.impact(perfect ? 'heavy' : 'medium');
    this.judge(perfect ? 'Отлично!' : 'Хорошо', perfect ? '#6dff9a' : '#ffd166');
    this.heal(perfect ? HP.perfect : HP.good, false);
    if (this.cycle === 1 && this.consumed.size === 9 && !this.crunched) {
      this.crunched = true; Sound.fx.crunch();
      this.toast('Хруст… значит, глубина правильная 😬', 1600);
    }
  }

  btnDown() {
    if (this.mode === 'adren') { this.stopSpinner(); return; }
    if (this.mode === 'breath' && !this.holding) {
      this.holding = true; this.holdT = 0;
      this.btn.classList.add('on');
      Haptic.impact('soft');
    } else if (this.mode === 'charge') {
      this.mode = 'charging'; this.chJ = 0;
      this.setBtn('Заряжаю… отпусти в зелёной зоне', 'busy on');
    }
  }

  btnUp() {
    if (this.mode === 'breath' && this.holding) this.endBreath();
    else if (this.mode === 'charging') this.shock();
  }

  endBreath() {
    this.holding = false;
    this.btn.classList.remove('on');
    Sound.loopStop('breath'); Sound.fx.exhale();
    const h = this.holdT;
    this.lastHold = h; clearTimeout(this.lhT); this.lhT = setTimeout(() => { this.lastHold = 0; }, 900);
    this.breathTries++;
    if (h >= BREATH_MIN && h <= BREATH_MAX) {
      this.breaths++;
      Haptic.notify('success');
      this.judge('Вдох ✓', '#6dff9a');
      this.heal(HP.breath);
    } else {
      Haptic.notify('warning'); Sound.fx.miss();
      this.toast(h < BREATH_MIN ? 'Маловато воздуха — грудь не поднялась' : 'Перераздула! Помягче 🎈', 1200);
      this.heal(HP.breathBad);
    }
    if (this.mode === 'breath' && this.breathTries >= 2) {
      this.mode = 'wait';
      this.btn.classList.add('hidden');
      this.later(700, () => this.beginAdrenaline());
    }
  }

  shock() {
    const J = this.chJ;
    Sound.loopStop('whine');
    this.btn.classList.add('hidden');
    this.lastCharge = J;
    this.flash = 1; this.jolt = 1;
    Sound.fx.zap(); Haptic.notify('error');
    setTimeout(() => Haptic.impact('heavy'), 120);
    if (J < SHOCK_MIN || J > SHOCK_MAX) {
      this.mode = 'wait';
      this.toast(J < SHOCK_MIN ? `Только ${Math.round(J)} Дж — не хватило! Продолжай СЛР` : `${Math.round(J)} Дж — перебор, ожог! Продолжай СЛР`, 1900);
      this.later(1500, () => { this.heal(HP.shockBad); if (this.mode === 'wait') this.beginComp(); });
      return;
    }
    this.mode = 'rosc';
    this.roscT = this.ecgT + 0.9;
    setTimeout(() => { if (this.running) { this.toast(`${Math.round(J)} Дж — синусовый ритм! ROSC 🫀`, 1800); Sound.fx.fanfare(); } }, 1400);
    this.later(4200, () => {
      if (window.App) App.confetti(this.W / 2, this.H * 0.45, ['#ff4f7b', '#6dff9a', '#fff']);
      this.showCard({ ico: '🏆', title: 'Пациент спасён!', text: 'Синусовый ритм, давление 120/80, пациент открыл глаза и спрашивает, где его тапочки. Реаниматологи аплодируют стоя.', btn: 'Дальше' }, () => this.opts.onDone());
    });
  }

  // ---------- ЭКГ ----------
  ecgVal(ts) {
    if (this.deadT !== null && ts >= this.deadT) return (Math.random() - 0.5) * 0.02;
    if (this.roscT !== null && ts >= this.roscT - 0.9) {
      if (ts < this.roscT) return (Math.random() - 0.5) * 0.03;
      const RR = 0.77, ph = (ts - this.roscT) % RR;
      const gs = (c, w) => Math.exp(-Math.pow((ph - c) / w, 2));
      return 0.12 * gs(0.08, 0.025) - 0.12 * gs(0.17, 0.008) + 1.1 * gs(0.19, 0.011) - 0.3 * gs(0.21, 0.01) + 0.25 * gs(0.42, 0.05);
    }
    const amp = 0.45 + 0.6 * this.hp / 100; // мелковолновая ФЖ → крупноволновая по мере улучшения
    let v = amp * (0.32 * Math.sin(TAU * 4.7 * ts) * (0.55 + 0.45 * Math.sin(TAU * 0.63 * ts)) + 0.18 * Math.sin(TAU * 7.3 * ts + 1)) + 0.06 * (Math.random() - 0.5);
    for (let i = this.comps.length - 1; i >= 0; i--) {
      const d = ts - this.comps[i];
      if (d > 0.3) break;
      if (d >= 0) v += 0.95 * Math.sin(Math.PI * d / 0.3);
    }
    return v;
  }

  // ---------- цикл ----------
  update(dt) {
    this.t += dt;
    this.press *= Math.exp(-dt * 9);
    this.flash *= Math.exp(-dt * 4);
    this.jolt *= Math.exp(-dt * 5);
    this.hpFlash *= Math.exp(-dt * 4);
    this.hpShown += (this.hp - this.hpShown) * (1 - Math.exp(-dt * 8));
    for (const j of this.judges) j.life -= dt;
    this.judges = this.judges.filter(j => j.life > 0);
    for (const h of this.hpTexts) h.life -= dt;
    this.hpTexts = this.hpTexts.filter(h => h.life > 0);
    if (['analyze', 'charge', 'charging', 'rosc'].includes(this.mode) || (this.mode === 'wait' && this.lastCharge)) this.padsT = Math.min(1, this.padsT + dt * 2);
    else if (this.mode === 'comp') this.padsT = Math.max(0, this.padsT - dt * 2);

    // пациент ухудшается сам по себе
    if (this.active() && this.t > this.beat0) this.heal(-HP.decay * dt, false);

    if (this.mode === 'comp') {
      const k = Math.floor((this.t - this.beat0) / CPR_I);
      if (k > this.lastBeat && k >= 0 && k < CPR_COUNT) { this.lastBeat = k; Sound.fx.metro(k % 10 === 0); }
      // пропущенные удары
      while (this.mode === 'comp' && this.nextJudge < CPR_COUNT && this.t > this.beat0 + this.nextJudge * CPR_I + CPR_GOOD) {
        if (!this.consumed.has(this.nextJudge)) { this.judge('Пропуск', '#ff9a6b'); this.heal(HP.miss); }
        this.nextJudge++;
      }
      if (this.mode === 'comp' && this.nextJudge >= CPR_COUNT) { this.mode = 'wait'; this.later(400, () => this.beginBreath()); }
    }
    if (this.mode === 'breath' && this.holding) {
      this.holdT += dt * BREATH_RATE;
      this.fill = Math.min(1, this.holdT / 1.0);
      Sound.loop('breath', { filter: 'lowpass', freq: 300, q: 0.7 }, 0.22, 300 + 900 * this.fill);
      if (this.holdT >= BREATH_SCALE) this.endBreath();
    }
    if (!this.holding) this.fill *= Math.exp(-dt * 3);
    if (this.mode === 'adren') this.spA += ADREN_SPEED * dt;
    if (this.spRes) this.spRes.life -= dt;
    if (this.mode === 'analyze') {
      this.anT += dt;
      if (this.anT > 2.4) { this.mode = 'charge'; this.setBtn('⚡ ЗАРЯД — держи', 'charge'); this.toast('Разряд показан! Держи кнопку и отпусти в зелёной зоне', 1800); Sound.fx.ready(); }
    }
    if (this.mode === 'charging') {
      this.chJ += SHOCK_RATE * dt;
      Sound.loop('whine', { osc: 'sine', freq: 400 }, 0.12, 400 + 2600 * Math.min(1, this.chJ / SHOCK_SCALE));
      if (this.chJ >= SHOCK_SCALE) { this.chJ = SHOCK_SCALE; this.shock(); }
    }
    // тревога монитора, пока ритм не восстановлен (не мешаем метроному)
    if (this.roscT === null && this.deadT === null && this.mode !== 'comp' && this.mode !== 'idle') {
      this.alarmT -= dt;
      if (this.alarmT <= 0) { Sound.fx.alarm(); this.alarmT = 2.4; }
    }
    // ЭКГ: пишем отсчёты «бегущим» маркером
    const n = Math.round((this.ecgT + dt) * ECG_HZ) - Math.round(this.ecgT * ECG_HZ);
    for (let i = 0; i < n; i++) {
      const ts = this.ecgT + i / ECG_HZ;
      this.ecg[this.ecgW] = this.ecgVal(ts);
      this.ecgW = (this.ecgW + 1) % this.ecgN;
      for (let g = 1; g <= 10; g++) this.ecg[(this.ecgW + g) % this.ecgN] = NaN;
    }
    this.ecgT += dt;
    if (this.roscT !== null && this.ecgT > this.roscT) {
      const idx = Math.floor((this.ecgT - this.roscT - 0.19) / 0.77);
      if (idx > this.lastR && idx >= 0) { this.lastR = idx; Sound.fx.monBeep(); }
    }
  }

  drawMonitor(ctx) {
    const m = this.mon;
    ctx.fillStyle = '#03110a'; rrect(ctx, m.x, m.y, m.w, m.h, 12); ctx.fill();
    ctx.strokeStyle = '#1d3b2b'; ctx.lineWidth = 2; ctx.stroke();
    const gx = m.x + 8, gw = m.w * 0.7, gy = m.y + 10, gh = m.h - 20;
    ctx.save(); ctx.beginPath(); ctx.rect(gx, gy, gw, gh); ctx.clip();
    ctx.strokeStyle = 'rgba(60,140,90,.15)'; ctx.lineWidth = 1;
    for (let x = gx; x < gx + gw; x += 12) { ctx.beginPath(); ctx.moveTo(x, gy); ctx.lineTo(x, gy + gh); ctx.stroke(); }
    for (let y = gy; y < gy + gh; y += 12) { ctx.beginPath(); ctx.moveTo(gx, y); ctx.lineTo(gx + gw, y); ctx.stroke(); }
    ctx.strokeStyle = '#39ff8a'; ctx.lineWidth = 2; ctx.shadowColor = '#39ff8a'; ctx.shadowBlur = 6;
    ctx.beginPath();
    let pen = false;
    for (let i = 0; i < this.ecgN; i++) {
      const v = this.ecg[i];
      const x = gx + i / this.ecgN * gw, y = gy + gh * 0.55 - v * gh * 0.38;
      if (isNaN(v)) { pen = false; continue; }
      pen ? ctx.lineTo(x, y) : ctx.moveTo(x, y); pen = true;
    }
    ctx.stroke(); ctx.shadowBlur = 0;
    ctx.restore();
    const rx = gx + gw + 10;
    const rosc = this.roscT !== null && this.ecgT > this.roscT;
    ctx.fillStyle = '#39ff8a'; ctx.font = '700 10px "JetBrains Mono", monospace';
    ctx.fillText('ЧСС', rx, m.y + 20);
    ctx.font = '800 26px "JetBrains Mono", monospace';
    ctx.fillText(rosc ? '78' : '---', rx, m.y + 48);
    ctx.font = '700 10px "JetBrains Mono", monospace';
    if (rosc) { ctx.fillStyle = '#39ff8a'; ctx.fillText('СИНУС', rx, m.y + 66); ctx.fillStyle = '#5fd0ff'; ctx.fillText('SpO₂ 94', rx, m.y + 82); }
    else if (this.deadT !== null) { ctx.fillStyle = '#ff3b5c'; ctx.fillText('АСИСТОЛИЯ', rx, m.y + 66); }
    else if (Math.sin(this.t * 8) > 0) { ctx.fillStyle = '#ff3b5c'; ctx.fillText('ФЖ !!!', rx, m.y + 66); }
  }

  drawPatient(ctx) {
    const s = this.s, cx = this.cx, jolt = this.jolt;
    const cy = this.cy - Math.sin(this.t * 40) * jolt * 6;
    const tw = s * 0.56, th = s * 0.6;
    const top = cy - th * 0.45;
    const rosc = this.roscT !== null && this.ecgT > this.roscT + 1;
    const pale = rosc ? 0 : clamp(1 - this.hp / 100, 0, 1); // синюшность уходит по мере улучшения
    const skinG = (x0, y0, x1, y1, a, b) => { const g = ctx.createLinearGradient(x0, y0, x1, y1); g.addColorStop(0, a || '#f0c3a0'); g.addColorStop(1, b || '#c98d68'); return g; };
    ctx.save();
    // тень на полу
    ctx.fillStyle = 'rgba(0,0,0,.4)';
    ctx.beginPath(); ctx.ellipse(cx, cy + th * 0.15, tw * 0.95, th * 0.95, 0, 0, TAU); ctx.fill();
    // джинсы
    const wy = top + th * 0.98;
    ctx.fillStyle = skinG(cx - tw * 0.45, 0, cx + tw * 0.45, 0, '#4a6fa8', '#2b4677');
    rrect(ctx, cx - tw * 0.42, wy - 4, tw * 0.84, th * 0.4, 10); ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,.35)'; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(cx, wy + th * 0.08); ctx.lineTo(cx, wy + th * 0.4); ctx.stroke();
    ctx.fillStyle = '#3a2a1e'; ctx.fillRect(cx - tw * 0.42, wy - 4, tw * 0.84, 7);
    ctx.fillStyle = '#c9a24a'; rrect(ctx, cx - 7, wy - 5, 14, 9, 2); ctx.fill();
    // руки вдоль тела
    for (const side of [-1, 1]) {
      const sx = cx + side * tw * 0.47, sy = top + th * 0.1;
      const ex = cx + side * tw * 0.66, ey = top + th * 0.55;
      const hx = cx + side * tw * 0.62, hy = top + th * 1.0;
      ctx.lineCap = 'round'; ctx.lineJoin = 'round';
      ctx.strokeStyle = 'rgba(90,50,30,.55)'; ctx.lineWidth = s * 0.125;
      ctx.beginPath(); ctx.moveTo(sx, sy); ctx.quadraticCurveTo(ex, ey - th * 0.15, ex, ey); ctx.quadraticCurveTo(ex, ey + th * 0.2, hx, hy); ctx.stroke();
      ctx.strokeStyle = skinG(sx - s * 0.06, 0, sx + s * 0.06, 0); ctx.lineWidth = s * 0.11;
      ctx.stroke();
      ctx.fillStyle = skinG(hx - s * 0.05, hy, hx + s * 0.05, hy + s * 0.08);
      ctx.beginPath(); ctx.ellipse(hx, hy + s * 0.045, s * 0.05, s * 0.07, side * 0.15, 0, TAU); ctx.fill();
      ctx.strokeStyle = 'rgba(120,70,45,.4)'; ctx.lineWidth = 1;
      for (let f = -1; f <= 1; f++) { ctx.beginPath(); ctx.moveTo(hx + f * s * 0.017, hy + s * 0.07); ctx.lineTo(hx + f * s * 0.019, hy + s * 0.105); ctx.stroke(); }
    }
    // голова и шея
    const hr = s * 0.115, hy = top - hr * 0.95;
    ctx.fillStyle = skinG(cx - hr * 0.4, 0, cx + hr * 0.4, 0, '#d9a27c', '#b77e5a');
    rrect(ctx, cx - hr * 0.42, hy + hr * 0.6, hr * 0.84, hr * 0.8, hr * 0.2); ctx.fill();
    ctx.fillStyle = '#e2ad88';
    ctx.beginPath(); ctx.ellipse(cx - hr * 0.88, hy + hr * 0.05, hr * 0.14, hr * 0.24, 0, 0, TAU); ctx.fill();
    ctx.beginPath(); ctx.ellipse(cx + hr * 0.88, hy + hr * 0.05, hr * 0.14, hr * 0.24, 0, 0, TAU); ctx.fill();
    let g = ctx.createRadialGradient(cx - hr * 0.25, hy - hr * 0.2, hr * 0.1, cx, hy, hr * 1.1);
    g.addColorStop(0, '#f6cfae'); g.addColorStop(1, '#cf9670');
    ctx.fillStyle = g; ctx.beginPath(); ctx.ellipse(cx, hy, hr * 0.85, hr * 1.02, 0, 0, TAU); ctx.fill();
    if (pale > 0.02) { ctx.fillStyle = `rgba(120,150,200,${pale * 0.45})`; ctx.beginPath(); ctx.ellipse(cx, hy, hr * 0.85, hr * 1.02, 0, 0, TAU); ctx.fill(); }
    // волосы
    ctx.fillStyle = '#3d2a1f';
    ctx.beginPath();
    ctx.moveTo(cx - hr * 0.86, hy - hr * 0.05);
    ctx.bezierCurveTo(cx - hr * 1.0, hy - hr * 1.45, cx + hr * 1.0, hy - hr * 1.5, cx + hr * 0.86, hy - hr * 0.05);
    ctx.quadraticCurveTo(cx + hr * 0.7, hy - hr * 0.5, cx + hr * 0.2, hy - hr * 0.62);
    ctx.quadraticCurveTo(cx - hr * 0.3, hy - hr * 0.42, cx - hr * 0.86, hy - hr * 0.05);
    ctx.fill();
    // лицо
    ctx.strokeStyle = '#4a2e20'; ctx.lineCap = 'round'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(cx - hr * 0.55, hy - hr * 0.22); ctx.quadraticCurveTo(cx - hr * 0.35, hy - hr * 0.32, cx - hr * 0.15, hy - hr * 0.24);
    ctx.moveTo(cx + hr * 0.55, hy - hr * 0.22); ctx.quadraticCurveTo(cx + hr * 0.35, hy - hr * 0.32, cx + hr * 0.15, hy - hr * 0.24); ctx.stroke();
    if (rosc) {
      for (const sx of [-1, 1]) {
        ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.ellipse(cx + sx * hr * 0.35, hy - hr * 0.05, hr * 0.15, hr * 0.1, 0, 0, TAU); ctx.fill();
        ctx.fillStyle = '#3b6fa0'; ctx.beginPath(); ctx.arc(cx + sx * hr * 0.35, hy - hr * 0.05, hr * 0.07, 0, TAU); ctx.fill();
        ctx.fillStyle = '#111'; ctx.beginPath(); ctx.arc(cx + sx * hr * 0.35, hy - hr * 0.05, hr * 0.035, 0, TAU); ctx.fill();
      }
      ctx.strokeStyle = '#9b4a3f'; ctx.lineWidth = 2.5;
      ctx.beginPath(); ctx.arc(cx, hy + hr * 0.35, hr * 0.25, 0.15 * Math.PI, 0.85 * Math.PI); ctx.stroke();
    } else {
      ctx.lineWidth = 1.8;
      for (const sx of [-1, 1]) {
        ctx.beginPath(); ctx.arc(cx + sx * hr * 0.35, hy - hr * 0.1, hr * 0.15, 0.15 * Math.PI, 0.85 * Math.PI); ctx.stroke();
        for (let l = 0; l < 3; l++) { const a = (0.3 + l * 0.2) * Math.PI; ctx.beginPath(); ctx.moveTo(cx + sx * hr * 0.35 + Math.cos(a) * hr * 0.15, hy - hr * 0.1 + Math.sin(a) * hr * 0.15); ctx.lineTo(cx + sx * hr * 0.35 + Math.cos(a) * hr * 0.22, hy - hr * 0.1 + Math.sin(a) * hr * 0.22); ctx.stroke(); }
      }
      ctx.fillStyle = `rgb(${150 - pale * 60},${80 + pale * 20},${80 + pale * 70})`;
      ctx.beginPath(); ctx.ellipse(cx, hy + hr * 0.5, hr * 0.2, hr * 0.08, 0, 0, TAU); ctx.fill();
    }
    ctx.strokeStyle = 'rgba(140,80,55,.6)'; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(cx, hy - hr * 0.05); ctx.quadraticCurveTo(cx + hr * 0.12, hy + hr * 0.2, cx - hr * 0.04, hy + hr * 0.26); ctx.stroke();
    // торс: сжатие при компрессии и подъём при вдохе
    const sy = 1 - 0.05 * this.press + 0.05 * this.fill;
    ctx.translate(cx, cy); ctx.scale(1 + 0.03 * this.fill, sy); ctx.translate(-cx, -cy);
    ctx.beginPath();
    ctx.moveTo(cx - tw * 0.5, top + th * 0.12);
    ctx.quadraticCurveTo(cx - tw * 0.49, top - th * 0.01, cx - tw * 0.2, top - th * 0.02);
    ctx.lineTo(cx + tw * 0.2, top - th * 0.02);
    ctx.quadraticCurveTo(cx + tw * 0.49, top - th * 0.01, cx + tw * 0.5, top + th * 0.12);
    ctx.bezierCurveTo(cx + tw * 0.5, top + th * 0.45, cx + tw * 0.4, top + th * 0.7, cx + tw * 0.41, top + th);
    ctx.lineTo(cx - tw * 0.41, top + th);
    ctx.bezierCurveTo(cx - tw * 0.4, top + th * 0.7, cx - tw * 0.5, top + th * 0.45, cx - tw * 0.5, top + th * 0.12);
    ctx.closePath();
    g = ctx.createRadialGradient(cx - tw * 0.1, top + th * 0.35, tw * 0.1, cx, top + th * 0.45, tw * 0.75);
    g.addColorStop(0, '#f4caa6'); g.addColorStop(0.7, '#dca07a'); g.addColorStop(1, '#b97b56');
    ctx.fillStyle = g; ctx.fill();
    if (pale > 0.02) { ctx.fillStyle = `rgba(120,150,200,${pale * 0.3})`; ctx.fill(); }
    ctx.strokeStyle = 'rgba(110,60,40,.35)'; ctx.lineWidth = 1.6; ctx.stroke();
    // ключицы, грудные мышцы, грудина, пупок
    ctx.strokeStyle = 'rgba(130,75,50,.4)'; ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.moveTo(cx - tw * 0.4, top + th * 0.07); ctx.quadraticCurveTo(cx - tw * 0.18, top + th * 0.12, cx - tw * 0.05, top + th * 0.08);
    ctx.moveTo(cx + tw * 0.4, top + th * 0.07); ctx.quadraticCurveTo(cx + tw * 0.18, top + th * 0.12, cx + tw * 0.05, top + th * 0.08);
    ctx.moveTo(cx - tw * 0.4, top + th * 0.36); ctx.quadraticCurveTo(cx - tw * 0.2, top + th * 0.45, cx - tw * 0.03, top + th * 0.36);
    ctx.moveTo(cx + tw * 0.4, top + th * 0.36); ctx.quadraticCurveTo(cx + tw * 0.2, top + th * 0.45, cx + tw * 0.03, top + th * 0.36);
    ctx.stroke();
    ctx.strokeStyle = 'rgba(130,75,50,.25)';
    ctx.beginPath(); ctx.moveTo(cx, top + th * 0.12); ctx.lineTo(cx, top + th * 0.5); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(cx, top + th * 0.55); ctx.lineTo(cx, top + th * 0.78); ctx.stroke();
    ctx.fillStyle = 'rgba(150,85,60,.45)';
    for (const sx of [-1, 1]) { ctx.beginPath(); ctx.arc(cx + sx * tw * 0.24, top + th * 0.33, 2.6, 0, TAU); ctx.fill(); }
    ctx.beginPath(); ctx.ellipse(cx, top + th * 0.84, 3, 4, 0, 0, TAU); ctx.fill();
    // электроды AED
    if (this.padsT > 0) {
      ctx.globalAlpha = this.padsT;
      const pad = (x, y, a) => {
        ctx.save(); ctx.translate(x, y); ctx.rotate(a);
        ctx.fillStyle = '#f7f7f2'; rrect(ctx, -s * 0.08, -s * 0.06, s * 0.16, s * 0.12, 6); ctx.fill();
        ctx.strokeStyle = '#c9c9c0'; ctx.lineWidth = 1; ctx.stroke();
        ctx.fillStyle = '#ff7a00'; ctx.beginPath();
        ctx.moveTo(s * 0.01, -s * 0.045); ctx.lineTo(-s * 0.025, s * 0.005); ctx.lineTo(0, s * 0.005); ctx.lineTo(-s * 0.01, s * 0.045); ctx.lineTo(s * 0.025, -s * 0.005); ctx.lineTo(0, -s * 0.005); ctx.closePath(); ctx.fill();
        ctx.restore();
      };
      pad(cx + tw * 0.24, top + th * 0.18, -0.2);
      pad(cx - tw * 0.3, top + th * 0.66, 0.5);
      ctx.globalAlpha = 1;
    }
    ctx.restore();
  }

  // мини-игра «Адреналин»: останови стрелку в зелёном секторе
  beginAdrenaline() {
    this.mode = 'adren';
    this.spA = rnd(0, TAU); this.spZone = rnd(0, TAU); this.spRes = null;
    this.setBtn('💉 ВВЕСТИ АДРЕНАЛИН');
    this.toast('Адреналин 1 мг: останови стрелку в зелёном секторе', 1500);
    Sound.fx.pop();
  }

  stopSpinner() {
    if (this.mode !== 'adren') return;
    const ok = angDist(this.spA, this.spZone) <= ADREN_HALF;
    this.spRes = { ok, life: 1.1 };
    this.btn.classList.add('hidden');
    if (ok) { Sound.fx.lock(); Haptic.notify('success'); this.judge('Адреналин в вене ✓', '#6dff9a'); this.heal(HP.adren); }
    else { Sound.fx.miss(); Sound.fx.ouch(); Haptic.notify('error'); this.judge('Мимо вены!', '#ff6b7f'); this.heal(HP.adrenBad); }
    if (this.mode === 'adren') { this.mode = 'wait'; this.later(1000, () => this.beginComp()); }
  }

  drawSpinner(ctx) {
    const show = this.mode === 'adren' || (this.spRes && this.spRes.life > 0);
    if (!show) return;
    const R = this.s * 0.3, cx = this.cx, cy = this.cy + this.s * 0.02;
    ctx.save();
    ctx.fillStyle = 'rgba(8,14,24,.82)'; ctx.beginPath(); ctx.arc(cx, cy, R + 14, 0, TAU); ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,.2)'; ctx.lineWidth = 2; ctx.stroke();
    ctx.lineWidth = 14; ctx.strokeStyle = 'rgba(255,255,255,.1)';
    ctx.beginPath(); ctx.arc(cx, cy, R, 0, TAU); ctx.stroke();
    ctx.strokeStyle = this.spRes ? (this.spRes.ok ? '#6dff9a' : '#ff6b7f') : '#3ddc84';
    ctx.shadowColor = '#3ddc84'; ctx.shadowBlur = 12;
    ctx.beginPath(); ctx.arc(cx, cy, R, this.spZone - ADREN_HALF, this.spZone + ADREN_HALF); ctx.stroke();
    ctx.shadowBlur = 0;
    ctx.strokeStyle = 'rgba(255,255,255,.35)'; ctx.lineWidth = 1.5;
    for (let i = 0; i < 24; i++) { const a = i / 24 * TAU; ctx.beginPath(); ctx.moveTo(cx + Math.cos(a) * (R - 10), cy + Math.sin(a) * (R - 10)); ctx.lineTo(cx + Math.cos(a) * (R - 16), cy + Math.sin(a) * (R - 16)); ctx.stroke(); }
    // стрелка-шприц
    ctx.translate(cx, cy); ctx.rotate(this.spA);
    ctx.fillStyle = '#e8eef5'; rrect(ctx, -R * 0.15, -5, R * 0.75, 10, 3); ctx.fill();
    ctx.fillStyle = '#ff4f7b'; ctx.fillRect(R * 0.05, -3.5, R * 0.38, 7);
    ctx.strokeStyle = '#cfd8e3'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(R * 0.6, 0); ctx.lineTo(R * 1.02, 0); ctx.stroke();
    ctx.fillStyle = '#9aa6b6'; ctx.fillRect(-R * 0.22, -9, 6, 18);
    ctx.rotate(-this.spA);
    ctx.fillStyle = '#2b3446'; ctx.beginPath(); ctx.arc(0, 0, 8, 0, TAU); ctx.fill();
    ctx.restore();
    ctx.fillStyle = 'rgba(255,255,255,.9)'; ctx.font = '800 13px Manrope, sans-serif'; ctx.textAlign = 'center';
    ctx.fillText('💉 Адреналин 1 мг', cx, cy - R - 22);
    ctx.textAlign = 'left';
  }

  drawHands(ctx) {
    const hx = this.cx, hy = this.cy - this.s * 0.7 * 0.04; // нижняя треть грудины
    const hr = this.s * 0.085;
    // кольца-метроном
    if (this.mode === 'comp') {
      const t = this.t;
      const k0 = Math.floor((t - this.beat0) / CPR_I);
      for (let k = Math.max(0, k0); k <= Math.min(k0 + 2, CPR_COUNT - 1); k++) {
        if (this.consumed.has(k)) continue;
        const d = this.beat0 + k * CPR_I - t;
        if (d < -CPR_GOOD || d > CPR_I * 1.3) continue;
        const rr = hr * (1.05 + 2.4 * Math.max(0, d) / CPR_I);
        const near = Math.abs(d) <= CPR_PERFECT;
        ctx.strokeStyle = near ? 'rgba(109,255,154,.95)' : `rgba(47,224,196,${1 - Math.max(0, d) / (CPR_I * 1.3)})`;
        ctx.lineWidth = near ? 5 : 3;
        ctx.beginPath(); ctx.arc(hx, hy, rr, 0, TAU); ctx.stroke();
      }
      ctx.strokeStyle = 'rgba(255,255,255,.35)'; ctx.lineWidth = 2; ctx.setLineDash([4, 4]);
      ctx.beginPath(); ctx.arc(hx, hy, hr * 1.05, 0, TAU); ctx.stroke(); ctx.setLineDash([]);
    }
    if (this.mode === 'comp' || (this.mode === 'wait' && !this.lastCharge && this.nextJudge >= CPR_COUNT && !this.breathTries)) {
      const p = this.press;
      ctx.save(); ctx.translate(hx, hy + p * 4); ctx.scale(1 - p * 0.06, 1 - p * 0.06);
      for (const [ox, oy, a] of [[-hr * 0.12, hr * 0.1, -0.15], [hr * 0.12, -hr * 0.05, 0.12]]) {
        ctx.save(); ctx.translate(ox, oy); ctx.rotate(a);
        const g = ctx.createRadialGradient(-hr * 0.2, -hr * 0.3, 0, 0, 0, hr);
        g.addColorStop(0, '#9cc5ff'); g.addColorStop(1, '#3f78d6');
        ctx.fillStyle = g;
        ctx.beginPath(); ctx.ellipse(0, 0, hr * 0.7, hr * 0.85, 0, 0, TAU); ctx.fill();
        for (let f = 0; f < 4; f++) { rrect(ctx, -hr * 0.6 + f * hr * 0.32, -hr * 1.5, hr * 0.26, hr * 0.8, hr * 0.13); ctx.fill(); }
        ctx.restore();
      }
      ctx.restore();
    }
    // оценки
    for (const j of this.judges) {
      ctx.globalAlpha = clamp(j.life / 0.4, 0, 1);
      ctx.fillStyle = j.color; ctx.font = '800 20px Unbounded, sans-serif'; ctx.textAlign = 'center';
      ctx.shadowColor = '#000'; ctx.shadowBlur = 6;
      ctx.fillText(j.text, hx, hy - hr * 2.6 - (0.7 - j.life) * 40);
      ctx.shadowBlur = 0;
    }
    ctx.globalAlpha = 1; ctx.textAlign = 'left';
  }

  drawHp(ctx) {
    const b = this.hpBar, v = clamp(this.hpShown / 100, 0, 1);
    ctx.font = '800 12px Manrope, sans-serif'; ctx.textAlign = 'left';
    ctx.fillStyle = 'rgba(255,255,255,.85)';
    const beat = 1 + 0.25 * Math.exp(-Math.pow(((this.t * (1 + this.hp / 60)) % 1) * 7, 2));
    ctx.save(); ctx.translate(b.x + 9, b.y + b.h + 11); ctx.scale(beat, beat); ctx.font = '16px sans-serif'; ctx.textAlign = 'center'; ctx.fillText('🫀', 0, 6); ctx.restore();
    ctx.textAlign = 'left'; ctx.fillStyle = 'rgba(255,255,255,.85)';
    ctx.fillText('Состояние пациента', b.x + 22, b.y + b.h + 16);
    ctx.textAlign = 'right';
    ctx.fillText(`${Math.round(this.hp)}% · цель ${HP.goal}%`, b.x + b.w, b.y + b.h + 16);
    ctx.fillStyle = 'rgba(255,255,255,.1)'; rrect(ctx, b.x, b.y, b.w, b.h, 8); ctx.fill();
    if (v > 0) {
      const g = ctx.createLinearGradient(b.x, 0, b.x + b.w, 0);
      g.addColorStop(0, '#ff3b5c'); g.addColorStop(0.45, '#ffb02e'); g.addColorStop(1, '#3ddc84');
      ctx.save(); rrect(ctx, b.x, b.y, b.w * v, b.h, 8); ctx.clip();
      ctx.fillStyle = g; ctx.fillRect(b.x, b.y, b.w, b.h);
      ctx.restore();
    }
    ctx.strokeStyle = this.hpFlash > 0.05 ? `rgba(255,60,80,${0.4 + 0.6 * this.hpFlash})` : 'rgba(255,255,255,.3)';
    ctx.lineWidth = this.hpFlash > 0.05 ? 3 : 1; rrect(ctx, b.x, b.y, b.w, b.h, 8); ctx.stroke();
    const gx = b.x + b.w * HP.goal / 100;
    ctx.fillStyle = '#fff'; ctx.fillRect(gx - 1.5, b.y - 5, 3, b.h + 10);
    ctx.font = '800 10px Manrope, sans-serif'; ctx.textAlign = 'center'; ctx.fillText('цель', gx, b.y - 7);
    for (const h of this.hpTexts) {
      ctx.globalAlpha = clamp(h.life / 0.5, 0, 1);
      ctx.textAlign = 'center'; ctx.font = '800 14px Manrope, sans-serif';
      ctx.fillStyle = h.good ? '#6dff9a' : '#ff6b7f';
      ctx.fillText(h.text, b.x + b.w * clamp(v, 0.08, 0.92), b.y + b.h + 32 + (0.9 - h.life) * 16);
    }
    ctx.globalAlpha = 1; ctx.textAlign = 'left';
  }

  render() {
    const ctx = this.ctx, W = this.W, H = this.H;
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, '#16202a'); g.addColorStop(1, '#0b1117');
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    ctx.strokeStyle = 'rgba(255,255,255,.04)'; ctx.lineWidth = 1;
    for (let y = this.mon.y + this.mon.h; y < H; y += 40) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); }
    this.drawMonitor(ctx);
    this.drawHp(ctx);
    this.drawPatient(ctx);
    this.drawHands(ctx);
    this.drawSpinner(ctx);
    ctx.textAlign = 'center';
    // шкалы рисуем НАД кнопкой, чтобы палец её не закрывал
    const cr = this.canvas.getBoundingClientRect();
    const btnTop = this.btn.classList.contains('hidden') ? H - 24 : this.btn.getBoundingClientRect().top - cr.top;
    const gy = btnTop - 22;
    ctx.fillStyle = 'rgba(255,255,255,.9)'; ctx.font = '800 15px Manrope, sans-serif';
    if (this.mode === 'comp' || (this.mode === 'wait' && !this.lastCharge && this.nextJudge >= CPR_COUNT && !this.breathTries)) {
      ctx.fillText(`Цикл ${this.cycle} · удар ${Math.min(CPR_COUNT, this.nextJudge)}/${CPR_COUNT}`, W / 2, gy - 34);
      ctx.fillStyle = 'rgba(255,255,255,.5)'; ctx.font = '600 13px Manrope, sans-serif';
      ctx.fillText('тапай по груди, когда кольцо совпадёт с руками', W / 2, gy - 14);
      ctx.fillStyle = 'rgba(255,255,255,.12)'; rrect(ctx, W * 0.15, gy - 4, W * 0.7, 8, 4); ctx.fill();
      ctx.fillStyle = '#2fe0c4'; rrect(ctx, W * 0.15, gy - 4, W * 0.7 * Math.min(1, this.nextJudge / CPR_COUNT), 8, 4); ctx.fill();
    }
    if (this.mode === 'breath' || (this.mode === 'wait' && this.lastHold)) {
      ctx.fillStyle = 'rgba(255,255,255,.9)'; ctx.font = '800 15px Manrope, sans-serif';
      ctx.fillText(`Вдох ${Math.min(2, (this.breathTries || 0) + (this.mode === 'breath' ? 1 : 0))} из 2`, W / 2, gy - 44);
      const v = this.holding ? this.holdT : this.lastHold || 0;
      const a = BREATH_MIN / BREATH_SCALE, b = BREATH_MAX / BREATH_SCALE;
      this.drawGauge(ctx, gy, v / BREATH_SCALE,
        [{ from: 0, to: a, c: 'rgba(255,209,102,.15)' }, { from: a, to: b, c: 'rgba(109,255,154,.45)' }, { from: b, to: 1, c: 'rgba(255,90,110,.25)' }],
        [{ at: a, text: 'норма ▸' }, { at: b, text: '◂ норма' }],
        v < BREATH_MIN ? '#ffd166' : v <= BREATH_MAX ? '#6dff9a' : '#ff6b7f');
    }
    if (this.mode === 'charge' || this.mode === 'charging' || (this.mode === 'wait' && this.lastCharge) || this.mode === 'rosc') {
      const J = this.mode === 'charging' ? this.chJ : this.mode === 'charge' ? 0 : this.lastCharge;
      ctx.fillStyle = 'rgba(255,255,255,.9)'; ctx.font = '800 15px Manrope, sans-serif';
      ctx.fillText(`Заряд: ${Math.round(J)} Дж`, W / 2, gy - 44);
      const a = SHOCK_MIN / SHOCK_SCALE, b = SHOCK_MAX / SHOCK_SCALE;
      this.drawGauge(ctx, gy, J / SHOCK_SCALE,
        [{ from: 0, to: a, c: 'rgba(255,209,102,.15)' }, { from: a, to: b, c: 'rgba(109,255,154,.45)' }, { from: b, to: 1, c: 'rgba(255,90,110,.25)' }],
        [{ at: a, text: `${SHOCK_MIN} ▸` }, { at: b, text: `◂ ${SHOCK_MAX} Дж` }],
        J < SHOCK_MIN ? '#ffd166' : J <= SHOCK_MAX ? '#6dff9a' : '#ff6b7f');
    }
    ctx.textAlign = 'left';
    if (this.mode === 'dead') { ctx.fillStyle = 'rgba(0,0,0,.35)'; ctx.fillRect(0, 0, W, H); }
    if (this.flash > 0.02) { ctx.fillStyle = `rgba(255,255,255,${this.flash * 0.9})`; ctx.fillRect(0, 0, W, H); }
  }

  drawGauge(ctx, y, v, zones, ticks, color) {
    const W = this.W, x = W * 0.12, w = W * 0.76, h = 16, top = y - h;
    ctx.fillStyle = 'rgba(255,255,255,.08)'; rrect(ctx, x, top, w, h, 8); ctx.fill();
    for (const z of zones) { ctx.fillStyle = z.c; ctx.fillRect(x + w * z.from, top, w * (z.to - z.from), h); }
    ctx.fillStyle = color; rrect(ctx, x, top + 4, Math.max(0, w * Math.min(1, v)), h - 8, 4); ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,.35)'; ctx.lineWidth = 1; rrect(ctx, x, top, w, h, 8); ctx.stroke();
    ctx.font = '700 10px Manrope, sans-serif';
    for (const t of ticks) {
      const tx = x + w * t.at, left = t.text.startsWith('◂');
      ctx.fillStyle = '#fff'; ctx.fillRect(tx - 1.5, top - 7, 3, h + 10);
      ctx.fillStyle = 'rgba(255,255,255,.85)';
      ctx.textAlign = left ? 'left' : 'right';
      ctx.fillText(t.text, left ? tx + 4 : tx - 4, top - 4);
    }
    ctx.textAlign = 'center';
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
