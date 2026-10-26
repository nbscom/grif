// Навигация, общие настройки инструмента и строя
(() => {
'use strict';
const S = G.S, $ = G.$;
const TABS = ['today', 'tuner', 'metronome', 'exercises', 'songs', 'harmony', 'progress'];

G.go = tab => {
  if (!TABS.includes(tab)) tab = 'today';
  S.tab = tab; G.save();
  TABS.forEach(t => { $('tab-' + t).hidden = t !== tab; });
  [...$('nav').children].forEach(a => { a.classList.toggle('on', a.dataset.tab === tab); a.setAttribute('aria-current', a.dataset.tab === tab ? 'page' : 'false'); });
  try { if (location.hash !== '#' + tab) history.replaceState(null, '', '#' + tab); } catch (e) {}
  G.emit('tab', tab);
  window.scrollTo(0, 0);
};

function renderHeader() {
  [...$('inst').children].forEach(b => b.classList.toggle('on', b.dataset.v === S.inst));
  const tu = G.TUNINGS[S.inst];
  $('tuning').innerHTML = Object.entries(tu).map(([k, v]) => `<option value="${k}"${k === G.tuningId() ? ' selected' : ''}>${v.name}</option>`).join('');
  [...$('tone').children].forEach(b => b.classList.toggle('on', (b.dataset.d === '1') === S.drive));
  $('foot').textContent = `${G.INST_RU[S.inst][0].toUpperCase() + G.INST_RU[S.inst].slice(1)}, строй ${G.tuningLetters()}, ${G.nFrets()} ладов. Нажмите на лад, чтобы услышать ноту. Звук синтезируется в браузере.`;
}
G.renderHeader = renderHeader;

$('nav').addEventListener('click', e => {
  const a = e.target.closest('[data-tab]'); if (!a) return;
  e.preventDefault(); G.go(a.dataset.tab);
});
window.addEventListener('hashchange', () => { const t = location.hash.slice(1); if (TABS.includes(t) && t !== S.tab) G.go(t); });
document.addEventListener('click', e => {
  const t = e.target.closest('[data-goto]');
  if (t && !t.closest('#fbInfo')) G.go(t.dataset.goto);
});

$('inst').addEventListener('click', e => {
  const v = e.target.dataset.v; if (!v || v === S.inst) return;
  S.inst = v; G.audio.route(); renderHeader(); G.emit('instrument'); G.save();
});
$('tuning').addEventListener('change', e => {
  S.tuning[S.inst] = e.target.value; renderHeader(); G.emit('instrument'); G.save();
});
$('tone').addEventListener('click', e => {
  const d = e.target.dataset.d; if (d === undefined) return;
  S.drive = d === '1'; G.audio.route(); renderHeader(); G.save();
  if (!G.isBass()) G.audio.strum([0, 2, 2, -1, -1, -1].slice(0, G.NS()));
});

renderHeader();
G.harmony.render();
const h = location.hash.slice(1);
G.go(TABS.includes(h) ? h : S.tab);
G.emit('ready');
})();
