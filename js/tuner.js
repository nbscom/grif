// Вкладка «Тюнер» и карточка аудиовхода
(() => {
'use strict';
const S = G.S, $ = G.$, I = G.input, A = G.audio;
S.a4 = S.a4 || 440;
let lock = -1;            // -1 = авто, иначе индекс струны
let smooth = null, lastPitchAt = 0, inTune = 0;
let calib = null;

const root = $('tunerRoot');
root.innerHTML = `
  <section class="card" aria-labelledby="h-in">
    <div class="head"><h2 id="h-in">Вход с гитары</h2><span class="hint" id="inStatus"></span></div>
    <div class="stack">
      <div id="inBlocked" class="note-box warn" hidden></div>
      <div class="row">
        <select id="inDevice" aria-label="Устройство ввода" style="flex:1;min-width:0"></select>
        <button class="btn primary" id="inToggle">Включить вход</button>
      </div>
      <div>
        <div class="meter" aria-hidden="true"><div class="meter-fill" id="mFill"></div><div class="meter-peak" id="mPeak"></div><div class="meter-thr" id="mThr"></div></div>
        <div class="row" style="justify-content:space-between;margin-top:6px">
          <span class="hint" id="mDb">—</span>
          <label class="hint" for="thr">порог <input id="thr" class="range" type="range" min="0.002" max="0.08" step="0.001" style="width:140px;vertical-align:middle"></label>
        </div>
      </div>
      <div id="noSig" class="note-box" hidden></div>
      <div class="kv" id="inInfo"></div>
      <div class="row">
        <button class="btn" id="calBtn">Калибровать задержку</button>
        <span class="hint" id="calInfo"></span>
      </div>
    </div>
  </section>

  <section class="card" aria-labelledby="h-tun">
    <div class="head"><h2 id="h-tun">Тюнер</h2>
      <div class="tools">
        <label class="bpm" for="a4">A4 <input id="a4" type="number" min="430" max="450" step="1"> Гц</label>
      </div>
    </div>
    <div class="tuner">
      <div class="tn-note"><span class="big-num" id="tnNote">—</span><span id="tnOct" class="tn-oct"></span></div>
      <div class="tn-cents big-num" id="tnCents">&nbsp;</div>
      <svg class="tn-scale" viewBox="0 0 600 90" aria-hidden="true" id="tnScale"></svg>
      <div class="tn-hz" id="tnHz">Сыграйте открытую струну</div>
      <div class="tn-strings" id="tnStrings"></div>
      <p class="hint" style="text-align:center">Строй и инструмент выбираются вверху. Струна определяется автоматически; нажмите на неё, чтобы закрепить и услышать эталон.</p>
    </div>
  </section>`;

// ---------- шкала ----------
function drawScale() {
  let s = `<rect x="270" y="10" width="60" height="44" rx="6" class="tn-zone"/>`;
  for (let c = -50; c <= 50; c += 5) {
    const x = 300 + c * 5.6, big = c % 10 === 0;
    s += `<line x1="${x}" x2="${x}" y1="${big ? 14 : 22}" y2="${big ? 50 : 42}" class="tn-tick${c === 0 ? ' zero' : ''}"/>`;
    if (big) s += `<text x="${x}" y="72" text-anchor="middle" class="tn-lbl">${c > 0 ? '+' + c : c}</text>`;
  }
  s += `<g id="tnNeedle" style="transition:transform .08s linear"><line x1="300" x2="300" y1="4" y2="58" class="tn-needle"/><circle cx="300" cy="4" r="5" class="tn-needle-dot"/></g>`;
  $('tnScale').innerHTML = s;
}
drawScale();

function stringsRow(active) {
  const T = G.T();
  $('tnStrings').innerHTML = T.map((m, s) => `<button data-s="${s}" class="${s === active ? 'on' : ''}${s === lock ? ' lock' : ''}" aria-pressed="${s === lock}">
    <b>${(G.tuningId() === 'eb' ? G.FLAT : G.SHARP)[m % 12]}<sub>${Math.floor(m / 12) - 1}</sub></b><small>${G.stringNo(s)}-я</small></button>`).reverse().join('')
    + `<button data-s="-1" class="${lock === -1 ? 'on lock' : ''}"><b>авто</b><small>струна</small></button>`;
}

// ---------- состояние входа ----------
async function renderInput() {
  const blocked = !I.supported() || (I.error && /claude\.ai/.test(I.error));
  $('inBlocked').hidden = !blocked;
  if (blocked) {
    $('inBlocked').innerHTML = I.inClaude
      ? `<b>Вход с гитары работает только на сайте приложения.</b> Эта копия открыта внутри claude.ai, а там браузер не даёт страницам доступ к микрофону. Откройте <a href="${I.SITE}" target="_blank" rel="noopener">${I.SITE.replace('https://', '')}</a> в Chrome или Safari: там работают тюнер, проверка игры и тренировка «на инструменте». Эталонные тона ниже работают и здесь.`
      : `<b>Аудиовход недоступен.</b> ${G.esc(I.error || 'Откройте страницу по HTTPS в Chrome или Safari.')}`;
  }
  $('inToggle').textContent = I.starting ? 'Включаю…' : I.active ? 'Выключить' : 'Включить вход';
  $('inToggle').classList.toggle('primary', !I.active);
  $('inToggle').disabled = I.starting || blocked;
  $('inStatus').textContent = I.active ? 'включён' : 'выключен';
  if (I.active || I.devices.length) {
    const opts = I.devices.map(d => `<option value="${G.esc(d.deviceId)}"${d.deviceId === S.input.deviceId ? ' selected' : ''}>${G.esc(I.shortLabel(d.label || 'Аудиовход'))}</option>`).join('');
    $('inDevice').innerHTML = opts || `<option>${G.esc(S.input.deviceLabel || 'Устройство по умолчанию')}</option>`;
  } else {
    $('inDevice').innerHTML = `<option value="">${G.esc(S.input.deviceLabel ? I.shortLabel(S.input.deviceLabel) : 'Устройство появится после включения')}</option>`;
  }
  $('inDevice').disabled = !I.active;
  $('thr').value = S.input.threshold;
  $('mThr').style.left = Math.min(100, levelPct(S.input.threshold)) + '%';
  if (I.active) {
    const st = I.settings || {}, c = A.ctx();
    const ms = x => (x * 1000).toFixed(0) + ' мс';
    $('inInfo').innerHTML = `<span>Устройство</span><span>${G.esc(I.shortLabel(I.label))}</span>
      <span>Обработка</span><span>эхо ${st.echoCancellation ? 'вкл' : 'выкл'}, шум ${st.noiseSuppression ? 'вкл' : 'выкл'}, АРУ ${st.autoGainControl ? 'вкл' : 'выкл'}</span>
      <span>Частота</span><span>${c.sampleRate} Гц, каналов: ${st.channelCount || '—'}</span>
      <span>Задержка</span><span>выход ${ms(c.outputLatency || c.baseLatency || 0)}, вход ${ms(I.inputLatency)}, поправка ${S.input.latencyMs | 0} мс</span>`;
  } else $('inInfo').innerHTML = `<span>Mooer GE</span><span>будет выбран автоматически, если подключён по USB</span>`;
  $('calBtn').disabled = !I.active || !!calib;
  if (!calib) $('calInfo').textContent = S.input.latencyMs ? `Поправка ${S.input.latencyMs | 0} мс` : 'Нужна для оценки «рано/поздно»';
}
const levelPct = rms => rms <= 0 ? 0 : G.clamp((20 * Math.log10(rms) + 60) / 60 * 100, 0, 100);

G.on('inputState', renderInput);
G.on('level', m => {
  if (S.tab !== 'tuner') return;
  $('mFill').style.width = levelPct(m.rms) + '%';
  $('mPeak').style.left = levelPct(m.peak) + '%';
  $('mFill').classList.toggle('clip', m.peak > 0.98);
  $('mDb').textContent = m.peak > 0.98 ? 'Перегрузка входа: убавьте выход на Mooer' : (m.rms > 0 ? (20 * Math.log10(m.rms)).toFixed(0) + ' дБ' : '—');
});
setInterval(() => {
  if (S.tab !== 'tuner') return;
  const silent = I.active && performance.now() - I.lastSignal > 3500;
  $('noSig').hidden = !silent;
  if (silent) $('noSig').innerHTML = `<b>Сигнала нет.</b> Проверьте: громкость на гитаре не на нуле; Mooer включён и подключён USB-кабелем; в списке выше выбран Mooer, а не встроенный микрофон; на Mooer включён USB-выход (Output → USB). Если уровень есть, но ниже жёлтой метки, сдвиньте порог влево.`;
}, 500);

$('inToggle').addEventListener('click', () => { if (I.active) I.stop(); else I.start(); });
$('inDevice').addEventListener('change', e => { S.input.deviceId = e.target.value; G.save(); I.start(e.target.value); });
$('thr').addEventListener('input', e => { I.setThreshold(+e.target.value); $('mThr').style.left = levelPct(+e.target.value) + '%'; });
$('a4').value = S.a4;
$('a4').addEventListener('change', e => { S.a4 = G.clamp(+e.target.value || 440, 430, 450); e.target.value = S.a4; G.save(); });

// ---------- тюнер ----------
const midiA4 = f => 69 + 12 * Math.log2(f / S.a4);
G.on('pitch', p => {
  if (S.tab !== 'tuner') return;
  if (!p.f) return;
  const m = midiA4(p.f);
  smooth = smooth === null || Math.abs(m - smooth) > 0.7 ? m : smooth * 0.6 + m * 0.4;
  lastPitchAt = performance.now();
});
function frame() {
  requestAnimationFrame(frame);
  if (S.tab !== 'tuner') return;
  const fresh = smooth !== null && performance.now() - lastPitchAt < 500;
  const needle = $('tnNeedle');
  if (!fresh) {
    $('tnNote').textContent = '—'; $('tnOct').textContent = ''; $('tnCents').innerHTML = '&nbsp;';
    $('tnHz').textContent = I.active ? 'Сыграйте открытую струну' : 'Включите вход с гитары слева';
    needle.style.transform = 'translateX(0)'; needle.classList.remove('ok');
    $('tnCents').className = 'tn-cents big-num';
    stringsRow(lock); return;
  }
  const T = G.T();
  let s = lock;
  if (s < 0) {
    let best = 0, bd = 99;
    T.forEach((tm, i) => { const d = Math.abs(smooth - tm); if (d < bd) { bd = d; best = i; } });
    s = bd <= 1.0 ? best : -1;
  }
  const target = s >= 0 ? T[s] : Math.round(smooth);
  const cents = (smooth - target) * 100;
  const shown = G.clamp(cents, -50, 50);
  const tnm = Math.round(smooth);
  $('tnNote').textContent = (G.tuningId() === 'eb' ? G.FLAT : G.SHARP)[((s >= 0 ? target : tnm) % 12 + 12) % 12];
  $('tnOct').textContent = Math.floor((s >= 0 ? target : tnm) / 12) - 1;
  const ok = Math.abs(cents) <= 5;
  inTune = ok ? inTune + 1 : 0;
  $('tnCents').textContent = Math.abs(cents) > 99 ? (cents > 0 ? 'выше' : 'ниже') : (cents > 0 ? '+' : cents < 0 ? '−' : '') + Math.abs(Math.round(cents));
  $('tnCents').className = 'tn-cents big-num ' + (ok ? 'ok' : Math.abs(cents) < 15 ? 'near' : 'far');
  needle.style.transform = `translateX(${(shown * 5.6).toFixed(1)}px)`;
  needle.classList.toggle('ok', ok);
  const hz = S.a4 * Math.pow(2, (smooth - 69) / 12);
  $('tnHz').textContent = `${hz.toFixed(1)} Гц · ${s >= 0 ? `${G.stringNo(s)}-я струна, цель ${(S.a4 * Math.pow(2, (target - 69) / 12)).toFixed(1)} Гц` : 'хроматический режим'}${ok && inTune > 20 ? ' · настроено' : cents < -5 ? ' · подтяните' : cents > 5 ? ' · ослабьте' : ''}`;
  stringsRow(s);
}
requestAnimationFrame(frame);
$('tnStrings').addEventListener('click', e => {
  const b = e.target.closest('[data-s]'); if (!b) return;
  lock = +b.dataset.s;
  if (lock >= 0) {
    const m = G.T()[lock], c = A.ctx(), t = c.currentTime + 0.02;
    // эталон: чистый тон с обертоном, 2,5 с
    const o = c.createOscillator(), o2 = c.createOscillator(), g = c.createGain();
    o.frequency.value = S.a4 * Math.pow(2, (m - 69) / 12); o2.frequency.value = o.frequency.value * 2;
    const g2 = c.createGain(); g2.gain.value = 0.35;
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.25, t + 0.02); g.gain.setTargetAtTime(0, t + 1.8, 0.25);
    o.connect(g); o2.connect(g2); g2.connect(g); g.connect(c.destination);
    o.start(t); o2.start(t); o.stop(t + 3); o2.stop(t + 3);
  }
  stringsRow(lock);
});

// ---------- калибровка задержки: 8 щелчков, играть глушёный удар на каждый ----------
$('calBtn').addEventListener('click', () => {
  if (!I.active || calib) return;
  const c = A.ctx(), bpm = 80, beat = 60 / bpm, t0 = c.currentTime + 0.6;
  const clicks = [];
  for (let i = 0; i < 12; i++) { A.click(t0 + i * beat, i % 4 === 0 ? 2 : 1); clicks.push(t0 + i * beat); }
  calib = { clicks, hits: [] };
  $('calInfo').textContent = 'Слушайте 4 щелчка, затем играйте глушёный удар точно на каждый щелчок…';
  renderInput();
  const off = G.on('onset', m => { if (calib) calib.hits.push(m.t); });
  setTimeout(() => {
    const raw = [];
    calib.clicks.slice(4).forEach(ct => {
      const h = calib.hits.filter(t => Math.abs(t - ct) < beat * 0.45).sort((a, b) => Math.abs(a - ct) - Math.abs(b - ct))[0];
      if (h !== undefined) raw.push(h - ct);
    });
    if (raw.length >= 5) {
      raw.sort((a, b) => a - b);
      const med = raw[raw.length >> 1];
      const auto = (c.outputLatency || c.baseLatency || 0) + (I.inputLatency || 0);
      S.input.latencyMs = Math.round((med - auto) * 1000); G.save();
      $('calInfo').textContent = `Готово: общая задержка ${(med * 1000).toFixed(0)} мс по ${raw.length} ударам.`;
    } else $('calInfo').textContent = `Распознано ${raw.length} ударов из 8. Играйте громче или сдвиньте порог и повторите.`;
    off(); calib = null; renderInput();
  }, (12 * beat + 1) * 1000);
});

G.on('tab', t => { if (t === 'tuner') { renderInput(); stringsRow(lock); } });
G.on('instrument', () => { lock = -1; stringsRow(lock); });
renderInput(); stringsRow(lock);
})();
