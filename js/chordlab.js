// Блок «Изучение аккордов»: карточки по наборам, проверка по звуку, смены за минуту
(() => {
'use strict';
const S = G.S, $ = G.$, A = G.audio, D = G.data, I = G.input;
D.chordKnow = D.chordKnow || {};
D.changes = D.changes || {};

// pref: какую аппликатуру показывать — open, E (корень на 6-й), A (корень на 5-й), any
const SETS = {
  guitar: [
    { id: 'open-maj', name: 'Открытые мажорные', pref: 'open', items: [[0, 'maj'], [9, 'maj'], [7, 'maj'], [4, 'maj'], [2, 'maj']] },
    { id: 'open-min', name: 'Открытые минорные', pref: 'open', items: [[9, 'm'], [4, 'm'], [2, 'm']] },
    { id: 'open-7', name: 'Септаккорды', pref: 'open', items: [[9, '7'], [11, '7'], [0, '7'], [2, '7'], [4, '7'], [7, '7']] },
    { id: 'power', name: 'Пауэр-аккорды', pref: 'any', items: [[4, '5'], [7, '5'], [9, '5'], [0, '5'], [2, '5'], [5, '5']] },
    { id: 'barre-e', name: 'Баррэ от 6-й струны', pref: 'E', items: [[5, 'maj'], [5, 'm'], [7, 'maj'], [7, 'm'], [9, 'maj'], [11, 'm']] },
    { id: 'barre-a', name: 'Баррэ от 5-й струны', pref: 'A', items: [[10, 'maj'], [0, 'maj'], [0, 'm'], [11, 'maj'], [11, 'm'], [2, 'm']] },
    { id: 'sus', name: 'sus2 и sus4', pref: 'open', items: [[9, 'sus2'], [9, 'sus4'], [2, 'sus2'], [2, 'sus4'], [4, 'sus4']] },
  ],
  bass: [
    { id: 'b-maj', name: 'Мажорные трезвучия', pref: 'any', items: [[4, 'maj'], [9, 'maj'], [2, 'maj'], [7, 'maj'], [0, 'maj'], [5, 'maj']] },
    { id: 'b-min', name: 'Минорные трезвучия', pref: 'any', items: [[4, 'm'], [9, 'm'], [2, 'm'], [7, 'm'], [11, 'm'], [6, 'm']] },
    { id: 'b-7', name: 'Септаккорды', pref: 'any', items: [[4, '7'], [9, '7'], [2, '7'], [7, '7']] },
  ],
};
const KNOW_RU = { new: 'новый', learn: 'учу', know: 'знаю' };
const key = (r, q) => `${S.inst}:${r}:${q}`;
const know = (r, q) => (D.chordKnow[key(r, q)] || {}).s || 'new';
const sets = () => SETS[S.inst];
let setId = S.labSet && sets().find(x => x.id === S.labSet) ? S.labSet : sets()[0].id;
let mode = S.labMode || 'cards';
let card = null, revealed = false, heard = null;
let ch = null; // смены за минуту
S.labA = S.labA || 0; S.labB = S.labB || 1; S.labBpm = S.labBpm || 60; S.labMetro = S.labMetro !== false;

const curSet = () => sets().find(x => x.id === setId) || sets()[0];
function prefV(r, q, pref) {
  const vs = G.voicings(r, q);
  const test = { open: v => /открыт/.test(v.kind), E: v => /6-й/.test(v.kind), A: v => /5-й/.test(v.kind) }[pref];
  const i = test ? vs.findIndex(test) : 0;
  return Math.max(0, i);
}
function pickCard() {
  const items = curSet().items;
  // сначала новые и «учу», знакомые реже
  const w = items.map(([r, q]) => ({ new: 3, learn: 3, know: 1 })[know(r, q)]);
  let x = Math.random() * w.reduce((a, b) => a + b, 0), i = 0;
  while (x > w[i] && i < w.length - 1) { x -= w[i]; i++; }
  if (card && items.length > 1 && items[i][0] === card.root && items[i][1] === card.q) i = (i + 1) % items.length;
  const [root, q] = items[i];
  card = { root, q, v: G.isBass() ? 0 : prefV(root, q, curSet().pref) };
  revealed = false; heard = null;
}

function render() {
  const el = $('chordLab'), st = curSet();
  if (!card || !st.items.some(([r, q]) => r === card.root && q === card.q)) pickCard();
  const head = `<div class="head"><h2 id="h-lab">Изучение аккордов</h2>
    <div class="tools">
      <select id="labSet" aria-label="Набор аккордов">${sets().map(x => `<option value="${x.id}"${x.id === setId ? ' selected' : ''}>${x.name}</option>`).join('')}</select>
      <div class="seg" id="labMode"><button data-v="cards" class="${mode === 'cards' ? 'on' : ''}">Карточки</button><button data-v="changes" class="${mode === 'changes' ? 'on' : ''}">Смены за минуту</button></div>
    </div></div>`;
  const chips = `<div class="lab-chips">${st.items.map(([r, q]) => {
    const k = know(r, q), on = card && r === card.root && q === card.q;
    return `<button class="lab-chip k-${k}${on ? ' on' : ''}" data-pick="${r}:${q}" title="${KNOW_RU[k]}">${G.chordName({ root: r, q })}</button>`;
  }).join('')}<span class="hint">${st.items.filter(([r, q]) => know(r, q) === 'know').length} из ${st.items.length} знаю</span></div>`;
  el.innerHTML = head + chips + (mode === 'cards' ? cardsView() : changesView());
}

function cardsView() {
  const c = card, k = know(c.root, c.q);
  let pic;
  if (G.isBass()) {
    const pos = G.bassRootPositions(c.root).slice(0, 3).map(p => `${G.stringNo(p.s)}-я струна, ${p.f === 0 ? 'открытая' : p.f + ' лад'}`).join(' · ');
    pic = `<div class="lab-notes">${G.QUAL[c.q].iv.map(i => `<span class="tone${i === 0 ? ' r' : ''}"><b>${G.nn((c.root + i) % 12)}</b><span>${G.IVL[i]}</span></span>`).join('')}</div><p class="hint">Корень: ${pos}</p>`;
  } else {
    const v = G.voicings(c.root, c.q)[c.v];
    pic = v ? `<div class="lab-diag">${G.chordSVG(v.fr, c.root, c.q)}</div><p class="hint">${v.kind}</p>` : '<p class="hint">Нет аппликатуры в этом строе.</p>';
  }
  const next = G.suggestions(c, c.root, G.FAM[c.q] === 'm' ? 'minor' : 'major').slice(0, 4);
  const micLine = I.active
    ? (heard === null ? `<span class="hint">Сыграйте аккорд: проверю по басовой ноте (${G.nn(c.root)}).</span>`
      : heard === true ? `<span class="flash-ok">Слышу ${G.nn(c.root)} в басу: верно.</span>` : `<span class="flash-bad">В басу ${G.esc(heard)}, а нужна ${G.nn(c.root)}.</span>`)
    : `<button class="linkish" data-goto="tuner">Включите вход с гитары</button><span class="hint">, чтобы приложение проверяло аккорд по звуку.</span>`;
  return `<div class="lab-card">
    <div class="lab-main">
      <span class="lbl">${KNOW_RU[k]}</span>
      <div class="cname">${G.chordName(c)}</div>
      <div class="cdesc">${G.QUAL[c.q].name}</div>
      <div class="row lab-mic">${micLine}</div>
      <div class="row" style="justify-content:center">
        ${revealed ? '' : `<button class="btn primary" id="labReveal">Показать ${G.isBass() ? 'звуки' : 'аппликатуру'}</button>`}
        <button class="btn" id="labPlay">▶ Послушать</button>
      </div>
      <div class="row" style="justify-content:center">
        <button class="btn" id="labLearn">Ещё учу</button>
        <button class="btn good-btn" id="labKnow">Знаю</button>
        <button class="btn" id="labNext">Следующий →</button>
      </div>
    </div>
    <div class="lab-side">
      <div class="lab-pic${revealed ? '' : ' hidden-pic'}">${revealed ? pic : `<p class="hint">Вспомните аппликатуру и поставьте пальцы, затем проверьте себя.</p>`}</div>
      <div class="lab-next">
        <span class="lbl">Что играть после ${G.chordName(c)}</span>
        <div class="lab-next-row">${next.map(g => `<button class="lab-sug" data-sr="${g.root}" data-sq="${g.q}" title="${G.esc(g.why)}"><b>${G.chordName(g)}</b><small>${g.rn}</small></button>`).join('')}</div>
        <p class="hint">Ступени считаются от ${G.chordName(c)} как от тоники. Нажмите, чтобы добавить пару в последовательность.</p>
      </div>
    </div>
  </div>`;
}

function changesView() {
  const items = curSet().items;
  const a = items[S.labA % items.length], b = items[S.labB % items.length];
  const pk = `${S.inst}:${G.chordName({ root: a[0], q: a[1] })}-${G.chordName({ root: b[0], q: b[1] })}`;
  const rec = D.changes[pk] || {};
  const opt = sel => items.map(([r, q], i) => `<option value="${i}"${i === sel % items.length ? ' selected' : ''}>${G.chordName({ root: r, q })}</option>`).join('');
  const left = ch ? Math.max(0, 60 - (A.now() - ch.t0)) : 60;
  return `<div class="lab-changes">
    <p class="ctx">Меняйте два аккорда туда-обратно 60 секунд и считайте смены. Метроном задаёт ровный темп: одна смена на долю, когда освоитесь. ${I.active ? 'Вход включён: смены засчитываются сами по смене басовой ноты.' : 'Нажимайте «+1» (или пробел) на каждой смене.'}</p>
    <div class="row">
      <select id="labA" aria-label="Первый аккорд">${opt(S.labA)}</select><span>⇄</span><select id="labB" aria-label="Второй аккорд">${opt(S.labB)}</select>
      <label class="check"><input type="checkbox" id="labMetro"${S.labMetro ? ' checked' : ''}> Метроном</label>
      <label class="bpm" for="labBpm"><input id="labBpm" type="number" min="30" max="200" value="${S.labBpm}"> BPM</label>
    </div>
    <div class="lab-ch-main">
      <div class="lab-ch-pair">${[a, b].map(([r, q], i) => `<div class="lab-ch-c${ch && ch.cur === i ? ' now' : ''}"><div class="cname">${G.chordName({ root: r, q })}</div>${!G.isBass() && G.voicings(r, q).length ? `<div class="lab-mini">${G.chordSVG(G.voicings(r, q)[prefV(r, q, curSet().pref)].fr, r, q, { mini: true })}</div>` : ''}</div>`).join('')}</div>
      <div class="lab-ch-count"><span class="big-num" id="labCount">${ch ? ch.n : (rec.last ?? 0)}</span><span class="hint">смен</span></div>
      <div class="lab-ch-count"><span class="big-num" id="labLeft">${Math.ceil(left)}</span><span class="hint">секунд</span></div>
    </div>
    <div class="row" style="justify-content:center">
      <button class="btn primary big" id="labGo">${ch ? '■ Стоп' : '▶ Старт, 60 секунд'}</button>
      <button class="btn big" id="labPlus"${ch ? '' : ' disabled'}>+1</button>
    </div>
    <p class="hint" style="text-align:center">Рекорд для этой пары: <b>${rec.best ?? '—'}</b>${rec.d ? ` (${rec.d.split('-').reverse().join('.')})` : ''}. Хороший ориентир — 30 смен в минуту.</p>
  </div>`;
}

// ---------- смены за минуту ----------
function startChanges() {
  const items = curSet().items;
  const a = items[S.labA % items.length], b = items[S.labB % items.length];
  if (a === b) return;
  G.harmony.stop();
  const c = A.ctx();
  ch = { t0: c.currentTime + 0.1, n: 0, cur: 0, lastRoot: null, roots: [a[0], b[0]], pk: `${S.inst}:${G.chordName({ root: a[0], q: a[1] })}-${G.chordName({ root: b[0], q: b[1] })}` };
  ch.tr = new A.Transport({
    stepDur: () => 60 / S.labBpm,
    onStep(step, t) {
      if (t > ch.t0 + 60) { ch.tr.stop(); A.atTime(t, () => stopChanges(true)); return; }
      if (S.labMetro) A.click(t, step % 4 === 0 ? 2 : 1);
    },
  });
  ch.tr.start(ch.t0);
  ch.offNote = G.on('note', n => {
    if (!ch || n.midi === null) return;
    const pc = ((Math.round(n.midi) % 12) + 12) % 12;
    const i = ch.roots.indexOf(pc);
    if (i < 0) return;
    if (ch.lastRoot !== null && pc !== ch.lastRoot) bump(i);
    ch.lastRoot = pc;
  });
  ch.timer = setInterval(() => { const l = $('labLeft'); if (l && ch) l.textContent = Math.ceil(Math.max(0, 60 - (A.now() - ch.t0))); }, 200);
  render();
}
function bump(i) {
  if (!ch || A.now() < ch.t0) return;
  ch.n++; ch.cur = i === undefined ? 1 - ch.cur : i;
  const el = $('labCount'); if (el) el.textContent = ch.n;
  document.querySelectorAll('.lab-ch-c').forEach((e, k) => e.classList.toggle('now', k === ch.cur));
}
function stopChanges(finished) {
  if (!ch) return;
  const r = ch; ch = null;
  r.tr.stop(); clearInterval(r.timer); if (r.offNote) r.offNote();
  if (finished) {
    const rec = D.changes[r.pk] = D.changes[r.pk] || {};
    rec.last = r.n;
    if (!rec.best || r.n > rec.best) { rec.best = r.n; rec.d = G.today(); }
    G.saveData();
    A.click(A.now() + 0.02, 2); A.click(A.now() + 0.2, 2);
  }
  if (!G.planActive || !G.planActive()) G.addPractice(Math.min(60, A.now() - r.t0), 'free');
  render();
}

// ---------- события ----------
function setKnow(s) {
  const k = key(card.root, card.q);
  D.chordKnow[k] = Object.assign(D.chordKnow[k] || {}, { s, d: G.today() });
  G.saveData();
}
function playCard(c) {
  if (G.isBass()) { const m = G.bassRootMidi(c.root), t = A.now() + 0.02; G.QUAL[c.q].iv.concat([12]).forEach((iv, k) => A.pluck(m + iv, 0, t + k * 0.28, 0.9, 0.26)); return; }
  const v = G.voicings(c.root, c.q)[c.v]; if (v) A.strum(v.fr);
}
$('chordLab').addEventListener('click', e => {
  const t = e.target.closest('button'); if (!t) return;
  if (t.id === 'labReveal') { revealed = true; render(); }
  else if (t.id === 'labPlay') playCard(card);
  else if (t.id === 'labKnow') { setKnow('know'); pickCard(); render(); }
  else if (t.id === 'labLearn') { setKnow('learn'); pickCard(); render(); }
  else if (t.id === 'labNext') { pickCard(); render(); }
  else if (t.dataset.pick) {
    const [r, q] = t.dataset.pick.split(':');
    card = { root: +r, q, v: G.isBass() ? 0 : prefV(+r, q, curSet().pref) }; revealed = mode === 'cards' ? false : revealed; heard = null; render();
  } else if (t.dataset.sr !== undefined) {
    const nx = { root: +t.dataset.sr, q: t.dataset.sq };
    nx.v = G.isBass() ? 0 : G.nearestV(nx.root, nx.q, G.centerOf((G.voicings(card.root, card.q)[card.v] || { fr: [0] }).fr));
    G.harmony.append(card); G.harmony.append(nx);
    t.classList.add('added'); t.querySelector('small').textContent = 'добавлено';
  } else if (t.dataset.v && t.closest('#labMode')) { if (ch) stopChanges(false); mode = t.dataset.v; S.labMode = mode; G.save(); render(); }
  else if (t.id === 'labGo') ch ? stopChanges(false) : startChanges();
  else if (t.id === 'labPlus') bump();
});
$('chordLab').addEventListener('change', e => {
  const t = e.target;
  if (t.id === 'labSet') { if (ch) stopChanges(false); setId = t.value; S.labSet = setId; S.labA = 0; S.labB = 1; G.save(); card = null; render(); }
  else if (t.id === 'labA') { S.labA = +t.value; G.save(); render(); }
  else if (t.id === 'labB') { S.labB = +t.value; G.save(); render(); }
  else if (t.id === 'labMetro') { S.labMetro = t.checked; G.save(); }
  else if (t.id === 'labBpm') { S.labBpm = G.clamp(+t.value || 60, 30, 200); G.save(); }
});
document.addEventListener('keydown', e => {
  if (!ch || S.tab !== 'harmony' || e.code !== 'Space' || e.target.closest('input, select, textarea')) return;
  e.preventDefault(); bump();
});
G.on('note', n => {
  if (mode !== 'cards' || !card || S.tab !== 'harmony' || !n.onset || n.midi === null || ch) return;
  const pc = ((Math.round(n.midi) % 12) + 12) % 12;
  heard = pc === card.root ? true : G.nn(pc);
  if (heard === true && know(card.root, card.q) === 'new') setKnow('learn');
  render();
});
G.on('inputState', () => { if (S.tab === 'harmony') render(); });
G.on('instrument', () => { if (ch) stopChanges(false); if (!sets().find(x => x.id === setId)) setId = sets()[0].id; card = null; render(); });
G.on('tab', t => { if (t !== 'harmony' && ch) stopChanges(false); if (t === 'harmony') render(); });
render();
})();
