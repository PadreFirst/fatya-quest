// Синтезированные звуки (WebAudio) + тактильная отдача Telegram
const tg = window.Telegram && window.Telegram.WebApp;

const Sound = (() => {
  let ctx = null, master = null, noiseBuf = null, brownBuf = null, muted = false;

  function init() {
    try { if (navigator.audioSession) navigator.audioSession.type = 'playback'; } catch (e) {} // играть и в беззвучном режиме iOS 17+
    if (ctx) { if (ctx.state !== 'running') ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = muted ? 0 : 0.9;
    master.connect(ctx.destination);
    noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    brownBuf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
    const b2 = brownBuf.getChannelData(0);
    let last = 0;
    for (let i = 0; i < b2.length; i++) { last = (last + 0.02 * (Math.random() * 2 - 1)) / 1.02; b2[i] = last * 3.5; }
    const b = ctx.createBufferSource();
    b.buffer = ctx.createBuffer(1, 1, 22050);
    b.connect(master); b.start(0);
    if (ctx.state !== 'running') ctx.resume();
  }

  function tone(freq, dur, o = {}) {
    if (!ctx) return;
    const { type = 'sine', vol = 0.3, attack = 0.005, freqEnd = null, delay = 0 } = o;
    const t = ctx.currentTime + delay;
    const osc = ctx.createOscillator(), g = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t);
    if (freqEnd) osc.frequency.exponentialRampToValueAtTime(freqEnd, t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(g); g.connect(master);
    osc.start(t); osc.stop(t + dur + 0.05);
  }

  function noise(dur, o = {}) {
    if (!ctx) return;
    const { vol = 0.3, type = 'bandpass', freq = 1000, freqEnd = null, q = 1, attack = 0.005, delay = 0 } = o;
    const t = ctx.currentTime + delay;
    const s = ctx.createBufferSource(); s.buffer = noiseBuf;
    const f = ctx.createBiquadFilter(); f.type = type; f.Q.value = q;
    f.frequency.setValueAtTime(freq, t);
    if (freqEnd) f.frequency.exponentialRampToValueAtTime(freqEnd, t + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(f); f.connect(g); g.connect(master);
    s.start(t, Math.random() * 1.5); s.stop(t + dur + 0.05);
  }

  // «голосовое» ой: пила через формантный фильтр
  function voice(f0, f1, dur, formant, vol = 0.25, delay = 0) {
    if (!ctx) return;
    const t = ctx.currentTime + delay;
    const o = ctx.createOscillator(); o.type = 'sawtooth';
    o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(f1, t + dur);
    const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = formant; f.Q.value = 4;
    const f2 = ctx.createBiquadFilter(); f2.type = 'bandpass'; f2.frequency.value = formant * 1.9; f2.Q.value = 6;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.03); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(f); o.connect(f2); f.connect(g); f2.connect(g); g.connect(master);
    o.start(t); o.stop(t + dur + 0.05);
  }

  const fx = {
    click() { noise(0.03, { vol: 0.35, freq: 3200, q: 2 }); tone(1150, 0.06, { type: 'triangle', vol: 0.32 }); tone(1720, 0.05, { vol: 0.16, delay: 0.03 }); },
    detent() { noise(0.04, { vol: 0.45, freq: 1800, q: 3 }); tone(320, 0.07, { type: 'square', vol: 0.08, freqEnd: 200 }); },
    swoosh() { noise(0.28, { vol: 0.14, freq: 600, freqEnd: 2400, q: 0.8, attack: 0.08 }); },
    throw() { noise(0.15, { vol: 0.3, freq: 2600, freqEnd: 600, q: 0.9 }); },
    hit(kind) {
      tone(170, 0.16, { vol: 0.5, freqEnd: 55 });
      noise(0.07, { vol: 0.28, freq: 2200, q: 1.4 });
      if (kind === 'gb') {
        noise(0.3, { vol: 0.3, type: 'lowpass', freq: 650, freqEnd: 160, q: 8, delay: 0.02 });
        tone(230, 0.22, { vol: 0.16, freqEnd: 460, delay: 0.04 });
      } else if (kind === 'rbc') {
        tone(330, 0.14, { vol: 0.2, freqEnd: 170 });
      } else {
        tone(620, 0.14, { vol: 0.16, freqEnd: 310 });
        noise(0.12, { vol: 0.12, freq: 4000, q: 3, delay: 0.02 });
      }
    },
    clang() {
      [1250, 1880, 2630, 3410].forEach((f, i) => tone(f, 0.75 - i * 0.12, { vol: 0.17 }));
      noise(0.1, { vol: 0.35, freq: 4200, q: 0.7 });
      tone(160, 0.5, { type: 'sawtooth', vol: 0.12, freqEnd: 70, delay: 0.1 });
    },
    win() {
      [523, 659, 784, 1047].forEach((f, i) => tone(f, 0.4, { type: 'triangle', vol: 0.22, delay: i * 0.09 }));
      tone(1568, 0.7, { vol: 0.12, delay: 0.38 });
    },
    burst() { noise(0.6, { vol: 0.45, type: 'lowpass', freq: 1800, freqEnd: 120, q: 0.7 }); tone(110, 0.45, { vol: 0.4, freqEnd: 40 }); },
    pop() { tone(500, 0.12, { vol: 0.25, freqEnd: 1100 }); noise(0.05, { vol: 0.15, freq: 2500, q: 2 }); },
    beep(sig) {
      const f = 360 + 760 * sig;
      noise(0.14, { vol: 0.07 + 0.22 * sig, freq: f, q: 5, attack: 0.03 });
      tone(f * 1.25, 0.07, { vol: 0.04 + 0.1 * sig });
    },
    ledTick() { tone(2600, 0.025, { vol: 0.05 }); },
    lock() { [880, 1175, 1568, 2093].forEach((f, i) => tone(f, 0.3, { vol: 0.2, delay: i * 0.08 })); noise(0.4, { vol: 0.1, freq: 6000, q: 1, delay: 0.25 }); },
    tick() { tone(2400, 0.02, { type: 'square', vol: 0.05 }); noise(0.015, { vol: 0.12, freq: 5000, q: 3 }); },
    whoosh() { noise(1.0, { vol: 0.28, freq: 250, freqEnd: 2600, q: 0.6, attack: 0.35 }); },
    fanfare() {
      const n = [523, 659, 784, 1047, 784, 1047, 1319];
      n.forEach((f, i) => tone(f, 0.32, { type: 'triangle', vol: 0.2, delay: i * 0.11 }));
      n.forEach((f, i) => tone(f / 2, 0.32, { type: 'sine', vol: 0.12, delay: i * 0.11 }));
    },
    freeze() { tone(1800, 0.12, { type: 'square', vol: 0.06 }); tone(1200, 0.2, { type: 'square', vol: 0.05, delay: 0.1 }); },
    ouch() { voice(330, 190, 0.32, 750, 0.32); voice(260, 170, 0.22, 600, 0.2, 0.3); },
    pressStart() { tone(120, 0.12, { vol: 0.35, freqEnd: 70 }); noise(0.08, { vol: 0.2, type: 'lowpass', freq: 500 }); },
    // антибиотик
    slice() { noise(0.09, { vol: 0.35, type: 'highpass', freq: 2500, freqEnd: 6000, q: 0.7 }); noise(0.16, { vol: 0.25, type: 'lowpass', freq: 900, freqEnd: 250, q: 5, delay: 0.03 }); },
    swipe() { noise(0.12, { vol: 0.08, freq: 1800, freqEnd: 900, q: 1 }); },
    combo(n) { for (let i = 0; i < Math.min(n, 6); i++) tone(660 * Math.pow(1.122, i * 2), 0.14, { type: 'triangle', vol: 0.18, delay: i * 0.06 }); },
    launch() { noise(0.12, { vol: 0.05, freq: 500, freqEnd: 1500, q: 1 }); },
    // реанимация
    thump(good) { tone(95, 0.15, { vol: 0.55, freqEnd: 45 }); noise(0.06, { vol: 0.2, type: 'lowpass', freq: 600 }); if (good) tone(1400, 0.05, { vol: 0.08, delay: 0.01 }); },
    crunch() { for (let i = 0; i < 4; i++) noise(0.03, { vol: 0.3, freq: 2500 + i * 400, q: 4, delay: i * 0.025 }); },
    metro(accent) { noise(0.03, { vol: accent ? 0.25 : 0.14, freq: accent ? 2600 : 2000, q: 6 }); },
    miss() { tone(140, 0.18, { type: 'square', vol: 0.07, freqEnd: 110 }); },
    exhale() { noise(0.7, { vol: 0.12, type: 'lowpass', freq: 900, freqEnd: 300, q: 0.7, attack: 0.05 }); },
    monBeep() { tone(980, 0.09, { vol: 0.16 }); },
    alarm() { tone(880, 0.12, { type: 'square', vol: 0.04 }); tone(660, 0.12, { type: 'square', vol: 0.04, delay: 0.15 }); },
    zap() { noise(0.35, { vol: 0.6, type: 'highpass', freq: 800, q: 0.5 }); tone(60, 0.5, { type: 'sawtooth', vol: 0.4, freqEnd: 30 }); tone(140, 0.3, { vol: 0.4, freqEnd: 50 }); },
    ready() { [1200, 1200, 1600].forEach((f, i) => tone(f, 0.08, { type: 'square', vol: 0.06, delay: i * 0.12 })); },
  };

  // непрерывные звуки (гул аппарата, трекбол, нажим, заряд и т.п.)
  const loops = {};
  function loopGet(key, k) {
    if (!ctx) return null;
    if (loops[key]) return loops[key];
    const g = ctx.createGain(); g.gain.value = 0;
    const f = ctx.createBiquadFilter();
    let src;
    if (k.osc) {
      src = ctx.createOscillator(); src.type = k.osc; src.frequency.value = k.freq;
      f.type = 'lowpass'; f.frequency.value = k.cut || 3000;
    } else {
      src = ctx.createBufferSource(); src.buffer = k.brown ? brownBuf : noiseBuf; src.loop = true;
      f.type = k.filter || 'lowpass'; f.frequency.value = k.freq; f.Q.value = k.q || 1;
    }
    src.connect(f); f.connect(g); g.connect(master);
    src.start();
    loops[key] = { src, f, g, osc: !!k.osc };
    return loops[key];
  }
  function loop(key, k, gain, freq) {
    const l = loopGet(key, k);
    if (!l) return;
    l.g.gain.setTargetAtTime(gain, ctx.currentTime, 0.04);
    if (freq) (l.osc ? l.src.frequency : l.f.frequency).setTargetAtTime(freq, ctx.currentTime, 0.04);
  }
  function loopStop(key) {
    const l = loops[key];
    if (!l || !ctx) return;
    delete loops[key];
    try { l.g.gain.setTargetAtTime(0, ctx.currentTime, 0.03); l.src.stop(ctx.currentTime + 0.25); } catch (e) {}
  }

  // непрерывный «чавк» геля
  function gel(level) { loop('gel', { filter: 'bandpass', freq: 650, q: 1.4 }, Math.min(0.32, level * 0.32)); }
  function gelStop() { loopStop('gel'); }

  return {
    init, fx, gel, gelStop, loop, loopStop,
    get muted() { return muted; },
    setMuted(m) { muted = m; if (master) master.gain.value = m ? 0 : 0.9; },
  };
})();

const Haptic = {
  ok() { return tg && tg.HapticFeedback && tg.isVersionAtLeast && tg.isVersionAtLeast('6.1'); },
  impact(s = 'light') { try { if (this.ok()) tg.HapticFeedback.impactOccurred(s); else if (navigator.vibrate) navigator.vibrate(12); } catch (e) {} },
  notify(t) { try { if (this.ok()) tg.HapticFeedback.notificationOccurred(t); else if (navigator.vibrate) navigator.vibrate([30, 40, 30]); } catch (e) {} },
  select() { try { if (this.ok()) tg.HapticFeedback.selectionChanged(); } catch (e) {} },
};
