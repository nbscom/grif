// Звук: синтез струн, планировщик на часах Web Audio, щелчки метронома
(() => {
'use strict';
const S = G.S;
const A = G.audio = {};
let ctx = null, bus, cleanIn, driveIn, out, clickOut;
const voices = [];
const bufCache = {};

A.ctx = () => {
  if (ctx) { if (ctx.state === 'suspended') ctx.resume(); return ctx; }
  ctx = new (window.AudioContext || window.webkitAudioContext)({ latencyHint: 'interactive' });
  out = ctx.createGain(); out.gain.value = 0.85; out.connect(ctx.destination);
  clickOut = ctx.createGain(); clickOut.gain.value = S.metro.vol; clickOut.connect(ctx.destination);
  bus = ctx.createGain();
  cleanIn = ctx.createBiquadFilter(); cleanIn.type = 'lowpass'; cleanIn.frequency.value = 5500; cleanIn.connect(out);
  const pre = ctx.createGain(); pre.gain.value = 5;
  const sh = ctx.createWaveShaper(); const n = 2048, curve = new Float32Array(n), k = 35;
  for (let i = 0; i < n; i++) { const x = i * 2 / n - 1; curve[i] = (1 + k) * x / (1 + k * Math.abs(x)); }
  sh.curve = curve; sh.oversample = '4x';
  const mid = ctx.createBiquadFilter(); mid.type = 'peaking'; mid.frequency.value = 900; mid.gain.value = 4; mid.Q.value = 0.8;
  const cab = ctx.createBiquadFilter(); cab.type = 'lowpass'; cab.frequency.value = 3400; cab.Q.value = 0.9;
  const post = ctx.createGain(); post.gain.value = 0.28;
  pre.connect(sh); sh.connect(mid); mid.connect(cab); cab.connect(post); post.connect(out);
  driveIn = pre;
  A.route();
  return ctx;
};
A.now = () => A.ctx().currentTime;
A.route = () => { if (!ctx) return; bus.disconnect(); bus.connect(S.drive && !G.isBass() ? driveIn : cleanIn); };
A.setClickVol = v => { if (clickOut) clickOut.gain.value = v; };

function ksBuffer(midi) {
  if (bufCache[midi]) return bufCache[midi];
  const sr = ctx.sampleRate, f = G.freqOf(midi);
  const N = Math.max(2, Math.round(sr / f)), len = Math.floor(sr * (midi < 40 ? 3.2 : 2.8));
  const b = ctx.createBuffer(1, len, sr), d = b.getChannelData(0), ring = new Float32Array(N);
  let prev = 0;
  for (let i = 0; i < N; i++) { prev = prev * 0.45 + (Math.random() * 2 - 1) * 0.55; ring[i] = prev; }
  const damp = midi < 40 ? 0.4995 : 0.4985;
  let idx = 0;
  for (let i = 0; i < len; i++) {
    const a = ring[idx], nx = idx + 1 === N ? 0 : idx + 1;
    d[i] = a; ring[idx] = damp * (a + ring[nx]); idx = nx;
  }
  return (bufCache[midi] = b);
}
// at — абсолютное время AudioContext (или не задано = сейчас)
A.pluck = (midi, s, at, vel = 1, len) => {
  const c = A.ctx(), t = Math.max(c.currentTime + 0.005, at || 0);
  const old = voices[s];
  if (old) { old.g.gain.setTargetAtTime(0, t, 0.012); try { old.src.stop(t + 0.15); } catch (e) {} }
  const src = c.createBufferSource(); src.buffer = ksBuffer(midi);
  const g = c.createGain(); g.gain.value = (G.isBass() ? 0.42 : 0.3) * vel;
  if (len) { g.gain.setValueAtTime((G.isBass() ? 0.42 : 0.3) * vel, t + len); g.gain.setTargetAtTime(0, t + len, 0.02); }
  src.connect(g); g.connect(bus); src.start(t);
  voices[s] = { src, g };
};
A.strum = (fr, dir = 'down', vel = 1, at, len) => {
  const t0 = at || A.now() + 0.01;
  let idx = fr.map((f, s) => f >= 0 ? s : -1).filter(s => s >= 0);
  if (dir === 'up') idx = idx.slice(-4).reverse();
  idx.forEach((s, k) => A.pluck(G.midiAt(s, fr[s]), s, t0 + k * (dir === 'up' ? 0.014 : 0.022), vel, len));
};
A.chokeAll = () => { if (!ctx) return; voices.forEach(v => { if (v) v.g.gain.setTargetAtTime(0, ctx.currentTime, 0.03); }); };

// Щелчок метронома: level 2 = акцент, 1 = доля, 0 = дробление
A.click = (at, level) => {
  const c = A.ctx();
  const o = c.createOscillator(), g = c.createGain();
  o.frequency.value = level === 2 ? 1760 : level === 1 ? 1180 : 820;
  const peak = level === 2 ? 0.9 : level === 1 ? 0.55 : 0.25;
  g.gain.setValueAtTime(0, at);
  g.gain.linearRampToValueAtTime(peak, at + 0.001);
  g.gain.exponentialRampToValueAtTime(0.0001, at + 0.045);
  o.connect(g); g.connect(clickOut); o.start(at); o.stop(at + 0.06);
};

// ---------- визуальные события, привязанные ко времени звука ----------
const vq = [];
A.atTime = (t, fn) => { vq.push({ t, fn }); };
(function drain() {
  if (ctx && vq.length) {
    const now = ctx.currentTime;
    for (let i = 0; i < vq.length;) {
      if (vq[i].t <= now) { const e = vq.splice(i, 1)[0]; try { e.fn(); } catch (err) { console.error(err); } }
      else i++;
    }
  }
  requestAnimationFrame(drain);
})();
A.clearVisual = owner => { for (let i = vq.length - 1; i >= 0; i--) if (!owner || vq[i].fn.owner === owner) vq.splice(i, 1); };

// ---------- тактовый генератор: тики из воркера, не тормозят в фоне ----------
let tickWorker = null;
const tickSubs = new Set();
function startClock() {
  if (tickWorker) return;
  try {
    const src = 'let id=null;onmessage=e=>{if(e.data==="start"){if(!id)id=setInterval(()=>postMessage(0),20)}else{clearInterval(id);id=null}}';
    tickWorker = new Worker(URL.createObjectURL(new Blob([src], { type: 'text/javascript' })));
    tickWorker.onmessage = () => tickSubs.forEach(f => f());
    tickWorker.postMessage('start');
  } catch (e) {
    const id = setInterval(() => tickSubs.forEach(f => f()), 20);
    tickWorker = { postMessage() {}, terminate() { clearInterval(id); } };
  }
}

// Transport: шаги фиксированной длины, планируются с упреждением 120 мс
A.Transport = class {
  constructor({ stepDur, onStep, lookahead = 0.12 }) {
    this.stepDur = stepDur; this.onStep = onStep; this.lookahead = lookahead;
    this.running = false; this.step = 0; this.next = 0;
    this._tick = () => this.pump();
  }
  start(at) {
    const c = A.ctx();
    this.running = true; this.step = 0; this.next = at || c.currentTime + 0.08; this.t0 = this.next;
    startClock(); tickSubs.add(this._tick); this.pump();
    return this.t0;
  }
  pump() {
    if (!this.running) return;
    const c = A.ctx();
    while (this.next < c.currentTime + this.lookahead) {
      this.onStep(this.step, this.next);
      if (!this.running) return;
      this.next += this.stepDur();
      this.step++;
    }
  }
  stop() { this.running = false; tickSubs.delete(this._tick); }
};
})();
