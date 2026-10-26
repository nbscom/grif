// AudioWorklet: уровень, атаки и высота тона (YIN) для гитары и баса.
// Сигнал прореживается в 2 раза (до ~24 кГц), окно 2048 отсчётов прореженного сигнала:
// хватает на несколько периодов E1 (41 Гц) и до 24-го лада первой струны.
class PitchProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this.dsr = sampleRate / 2;
    this.N = 2048;                       // окно анализа (прореженные отсчёты)
    this.setMinFreq(36);
    this.tauMin = Math.floor(this.dsr / 1400);
    this.buf = new Float32Array(this.N);
    this.w = 0; this.filled = 0; this.hop = 512; this.sinceHop = 0;
    this.prevHalf = 0; this.lp = 0;
    this.env = 0; this.slow = 0; this.lastOnset = -1; this.armed = true;
    this.threshold = 0.01; this.blockRms = 0; this.peak = 0; this.sinceLevel = 0;
    this.port.onmessage = e => {
      if (!e.data) return;
      if (e.data.threshold !== undefined) this.threshold = e.data.threshold;
      if (e.data.minFreq) this.setMinFreq(e.data.minFreq);
    };
  }
  setMinFreq(f) {
    this.tauMax = Math.min((this.N >> 1) - 2, Math.ceil(this.dsr / f));
    this.d = new Float32Array(this.tauMax + 2);
  }
  yin() {
    const N = this.N, buf = this.buf, start = this.w, W = N - this.tauMax, d = this.d;
    // линейное окно из кольцевого буфера
    const x = this.lin || (this.lin = new Float32Array(N));
    for (let i = 0; i < N; i++) x[i] = buf[(start + i) % N];
    let energy = 0;
    for (let i = N - W; i < N; i++) energy += x[i] * x[i];
    const rms = Math.sqrt(energy / W);
    if (rms < this.threshold * 0.6) return { f: 0, clarity: 0, rms };
    d[0] = 1;
    let running = 0, best = -1;
    for (let tau = 1; tau <= this.tauMax; tau++) {
      let s = 0;
      for (let i = 0; i < W; i++) { const v = x[i] - x[i + tau]; s += v * v; }
      running += s;
      d[tau] = running > 0 ? s * tau / running : 1;
    }
    for (let tau = this.tauMin; tau < this.tauMax; tau++) {
      if (d[tau] < 0.15) { while (tau + 1 < this.tauMax && d[tau + 1] < d[tau]) tau++; best = tau; break; }
    }
    if (best < 0) {
      let m = 1, mi = -1;
      for (let tau = this.tauMin; tau < this.tauMax; tau++) if (d[tau] < m) { m = d[tau]; mi = tau; }
      if (m > 0.35) return { f: 0, clarity: 1 - m, rms };
      best = mi;
    }
    const a = d[best - 1], b = d[best], c = d[best + 1] !== undefined ? d[best + 1] : b;
    const den = a + c - 2 * b;
    const shift = den !== 0 ? (a - c) / (2 * den) : 0;
    return { f: this.dsr / (best + shift), clarity: 1 - b, rms };
  }
  process(inputs) {
    const inp = inputs[0];
    if (!inp || !inp.length || !inp[0]) return true;
    const ch0 = inp[0], ch1 = inp[1];
    const n = ch0.length;
    let sq = 0, pk = 0;
    for (let i = 0; i < n; i++) {
      const v = ch1 ? (ch0[i] + ch1[i]) * 0.5 : ch0[i];
      sq += v * v; const av = v < 0 ? -v : v; if (av > pk) pk = av;
      // прореживание 2:1 с простым ФНЧ
      this.lp = this.lp * 0.35 + v * 0.65;
      if (i & 1) {
        this.buf[this.w] = (this.lp + this.prevHalf) * 0.5;
        this.w = (this.w + 1) % this.N; this.filled++; this.sinceHop++;
      } else this.prevHalf = this.lp;
    }
    const rms = Math.sqrt(sq / n);
    const t = currentTime;
    // атака: быстрая огибающая заметно выше медленной
    this.env = rms;
    this.slow = this.slow * 0.97 + rms * 0.03;
    if (this.armed && rms > this.threshold && rms > this.slow * 2.2 + this.threshold * 0.5) {
      this.port.postMessage({ type: 'onset', t, rms });
      this.armed = false; this.lastOnset = t;
    }
    if (!this.armed && t - this.lastOnset > 0.06 && rms < this.slow * 1.3) this.armed = true;
    if (pk > this.peak) this.peak = pk;
    this.sinceLevel += n;
    if (this.sinceLevel >= 1024) {
      this.port.postMessage({ type: 'level', rms, peak: this.peak, t });
      this.peak = 0; this.sinceLevel = 0;
    }
    if (this.filled >= this.N && this.sinceHop >= this.hop) {
      this.sinceHop = 0;
      const r = this.yin();
      this.port.postMessage({ type: 'pitch', f: r.f, clarity: r.clarity, rms: r.rms, t });
    }
    return true;
  }
}
registerProcessor('pitch-processor', PitchProcessor);
