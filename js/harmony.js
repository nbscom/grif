// Вкладка «Гармония»: аккорды, подсказки, прогрессии, гриф, тренировка нот
(() => {
'use strict';
const S = G.S, $ = G.$, A = G.audio;
let quiz = null;     // { target, ok, total, streak, marks, msg, msgOk, t0 }
let playing = -1, transport = null;
let lastNote = null;

const curVoicing = () => G.voicings(S.cur.root, S.cur.q)[S.cur.v];

function renderKey() {
  $('keyRoot').innerHTML = G.SHARP.map((_, i) => `<option value="${i}"${i === S.keyRoot ? ' selected' : ''}>${G.nn(i)}</option>`).join('');
  [...$('keyMode').children].forEach(b => b.classList.toggle('on', b.dataset.m === S.keyMode));
  $('power').checked = S.power;
}

function renderChord() {
  const c = S.cur, scalePcs = (S.keyMode === 'major' ? G.SCALES.major : G.SCALES.minor).iv.map(i => (S.keyRoot + i) % 12);
  $('roots').innerHTML = G.SHARP.map((_, i) =>
    `<button data-root="${i}" class="${i === c.root ? 'on' : ''} ${scalePcs.includes(i) ? 'inkey' : ''}" aria-pressed="${i === c.root}">${G.nn(i)}</button>`).join('');
  $('quals').innerHTML = G.QUAL_ORDER.map(q =>
    `<button data-q="${q}" class="${q === c.q ? 'on' : ''}" aria-pressed="${q === c.q}">${q === 'maj' ? 'мажор' : G.QUAL[q].suf}</button>`).join('');
  const deg = G.degreeOf(c);
  const tones = G.QUAL[c.q].iv.map(i => {
    const l = G.IVL[i];
    return `<span class="tone${i === 0 ? ' r' : ''}"><b>${G.nn((c.root + i) % 12)}</b><span>${l} · ${G.IVL_RU[l]}</span></span>`;
  }).join('');
  let body;
  if (G.isBass()) {
    const pos = G.bassRootPositions(c.root).map(p => `<span class="tone r"><b>${G.stringNo(p.s)}-я</b><span>${p.f === 0 ? 'открытая' : p.f + ' лад'}</span></span>`).join('');
    body = `<div class="cdesc">Корень на басу</div><div class="tones">${pos}</div>
      <p class="hint" style="text-align:center;max-width:34ch">На басу играют корень аккорда, а квинту и октаву добавляют для движения. Все звуки аккорда подсвечены на грифе ниже в режиме «аккорд».</p>`;
  } else {
    const vs = G.voicings(c.root, c.q);
    if (c.v >= vs.length) c.v = 0;
    const v = vs[c.v];
    body = v ? `<div class="vnav">
      <button id="vPrev" aria-label="Предыдущая аппликатура" ${c.v === 0 ? 'disabled' : ''}>‹</button>
      <div class="diagram-big" id="bigDiag" title="Нажмите, чтобы сыграть">${G.chordSVG(v.fr, c.root, c.q)}</div>
      <button id="vNext" aria-label="Следующая аппликатура" ${c.v >= vs.length - 1 ? 'disabled' : ''}>›</button>
    </div>
    <div class="vkind${/Drop/.test(v.kind) ? ' drop' : ''}">Аппликатура ${c.v + 1} из ${vs.length} · ${v.kind}</div>`
      : `<p class="hint">В строе ${G.tuningLetters()} для этого аккорда нет удобной аппликатуры.</p>`;
  }
  $('chordMain').innerHTML = `
    <div class="cname">${G.chordName(c)}</div>
    <div class="cdesc">${G.QUAL[c.q].name}</div>
    <span class="deg${deg ? '' : ' out'}">${deg ? deg + ' в ' + G.keyRu(true) : 'вне тональности ' + G.keyRu(false)}</span>
    ${body}
    <div class="tones">${tones}</div>
    <div class="row-btns">
      <button class="btn primary" id="playChord">▶ Сыграть</button>
      <button class="btn" id="arpChord">${G.isBass() ? 'Арпеджио' : 'Перебор'}</button>
    </div>`;
}

function renderSug() {
  const c = S.cur, deg = G.degreeOf(c), list = G.suggestions(c);
  const ref = (curVoicing() || { fr: [0] }).fr;
  $('sugCtx').innerHTML = deg
    ? `Сейчас звучит <b>${G.chordName(c)}</b>, это <b>${deg}</b> в ${G.keyRu(true)}. Варианты отсортированы по тому, как часто так ходят в рок- и поп-музыке.`
    : `<b>${G.chordName(c)}</b> не входит в ${G.keyRu(false)}. Варианты построены от самого аккорда. <button class="linkish" id="adoptKey">Сделать ${G.nn(c.root)} ${G.FAM[c.q] === 'm' ? 'минор' : 'мажор'} тональностью</button>`;
  $('sugList').innerHTML = list.map((g, i) => {
    let pic = '';
    if (G.isBass()) {
      const p = G.bassRootPositions(g.root)[0];
      pic = `<span class="bass-pos"><b>${p.f}</b><small>лад · ${G.stringNo(p.s)}-я</small></span>`;
    } else {
      const vi = G.nearestV(g.root, g.q, G.centerOf(ref)), v = G.voicings(g.root, g.q)[vi];
      pic = v ? G.chordSVG(v.fr, g.root, g.q, { mini: true }) : '';
    }
    return `<button class="sug" data-sug="${i}">
      <span class="rn">${g.rn}<span class="pill w${g.w}">${G.W_LABEL[g.w]}</span></span>
      <span class="nm">${G.chordName(g)}</span>
      <span class="mini-wrap">${pic}</span>
      <span class="why">${g.why}</span>
    </button>`;
  }).join('');
  $('sugList')._data = list;
}

// ---------- последовательность: размер, длительности, бой ----------
const PSIG = {
  '4/4': { spb: 8, beatSteps: [0, 2, 4, 6], strums: [['D-DU-UDU', 'поп: Д ДВ ВДВ'], ['DDDDDDDD', 'рок: восьмые вниз'], ['D-D-D-D-', 'на каждую долю'], ['D-------', 'только сильная доля']] },
  '3/4': { spb: 6, beatSteps: [0, 2, 4], strums: [['D-DUDU', 'вальс: Д ДВ ДВ'], ['DDDDDD', 'восьмые вниз'], ['D-D-D-', 'на каждую долю'], ['D-----', 'только сильная доля']] },
  '2/4': { spb: 4, beatSteps: [0, 2], strums: [['D-DU', 'Д ДВ'], ['DDDD', 'восьмые вниз'], ['D-D-', 'на каждую долю'], ['D---', 'только сильная доля']] },
  '6/8': { spb: 6, beatSteps: [0, 1, 2, 3, 4, 5], strums: [['D--D--', 'на две доли'], ['DDDDDD', 'все восьмые'], ['D-UD-U', 'Д ВД В'], ['D-----', 'только сильная доля']] },
};
S.pSig = PSIG[S.pSig] ? S.pSig : '4/4';
['pMetro', 'pCount', 'pSound', 'pLoop'].forEach((k, i) => { if (S[k] === undefined) S[k] = [true, true, true, true][i]; });
if (S.pStrum === undefined) S.pStrum = 0;
const sig = () => PSIG[S.pSig];
const beatsPerBar = () => S.pSig === '6/8' ? 6 : sig().beatSteps.length;
const durOpts = () => S.pSig === '3/4' ? [1, 2, 4] : [0.5, 1, 2, 4];
const barsOf = c => c.bars || 1;
const durLabel = b => b === 0.5 ? '½ такта' : b === 1 ? '1 такт' : b + ' такта';
const totalBars = () => S.prog.reduce((a, c) => a + barsOf(c), 0);
let beatNow = null; // { seg, k }

function renderProg() {
  $('preset').innerHTML = `<option value="">Готовые прогрессии…</option>` + G.PRESETS[S.keyMode].map((p, i) => `<option value="${i}">${p[0]}</option>`).join('');
  $('bpm').value = S.bpm;
  $('pSig').innerHTML = Object.keys(PSIG).map(k => `<button data-v="${k}" class="${k === S.pSig ? 'on' : ''}" aria-pressed="${k === S.pSig}">${k}</button>`).join('');
  $('pStrum').innerHTML = sig().strums.map(([pat, nm], i) => `<option value="${i}"${i === S.pStrum ? ' selected' : ''}>${nm}</option>`).join('');
  $('pStrum').disabled = G.isBass();
  ['pMetro', 'pCount', 'pSound', 'pLoop'].forEach(k => { $(k).checked = !!S[k]; });
  $('playProg').textContent = playing >= 0 ? '■ Стоп' : '▶ Играть';
  $('playProg').disabled = !S.prog.length;
  const bpb = beatsPerBar();
  $('progList').innerHTML = S.prog.length ? S.prog.map((c, i) => {
    const nb = Math.round(barsOf(c) * bpb);
    return `<div class="pchip${i === S.sel ? ' on' : ''}${i === playing ? ' play' : ''}" data-pi="${i}" role="button" tabindex="0" aria-label="${G.chordName(c)}, ${durLabel(barsOf(c))}" style="flex:${barsOf(c)} 1 ${Math.round(barsOf(c) * 96)}px">
      <b>${G.chordName(c)}</b><small>${G.degreeOf(c) || '—'} · ${durLabel(barsOf(c))}</small>
      <span class="bdots">${Array.from({ length: nb }, (_, k) => `<i data-b="${i}-${k}" class="${k % bpb === 0 ? 'down' : ''}"></i>`).join('')}</span>
      <button class="px" data-del="${i}" aria-label="Удалить ${G.chordName(c)}">×</button>
    </div>`;
  }).join('') : `<span class="empty">Последовательность пуста. Выберите аккорд и нажмите подсказку или возьмите готовую прогрессию.</span>`;
  const c = S.prog[S.sel];
  $('seqSel').innerHTML = c ? `<span class="lbl">Аккорд ${S.sel + 1}: ${G.chordName(c)}</span>
    <div class="seg" id="pDur">${durOpts().map(b => `<button data-d="${b}" class="${b === barsOf(c) ? 'on' : ''}">${b === 0.5 ? '½' : b}</button>`).join('')}</div><span class="hint">такт.</span>
    <button class="btn" data-mv="-1" ${S.sel === 0 ? 'disabled' : ''} aria-label="Сдвинуть влево">←</button>
    <button class="btn" data-mv="1" ${S.sel >= S.prog.length - 1 ? 'disabled' : ''} aria-label="Сдвинуть вправо">→</button>
    <button class="btn" data-dup="1">Повторить</button>` : '';
  const tb = totalBars(), sec = tb * sig().spb * 60 / S.bpm / 2;
  $('seqStatus').innerHTML = S.prog.length ? `<span class="hint">${tb % 1 ? tb.toFixed(1) : tb} ${tb === 1 ? 'такт' : tb < 5 ? 'такта' : 'тактов'} в размере ${S.pSig} · круг ${G.fmtTime(sec)}</span><span class="seq-beat" id="seqBeat"></span>` : '';
}

function renderFB() {
  const c = S.cur, chordPcs = G.chordLbls(c), voicing = (curVoicing() || { fr: [] }).fr;
  const sc = G.SCALES[S.scale], scaleSet = {};
  sc.iv.forEach(i => scaleSet[(S.keyRoot + i) % 12] = G.SC_IVL[i]);
  G.drawFretboard($('fb'), {
    dot(s, f) {
      const pc = G.pcAt(s, f);
      let cls = null, label = '', r = 11;
      if (quiz) {
        const m = quiz.marks.find(m => m.s === s && m.f === f);
        if (m) { cls = m.ok ? 'ok' : 'bad'; label = G.nn(pc); }
      } else if (S.fbMode === 'notes') {
        const nat = G.NATURAL.includes(pc);
        cls = nat ? 'nat' : 'acc'; r = nat ? 11 : 9.5;
        label = S.fbLabels === 'names' ? G.nn(pc) : G.SC_IVL[(pc - S.keyRoot + 12) % 12];
      } else if (S.fbMode === 'chord') {
        if (chordPcs[pc] !== undefined) {
          cls = pc === c.root ? 'root' : 'tone';
          if (voicing[s] === f) cls += ' ring';
          label = S.fbLabels === 'names' ? G.nn(pc) : chordPcs[pc];
        }
      } else if (scaleSet[pc] !== undefined) {
        cls = pc === S.keyRoot ? 'root' : 'tone';
        label = S.fbLabels === 'names' ? G.nn(pc) : scaleSet[pc];
      }
      if (lastNote && lastNote.s === s && lastNote.f === f && !quiz) {
        if (!cls) { cls = 'nat'; label = G.nn(pc); }
        cls += ' ring';
      }
      return cls ? { cls, label, r } : null;
    },
  });
  [...$('fbMode').children].forEach(b => b.classList.toggle('on', !quiz && b.dataset.v === S.fbMode));
  [...$('fbLabels').children].forEach(b => b.classList.toggle('on', b.dataset.v === S.fbLabels));
  $('scale').innerHTML = Object.entries(G.SCALES).map(([k, v]) => `<option value="${k}"${k === S.scale ? ' selected' : ''}>${G.nn(S.keyRoot)} ${v.name}</option>`).join('');
  $('scale').hidden = S.fbMode !== 'scale' || !!quiz;
  $('quizBtn').textContent = quiz ? 'Закончить тренировку' : 'Тренировка: найди ноту';
  $('quizBtn').classList.toggle('primary', !!quiz);
  $('quizSrc').hidden = !quiz;
  [...$('quizSrc').children].forEach(b => b.classList.toggle('on', b.dataset.v === S.quizSrc));

  let info;
  if (quiz) {
    const mic = S.quizSrc === 'mic';
    const micState = mic && !(G.input && G.input.active) ? `<button class="btn primary" data-goto="tuner">Подключить вход с гитары</button>` : '';
    info = `<span>${mic ? 'Сыграйте на инструменте ноту' : 'Найдите на грифе ноту'}</span><span class="quiz-target">${G.nn(quiz.target)}</span>
      <span class="score">верно ${quiz.ok} из ${quiz.total} · серия ${quiz.streak}</span>
      ${quiz.msg ? `<span class="${quiz.msgOk ? 'flash-ok' : 'flash-bad'}">${quiz.msg}</span>` : ''}${micState}`;
  } else {
    const legend = S.fbMode === 'notes'
      ? `<span><i class="sw" style="background:var(--pearl)"></i>натуральные ноты</span><span><i class="sw" style="background:#8C8478"></i>диезы и бемоли</span>`
      : `<span><i class="sw" style="background:var(--fb-root)"></i>тоника ${S.fbMode === 'chord' ? G.chordName(c) : G.nn(S.keyRoot)}</span><span><i class="sw" style="background:var(--fb-tone)"></i>${S.fbMode === 'chord' ? 'звуки аккорда' : 'ноты гаммы'}</span>${S.fbMode === 'chord' && !G.isBass() ? '<span><i class="sw" style="background:var(--fb-tone);box-shadow:0 0 0 2px #fff"></i>выбранная аппликатура</span>' : ''}`;
    const ln = lastNote ? `<span>Нота <b>${G.midiName(G.midiAt(lastNote.s, lastNote.f))}</b> · ${G.stringNo(lastNote.s)}-я струна, ${lastNote.f === 0 ? 'открытая' : lastNote.f + '-й лад'}</span>` : `<span class="hint">Нажмите на лад, чтобы услышать ноту.</span>`;
    info = `${ln}<div class="legend">${legend}</div>`;
  }
  $('fbInfo').innerHTML = info;
}

function renderAll() { renderKey(); renderChord(); renderSug(); renderProg(); renderFB(); G.save(); }
G.harmony = {
  render: renderAll,
  show(c) { S.sel = -1; setCur({ root: c.root, q: c.q, v: c.v || 0 }, { sync: false }); renderAll(); },
  append(c) { S.prog.push({ root: c.root, q: c.q, v: c.v || 0, bars: 1 }); S.sel = S.prog.length - 1; setCur(S.prog[S.sel], { sync: false }); renderAll(); },
  stop: () => { if (playing >= 0) stopProg(); },
};

// ---------- звук ----------
function setCur(c, { sync = true } = {}) {
  S.cur = { ...c };
  if (sync && S.sel >= 0 && S.prog[S.sel]) S.prog[S.sel] = { ...c, bars: S.prog[S.sel].bars || 1 };
}
function bassLine(root, at, step, pattern) {
  const m = G.bassRootMidi(root);
  pattern.forEach((iv, k) => { if (iv !== null) A.pluck(m + iv, 0, at + k * step, k === 0 ? 1 : 0.85, step * 0.9); });
}
function playCur() {
  if (G.isBass()) return bassLine(S.cur.root, A.now() + 0.02, 0.001, [0]);
  const v = curVoicing(); if (v) A.strum(v.fr);
}
function arpCur() {
  const t = A.now() + 0.02;
  if (G.isBass()) {
    const third = G.QUAL[S.cur.q].iv[1];
    return bassLine(S.cur.root, t, 0.3, [0, third, 7, 12, 7, third, 0]);
  }
  const v = curVoicing(); if (!v) return;
  const idx = v.fr.map((f, s) => f >= 0 ? s : -1).filter(s => s >= 0);
  idx.concat(idx.slice(1, -1).reverse()).forEach((s, k) => A.pluck(G.midiAt(s, v.fr[s]), s, t + k * 0.17, 0.9));
}
function stopProg() {
  if (transport) transport.stop();
  transport = null; playing = -1; beatNow = null; A.chokeAll(); A.clearVisual(); renderProg();
}
function lightBeat(seg, k, label) {
  document.querySelectorAll('#progList .bdots i.now').forEach(el => el.classList.remove('now'));
  const el = document.querySelector(`#progList [data-b="${seg}-${k}"]`);
  if (el) el.classList.add('now');
  const sb = $('seqBeat'); if (sb) sb.textContent = label;
}
function playProg() {
  if (playing >= 0) return stopProg();
  if (!S.prog.length) return;
  A.ctx();
  const sg = sig(), spb = sg.spb, sigName = S.pSig;
  // раскладка: для каждого шага (восьмой) — индекс аккорда
  const segAt = [], segStart = [];
  S.prog.forEach((c, i) => { segStart.push(segAt.length); const n = Math.max(1, Math.round(barsOf(c) * spb)); for (let k = 0; k < n; k++) segAt.push(i); });
  const total = segAt.length;
  const countIn = S.pCount ? spb : 0;
  const stepLen = () => 60 / S.bpm / 2;
  const beatOf = st => sigName === '6/8' ? st : sg.beatSteps.indexOf(st);
  playing = 0;
  let lastSeg = -1;
  transport = new A.Transport({
    stepDur: stepLen,
    onStep(step, t) {
      const sIn = step - countIn;
      const inBar = ((sIn % spb) + spb) % spb;
      const isBeat = sigName === '6/8' || sg.beatSteps.includes(inBar);
      const lvl = sigName === '6/8' ? (inBar === 0 ? 2 : inBar === 3 ? 1 : 0) : (inBar === 0 ? 2 : 1);
      if (sIn < 0) {                                   // отсчёт
        if (isBeat) { A.click(t, lvl); A.atTime(t, () => { const sb = $('seqBeat'); if (sb) sb.textContent = 'Отсчёт: ' + (beatOf(inBar) + 1); }); }
        return;
      }
      if (sIn >= total && !S.pLoop) { transport.stop(); A.atTime(t, () => { if (playing >= 0) stopProg(); }); return; }
      const pos = sIn % total, seg = segAt[pos], c = S.prog[seg];
      if (!c) return;
      if (S.pMetro && isBeat) A.click(t, lvl);
      if (seg !== lastSeg || pos === 0) {
        lastSeg = seg;
        A.atTime(t, () => {
          if (!transport) return;
          playing = seg; S.sel = seg; S.cur = { ...c };
          renderChord(); renderSug(); renderProg(); renderFB();
        });
      }
      if (isBeat) {
        const k = Math.floor((pos - segStart[seg]) / (sigName === '6/8' ? 1 : 2));
        const bar = Math.floor(pos / spb) + 1, totalBarsN = Math.ceil(total / spb);
        A.atTime(t, () => lightBeat(seg, k, `такт ${bar} из ${totalBarsN} · доля ${beatOf(inBar) + 1}`));
      }
      if (!S.pSound) return;
      const ch = G.isBass() ? (isBeat ? 'D' : '-') : sg.strums[Math.min(S.pStrum, sg.strums.length - 1)][0][inBar];
      if (!ch || ch === '-') return;
      if (G.isBass()) { A.pluck(G.bassRootMidi(c.root) + (inBar === spb - 2 && sigName !== '6/8' ? 12 : 0), 0, t, inBar === 0 ? 1 : 0.8, stepLen() * 1.7); return; }
      const v = G.voicings(c.root, c.q)[c.v];
      if (v) A.strum(v.fr, ch === 'D' ? 'down' : 'up', ch === 'D' ? (inBar === 0 ? 1.05 : 0.85) : 0.55, t);
    },
  });
  transport.start();
  renderProg();
}

// ---------- тренировка нот ----------
function nextQuiz() {
  let t; do { t = Math.floor(Math.random() * 12); } while (quiz && t === quiz.target);
  quiz.target = t; quiz.t0 = performance.now();
}
function answer(pc, s, f, viaMic) {
  if (!quiz) return;
  const ok = pc === quiz.target;
  quiz.total++;
  if (s !== undefined) quiz.marks.push({ s, f, ok });
  const where = s !== undefined ? ` на ${G.stringNo(s)}-й струне, ${f === 0 ? 'открытая' : f + '-й лад'}` : '';
  const secs = ((performance.now() - quiz.t0) / 1000).toFixed(1);
  if (ok) { quiz.ok++; quiz.streak++; quiz.msg = `Верно: ${G.nn(pc)}${where} · ${secs} с`; quiz.msgOk = true; }
  else { quiz.streak = 0; quiz.msg = `Прозвучала ${G.nn(pc)}${viaMic ? '' : where}. Попробуйте ещё раз.`; quiz.msgOk = false; }
  G.emit('quizAnswer', { ok, ms: performance.now() - quiz.t0 });
  if (ok) { const done = quiz; setTimeout(() => { if (quiz === done) { quiz.marks = []; nextQuiz(); renderFB(); } }, 900); }
  renderFB();
}
G.on('note', n => {
  if (!quiz || S.quizSrc !== 'mic' || G.S.tab !== 'harmony' || !n.onset || n.midi === null) return;
  if (quiz.msgOk && performance.now() - quiz.t0 < 300) return;
  answer(Math.round(n.midi) % 12, undefined, undefined, true);
});

// ---------- события ----------
$('keyRoot').addEventListener('change', e => { S.keyRoot = +e.target.value; renderAll(); });
$('keyMode').addEventListener('click', e => {
  const m = e.target.dataset.m; if (!m || m === S.keyMode) return;
  S.keyMode = m;
  const swap = { minPent: 'majPent', majPent: 'minPent', major: 'minor', minor: 'major' };
  if (swap[S.scale] && (m === 'major') === (S.scale === 'minPent' || S.scale === 'minor')) S.scale = swap[S.scale];
  renderAll();
});
$('power').addEventListener('change', e => { S.power = e.target.checked; renderSug(); G.save(); });
$('roots').addEventListener('click', e => {
  const r = e.target.dataset.root; if (r === undefined) return;
  setCur({ root: +r, q: S.cur.q, v: 0 }); renderAll(); playCur();
});
$('quals').addEventListener('click', e => {
  const q = e.target.dataset.q; if (!q) return;
  setCur({ root: S.cur.root, q, v: 0 }); renderAll(); playCur();
});
$('chordMain').addEventListener('click', e => {
  const t = e.target.closest('button, #bigDiag'); if (!t) return;
  const n = G.voicings(S.cur.root, S.cur.q).length;
  if (t.id === 'vPrev' && S.cur.v > 0) { setCur({ ...S.cur, v: S.cur.v - 1 }); renderAll(); playCur(); }
  else if (t.id === 'vNext' && S.cur.v < n - 1) { setCur({ ...S.cur, v: S.cur.v + 1 }); renderAll(); playCur(); }
  else if (t.id === 'playChord' || t.id === 'bigDiag') playCur();
  else if (t.id === 'arpChord') arpCur();
});
$('sugCtx').addEventListener('click', e => {
  if (e.target.id !== 'adoptKey') return;
  S.keyRoot = S.cur.root; S.keyMode = G.FAM[S.cur.q] === 'm' ? 'minor' : 'major'; renderAll();
});
$('sugList').addEventListener('click', e => {
  const b = e.target.closest('[data-sug]'); if (!b) return;
  const g = $('sugList')._data[+b.dataset.sug];
  const ref = G.centerOf((curVoicing() || { fr: [0] }).fr);
  const c = { root: g.root, q: g.q, v: G.isBass() ? 0 : G.nearestV(g.root, g.q, ref) };
  const at = S.sel >= 0 ? S.sel + 1 : S.prog.length;
  S.prog.splice(at, 0, c); S.sel = at; setCur(c, { sync: false });
  renderAll(); playCur();
});
$('progList').addEventListener('click', e => {
  const del = e.target.closest('[data-del]');
  if (del) {
    const i = +del.dataset.del; S.prog.splice(i, 1);
    if (S.sel >= S.prog.length) S.sel = S.prog.length - 1;
    if (S.sel >= 0) setCur(S.prog[S.sel], { sync: false });
    if (!S.prog.length && playing >= 0) stopProg();
    renderAll(); return;
  }
  const chip = e.target.closest('[data-pi]'); if (!chip) return;
  S.sel = +chip.dataset.pi; setCur(S.prog[S.sel], { sync: false }); renderAll();
  if (playing < 0) playCur();
});
$('progList').addEventListener('keydown', e => {
  if ((e.key === 'Enter' || e.key === ' ') && e.target.dataset.pi !== undefined) { e.preventDefault(); e.target.click(); }
});
$('preset').addEventListener('change', e => {
  if (e.target.value === '') return;
  const p = G.PRESETS[S.keyMode][+e.target.value][1];
  S.prog = G.chainVoicings(p.map(([iv, q]) => ({ root: (S.keyRoot + iv) % 12, q: G.powerize(q) })));
  S.sel = 0; setCur(S.prog[0], { sync: false });
  e.target.value = '';
  renderAll();
});
$('bpm').addEventListener('change', e => { S.bpm = G.clamp(+e.target.value || 96, 40, 220); e.target.value = S.bpm; G.save(); renderProg(); });
$('pSig').addEventListener('click', e => {
  const v = e.target.dataset.v; if (!v || v === S.pSig) return;
  if (playing >= 0) stopProg();
  S.pSig = v; S.pStrum = 0;
  if (v === '3/4') S.prog.forEach(c => { if (barsOf(c) === 0.5) c.bars = 1; });
  G.save(); renderProg();
});
$('pStrum').addEventListener('change', e => { S.pStrum = +e.target.value; G.save(); });
['pMetro', 'pCount', 'pSound', 'pLoop'].forEach(k => $(k).addEventListener('change', e => { S[k] = e.target.checked; G.save(); }));
$('seqSel').addEventListener('click', e => {
  const t = e.target.closest('button'); if (!t || S.sel < 0 || !S.prog[S.sel]) return;
  if (playing >= 0) stopProg();
  const i = S.sel;
  if (t.dataset.d) { S.prog[i].bars = +t.dataset.d; S.cur.bars = S.prog[i].bars; }
  else if (t.dataset.mv) {
    const j = i + +t.dataset.mv; if (j < 0 || j >= S.prog.length) return;
    [S.prog[i], S.prog[j]] = [S.prog[j], S.prog[i]]; S.sel = j;
  } else if (t.dataset.dup) { S.prog.splice(i + 1, 0, { ...S.prog[i] }); S.sel = i + 1; }
  G.save(); renderProg();
});
$('playProg').addEventListener('click', playProg);
$('addCur').addEventListener('click', () => { S.prog.push({ ...S.cur }); S.sel = S.prog.length - 1; renderAll(); });
$('clearProg').addEventListener('click', () => { if (playing >= 0) stopProg(); S.prog = []; S.sel = -1; renderAll(); });

$('fbMode').addEventListener('click', e => {
  const v = e.target.dataset.v; if (!v) return;
  quiz = null; S.fbMode = v; renderFB(); G.save();
});
$('fbLabels').addEventListener('click', e => { const v = e.target.dataset.v; if (!v) return; S.fbLabels = v; renderFB(); G.save(); });
$('scale').addEventListener('change', e => { S.scale = e.target.value; renderFB(); G.save(); });
$('quizBtn').addEventListener('click', () => {
  if (quiz) quiz = null;
  else { quiz = { ok: 0, total: 0, streak: 0, marks: [], msg: '' }; nextQuiz(); lastNote = null; }
  renderFB();
});
$('quizSrc').addEventListener('click', e => { const v = e.target.dataset.v; if (!v) return; S.quizSrc = v; G.save(); renderFB(); });
$('fbInfo').addEventListener('click', e => { const t = e.target.closest('[data-goto]'); if (t) G.go(t.dataset.goto); });
$('fb').addEventListener('click', e => {
  const t = e.target.closest('.hit'); if (!t) return;
  const s = +t.dataset.s, f = +t.dataset.f;
  A.pluck(G.midiAt(s, f), s);
  if (quiz && S.quizSrc === 'click') return answer(G.pcAt(s, f), s, f);
  if (!quiz) lastNote = { s, f };
  renderFB();
});

G.on('instrument', () => { if (playing >= 0) stopProg(); lastNote = null; if (quiz) quiz.marks = []; G.revoice(); renderAll(); });
})();
