// Вкладка «Сегодня»: программа по неделям и таймер на 30 минут
(() => {
'use strict';
const S = G.S, $ = G.$, D = G.data, A = G.audio;
const BLOCKS = [
  { key: 'warmup', title: 'Разминка и хроматика', min: 5 },
  { key: 'tech', title: 'Техника', min: 10 },
  { key: 'rhythm', title: 'Ритм с метрономом', min: 5 },
  { key: 'song', title: 'Песня или рифф', min: 10 },
];
const W = (title, focus, warmup, tech, rhythm, song) => ({ title, focus, warmup, tech, rhythm, song });
const PROGRAM = {
  guitar: [
    W('Быстрое освежение: 6-я струна и квинты', 'Вспоминаем ноты 6-й струны и пауэр-аккорды от них. Темп ниже комфортного, звук чистый и заглушённый.',
      ['g-chroma'], ['g-power', 'g-notes6', 'g-pm8'], ['g-rests'], ['g-pr-8', 'g-notes6']),
    W('Быстрое освежение: 5-я струна и даунстроки', 'Ноты 5-й струны, смена аккордов между 6-й и 5-й, выносливость правой руки на восьмых.',
      ['g-spider'], ['g-notes5', 'g-down8', 'g-notes65'], ['g-sync'], ['g-pr-riff', 'g-pr-8']),
    W('Гранж: Drop D и квинты одним пальцем', 'Перестройтесь в Drop D. Тяжёлые квинты одним пальцем, слайды, контраст «тихо/громко».',
      ['g-chroma'], ['g-slides', 'g-power', 'g-pm8'], ['g-rests'], ['g-grunge-1', 'g-grunge-dyn']),
    W('Гранж: бенды и динамика', 'Бенды до точной высоты, легато, резкое переключение чистого и перегруженного звука.',
      ['g-spider'], ['g-bends', 'g-legato', 'g-slides'], ['g-sync'], ['g-grunge-slide', 'g-grunge-dyn']),
    W('Рэп-метал: паузы и глушение', 'Ритм на шестнадцатых с паузами, глухие удары, жёсткое глушение ладонью. Метроном — главный судья.',
      ['g-chroma'], ['g-pm8', 'g-down8'], ['g-rm-mute'], ['g-rm-rests', 'g-rm-oct']),
    W('Рэп-метал: октавы, тремоло и эффекты', 'Октавные партии, тремоло-пикинг, эксперименты с питч-шифтером и фланжером на Mooer.',
      ['g-spider'], ['g-legato', 'g-rm-trem'], ['g-rm-mute'], ['g-rm-oct', 'g-rm-rests']),
    W('Популярный рок: восьмые и смены', 'Ровные восьмые на квинтах, перебор открытых аккордов, смены без опозданий.',
      ['g-chroma'], ['g-bends', 'g-slides'], ['g-sync'], ['g-pr-8', 'g-pr-arp']),
    W('Популярный рок: рифы и арпеджио', 'Одиночные рифы на открытых струнах, арпеджио, легато в соло-фразах.',
      ['g-spider'], ['g-legato', 'g-down8'], ['g-rests'], ['g-pr-riff', 'g-pr-arp']),
  ],
  bass: [
    W('Бас: освежение, ноты 4-й струны', 'Ноты на E-струне и ровные корни восьмыми. Звук короткий и плотный.',
      ['b-chroma'], ['b-notesE', 'b-root8'], ['b-sync'], ['b-pr']),
    W('Бас: 3-я струна и октавы', 'Ноты на A-струне, октавы, связка «корень–квинта–октава».',
      ['b-chroma'], ['b-notesA', 'b-oct', 'b-r5'], ['b-sync'], ['b-pr', 'b-r5']),
    W('Бас: гранж в Drop D', 'Перестройте 4-ю струну в D. Корни за гитарой, слайды в ноту.',
      ['b-chroma'], ['b-slide', 'b-root8'], ['b-sync'], ['b-grunge']),
    W('Бас: гранж, выносливость', 'Медиатором вниз на восьмых, держим темп без ускорения.',
      ['b-chroma'], ['b-root8', 'b-oct'], ['b-sync'], ['b-grunge', 'b-pr']),
    W('Бас: рэп-метал с паузами', 'Короткие ноты, точные паузы, синхронность с бочкой.',
      ['b-chroma'], ['b-oct', 'b-slide'], ['b-rm'], ['b-rm']),
    W('Бас: рэп-метал, грув', 'Синкопы и слайды, игра в один ритм с гитарным рифом.',
      ['b-chroma'], ['b-slide', 'b-r5'], ['b-rm'], ['b-rm', 'b-grunge']),
    W('Бас: популярный рок', 'Корни восьмыми под смены I–V–vi–IV, октавы в конце такта.',
      ['b-chroma'], ['b-r5', 'b-root8'], ['b-sync'], ['b-pr']),
    W('Бас: рок, связки', 'Проходящие ноты между корнями, хаммеры и слайды.',
      ['b-chroma'], ['b-slide', 'b-oct'], ['b-sync'], ['b-pr', 'b-r5']),
  ],
};

// ---------- состояние сессии ----------
const P = () => D.plan[S.inst];
const dayNo = () => P().day;
function weekOf(day) {
  const prog = PROGRAM[S.inst];
  const w = Math.floor((day - 1) / 7);
  if (w < prog.length) return { idx: w, cycle: 0 };
  const rest = w - prog.length;           // после 8 недель — круг по неделям 3–8 с повышением темпа
  return { idx: 2 + rest % (prog.length - 2), cycle: 1 + Math.floor(rest / (prog.length - 2)) };
}
function today(day = dayNo()) {
  const wk = weekOf(day), w = PROGRAM[S.inst][wk.idx], dIn = (day - 1) % 7;
  const pick = (arr, n) => Array.from({ length: Math.min(n, arr.length) }, (_, i) => arr[(dIn + i) % arr.length]);
  return { day, week: Math.floor((day - 1) / 7) + 1, wk, w,
    ex: { warmup: pick(w.warmup, 1), tech: pick(w.tech, 2), rhythm: pick(w.rhythm, 1), song: pick(w.song, 2) } };
}
function sess() {
  const p = P();
  if (!p.sess || p.sess.date !== G.today() || (!p.sess.done && p.sess.day !== p.day)) p.sess = { date: G.today(), day: p.day, block: 0, el: [0, 0, 0, 0], done: false };
  return p.sess;
}
let running = false, tick = null, lastT = 0;
G.planActive = () => running;
const doneToday = () => P().last === G.today();

function startTimer() {
  if (running) return;
  running = true; lastT = performance.now();
  tick = setInterval(step, 250);
  A.ctx();
  render();
}
function pauseTimer() { running = false; clearInterval(tick); tick = null; G.saveData(); render(); }
function step() {
  const now = performance.now(), dt = (now - lastT) / 1000; lastT = now;
  const s = sess(), b = BLOCKS[s.block];
  if (!b) return pauseTimer();
  s.el[s.block] += dt;
  G.addPractice(dt, b.key);
  if (s.el[s.block] >= b.min * 60) {
    chime();
    if (s.block < BLOCKS.length - 1) s.block++;
    else { complete(); return; }
    render();
  }
  updateClock();
}
function chime() { const t = A.now() + 0.02; A.click(t, 2); A.click(t + 0.18, 2); A.click(t + 0.36, 1); }
function complete() {
  const p = P(), s = sess();
  s.done = true;
  if (p.last !== G.today()) { p.last = G.today(); p.day += 1; }
  pauseTimer();
  G.emit('data');
  render();
}
function skip() {
  const s = sess();
  if (s.block < BLOCKS.length - 1) { s.block++; G.saveData(); render(); }
  else complete();
}

// ---------- отрисовка ----------
const clk = sec => G.fmtTime(sec);
function render() {
  const s = sess(), t = today(s.day), done = doneToday();
  const tot = BLOCKS.reduce((a, b) => a + b.min * 60, 0), el = s.el.reduce((a, b) => a + b, 0);
  const daySec = (D.days[G.today()] || {}).sec || 0;
  const goals = D.goals.filter(g => g.status !== 'tempo');
  $('todayRoot').innerHTML = `
  <section class="card wide today-head">
    <div class="today-top">
      <div class="stack" style="gap:6px;min-width:0">
        <span class="lbl">${G.INST_RU[S.inst]} · день ${t.day} · неделя ${t.week}${t.wk.cycle ? ` · повтор ${t.wk.cycle}, темп +${t.wk.cycle * 5}` : ''}</span>
        <h1 class="today-title">${t.w.title}</h1>
        <p class="ctx" style="margin:0">${t.w.focus}</p>
      </div>
      <div class="today-clock">
        <div class="big-num" id="plClock">${clk(BLOCKS[s.block] ? BLOCKS[s.block].min * 60 - s.el[s.block] : 0)}</div>
        <div class="hint" id="plClockSub">${done && !running ? 'план на сегодня выполнен' : (BLOCKS[s.block] || {}).title || ''}</div>
        <div class="row" style="justify-content:center">
          ${done && s.done ? `<button class="btn" id="plAgain">Позаниматься ещё</button>` :
            `<button class="btn primary big" id="plStart">${running ? '⏸ Пауза' : el > 0 ? '▶ Продолжить' : '▶ Начать'}</button>
             <button class="btn big" id="plSkip"${el === 0 && !running ? ' disabled' : ''}>Следующий блок</button>`}
        </div>
      </div>
    </div>
    <div class="pl-progress" aria-hidden="true">${BLOCKS.map((b, i) => `<span style="flex:${b.min}"><i style="width:${Math.min(100, s.el[i] / (b.min * 60) * 100)}%"></i></span>`).join('')}</div>
    <div class="row hint"><span>Всего ${clk(el)} из ${clk(tot)}</span><span>·</span><span>Сегодня в приложении ${Math.round(daySec / 60)} мин</span><span>·</span><span>Серия ${G.streak()} дн.</span></div>
  </section>
  ${BLOCKS.map((b, i) => {
    const st = s.done || i < s.block ? 'done' : i === s.block ? 'now' : 'next';
    const exs = t.ex[b.key].map(id => G.exById(id)).filter(Boolean);
    const extra = b.key === 'song' && goals.length ? `<div class="pl-goals"><span class="lbl">Мои песни</span>${goals.slice(0, 3).map(g => `<button class="linkish" data-goto="songs">${G.esc(g.title)}</button>`).join('')}</div>` : '';
    return `<section class="card pl-block ${st}">
      <div class="head"><h2>${b.title}</h2><span class="pill ${st === 'now' ? 'w3' : st === 'done' ? 'w2' : 'w1'}">${st === 'done' ? 'готово' : st === 'now' ? 'сейчас' : b.min + ' мин'}</span></div>
      <div class="stack">${exs.map(ex => `<button class="pl-ex" data-ex="${ex.id}">
          <span><b>${G.esc(ex.title)}</b><small>${G.esc(ex.desc)}</small></span>
          <span class="pl-bpm">${G.exercises.workBpm(ex)}<small>BPM</small></span>
        </button>`).join('')}${extra}</div>
    </section>`;
  }).join('')}
  <section class="card wide">
    <div class="head"><h2>Как устроен план</h2></div>
    <p class="ctx" style="margin:0">Каждый день — 4 блока, всего 30 минут: таймер сам переключает блоки и подаёт сигнал. Нажмите на упражнение, чтобы открыть его с метрономом и проверкой по звуку; таймер при этом продолжает идти. День программы засчитывается, когда пройдены все блоки. Пропущенный день не ломает план: завтра вы продолжите с того же места. Гитара и бас идут по отдельным программам: переключите инструмент вверху.</p>
  </section>`;
  renderBar();
}
function updateClock() {
  const s = sess(), b = BLOCKS[s.block];
  const left = b ? b.min * 60 - s.el[s.block] : 0;
  const c = $('plClock'); if (c) c.textContent = clk(left);
  const bars = document.querySelectorAll('.pl-progress i');
  bars.forEach((el, i) => el.style.width = Math.min(100, s.el[i] / (BLOCKS[i].min * 60) * 100) + '%');
  renderBar();
}
function renderBar() {
  const bar = $('planBar'), s = sess(), b = BLOCKS[s.block];
  const show = (running || s.el.some(x => x > 0)) && !s.done && S.tab !== 'today';
  bar.hidden = !show;
  if (!show) return;
  bar.innerHTML = `<div class="planbar-in">
    <span class="lbl">План</span><b>${b.title}</b><span class="big-num pb-clock">${clk(b.min * 60 - s.el[s.block])}</span>
    <button class="btn" id="pbToggle">${running ? '⏸ Пауза' : '▶ Продолжить'}</button>
    <button class="btn" id="pbNext">Следующий блок</button>
    <button class="linkish" data-goto="today">к плану</button></div>`;
}

$('todayRoot').addEventListener('click', e => {
  const t = e.target.closest('button'); if (!t) return;
  if (t.id === 'plStart') running ? pauseTimer() : startTimer();
  else if (t.id === 'plSkip') skip();
  else if (t.id === 'plAgain') { const p = P(); p.sess = { date: G.today(), day: p.day, block: 0, el: [0, 0, 0, 0], done: false, extra: true }; render(); }
  else if (t.dataset.ex) G.exercises.open(t.dataset.ex);
});
document.addEventListener('click', e => {
  const t = e.target.closest('#pbToggle, #pbNext'); if (!t) return;
  if (t.id === 'pbToggle') running ? pauseTimer() : startTimer(); else skip();
});
G.on('tab', t => { if (t === 'today') render(); else renderBar(); });
G.on('instrument', () => { if (running) pauseTimer(); render(); });
G.on('data', () => { if (S.tab === 'today') render(); });
render();
})();
