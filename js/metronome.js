// Вкладка «Метроном»: планировщик на часах Web Audio
(() => {
'use strict';
const S = G.S, $ = G.$, A = G.audio, M = S.metro;
const SIGS = {
  '4/4': { beats: 4, unit: 1, accents: [2, 1, 1, 1] },
  '3/4': { beats: 3, unit: 1, accents: [2, 1, 1] },
  '6/8': { beats: 6, unit: 0.5, accents: [2, 0, 0, 1, 0, 0] },
};
const SUBS = [[1, 'доли'], [2, 'восьмые'], [3, 'триоли'], [4, 'шестнадцатые']];
let tr = null, taps = [];

$('metroRoot').innerHTML = `
  <section class="card wide metro" aria-labelledby="h-met">
    <div class="head"><h2 id="h-met">Метроном</h2><span class="hint">Пробел: старт и стоп · T: tap tempo · стрелки: ±1, с Shift ±5</span></div>
    <div class="metro-grid">
      <div class="metro-main">
        <div class="metro-bpm"><button class="round" data-d="-5" aria-label="Медленнее на 5">−5</button><button class="round" data-d="-1" aria-label="Медленнее на 1">−1</button>
          <div><div class="big-num" id="mBpm"></div><div class="hint" style="text-align:center">BPM</div></div>
          <button class="round" data-d="1" aria-label="Быстрее на 1">+1</button><button class="round" data-d="5" aria-label="Быстрее на 5">+5</button></div>
        <input type="range" class="range" id="mRange" min="40" max="220" step="1" aria-label="Темп">
        <div class="beats" id="mBeats"></div>
        <div class="row" style="justify-content:center">
          <button class="btn primary big" id="mStart">▶ Старт</button>
          <button class="btn big" id="mTap">Tap</button>
        </div>
        <div class="hint" id="mTapInfo" style="text-align:center;min-height:1.4em"></div>
      </div>
      <div class="stack metro-side">
        <div class="ctl"><span class="lbl">Размер</span><div class="seg" id="mSig">${Object.keys(SIGS).map(k => `<button data-v="${k}">${k}</button>`).join('')}</div></div>
        <div class="ctl"><span class="lbl">Дробление</span><div class="seg" id="mSub">${SUBS.map(([v, n]) => `<button data-v="${v}">${n}</button>`).join('')}</div></div>
        <label class="check"><input type="checkbox" id="mAcc"> Акцент на первую долю</label>
        <label class="hint" for="mVol">Громкость щелчка <input id="mVol" class="range" type="range" min="0" max="1" step="0.05"></label>
        <div class="note-box" id="mTempoName"></div>
      </div>
    </div>
  </section>`;

const TEMPO_NAMES = [[60, 'медленно: разбор новых риффов'], [80, 'спокойно: точность и глушение'], [100, 'средний рок-темп'], [120, 'драйв: гранж, панк-рок'], [140, 'быстро: даунстроки восьмыми на пределе'], [221, 'очень быстро']];
function render() {
  $('mBpm').textContent = M.bpm;
  $('mRange').value = M.bpm;
  [...$('mSig').children].forEach(b => b.classList.toggle('on', b.dataset.v === M.sig));
  [...$('mSub').children].forEach(b => b.classList.toggle('on', +b.dataset.v === M.sub));
  $('mAcc').checked = M.accent;
  $('mVol').value = M.vol;
  $('mStart').textContent = tr ? '■ Стоп' : '▶ Старт';
  const sig = SIGS[M.sig];
  $('mBeats').innerHTML = Array.from({ length: sig.beats }, (_, i) => `<span class="beat${sig.accents[i] === 2 && M.accent ? ' acc' : ''}" data-i="${i}">${i + 1}</span>`).join('');
  $('mTempoName').innerHTML = `<b>${M.bpm} BPM</b>: ${TEMPO_NAMES.find(([b]) => M.bpm < b)[1]}. Даунстроки восьмыми на этом темпе: ${(M.bpm * 2 / 60).toFixed(1)} удара в секунду.`;
}
function setBpm(b) {
  M.bpm = G.clamp(Math.round(b), 40, 220); G.save(); render();
}
function start() {
  if (tr) return stop();
  tr = new A.Transport({
    stepDur: () => 60 / M.bpm * SIGS[M.sig].unit / M.sub,
    onStep(step, t) {
      const sg = SIGS[M.sig], per = sg.beats * M.sub;
      const k = step % per, beat = Math.floor(k / M.sub), sub = k % M.sub;
      const acc = sg.accents[beat];
      A.click(t, sub !== 0 ? 0 : acc === 2 ? (M.accent ? 2 : 1) : acc);
      if (sub === 0) A.atTime(t, () => flash(beat));
    },
  });
  tr.start();
  render();
}
function stop() { if (tr) tr.stop(); tr = null; A.clearVisual(); render(); }
function flash(i) {
  [...$('mBeats').children].forEach((el, j) => el.classList.toggle('now', j === i));
}
G.metronome = { stop, isRunning: () => !!tr };

$('metroRoot').addEventListener('click', e => {
  const d = e.target.closest('[data-d]'); if (d) setBpm(M.bpm + +d.dataset.d);
});
$('mRange').addEventListener('input', e => setBpm(+e.target.value));
$('mSig').addEventListener('click', e => { const v = e.target.dataset.v; if (!v) return; M.sig = v; G.save(); render(); });
$('mSub').addEventListener('click', e => { const v = +e.target.dataset.v; if (!v) return; M.sub = v; G.save(); render(); });
$('mAcc').addEventListener('change', e => { M.accent = e.target.checked; G.save(); render(); });
$('mVol').addEventListener('input', e => { M.vol = +e.target.value; A.setClickVol(M.vol); G.save(); });
$('mStart').addEventListener('click', start);
function tap() {
  const now = performance.now();
  taps = taps.filter(t => now - t < 2500); taps.push(now);
  if (taps.length >= 2) {
    const iv = []; for (let i = 1; i < taps.length; i++) iv.push(taps[i] - taps[i - 1]);
    iv.sort((a, b) => a - b);
    setBpm(60000 / iv[iv.length >> 1]);
    $('mTapInfo').textContent = `По ${taps.length} нажатиям`;
  } else $('mTapInfo').textContent = 'Нажимайте в темпе ещё…';
  const b = $('mTap'); b.classList.add('tapped'); setTimeout(() => b.classList.remove('tapped'), 90);
}
$('mTap').addEventListener('click', tap);
document.addEventListener('keydown', e => {
  if (S.tab !== 'metronome' || e.target.closest('input, select, textarea')) return;
  if (e.code === 'Space') { e.preventDefault(); start(); }
  else if (e.key === 't' || e.key === 'T' || e.key === 'е' || e.key === 'Е') tap();
  else if (e.key === 'ArrowUp' || e.key === 'ArrowRight') { e.preventDefault(); setBpm(M.bpm + (e.shiftKey ? 5 : 1)); }
  else if (e.key === 'ArrowDown' || e.key === 'ArrowLeft') { e.preventDefault(); setBpm(M.bpm - (e.shiftKey ? 5 : 1)); }
});
render();
})();
