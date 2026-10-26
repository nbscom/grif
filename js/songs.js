// Вкладка «Песни»: alphaTab, импорт Guitar Pro и текстовых табов, этюды, песни-цели
(() => {
'use strict';
const S = G.S, $ = G.$, D = G.data;
let api = null, loading = null, score = null, current = null; // current: { kind, id, title }
let speed = S.songSpeed || 100;
const STATUS = { learn: 'учу', slow: 'играю медленно', tempo: 'играю в темпе' };

$('songsRoot').innerHTML = `
  <section class="card wide" aria-labelledby="h-pl">
    <div class="head">
      <h2 id="h-pl">Плеер табов</h2>
      <span class="hint" id="atTitle">Выберите этюд или откройте свой файл</span>
    </div>
    <div class="at-bar">
      <button class="btn primary" id="atPlay" disabled>▶ Играть</button>
      <button class="btn" id="atStop" disabled>■</button>
      <label class="bpm" for="atSpeed">скорость <input id="atSpeed" type="range" class="range" min="50" max="100" step="5" style="width:120px"> <b id="atSpeedV"></b></label>
      <label class="check"><input type="checkbox" id="atLoop"> Зациклить</label>
      <label class="bpm">такты <input id="atFrom" type="number" min="1" value="1"> — <input id="atTo" type="number" min="1" value="1"></label>
      <button class="btn" id="atRange">Задать фрагмент</button>
      <label class="check"><input type="checkbox" id="atMetro"> Метроном</label>
      <button class="btn" id="atChords" disabled>Аккорды в «Гармонию»</button>
    </div>
    <div class="at-tracks" id="atTracks"></div>
    <div class="at-wrap" id="atWrap"><div id="atMain"></div><p class="hint at-empty" id="atEmpty">Здесь появятся табы. Выделите мышью фрагмент нот, чтобы зациклить его.</p></div>
    <p class="hint" id="atStatus"></p>
  </section>

  <section class="card" aria-labelledby="h-lib">
    <div class="head"><h2 id="h-lib">Этюды и рифы</h2><span class="hint">оригинальные, в стиле жанров</span></div>
    <div class="stack" id="libList"></div>
  </section>

  <section class="card" aria-labelledby="h-my">
    <div class="head"><h2 id="h-my">Мои файлы</h2><span class="hint">Guitar Pro и текстовые табы</span></div>
    <div class="stack">
      <div class="row">
        <label class="btn primary" for="fileIn">Открыть файл…</label>
        <input id="fileIn" type="file" accept=".gp,.gp3,.gp4,.gp5,.gpx,.gp7,.txt,.tab,.text" hidden multiple>
        <span class="hint">.gp, .gp5, .gpx, .txt</span>
      </div>
      <textarea id="tabText" rows="7" placeholder="Или вставьте текстовый таб:&#10;e|-----------------|&#10;B|-----------------|&#10;G|-----------------|&#10;D|-----0-----0-----|&#10;A|---2---2-----3---|&#10;E|-0-------0-------|"></textarea>
      <div class="row"><input id="tabName" type="text" placeholder="Название" aria-label="Название таба"><button class="btn" id="tabOpen">Открыть текстовый таб</button></div>
      <div id="myFiles" class="stack"></div>
      <p class="hint">Файлы хранятся только в этом браузере. Табы песен, защищённых авторским правом, в приложение не встроены: загружайте свои файлы.</p>
    </div>
  </section>

  <section class="card wide" aria-labelledby="h-goals">
    <div class="head"><h2 id="h-goals">Мои песни-цели</h2><span class="hint">статус меняется нажатием</span></div>
    <form class="row" id="goalForm">
      <input id="gTitle" type="text" placeholder="Песня" aria-label="Песня" required>
      <input id="gArtist" type="text" placeholder="Исполнитель" aria-label="Исполнитель">
      <input id="gBpm" type="number" placeholder="Темп" aria-label="Целевой темп" min="30" max="260" style="width:90px">
      <button class="btn primary" type="submit">Добавить</button>
    </form>
    <div class="goals" id="goals"></div>
  </section>`;

// ---------- alphaTab ----------
function loadLib() {
  if (window.alphaTab) return Promise.resolve();
  if (loading) return loading;
  loading = new Promise((res, rej) => {
    const s = document.createElement('script');
    s.src = 'vendor/alphaTab.min.js';
    s.onload = res; s.onerror = () => rej(new Error('Не удалось загрузить alphaTab'));
    document.head.appendChild(s);
  });
  return loading;
}
async function ensureApi() {
  await loadLib();
  if (api) return api;
  const at = window.alphaTab;
  api = new at.AlphaTabApi($('atMain'), {
    core: { fontDirectory: 'vendor/font/', scriptFile: new URL('vendor/alphaTab.min.js', location.href).href, engine: 'svg' },
    display: { scale: 0.95, layoutMode: 'Page' },
    player: { playerMode: 'EnabledSynthesizer', soundFont: 'vendor/soundfont/sonivox.sf2', scrollElement: $('atWrap'), enableCursor: true },
  });
  api.scoreLoaded.on(sc => { score = sc; onScore(); });
  api.playerReady.on(() => { $('atPlay').disabled = false; $('atStop').disabled = false; status(''); });
  api.soundFontLoad.on(e => status(`Загрузка звуков: ${Math.round(e.loaded / Math.max(1, e.total) * 100)}%`));
  api.playerStateChanged.on(e => { $('atPlay').textContent = e.state === 1 ? '⏸ Пауза' : '▶ Играть'; });
  api.error.on(e => status('Ошибка: ' + (e && e.message || e)));
  api.renderFinished.on(() => { $('atEmpty').hidden = true; });
  api.playbackSpeed = speed / 100;
  api.metronomeVolume = $('atMetro').checked ? 1 : 0;
  return api;
}
const status = t => { $('atStatus').textContent = t; };
function onScore() {
  const tr = score.tracks;
  $('atTitle').textContent = (score.title || current && current.title || 'Без названия') + (score.artist ? ' — ' + score.artist : '') + ` · ${score.masterBars.length} тактов · ${score.tempo} BPM`;
  $('atTracks').innerHTML = tr.map((t, i) => `<button class="btn${i === 0 ? ' on' : ''}" data-track="${i}">${G.esc(t.name || 'Дорожка ' + (i + 1))}${t.staves[0].isPercussion ? ' (ударные)' : ''}</button>`).join('') +
    (tr.length > 1 ? `<button class="btn" data-track="all">Все дорожки</button>` : '');
  $('atFrom').max = $('atTo').max = score.masterBars.length;
  $('atFrom').value = 1; $('atTo').value = Math.min(4, score.masterBars.length);
  $('atChords').disabled = false;
  // по умолчанию показываем дорожку текущего инструмента
  const want = tr.findIndex(t => /bass|бас/i.test(t.name) === G.isBass() && !t.staves[0].isPercussion);
  if (want > 0) showTrack(want);
}
function showTrack(v) {
  if (!api || !score) return;
  const tracks = v === 'all' ? score.tracks.filter(t => !t.staves[0].isPercussion) : [score.tracks[+v]];
  api.renderTracks(tracks);
  [...$('atTracks').children].forEach(b => b.classList.toggle('on', b.dataset.track === String(v)));
}
async function openTex(tex, info) {
  current = info;
  $('atEmpty').hidden = false; $('atEmpty').textContent = 'Отрисовка…';
  await ensureApi();
  try { api.tex(tex); } catch (e) { status('Не удалось открыть: ' + e.message); }
}
async function openBinary(buf, info) {
  current = info;
  $('atEmpty').hidden = false; $('atEmpty').textContent = 'Отрисовка…';
  await ensureApi();
  try { api.load(new Uint8Array(buf)); } catch (e) { status('Не удалось открыть файл: ' + e.message); }
}
G.songs = { openTex };

// ---------- текстовые табы ----------
G.parseTextTab = text => {
  const lines = text.replace(/\r/g, '').split('\n');
  const isStr = l => /^\s*[A-Ga-g][#b♯♭]?\s*[|:\-]/.test(l) && (l.match(/-/g) || []).length >= 3;
  const blocks = [];
  for (let i = 0; i < lines.length;) {
    if (!isStr(lines[i])) { i++; continue; }
    const b = [];
    while (i < lines.length && isStr(lines[i])) b.push(lines[i++]);
    if (b.length === 4 || b.length === 6 || b.length === 5 || b.length === 7) blocks.push(b);
  }
  if (!blocks.length) throw new Error('Не нашёл строк таба. Ожидаются строки вида «E|--0--3--|».');
  const NS = blocks[0].length;
  const events = [];
  for (const b of blocks) {
    const rows = b.map(l => l.replace(/^\s*[A-Ga-g][#b♯♭]?\s*/, ''));
    const W = Math.max(...rows.map(r => r.length));
    let col = 0;
    while (col < W) {
      const notes = [];
      let adv = 1;
      rows.forEach((r, k) => {
        const m = r.slice(col).match(/^(\d{1,2})/);
        if (m) { notes.push({ s: NS - 1 - k, f: +m[1] }); adv = Math.max(adv, m[1].length); }
        else if (r[col] === 'x' || r[col] === 'X') notes.push({ s: NS - 1 - k, f: null });
      });
      if (notes.length) {
        const pitched = notes.filter(n => n.f !== null);
        if (pitched.length) events.push({ notes: pitched, s: Math.min(...pitched.map(n => n.s)), f: pitched.find(n => n.s === Math.min(...pitched.map(q => q.s))).f, dur: 0.5 });
        else events.push({ dead: true, s: notes[0].s, dur: 0.5 });
      }
      col += adv;
    }
  }
  let beat = 0; events.forEach(e => { e.beat = beat; beat += e.dur; });
  const pad = (4 - beat % 4) % 4;
  if (pad) for (let x = 0; x < pad / 0.5; x++) { events.push({ rest: true, dur: 0.5, beat }); beat += 0.5; }
  return { NS, events };
};
function textTabToTex(text, title) {
  const { NS, events } = G.parseTextTab(text);
  const inst = NS === 4 || NS === 5 ? 'bass' : 'guitar';
  const tuning = inst === S.inst ? G.T() : G.TUNINGS[inst].std.notes;
  return `\\title "${(title || 'Текстовый таб').replace(/"/g, "'")}"\n\\tempo 90\n.\n` + G.trackTex(inst === 'bass' ? 'Бас' : 'Гитара', inst, events, tuning.slice(0, NS));
}

// ---------- аккорды из партитуры -> «Гармония» ----------
function chordsFromScore() {
  const t = score.tracks.find(t => !t.staves[0].isPercussion && !/bass|бас/i.test(t.name)) || score.tracks[0];
  const st = t.staves[0], out = [];
  const nameToChord = nm => {
    const m = /^([A-G])([#b♯♭]?)(.*)$/.exec(nm.trim()); if (!m) return null;
    let r = 'C D EF G A B'.indexOf(m[1]); r += /[#♯]/.test(m[2]) ? 1 : /[b♭]/.test(m[2]) ? -1 : 0; r = (r + 12) % 12;
    const rest = m[3];
    const q = /^5/.test(rest) ? '5' : /^maj7/.test(rest) ? 'maj7' : /^m7b5|ø/.test(rest) ? 'm7b5' : /^m7/.test(rest) ? 'm7' : /^(m|min)/.test(rest) ? 'm' : /^7/.test(rest) ? '7' : /^dim|°/.test(rest) ? 'dim' : /^sus2/.test(rest) ? 'sus2' : /^sus4|^sus/.test(rest) ? 'sus4' : 'maj';
    return { root: r, q };
  };
  st.bars.forEach(bar => {
    const beats = bar.voices[0].beats;
    let found = null;
    for (const b of beats) {
      if (b.chord && b.chord.name) { found = nameToChord(b.chord.name); if (found) break; }
    }
    if (!found) {
      const b = beats.find(b => !b.isRest && b.notes.length);
      if (b) {
        const ps = b.notes.map(n => n.realValue).sort((a, c) => a - c);
        const root = ps[0] % 12, pcs = new Set(ps.map(p => ((p - ps[0]) % 12 + 12) % 12));
        const q = pcs.has(4) ? (pcs.has(10) ? '7' : 'maj') : pcs.has(3) ? (pcs.has(10) ? 'm7' : 'm') : pcs.has(7) ? '5' : null;
        if (q) found = { root, q };
        else if (b.notes.length === 1) found = { root, q: '5' };
      }
    }
    if (found && !(out.length && out[out.length - 1].root === found.root && out[out.length - 1].q === found.q)) out.push(found);
  });
  return out.slice(0, 16);
}

// ---------- библиотека ----------
function renderLib() {
  const riffs = G.EX.filter(e => e.cat === 'riff');
  const byStyle = s => riffs.filter(e => e.style === s);
  $('libList').innerHTML = G.ETUDES.map(et => `<button class="pl-ex" data-etude="${et.id}"><span><b>${et.title}</b><small>${G.STYLE_RU[et.style]} · гитара и бас · ${et.bpm} BPM</small></span><span class="pl-bpm">2<small>дорожки</small></span></button>`).join('') +
    Object.keys(G.STYLE_RU).map(s => `<div class="lib-group"><span class="lbl">${G.STYLE_RU[s]}</span>${byStyle(s).map(e => `<button class="linkish" data-riff="${e.id}">${G.esc(e.title)}${e.inst === 'bass' ? ' (бас)' : ''}</button>`).join('')}</div>`).join('');
}
async function renderFiles() {
  const fs = await G.files.all();
  $('myFiles').innerHTML = fs.length ? fs.sort((a, b) => b.added - a.added).map(f => `<div class="file-row">
      <button class="linkish" data-open="${f.id}">${G.esc(f.name)}</button><span class="hint">${f.kind === 'text' ? 'текст' : 'Guitar Pro'}</span>
      <button class="px" data-delf="${f.id}" aria-label="Удалить ${G.esc(f.name)}">×</button></div>`).join('')
    : '<p class="hint">Пока нет сохранённых файлов.</p>';
}
function renderGoals() {
  $('goals').innerHTML = D.goals.length ? D.goals.map(g => `<div class="goal">
      <div style="min-width:0"><b>${G.esc(g.title)}</b>${g.artist ? `<small>${G.esc(g.artist)}</small>` : ''}</div>
      <span class="hint">${g.bpm ? g.bpm + ' BPM' : ''}</span>
      <button class="status st-${g.status}" data-gs="${g.id}">${STATUS[g.status]}</button>
      <button class="px" data-gdel="${g.id}" aria-label="Удалить ${G.esc(g.title)}">×</button>
    </div>`).join('') : '<p class="hint">Добавьте песни, к которым идёте. Статус: учу → играю медленно → играю в темпе.</p>';
}

// ---------- события ----------
$('atPlay').addEventListener('click', () => { if (api) { G.audio.ctx(); api.playPause(); } });
$('atStop').addEventListener('click', () => api && api.stop());
$('atSpeed').value = speed; $('atSpeedV').textContent = speed + '%';
$('atSpeed').addEventListener('input', e => { speed = +e.target.value; S.songSpeed = speed; G.save(); $('atSpeedV').textContent = speed + '%'; if (api) api.playbackSpeed = speed / 100; });
$('atLoop').addEventListener('change', e => { if (api) api.isLooping = e.target.checked; });
$('atMetro').addEventListener('change', e => { if (api) { api.metronomeVolume = e.target.checked ? 1 : 0; api.countInVolume = e.target.checked ? 1 : 0; } });
$('atRange').addEventListener('click', () => {
  if (!api || !score) return;
  const tr = api.tracks && api.tracks[0] || score.tracks[0];
  const n = score.masterBars.length;
  const a = G.clamp(+$('atFrom').value || 1, 1, n) - 1, b = G.clamp(+$('atTo').value || 1, a + 1, n) - 1;
  const bars = tr.staves[0].bars;
  const first = bars[a].voices[0].beats[0], lastBeats = bars[b].voices[0].beats, last = lastBeats[lastBeats.length - 1];
  api.highlightPlaybackRange(first, last);
  api.applyPlaybackRangeFromHighlight();
  api.isLooping = true; $('atLoop').checked = true;
  status(`Фрагмент: такты ${a + 1}–${b + 1}, зациклен.`);
});
$('atTracks').addEventListener('click', e => { const b = e.target.closest('[data-track]'); if (b) showTrack(b.dataset.track); });
$('atChords').addEventListener('click', () => {
  if (!score) return;
  const list = chordsFromScore();
  if (!list.length) return status('Не удалось определить аккорды в этой партитуре.');
  const first = list[0];
  S.keyRoot = first.root; S.keyMode = G.FAM[first.q] === 'm' ? 'minor' : 'major';
  S.prog = G.chainVoicings(list); S.sel = 0; S.cur = { ...S.prog[0] };
  G.save(); G.harmony.render(); G.go('harmony');
});
$('libList').addEventListener('click', e => {
  const et = e.target.closest('[data-etude]'), rf = e.target.closest('[data-riff]');
  if (et) { const x = G.ETUDES.find(q => q.id === et.dataset.etude); openTex(G.etudeToTex(x), { kind: 'etude', id: x.id, title: x.title }); }
  if (rf) { const x = G.exById(rf.dataset.riff); openTex(G.exToTex(x), { kind: 'riff', id: x.id, title: x.title }); }
});
$('fileIn').addEventListener('change', async e => {
  for (const f of e.target.files) {
    const isText = /\.(txt|tab|text)$/i.test(f.name);
    const rec = { id: 'f' + Date.now() + Math.random().toString(36).slice(2, 6), name: f.name, added: Date.now(), kind: isText ? 'text' : 'gp', data: isText ? await f.text() : await f.arrayBuffer() };
    try { await G.files.put(rec); } catch (err) { status('Файл открыт, но не сохранён: ' + err.message); }
    openRec(rec);
  }
  e.target.value = ''; renderFiles();
});
function openRec(rec) {
  if (rec.kind === 'text') {
    try { openTex(textTabToTex(rec.data, rec.name.replace(/\.\w+$/, '')), { kind: 'file', id: rec.id, title: rec.name }); }
    catch (err) { status(err.message); }
  } else openBinary(rec.data, { kind: 'file', id: rec.id, title: rec.name });
}
$('tabOpen').addEventListener('click', async () => {
  const text = $('tabText').value; if (!text.trim()) return;
  const name = $('tabName').value.trim() || 'Текстовый таб';
  try {
    const tex = textTabToTex(text, name);
    const rec = { id: 'f' + Date.now(), name, added: Date.now(), kind: 'text', data: text };
    try { await G.files.put(rec); } catch (err) {}
    openTex(tex, { kind: 'file', id: rec.id, title: name }); renderFiles();
  } catch (err) { status(err.message); }
});
$('myFiles').addEventListener('click', async e => {
  const o = e.target.closest('[data-open]'), d = e.target.closest('[data-delf]');
  if (o) { const rec = await G.files.get(o.dataset.open); if (rec) openRec(rec); }
  if (d) {
    if (d.dataset.confirm !== '1') { d.dataset.confirm = '1'; d.textContent = 'удалить?'; d.classList.add('confirm'); setTimeout(() => { d.dataset.confirm = ''; d.textContent = '×'; d.classList.remove('confirm'); }, 3000); return; }
    await G.files.del(d.dataset.delf); renderFiles();
  }
});
$('goalForm').addEventListener('submit', e => {
  e.preventDefault();
  const title = $('gTitle').value.trim(); if (!title) return;
  D.goals.push({ id: 'g' + Date.now(), title, artist: $('gArtist').value.trim(), bpm: +$('gBpm').value || null, status: 'learn', added: G.today() });
  G.saveData(); $('goalForm').reset(); renderGoals();
});
$('goals').addEventListener('click', e => {
  const s = e.target.closest('[data-gs]'), d = e.target.closest('[data-gdel]');
  const order = ['learn', 'slow', 'tempo'];
  if (s) { const g = D.goals.find(x => x.id === s.dataset.gs); g.status = order[(order.indexOf(g.status) + 1) % 3]; G.saveData(); renderGoals(); }
  if (d) { D.goals = D.goals.filter(x => x.id !== d.dataset.gdel); G.data.goals = D.goals; G.saveData(); renderGoals(); }
});
G.on('tab', t => {
  if (t === 'songs') { renderFiles(); renderGoals(); }
  else if (api) { try { api.pause(); } catch (e) {} }
});
renderLib(); renderGoals();
})();
