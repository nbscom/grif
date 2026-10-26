// Вкладка «Прогресс»: минуты, серия, темп и точность, резервная копия
(() => {
'use strict';
const S = G.S, $ = G.$, D = G.data;
let exSel = S.progEx || '';

$('progRoot').innerHTML = `
  <section class="card wide"><div class="tiles" id="pgTiles"></div></section>
  <section class="card wide" aria-labelledby="h-pd">
    <div class="head"><h2 id="h-pd">Минуты по дням</h2><span class="hint">последние 28 дней, все инструменты</span></div>
    <div class="chart" id="chDays"></div>
  </section>
  <section class="card" aria-labelledby="h-pw">
    <div class="head"><h2 id="h-pw">Минуты по неделям</h2><span class="hint">8 недель</span></div>
    <div class="chart" id="chWeeks"></div>
  </section>
  <section class="card" aria-labelledby="h-pa">
    <div class="head"><h2 id="h-pa">Точность по дням</h2><span class="hint">средняя по прогонам с проверкой</span></div>
    <div class="chart" id="chAcc"></div>
  </section>
  <section class="card wide" aria-labelledby="h-pt">
    <div class="head"><h2 id="h-pt">Рабочий темп</h2><select id="pgEx" aria-label="Упражнение"></select></div>
    <div class="chart" id="chTempo"></div>
    <details class="pg-table"><summary>Таблица прогонов</summary><div id="pgTable"></div></details>
  </section>
  <section class="card wide" aria-labelledby="h-bk">
    <div class="head"><h2 id="h-bk">Резервная копия</h2><span class="hint">данные хранятся в этом браузере</span></div>
    <div class="row">
      <button class="btn primary" id="bkExport">Сохранить копию в JSON</button>
      <button class="btn" id="bkCopy">Скопировать JSON</button>
      <label class="btn" for="bkFile">Восстановить из файла…</label><input id="bkFile" type="file" accept=".json,application/json" hidden>
      <span class="hint" id="bkInfo"></span>
    </div>
    <div id="bkConfirm"></div>
  </section>`;

// ---------- данные ----------
const dayKey = (off) => { const d = new Date(); d.setDate(d.getDate() - off); return G.today(d); };
const short = k => { const [, m, d] = k.split('-'); return `${+d}.${m}`; };
function daysSeries(n) {
  const out = [];
  for (let i = n - 1; i >= 0; i--) { const k = dayKey(i); out.push({ k, label: short(k), v: Math.round(((D.days[k] || {}).sec || 0) / 60) }); }
  return out;
}
function weeksSeries(n) {
  const out = [];
  const now = new Date(), dow = (now.getDay() + 6) % 7; // понедельник = 0
  for (let w = n - 1; w >= 0; w--) {
    let sum = 0; const start = new Date(now); start.setDate(now.getDate() - dow - w * 7);
    for (let i = 0; i < 7; i++) { const d = new Date(start); d.setDate(start.getDate() + i); sum += ((D.days[G.today(d)] || {}).sec || 0); }
    out.push({ label: short(G.today(start)), v: Math.round(sum / 60), k: 'неделя с ' + short(G.today(start)) });
  }
  return out;
}
function accSeries() {
  const by = {};
  D.results.forEach(r => { (by[r.d] = by[r.d] || []).push(r.acc); });
  return Object.keys(by).sort().slice(-28).map(k => ({ k, label: short(k), v: Math.round(by[k].reduce((a, b) => a + b, 0) / by[k].length), n: by[k].length }));
}
function tempoSeries(id) {
  const by = {};
  D.results.filter(r => r.ex === id).forEach(r => {
    const b = by[r.d] = by[r.d] || { best: null, max: 0, n: 0 };
    b.n++; b.max = Math.max(b.max, r.bpm);
    if (r.acc >= 90) b.best = Math.max(b.best || 0, r.bpm);
  });
  return Object.keys(by).sort().map(k => ({ k, label: short(k), v: by[k].best || null, max: by[k].max, n: by[k].n }));
}

// ---------- графики (одна серия, без легенды) ----------
const tip = (() => { const t = document.createElement('div'); t.className = 'ch-tip'; t.hidden = true; document.body.appendChild(t); return t; })();
function bindTips(el) {
  el.addEventListener('pointermove', e => {
    const h = e.target.closest('[data-tip]');
    if (!h) { tip.hidden = true; return; }
    tip.textContent = h.dataset.tip; tip.hidden = false;
    const x = Math.min(window.innerWidth - tip.offsetWidth - 8, e.clientX + 12);
    tip.style.left = x + 'px'; tip.style.top = (e.clientY - tip.offsetHeight - 10) + 'px';
  });
  el.addEventListener('pointerleave', () => { tip.hidden = true; });
}
function niceMax(v) { if (v <= 0) return 10; const p = Math.pow(10, Math.floor(Math.log10(v))); for (const m of [1, 2, 2.5, 5, 10]) if (m * p >= v) return m * p; return 10 * p; }
function axisFrame(W, H, padL, padB, max, unit, ticks = max % 5 === 0 ? 5 : 4) {
  let s = '';
  for (let i = 0; i <= ticks; i++) {
    const v = max * i / ticks, y = H - padB - (H - padB - 10) * i / ticks;
    s += `<line x1="${padL}" x2="${W}" y1="${y}" y2="${y}" class="ch-grid${i === 0 ? ' base' : ''}"/>`;
    s += `<text x="${padL - 6}" y="${y + 4}" text-anchor="end" class="ch-ax">${Math.round(v)}${i === ticks ? ' ' + unit : ''}</text>`;
  }
  return s;
}
function barChart(el, data, { unit = 'мин', fmt = d => `${d.k}: ${d.v} ${unit}`, every = 1, target = null } = {}) {
  const W = Math.max(300, el.clientWidth || 760), H = 220, padL = 52, padB = 26, n = data.length;
  const max = niceMax(Math.max(target || 0, ...data.map(d => d.v)));
  const bw = (W - padL) / n, Y = v => H - padB - (H - padB - 10) * v / max;
  let s = axisFrame(W, H, padL, padB, max, unit);
  if (target) s += `<line x1="${padL}" x2="${W}" y1="${Y(target)}" y2="${Y(target)}" class="ch-target"/><text x="${W}" y="${Y(target) - 5}" text-anchor="end" class="ch-ax">цель ${target} ${unit}</text>`;
  data.forEach((d, i) => {
    const x = padL + i * bw, h = Math.max(0, H - padB - Y(d.v));
    if (d.v > 0) s += `<path d="M${x + 1},${H - padB} v${-Math.max(0, h - 4)} q0,-4 4,-4 h${bw - 10} q4,0 4,4 v${Math.max(0, h - 4)} z" class="ch-bar"/>`;
    s += `<rect x="${x}" y="10" width="${bw}" height="${H - padB - 10}" class="ch-hit" data-tip="${G.esc(fmt(d))}"/>`;
    if (i % every === 0 || i === n - 1) s += `<text x="${x + bw / 2}" y="${H - 8}" text-anchor="middle" class="ch-ax">${d.label}</text>`;
  });
  el.innerHTML = `<svg viewBox="0 0 ${W} ${H}" class="ch-svg" role="img" aria-label="Столбчатая диаграмма">${s}</svg>`;
}
function lineChart(el, data, { unit = '', min = 0, max = null, fmt, empty }) {
  const pts = data.filter(d => d.v !== null);
  if (!pts.length) { el.innerHTML = `<p class="hint ch-empty">${empty}</p>`; return; }
  const W = Math.max(300, el.clientWidth || 760), H = 220, padL = 52, padB = 26, n = data.length;
  const hi = max || niceMax(Math.max(...pts.map(d => d.v)) * 1.1), lo = min;
  const X = i => padL + (n === 1 ? (W - padL) / 2 : 12 + (W - padL - 24) * i / (n - 1));
  const Y = v => H - padB - (H - padB - 10) * (v - lo) / (hi - lo);
  let s = '';
  const tk = (hi - lo) % 5 === 0 ? 5 : 4;
  for (let i = 0; i <= tk; i++) {
    const v = lo + (hi - lo) * i / tk, y = Y(v);
    s += `<line x1="${padL}" x2="${W}" y1="${y}" y2="${y}" class="ch-grid${i === 0 ? ' base' : ''}"/><text x="${padL - 6}" y="${y + 4}" text-anchor="end" class="ch-ax">${Math.round(v)}${i === tk ? ' ' + unit : ''}</text>`;
  }
  const seq = data.map((d, i) => d.v === null ? null : [X(i), Y(d.v)]).filter(Boolean);
  if (seq.length > 1) {
    s += `<path d="M${seq[0][0]},${H - padB} ${seq.map(p => 'L' + p.join(',')).join(' ')} L${seq[seq.length - 1][0]},${H - padB} Z" class="ch-area"/>`;
    s += `<path d="M${seq.map(p => p.join(',')).join(' L')}" class="ch-line"/>`;
  }
  const every = Math.ceil(n / Math.max(3, Math.floor(W / 90)));
  data.forEach((d, i) => {
    if (d.v !== null) s += `<circle cx="${X(i)}" cy="${Y(d.v)}" r="${i === n - 1 ? 5 : 4}" class="ch-dot${i === n - 1 ? ' last' : ''}"/>`;
    if (i % every === 0 || i === n - 1) s += `<text x="${X(i)}" y="${H - 8}" text-anchor="middle" class="ch-ax">${d.label}</text>`;
    const w = n === 1 ? W - padL : (W - padL - 24) / (n - 1);
    s += `<rect x="${X(i) - w / 2}" y="10" width="${w}" height="${H - padB - 10}" class="ch-hit" data-tip="${G.esc(fmt(d))}"/>`;
  });
  const last = pts[pts.length - 1];
  s += `<text x="${Math.min(W - 4, X(data.indexOf(last)) + 8)}" y="${Y(last.v) - 9}" text-anchor="${data.indexOf(last) > n * 0.8 ? 'end' : 'start'}" class="ch-lbl">${last.v} ${unit}</text>`;
  el.innerHTML = `<svg viewBox="0 0 ${W} ${H}" class="ch-svg" role="img" aria-label="Линейный график">${s}</svg>`;
}

// ---------- отрисовка ----------
function render() {
  const days = daysSeries(28), week = days.slice(-7).reduce((a, d) => a + d.v, 0);
  const total = Object.values(D.days).filter(d => d.sec >= 300).length;
  const recent = D.results.filter(r => r.d >= dayKey(6));
  const acc7 = recent.length ? Math.round(recent.reduce((a, r) => a + r.acc, 0) / recent.length) : null;
  const pl = D.plan[S.inst];
  $('pgTiles').innerHTML = [
    ['Серия', G.streak(), 'дней подряд от 5 минут'],
    ['Эта неделя', week, 'минут за 7 дней из 210'],
    ['Занятий', total, 'дней с практикой'],
    ['Точность', acc7 === null ? '—' : acc7 + '%', 'средняя за 7 дней'],
    ['План', pl.day, `день программы: ${G.INST_RU[S.inst]}`],
  ].map(([l, v, s]) => `<div class="tile"><span class="lbl">${l}</span><span class="big-num">${v}</span><span class="hint">${s}</span></div>`).join('');
  barChart($('chDays'), days, { every: Math.ceil(28 / Math.max(4, Math.floor(($('chDays').clientWidth || 760) / 70))), target: 30, fmt: d => `${d.k.split('-').reverse().join('.')}: ${d.v} мин` });
  barChart($('chWeeks'), weeksSeries(8), { target: 210, fmt: d => `${d.k}: ${d.v} мин` });
  lineChart($('chAcc'), accSeries(), { unit: '%', min: 0, max: 100, fmt: d => `${d.k.split('-').reverse().join('.')}: ${d.v}% (прогонов: ${d.n})`, empty: 'Пока нет прогонов с проверкой по звуку. Сыграйте упражнение с включённым входом.' });
  const used = [...new Set(D.results.map(r => r.ex))].map(G.exById).filter(Boolean);
  const opts = (used.length ? used : G.EX.filter(e => e.inst === S.inst));
  if (!opts.find(e => e.id === exSel)) exSel = opts[0] && opts[0].id;
  $('pgEx').innerHTML = opts.map(e => `<option value="${e.id}"${e.id === exSel ? ' selected' : ''}>${G.esc(e.title)}</option>`).join('');
  const ex = G.exById(exSel), ts = tempoSeries(exSel);
  lineChart($('chTempo'), ts, { unit: 'BPM', min: Math.max(0, Math.floor((Math.min(...ts.map(d => d.v || 999), ex ? ex.bpm : 60) - 20) / 10) * 10), fmt: d => `${d.k.split('-').reverse().join('.')}: ${d.v ? d.v + ' BPM с точностью ≥ 90%' : 'нет прогонов ≥ 90%'}, максимум ${d.max} BPM, прогонов ${d.n}`,
    empty: `Нет прогонов «${ex ? G.esc(ex.title) : ''}» с точностью от 90%. Рабочий темп сейчас: ${ex ? G.exercises.workBpm(ex) : '—'} BPM.` });
  const rows = D.results.filter(r => r.ex === exSel).slice(-30).reverse();
  $('pgTable').innerHTML = rows.length ? `<div class="tbl-wrap"><table><thead><tr><th>Дата</th><th>Темп</th><th>Точность</th><th>Ритм</th></tr></thead><tbody>${rows.map(r => `<tr><td>${r.d.split('-').reverse().join('.')}</td><td>${r.bpm}</td><td>${r.acc}%</td><td>${r.early ? (r.early > 0 ? '+' : '') + r.early + ' мс' : '0'}</td></tr>`).join('')}</tbody></table></div>` : '<p class="hint">Прогонов пока нет.</p>';
}
['chDays', 'chWeeks', 'chAcc', 'chTempo'].forEach(id => bindTips($(id)));
$('pgEx').addEventListener('change', e => { exSel = e.target.value; S.progEx = exSel; G.save(); render(); });

// ---------- резервная копия ----------
$('bkExport').addEventListener('click', () => {
  const blob = new Blob([G.exportJSON()], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob); a.download = `grif-backup-${G.today()}.json`;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  $('bkInfo').textContent = G.input.inClaude ? 'Если файл не скачался (внутри claude.ai загрузки заблокированы), нажмите «Скопировать JSON».' : 'Файл сохранён в «Загрузки».';
});
$('bkCopy').addEventListener('click', async () => {
  const text = G.exportJSON();
  try { await navigator.clipboard.writeText(text); $('bkInfo').textContent = 'JSON скопирован в буфер обмена.'; }
  catch (e) {
    $('bkConfirm').innerHTML = `<textarea rows="6" readonly class="bk-text">${G.esc(text)}</textarea>`;
    const t = $('bkConfirm').querySelector('textarea'); t.focus(); t.select();
    $('bkInfo').textContent = 'Буфер обмена недоступен: текст выделен, скопируйте его вручную.';
  }
});
$('bkFile').addEventListener('change', async e => {
  const f = e.target.files[0]; if (!f) return;
  const text = await f.text(); e.target.value = '';
  let o; try { o = JSON.parse(text); } catch (err) { $('bkInfo').textContent = 'Файл не читается как JSON.'; return; }
  const n = o && o.data ? Object.keys(o.data.days || {}).length : 0;
  $('bkConfirm').innerHTML = `<div class="note-box warn">Восстановить копию от ${G.esc((o.exported || '').slice(0, 10))} (${n} дней занятий)? Текущие данные будут заменены. <button class="btn primary" id="bkYes">Заменить</button> <button class="btn" id="bkNo">Отмена</button></div>`;
  $('bkYes').onclick = () => {
    try { G.importJSON(text); $('bkInfo').textContent = 'Данные восстановлены. Перезагружаю…'; setTimeout(() => location.reload(), 600); }
    catch (err) { $('bkInfo').textContent = err.message; }
    $('bkConfirm').innerHTML = '';
  };
  $('bkNo').onclick = () => { $('bkConfirm').innerHTML = ''; };
});

G.on('tab', t => { if (t === 'progress') render(); });
let rz = null;
window.addEventListener('resize', () => { clearTimeout(rz); rz = setTimeout(() => { if (S.tab === 'progress') render(); }, 150); });
G.on('data', () => { if (S.tab === 'progress') render(); });
G.on('instrument', () => { if (S.tab === 'progress') render(); });
render();
})();
