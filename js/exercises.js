// Вкладка «Упражнения»: табы, метроном, проверка высоты и ритма по звуку
(() => {
'use strict';
const S = G.S, $ = G.$, A = G.audio, I = G.input, D = G.data;
const PX = 64;            // пикселей на долю
let sel = S.exSel || null;
let filter = S.exFilter || 'all';
let run = null;           // текущий прогон
let lastResult = null;    // { exId, marks: [...], ... }
S.exRepeats = S.exRepeats || 2;

$('exRoot').innerHTML = `
  <section class="card" aria-labelledby="h-exl">
    <div class="head"><h2 id="h-exl">Упражнения</h2><span class="hint" id="exCount"></span></div>
    <div class="quals" id="exFilter"></div>
    <div class="ex-list" id="exList"></div>
  </section>
  <section class="card" aria-labelledby="h-exr" id="exRunner">
    <div class="head"><h2 id="h-exr">—</h2><span class="hint" id="exMeta"></span></div>
    <p class="ctx" id="exDesc"></p>
    <div id="exWarn"></div>
    <div class="tabview-wrap" id="tabWrap"><svg id="tabSvg" class="tabview" aria-label="Табулатура"></svg></div>
    <div class="ex-controls">
      <div class="metro-bpm small"><button class="round" data-bpm="-5" aria-label="Медленнее на 5">−5</button>
        <div><div class="big-num" id="exBpm"></div><div class="hint" style="text-align:center">BPM</div></div>
        <button class="round" data-bpm="5" aria-label="Быстрее на 5">+5</button></div>
      <div class="ctl"><span class="lbl">Повторы</span><div class="seg" id="exRep"><button data-v="1">1</button><button data-v="2">2</button><button data-v="4">4</button><button data-v="0">∞</button></div></div>
      <div class="row">
        <button class="btn primary big" id="exCheck">● Играть с проверкой</button>
        <button class="btn big" id="exListen">▶ Послушать</button>
        <button class="btn big" id="exFree">Без проверки</button>
      </div>
    </div>
    <div id="exResult"></div>
  </section>`;

// ---------- список ----------
const exList = () => G.EX.filter(e => e.inst === S.inst);
const bestAcc = id => { const r = D.results.filter(x => x.ex === id); return r.length ? Math.max(...r.map(x => x.acc)) : null; };
const workBpm = ex => D.tempo[ex.id] || ex.bpm;
function renderList() {
  const cats = ['all', 'warmup', 'notes', 'tech', 'rhythm', 'riff'];
  $('exFilter').innerHTML = cats.map(c => `<button data-f="${c}" class="${c === filter ? 'on' : ''}">${c === 'all' ? 'все' : G.CAT_RU[c].toLowerCase()}</button>`).join('');
  const list = exList().filter(e => filter === 'all' || e.cat === filter);
  $('exCount').textContent = `${list.length} для: ${G.INST_RU[S.inst]}`;
  $('exList').innerHTML = list.map(e => {
    const b = bestAcc(e.id);
    return `<button class="ex-item${e.id === sel ? ' on' : ''}" data-ex="${e.id}">
      <span class="ex-t">${G.esc(e.title)}</span>
      <span class="ex-tags"><span class="tag-c">${G.CAT_RU[e.cat]}</span>${e.style ? `<span class="tag-c st">${G.STYLE_RU[e.style]}</span>` : ''}${e.tuning ? `<span class="tag-c drop">Drop D</span>` : ''}</span>
      <span class="ex-s"><b>${workBpm(e)}</b> BPM${b !== null ? ` · лучшая ${b}%` : ''}</span>
    </button>`;
  }).join('') || `<p class="hint">Нет упражнений в этой группе.</p>`;
}

// ---------- табулатура ----------
function layout(ex) {
  const NS = G.NS();
  const parsed = G.parseRiff(ex.riff, NS);
  return { NS, events: parsed.events, beats: parsed.beats };
}
function drawTab(ex, marks) {
  const { NS, events, beats } = layout(ex);
  const gap = 18, top = 30, padL = 34, W = padL + beats * PX + 24, H = top + gap * (NS - 1) + 52;
  const Y = s => top + (NS - 1 - s) * gap;
  const X = b => padL + b * PX + 12;
  let h = '';
  for (let s = 0; s < NS; s++) {
    h += `<line x1="${padL}" x2="${W - 8}" y1="${Y(s)}" y2="${Y(s)}" class="tb-line"/>`;
    h += `<text x="6" y="${Y(s) + 4}" class="tb-sn">${(G.tuningId() === 'eb' ? G.FLAT : G.SHARP)[G.T()[s] % 12]}</text>`;
  }
  for (let b = 0; b <= beats + 1e-6; b += 1) {
    const x = padL + b * PX;
    if (b % 4 === 0) h += `<line x1="${x}" x2="${x}" y1="${Y(NS - 1)}" y2="${Y(0)}" class="tb-bar"/>`;
    else h += `<line x1="${x}" x2="${x}" y1="${Y(0) + 8}" y2="${Y(0) + 12}" class="tb-tick"/>`;
    if (b < beats && b % 1 === 0) h += `<text x="${x + 3}" y="${Y(0) + 24}" class="tb-cnt">${(b % 4) + 1}</text>`;
  }
  events.forEach((e, i) => {
    const x = X(e.beat), mk = marks && marks[i];
    if (e.rest) { h += `<text x="${x}" y="${Y(Math.floor((NS - 1) / 2)) + 4}" text-anchor="middle" class="tb-rest">${e.dur >= 1 ? '𝄽' : e.dur >= 0.5 ? '𝄾' : '𝄿'}</text>`; return; }
    if (mk) h += `<rect x="${x - 13}" y="${Y(NS - 1) - 11}" width="26" height="${gap * (NS - 1) + 22}" rx="6" class="tb-mk ${mk.cls}"/>`;
    const notes = G.riffNotes(e);
    notes.forEach(n => {
      const label = n.f === null ? 'x' : String(n.f);
      h += `<rect x="${x - 4 - label.length * 3.6}" y="${Y(n.s) - 7}" width="${8 + label.length * 7.2}" height="14" class="tb-bg"/>`;
      h += `<text x="${x}" y="${Y(n.s) + 4.5}" text-anchor="middle" class="tb-n${notes[0] === n && e.shape ? ' root' : ''}">${label}</text>`;
    });
    const above = [];
    if (e.pm) above.push('P.M.');
    if (e.tech === 'h') above.push('H'); else if (e.tech === 'p') above.push('P'); else if (e.tech === 'b') above.push('↑тон'); else if (e.tech === '/') above.push('╱');
    if (above.length) h += `<text x="${x}" y="${top - 14}" text-anchor="middle" class="tb-fx">${above.join(' ')}</text>`;
    if (mk && mk.txt) h += `<text x="${x}" y="${Y(0) + 40}" text-anchor="middle" class="tb-res ${mk.cls}">${mk.txt}</text>`;
  });
  h += `<line id="tbCursor" x1="0" x2="0" y1="${top - 22}" y2="${Y(0) + 14}" class="tb-cursor" style="display:none"/>`;
  const svg = $('tabSvg');
  svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
  svg.style.width = W + 'px';
  svg.innerHTML = h;
  return { padL, X };
}

// ---------- карточка упражнения ----------
function renderRunner() {
  const ex = G.exById(sel);
  if (!ex || ex.inst !== S.inst) { sel = exList()[0].id; return renderRunner(); }
  $('h-exr').textContent = ex.title;
  $('exMeta').textContent = `${G.CAT_RU[ex.cat]}${ex.style ? ' · ' + G.STYLE_RU[ex.style] : ''} · исходный темп ${ex.bpm}`;
  $('exDesc').textContent = ex.desc;
  const needDrop = ex.tuning === 'dropD' && !(G.T()[1] - G.T()[0] === 7);
  $('exWarn').innerHTML = needDrop ? `<div class="note-box warn" style="margin-bottom:12px">Рифф написан для Drop D: опустите 6-ю струну на тон (до D) и переключите строй. <button class="btn" id="exToDrop">Переключить на Drop D</button></div>` : '';
  $('exBpm').textContent = workBpm(ex);
  [...$('exRep').children].forEach(b => b.classList.toggle('on', +b.dataset.v === S.exRepeats));
  const busy = !!run;
  $('exCheck').textContent = run && run.mode === 'check' ? '■ Стоп' : '● Играть с проверкой';
  $('exListen').textContent = run && run.mode === 'listen' ? '■ Стоп' : '▶ Послушать';
  $('exFree').textContent = run && run.mode === 'free' ? '■ Стоп' : 'Без проверки';
  $('exCheck').disabled = busy && run.mode !== 'check';
  $('exListen').disabled = busy && run.mode !== 'listen';
  $('exFree').disabled = busy && run.mode !== 'free';
  drawTab(ex, lastResult && lastResult.exId === ex.id && lastResult.tuning === G.tuningId() ? lastResult.marks : null);
  renderResult();
}
function renderResult() {
  const ex = G.exById(sel), r = lastResult && lastResult.exId === sel ? lastResult : null;
  let h = '';
  if (run && run.mode === 'check' && !I.active) h += '';
  if (r) {
    const dir = Math.abs(r.meanDt) < 8 ? 'точно в долю' : r.meanDt < 0 ? `в среднем раньше на ${Math.abs(r.meanDt)} мс` : `в среднем позже на ${r.meanDt} мс`;
    h += `<div class="ex-res">
      <div class="ex-acc"><span class="big-num ${r.acc >= 90 ? 'good' : r.acc >= 70 ? 'mid' : 'low'}">${r.acc}%</span><span class="hint">точность при ${r.bpm} BPM</span></div>
      <div class="kv">
        <span>Верные ноты</span><span>${r.pitchOk} из ${r.total}</span>
        <span>Ритм</span><span>${r.timed ? `${dir}, разброс ±${r.meanAbs} мс` : 'нет данных'}</span>
        <span>Лишние удары</span><span>${r.extra}</span>
        <span>Серия ≥ 90%</span><span>${streak90(ex.id, r.bpm)} из 3 при ${r.bpm} BPM</span>
      </div>
    </div>`;
    if (streak90(ex.id, r.bpm) >= 3 && workBpm(ex) <= r.bpm) h += `<div class="note-box good-box">Три прогона подряд не ниже 90%. <button class="btn primary" id="exUp">Поднять темп до ${r.bpm + 5} BPM</button></div>`;
    h += `<p class="hint">Цвет под нотой: зелёный — точно, жёлтый — верная нота, но мимо доли, красный — не та нота или пропуск. Цифры — ранний (−) или поздний (+) удар в мс.</p>`;
  } else if (!I.active) {
    h += `<div class="note-box">Для проверки по звуку включите вход с гитары на вкладке <button class="linkish" data-goto="tuner">«Тюнер»</button>. Без входа можно слушать рифф и играть под метроном.</div>`;
  }
  $('exResult').innerHTML = h;
}
const streak90 = (id, bpm) => {
  const r = D.results.filter(x => x.ex === id && x.inst === S.inst);
  let n = 0;
  for (let i = r.length - 1; i >= 0 && n < 3; i--) { if (r[i].bpm >= bpm && r[i].acc >= 90) n++; else break; }
  return n;
};

// ---------- прогон ----------
function start(mode) {
  if (run) return stop(true);
  const ex = G.exById(sel);
  if (mode === 'check' && !I.active) { G.go('tuner'); return; }
  const c = A.ctx();
  const bpm = workBpm(ex), beat = 60 / bpm;
  const { events, beats } = layout(ex);
  const reps = S.exRepeats || Infinity;
  const countIn = 4;
  const loopBeats = Math.ceil(beats / 4) * 4;
  const geo = drawTab(ex, null);
  run = { mode, ex, bpm, beat, events, beats, loopBeats, reps, countIn, onsets: [], frames: [], geo, rep: 0 };
  const totalBeats = countIn + (isFinite(reps) ? reps * loopBeats : 1e9);
  const tr = new A.Transport({
    stepDur: () => beat / 4,
    onStep(step, t) {
      const b = step / 4;
      if (b >= totalBeats) { A.atTime(t, () => finish()); tr.stop(); return; }
      if (step % 4 === 0) A.click(t, (b < countIn ? (b === 0 ? 2 : 1) : ((b - countIn) % 4 === 0 ? 2 : 1)));
      if (mode === 'listen' && b >= countIn) {
        const inLoop = (b - countIn) % loopBeats;
        events.forEach(e => {
          if (Math.abs(e.beat - inLoop) > 1e-6 || e.rest) return;
          const len = e.dur * beat * (e.pm ? 0.35 : 0.95);
          G.riffNotes(e).forEach((n, k) => {
            if (n.f === null) { A.pluck(G.midiAt(n.s, 0), n.s, t, 0.25, 0.03); return; }
            const m = G.midiAt(n.s, n.f);
            A.pluck(m + (e.tech === 'b' ? 0 : 0), n.s, t + k * 0.008, e.pm ? 0.7 : 0.9, len);
          });
        });
      }
    },
  });
  run.tr = tr;
  run.t0 = tr.start() ;
  run.tPlay = run.t0 + countIn * beat;
  if (mode === 'check') {
    run.offNote = G.on('note', n => run && run.onsets.push({ t: n.t - I.totalLatency(), midi: n.midi }));
    run.offPitch = G.on('pitch', p => run && p.f && run.frames.push({ t: p.t - I.totalLatency(), midi: p.midi }));
  }
  run.wall = performance.now();
  lastResult = null;
  renderRunner(); renderList();
  cursorLoop();
}
function cursorLoop() {
  if (!run) return;
  requestAnimationFrame(cursorLoop);
  const cur = $('tbCursor'); if (!cur) return;
  const c = A.ctx(), lat = (c.outputLatency || c.baseLatency || 0);
  const b = (c.currentTime - lat - run.tPlay) / run.beat;
  if (b < 0) { cur.style.display = 'none'; $('exMeta').textContent = `Отсчёт: ${Math.min(4, Math.floor(b + run.countIn) + 1)}`; return; }
  const inLoop = b % run.loopBeats;
  run.rep = Math.floor(b / run.loopBeats);
  const x = run.geo.padL + inLoop * PX;
  cur.style.display = '';
  cur.setAttribute('x1', x); cur.setAttribute('x2', x);
  $('exMeta').textContent = `Повтор ${run.rep + 1}${isFinite(run.reps) ? ' из ' + run.reps : ''} · ${run.bpm} BPM`;
  const wrap = $('tabWrap');
  if (x < wrap.scrollLeft + 40 || x > wrap.scrollLeft + wrap.clientWidth - 80) wrap.scrollLeft = Math.max(0, x - 60);
}
function stop(manual) {
  if (!run) return;
  const r = run;
  r.tr.stop();
  if (r.offNote) r.offNote();
  if (r.offPitch) r.offPitch();
  A.clearVisual(); A.chokeAll();
  run = null;
  const sec = (performance.now() - r.wall) / 1000;
  if (!G.planActive || !G.planActive()) G.addPractice(sec, 'free');
  if (r.mode === 'check') {
    const playedReps = manual ? Math.floor(Math.max(0, A.ctx().currentTime - r.tPlay) / (r.loopBeats * r.beat)) : (isFinite(r.reps) ? r.reps : 1);
    if (playedReps >= 1) evaluate(r, playedReps);
  }
  renderRunner(); renderList();
}
function finish() { setTimeout(() => stop(false), 450); }

// ---------- оценка ----------
function evaluate(r, reps) {
  const exp = [];
  for (let k = 0; k < reps; k++) r.events.forEach((e, i) => {
    if (e.rest) return;
    exp.push({ i, k, e, t: r.tPlay + (k * r.loopBeats + e.beat) * r.beat, x: G.riffExpect(e) });
  });
  const used = new Set();
  const marks = {};
  let sum = 0, pitchOk = 0, dts = [];
  exp.forEach((p, j) => {
    const prev = exp[j - 1], next = exp[j + 1];
    const w = Math.min(0.15, prev ? (p.t - prev.t) / 2 : 0.15, next ? (next.t - p.t) / 2 : 0.15);
    let on = null, bd = Infinity;
    r.onsets.forEach((o, oi) => { const d = Math.abs(o.t - p.t); if (!used.has(oi) && d <= Math.max(w, 0.05) && d < bd) { bd = d; on = oi; } });
    const onset = on !== null ? r.onsets[on] : null;
    if (on !== null) used.add(on);
    const durS = p.e.dur * r.beat;
    const framesIn = (a, b) => r.frames.filter(f => f.t >= p.t + a && f.t <= p.t + b).map(f => f.midi);
    const legato = p.e.tech === 'h' || p.e.tech === 'p' || p.e.tech === '/';
    let ok = false;
    if (p.x.midi === null) ok = !!onset;
    else if (p.x.chord) {
      const pc = p.x.midi % 12;
      const fr = framesIn(0.08, Math.max(0.12, Math.min(durS, 0.5)));
      ok = (onset && onset.midi !== null && Math.round(onset.midi) % 12 === pc) || share(fr, m => ((Math.round(m) % 12) + 12) % 12 === pc) >= 0.5;
    } else if (p.e.tech === 'b') {
      ok = framesIn(0.05, durS).some(m => Math.abs(m - p.x.midi) < 0.35);
    } else {
      const near = m => { const d = Math.abs(m - p.x.midi); return d < 0.5 || Math.abs(d - 12) < 0.5; };
      ok = (onset && onset.midi !== null && near(onset.midi)) || share(framesIn(legato ? 0.02 : 0.08, Math.max(0.1, durS)), near) >= 0.5;
    }
    const dt = onset ? Math.round((onset.t - p.t) * 1000) : null;
    let sc;
    if (!ok) sc = onset && p.x.midi !== null ? 0.15 : 0;
    else if (legato && dt === null) sc = 1;
    else if (dt === null) sc = 0.4;
    else { const a = Math.abs(dt); sc = a <= 35 ? 1 : a <= 70 ? 0.8 : a <= 110 ? 0.5 : 0.3; }
    sum += sc; if (ok) pitchOk++;
    if (dt !== null && ok) dts.push(dt);
    if (p.k === reps - 1) marks[p.i] = { cls: sc >= 0.8 ? 'good' : sc >= 0.4 ? 'mid' : 'low', txt: !ok ? (onset ? 'нота' : 'нет') : dt === null ? '·' : (dt > 0 ? '+' : '') + dt };
  });
  const tEnd = r.tPlay + reps * r.loopBeats * r.beat;
  const extra = r.onsets.filter((o, oi) => !used.has(oi) && o.t > r.tPlay - 0.1 && o.t < tEnd).length;
  const acc = exp.length ? Math.round(sum / exp.length * 100) : 0;
  const meanDt = dts.length ? Math.round(dts.reduce((a, b) => a + b, 0) / dts.length) : 0;
  const meanAbs = dts.length ? Math.round(dts.reduce((a, b) => a + Math.abs(b - meanDt), 0) / dts.length) : 0;
  lastResult = { exId: r.ex.id, tuning: G.tuningId(), marks, acc, bpm: r.bpm, total: exp.length, pitchOk, meanDt, meanAbs, timed: dts.length > 0, extra };
  G.addResult({ ex: r.ex.id, bpm: r.bpm, acc, early: meanDt, n: exp.length });
  G.emit('exerciseDone', lastResult);
}
const share = (arr, fn) => arr.length ? arr.filter(fn).length / arr.length : 0;
G.evaluateRun = evaluate; // для тестов

// ---------- события ----------
function select(id) { if (run) stop(true); sel = id; S.exSel = id; G.save(); lastResult = null; renderList(); renderRunner(); $('tabWrap').scrollLeft = 0; }
$('exList').addEventListener('click', e => { const b = e.target.closest('[data-ex]'); if (b) select(b.dataset.ex); });
$('exFilter').addEventListener('click', e => { const f = e.target.dataset.f; if (!f) return; filter = f; S.exFilter = f; G.save(); renderList(); });
$('exRunner').addEventListener('click', e => {
  const t = e.target.closest('button'); if (!t) return;
  const ex = G.exById(sel);
  if (t.dataset.bpm) { if (run) return; D.tempo[ex.id] = G.clamp(workBpm(ex) + +t.dataset.bpm, 30, 240); G.saveData(); renderRunner(); renderList(); }
  else if (t.id === 'exCheck') start('check');
  else if (t.id === 'exListen') start('listen');
  else if (t.id === 'exFree') start('free');
  else if (t.id === 'exUp') { D.tempo[ex.id] = lastResult.bpm + 5; G.saveData(); lastResult = null; renderRunner(); renderList(); }
  else if (t.id === 'exToDrop') { S.tuning.guitar = 'dropD'; G.save(); G.renderHeader(); G.emit('instrument'); }
});
$('exRep').addEventListener('click', e => { const v = e.target.dataset.v; if (v === undefined) return; S.exRepeats = +v; G.save(); renderRunner(); });
G.on('instrument', () => { if (run) stop(true); lastResult = null; renderList(); renderRunner(); });
G.on('inputState', () => { if (S.tab === 'exercises') renderResult(); });
G.on('tab', t => { if (t !== 'exercises' && run) stop(true); if (t === 'exercises') { renderList(); renderRunner(); } });
document.addEventListener('keydown', e => {
  if (S.tab !== 'exercises' || e.target.closest('input, select, textarea')) return;
  if (e.code === 'Space') { e.preventDefault(); start(I.active ? 'check' : 'free'); }
});

G.exercises = { open(id) { G.go('exercises'); if (G.exById(id)) select(id); }, stop: () => stop(true), workBpm, isRunning: () => !!run };
if (!sel || !G.exById(sel)) sel = exList()[0].id;
renderList(); renderRunner();
})();
