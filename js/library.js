// Библиотека оригинальных упражнений и рифов «в стиле» жанров.
// Нотация: токены через пробел, «|» — только для чтения.
//   S.F[дл]   нота: S — номер струны (1 — самая тонкая), F — лад; дл: w h q e s (+ «.» — с точкой); по умолчанию e
//   m…        глушение ладонью (palm mute)      x S[дл]  глухой удар по струне S без высоты
//   h… p…     хаммер / пулл к этой ноте         b…       бенд на тон вверх (проверяется целевая высота)
//   /…        слайд к этой ноте                 P S.F    пауэр-аккорд от корня на струне S
//   O S.F     октава от корня на струне S       r[дл]    пауза
(() => {
'use strict';
const DUR = { w: 4, h: 2, q: 1, e: 0.5, s: 0.25 };
const rep = (s, n) => Array(n).fill(s).join(' ');

G.parseRiff = (text, NS) => {
  const ev = [];
  let beat = 0;
  for (const tok of text.trim().split(/\s+/)) {
    if (!tok || tok === '|') continue;
    const m = tok.match(/^(m?)([xhpb/]?)([PO]?)(r|[1-6])(?:\.(\d{1,2}))?([whqes]?)(\.?)$/);
    if (!m) throw new Error('Не понял токен «' + tok + '»');
    const [, pm, tech, shape, sv, fv, dl, dot] = m;
    const dur = DUR[dl || 'e'] * (dot ? 1.5 : 1);
    const e = { beat, dur };
    if (sv === 'r') e.rest = true;
    else {
      const sn = +sv, s = NS - sn;
      if (s < 0) throw new Error('Нет струны ' + sn);
      if (pm) e.pm = true;
      if (tech === 'x') { e.dead = true; e.s = s; }
      else {
        e.s = s; e.f = +fv;
        if (tech) e.tech = tech;
        if (shape) e.shape = shape;
      }
    }
    ev.push(e); beat += dur;
  }
  return { events: ev, beats: beat };
};

// Ноты, которые реально звучат (с учётом строя): [{s,f}], и ожидаемая высота для проверки
G.riffNotes = e => {
  if (e.notes) return e.notes;
  if (e.rest || e.dead) return e.dead ? [{ s: e.s, f: null }] : [];
  if (e.shape === 'P') {
    const out = [{ s: e.s, f: e.f }];
    if (G.isDrop() && e.s === 0) { out.push({ s: 1, f: e.f }, { s: 2, f: e.f }); }
    else if (e.s + 1 < G.NS()) {
      const up = G.T()[e.s + 1] - G.T()[e.s] === 4 ? 3 : 2;   // через струну B
      out.push({ s: e.s + 1, f: e.f + up });
    }
    return out;
  }
  if (e.shape === 'O') {
    if (e.s + 2 >= G.NS()) return [{ s: e.s, f: e.f }];
    const span = G.T()[e.s + 2] - G.T()[e.s];
    return [{ s: e.s, f: e.f }, { s: e.s + 2, f: e.f + 12 - span }];
  }
  return [{ s: e.s, f: e.f }];
};
G.riffExpect = e => {
  if (e.rest) return null;
  if (e.dead) return { midi: null };
  const f = e.tech === 'b' ? e.f + 2 : e.f;
  return { midi: G.midiAt(e.s, f), chord: !!e.shape || !!(e.notes && e.notes.length > 1) };
};

// ---------------- упражнения ----------------
const chroma6 = () => {
  const up = [], dn = [];
  for (let s = 6; s >= 1; s--) for (const f of [1, 2, 3, 4]) up.push(`${s}.${f}`);
  for (let s = 1; s <= 6; s++) for (const f of [4, 3, 2, 1]) dn.push(`${s}.${f}`);
  return up.concat(dn).join(' ');
};
const spider6 = () => { const a = []; for (let s = 6; s >= 1; s--) for (const f of [1, 3, 2, 4]) a.push(`${s}.${f}`); return a.join(' '); };
const chroma4 = () => {
  const a = [];
  for (let s = 4; s >= 1; s--) for (const f of [1, 2, 3, 4]) a.push(`${s}.${f}`);
  for (let s = 1; s <= 4; s++) for (const f of [4, 3, 2, 1]) a.push(`${s}.${f}`);
  return a.join(' ');
};

const EX = [
  // ===== гитара: разминка =====
  { id: 'g-chroma', inst: 'guitar', cat: 'warmup', title: 'Хроматика 1-2-3-4', bpm: 70, riff: chroma6(),
    desc: 'По одному пальцу на лад, с 6-й струны на 1-ю и обратно. Переменный штрих, пальцы держите низко над грифом.' },
  { id: 'g-spider', inst: 'guitar', cat: 'warmup', title: 'Паук 1-3-2-4', bpm: 60, riff: spider6(),
    desc: 'Перекрёстный порядок пальцев разгоняет независимость безымянного и мизинца.' },
  // ===== гитара: ноты =====
  { id: 'g-notes6', inst: 'guitar', cat: 'notes', title: 'Ноты на 6-й струне', bpm: 70,
    riff: '6.0q 6.1q 6.3q 6.5q 6.7q 6.8q 6.10q 6.12q 6.10q 6.8q 6.7q 6.5q 6.3q 6.1q 6.0h',
    desc: 'E F G A B C D E: проговаривайте названия вслух. Эти лады — корни всех пауэр-аккордов на 6-й струне.' },
  { id: 'g-notes5', inst: 'guitar', cat: 'notes', title: 'Ноты на 5-й струне', bpm: 70,
    riff: '5.0q 5.2q 5.3q 5.5q 5.7q 5.8q 5.10q 5.12q 5.10q 5.8q 5.7q 5.5q 5.3q 5.2q 5.0h',
    desc: 'A B C D E F G A: корни аккордов с 5-й струны.' },
  { id: 'g-notes65', inst: 'guitar', cat: 'notes', title: 'Ноты 6-й и 5-й вперемешку', bpm: 60,
    riff: '6.3q 5.3q 6.5q 5.5q 6.7q 5.7q 6.8q 5.8q 6.10q 5.10q 6.1q 5.2q 6.0h 5.0h',
    desc: 'G C, A D, B E, C F, D G: одна и та же нота ищется на соседней струне на 5 ладов ниже.' },
  // ===== гитара: техника =====
  { id: 'g-power', inst: 'guitar', cat: 'tech', title: 'Пауэр-аккорды: корень на 6-й и 5-й', bpm: 80,
    riff: 'P6.0q P6.3q P6.5q P6.7q | P5.3q P5.5q P5.7q P6.0q',
    desc: 'E5 G5 A5 B5, затем C5 D5 E5. Глушите незадействованные струны подушечкой указательного пальца.' },
  { id: 'g-pm8', inst: 'guitar', cat: 'tech', title: 'Глушение ладонью, восьмые', bpm: 90,
    riff: rep('m6.0e', 6) + ' P6.3q | ' + rep('m6.0e', 6) + ' P6.5q',
    desc: 'Ребро ладони на струнах у самой подставки, только удары вниз. Аккорд в конце — без глушения, в полный звук.' },
  { id: 'g-down8', inst: 'guitar', cat: 'tech', title: 'Даунстроки восьмыми', bpm: 100,
    riff: [rep('P6.5e', 8), rep('P6.3e', 8), rep('P5.3e', 8), rep('P5.5e', 8)].join(' | '),
    desc: 'Только удары вниз, кисть свободная. Цель: держать 140+ BPM восьмыми без зажатости предплечья.' },
  { id: 'g-bends', inst: 'guitar', cat: 'tech', title: 'Бенды на тон', bpm: 60,
    riff: '3.9q b3.7q 3.9q b3.7q | 2.10q b2.8q 2.10q b2.8q',
    desc: 'Сначала эталонная нота, затем бенд до неё. Тяните тремя пальцами, приложение проверяет, дотянута ли высота.' },
  { id: 'g-slides', inst: 'guitar', cat: 'tech', title: 'Слайды', bpm: 70,
    riff: '4.5e /4.7e 4.7q 4.5e /4.9e 4.9q | 3.4e /3.6e 3.6q 3.6e /3.4e 3.4q',
    desc: 'Не ослабляйте прижим во время скольжения, иначе звук оборвётся. Проверяется нота, в которую вы приехали.' },
  { id: 'g-legato', inst: 'guitar', cat: 'tech', title: 'Хаммеры и пуллы', bpm: 70,
    riff: '3.5e h3.7e p3.5e re 4.5e h4.7e p4.5e re | 2.5e h2.8e p2.5e re 1.5e h1.8e p1.5e re',
    desc: 'Пентатоника ля минор. Хаммер — резкий удар пальцем, пулл — щипок пальцем вниз. Громкость всех трёх нот должна быть ровной.' },
  // ===== гитара: ритм =====
  { id: 'g-rests', inst: 'guitar', cat: 'rhythm', title: 'Паузы и сбивки', bpm: 85,
    riff: 'P6.0e re P6.0e re P6.0s P6.0s re P6.3q | P6.0e re P6.0e P6.0e re P6.5e P6.3q',
    desc: 'Паузы считаются так же точно, как удары. Глушите струны левой рукой сразу после удара.' },
  { id: 'g-sync', inst: 'guitar', cat: 'rhythm', title: 'Синкопы на восьмых', bpm: 80,
    riff: 'P5.0q. P5.0e re P5.0e P5.3q | P5.5q. P5.5e re P5.3e P5.0q',
    desc: 'Удары на «и» доли. Рука продолжает двигаться вниз-вверх и в паузах, просто не задевает струны.' },
  // ===== гранж (Drop D) =====
  { id: 'g-grunge-1', inst: 'guitar', cat: 'riff', style: 'grunge', tuning: 'dropD', title: 'Гранж: квинты одним пальцем', bpm: 100,
    riff: 'P6.0e P6.0e P6.3e P6.0e P6.5q P6.3q | P6.0e P6.0e P6.7e P6.5e P6.3q P6.1q',
    desc: 'Drop D: один палец лежит на трёх нижних струнах. Играйте грязно, но в ритм: в гранже важна энергия правой руки.' },
  { id: 'g-grunge-dyn', inst: 'guitar', cat: 'riff', style: 'grunge', tuning: 'dropD', title: 'Гранж: тихий куплет, громкий припев', bpm: 90,
    riff: '4.0e 3.2e 2.3e 3.2e 4.0e 3.2e 2.3e 3.2e | 4.0e 3.2e 2.3e 3.2e 4.3e 3.2e 2.3e 3.2e | P6.0q P6.0q P6.5q P6.3q | P6.0q P6.0q P6.7q P6.5q',
    desc: 'Первые два такта чистым звуком и тихо, затем включите перегруз на Mooer и бейте квинты. Тренирует резкую смену динамики.' },
  { id: 'g-grunge-slide', inst: 'guitar', cat: 'riff', style: 'grunge', tuning: 'dropD', title: 'Гранж: слайды на квинтах', bpm: 95,
    riff: 'P6.2e /P6.5e P6.5e P6.2e P6.0q P6.0q | P6.2e /P6.5e P6.5e P6.7e /P6.5q P6.3q',
    desc: 'Скольжение всей квинтой без отрыва пальца. Корень проверяется по 6-й струне.' },
  // ===== рэп-метал (Drop D) =====
  { id: 'g-rm-rests', inst: 'guitar', cat: 'riff', style: 'rapmetal', tuning: 'dropD', title: 'Рэп-метал: рифф с паузами', bpm: 88,
    riff: 'mP6.0s mP6.0s rs mP6.0s re P6.3e re P6.5e P6.3e re | mP6.0s mP6.0s rs mP6.0s re P6.7e rs P6.5s P6.3e P6.0e re',
    desc: 'Короткие глушёные удары и резкие паузы: рифф держится на тишине между ударами. Левая рука глушит сразу.' },
  { id: 'g-rm-mute', inst: 'guitar', cat: 'riff', style: 'rapmetal', tuning: 'dropD', title: 'Рэп-метал: глухие удары и акценты', bpm: 90,
    riff: 'x6s x6s P6.0e x6s x6s P6.0e x6s P6.3s re P6.0q | x6s x6s P6.0e x6s x6s P6.5e P6.3e P6.0q.',
    desc: 'Глухие удары: левая рука лежит на струнах, не прижимая. Акценты — открытая квинта. Проверяется попадание в долю.' },
  { id: 'g-rm-oct', inst: 'guitar', cat: 'riff', style: 'rapmetal', title: 'Рэп-метал: октавы и пауза', bpm: 92,
    riff: 'O4.7e re O4.7e O4.5e re O4.3e O4.5q | O4.7e re O4.7e O4.10e re O4.8e O4.7q',
    desc: 'Октава через струну, средняя струна заглушена. Попробуйте на Mooer эффект питч-шифтера на октаву вверх: так звучат «сиренные» партии жанра.' },
  { id: 'g-rm-trem', inst: 'guitar', cat: 'riff', style: 'rapmetal', title: 'Тремоло-пикинг на одной ноте', bpm: 80,
    riff: rep('3.7s', 16) + ' | ' + rep('3.5s', 8) + ' ' + rep('3.3s', 8),
    desc: 'Быстрый переменный штрих шестнадцатыми из кисти. С эффектом фланжера или фейзера получается характерный шумовой звук.' },
  // ===== поп-рок =====
  { id: 'g-pr-8', inst: 'guitar', cat: 'riff', style: 'poprock', title: 'Поп-рок: восьмые I–V–vi–IV', bpm: 110,
    riff: [rep('P6.3e', 8), rep('P5.5e', 8), rep('P6.0e', 8), rep('P5.3e', 8)].join(' | '),
    desc: 'G5 D5 E5 C5 ровными восьмыми. Самая частая основа куплетов в поп-роке: следите, чтобы смена аккорда не опаздывала.' },
  { id: 'g-pr-arp', inst: 'guitar', cat: 'riff', style: 'poprock', title: 'Поп-рок: арпеджио открытых аккордов', bpm: 80,
    riff: '5.3e 4.2e 3.0e 2.1e 3.0e 4.2e 5.3e 4.2e | 6.3e 5.2e 4.0e 3.0e 2.0e 3.0e 4.0e 5.2e | 5.0e 4.2e 3.2e 2.1e 3.2e 4.2e 5.0e 4.2e | 6.0e 5.2e 4.2e 3.0e 2.0e 3.0e 4.2e 5.2e',
    desc: 'C G Am Em перебором. Держите аккорд целиком, пусть струны звучат вместе.' },
  { id: 'g-pr-riff', inst: 'guitar', cat: 'riff', style: 'poprock', title: 'Поп-рок: рифф на открытой струне', bpm: 105,
    riff: '6.0e 6.0e 5.2e 6.0e 5.4e 5.2e 6.0e 6.3e | 6.0e 6.0e 5.2e 6.0e 5.5e 5.4e 5.2e 6.0e',
    desc: 'Одиночные ноты вокруг открытой ми. Глушите 6-ю струну, когда играете на 5-й.' },

  // ===== бас =====
  { id: 'b-chroma', inst: 'bass', cat: 'warmup', title: 'Бас: хроматика 1-2-3-4', bpm: 70, riff: chroma4(),
    desc: 'Палец на лад, чередование указательного и среднего пальцев правой руки (или медиатор вниз-вверх).' },
  { id: 'b-notesE', inst: 'bass', cat: 'notes', title: 'Бас: ноты на 4-й струне', bpm: 70,
    riff: '4.0q 4.1q 4.3q 4.5q 4.7q 4.8q 4.10q 4.12q 4.10q 4.8q 4.7q 4.5q 4.3q 4.1q 4.0h',
    desc: 'E F G A B C D E: самая нужная струна басиста.' },
  { id: 'b-notesA', inst: 'bass', cat: 'notes', title: 'Бас: ноты на 3-й струне', bpm: 70,
    riff: '3.0q 3.2q 3.3q 3.5q 3.7q 3.8q 3.10q 3.12q 3.10q 3.8q 3.7q 3.5q 3.3q 3.2q 3.0h',
    desc: 'A B C D E F G A.' },
  { id: 'b-root8', inst: 'bass', cat: 'tech', title: 'Бас: корни восьмыми', bpm: 100,
    riff: [rep('4.0e', 8), rep('3.3e', 8), rep('4.3e', 8), rep('3.5e', 8)].join(' | '),
    desc: 'E C G D ровными восьмыми. Основа рок-баса: точнее барабанщика.' },
  { id: 'b-oct', inst: 'bass', cat: 'tech', title: 'Бас: октавы', bpm: 90,
    riff: rep('4.5e 2.7e', 4) + ' | ' + rep('3.5e 1.7e', 4),
    desc: 'Корень и октава через струну. Глушите среднюю струну пальцем.' },
  { id: 'b-r5', inst: 'bass', cat: 'tech', title: 'Бас: корень, квинта, октава', bpm: 85,
    riff: '4.3e 3.5e 2.5e 3.5e 4.3e 3.5e 2.5e 3.5e | 3.3e 2.5e 1.5e 2.5e 3.3e 2.5e 1.5e 2.5e',
    desc: 'Аппликатура «квадрат»: квинта на струну выше и на два лада дальше, октава ещё выше.' },
  { id: 'b-slide', inst: 'bass', cat: 'tech', title: 'Бас: слайды и хаммеры', bpm: 75,
    riff: '4.3e /4.5e 4.5q 3.3e h3.5e 3.5q | 4.5e /4.7e 4.7q 3.5e h3.7e 3.7q',
    desc: 'Слайд в ноту и хаммер на соседний тон без повторного удара.' },
  { id: 'b-sync', inst: 'bass', cat: 'rhythm', title: 'Бас: синкопы', bpm: 80,
    riff: '4.0q. 4.0e re 4.0e 4.3q | 4.5q. 4.5e re 4.3e 4.0q',
    desc: 'Совпадает по ритму с гитарными «Синкопами на восьмых»: можно играть вместе.' },
  { id: 'b-grunge', inst: 'bass', cat: 'riff', style: 'grunge', tuning: 'dropD', title: 'Бас: гранж в Drop D', bpm: 100,
    riff: '4.0e 4.0e 4.3e 4.0e 4.5q 4.3q | 4.0e 4.0e 4.7e 4.5e 4.3q 4.1q',
    desc: 'Повторяет корни гитарного рифа «квинты одним пальцем». Медиатором, только вниз.' },
  { id: 'b-rm', inst: 'bass', cat: 'riff', style: 'rapmetal', tuning: 'dropD', title: 'Бас: рэп-метал с паузами', bpm: 88,
    riff: 'm4.0s m4.0s rs m4.0s re 4.3e re 4.5e 4.3e re | m4.0s m4.0s rs m4.0s re 4.7e rs 4.5s 4.3e 4.0e re',
    desc: 'Плотный, короткий звук. Паузы глушите обеими руками.' },
  { id: 'b-pr', inst: 'bass', cat: 'riff', style: 'poprock', title: 'Бас: поп-рок восьмые I–V–vi–IV', bpm: 110,
    riff: [rep('4.3e', 8), rep('3.5e', 8), rep('4.0e', 8), rep('3.3e', 8)].join(' | '),
    desc: 'G D E C под гитарные восьмые. Добавьте октаву на последнюю восьмую, когда освоитесь.' },
];
EX.forEach(e => { e.cat = e.cat || 'tech'; });
G.EX = EX;
G.exById = id => EX.find(e => e.id === id);
G.CAT_RU = { warmup: 'Разминка', notes: 'Ноты', tech: 'Техника', rhythm: 'Ритм', riff: 'Рифы' };
G.STYLE_RU = { grunge: 'гранж', rapmetal: 'рэп-метал', poprock: 'поп-рок' };

// Этюды из двух дорожек для вкладки «Песни»
G.ETUDES = [
  { id: 'et-grunge', title: 'Этюд «Гараж»', style: 'grunge', bpm: 100, parts: { guitar: 'g-grunge-1', bass: 'b-grunge' } },
  { id: 'et-rm', title: 'Этюд «Пауза»', style: 'rapmetal', bpm: 88, parts: { guitar: 'g-rm-rests', bass: 'b-rm' } },
  { id: 'et-pr', title: 'Этюд «Радио»', style: 'poprock', bpm: 110, parts: { guitar: 'g-pr-8', bass: 'b-pr' } },
  { id: 'et-sync', title: 'Этюд «Синкопа»', style: 'poprock', bpm: 80, parts: { guitar: 'g-sync', bass: 'b-sync' } },
];

// ---------------- alphaTex ----------------
const TEXDUR = { 4: 1, 2: 2, 1: 4, 0.5: 8, 0.25: 16 };
const toneName = m => ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'][m % 12] + (Math.floor(m / 12) - 1);
function durTex(d) {
  if (TEXDUR[d]) return { d: TEXDUR[d], dot: false };
  if (TEXDUR[d / 1.5]) return { d: TEXDUR[d / 1.5], dot: true };
  return { d: 16, dot: false };
}
// события одной дорожки -> строка alphaTex (с тактами по 4/4)
G.eventsToTex = (events, tuning) => {
  const NS = tuning.length;
  const strNo = s => NS - s;
  let out = [], beat = 0;
  events.forEach((e, i) => {
    const { d, dot } = durTex(e.dur);
    const beatFx = [];
    if (dot) beatFx.push('d');
    let body;
    if (e.rest) body = 'r';
    else {
      const next = events[i + 1];
      const nfx = [];
      if (e.pm) nfx.push('pm');
      if (e.tech === 'b') nfx.push('b (0 4)');
      if (next && !next.rest && (next.tech === 'h' || next.tech === 'p')) nfx.push('h');
      if (next && !next.rest && next.tech === '/') nfx.push('sl');
      const fx = nfx.length ? `{${nfx.join(' ')}}` : '';
      const notes = e.dead ? [{ s: e.s, f: 'x' }] : G.riffNotesFor(e, tuning);
      const parts = notes.map(n => `${n.f === null ? 'x' : n.f}.${strNo(n.s)}${fx}`);
      body = parts.length > 1 ? `(${parts.join(' ')})` : parts[0];
    }
    out.push(`${body}.${d}${beatFx.length ? `{${beatFx.join(' ')}}` : ''}`);
    beat += e.dur;
    if (Math.abs(beat % 4) < 1e-6 && i < events.length - 1) out.push('|');
  });
  return out.join(' ');
};
// riffNotes для произвольного строя (а не текущего)
G.riffNotesFor = (e, tuning) => {
  const saveT = G.T, saveNS = G.NS, saveDrop = G.isDrop;
  G.T = () => tuning; G.NS = () => tuning.length; G.isDrop = () => tuning.length === 6 && tuning[1] - tuning[0] === 7;
  try { return G.riffNotes(e); } finally { G.T = saveT; G.NS = saveNS; G.isDrop = saveDrop; }
};
G.texTuning = tuning => tuning.slice().reverse().map(toneName).join(' ');
G.exTuning = ex => G.TUNINGS[ex.inst][ex.tuning || (ex.inst === G.S.inst ? G.S.tuning[ex.inst] : 'std')].notes;
G.trackTex = (name, inst, events, tuning) =>
  `\\track "${name}"\n\\staff {score tabs}\n\\tuning (${G.texTuning(tuning)})\n\\instrument ${inst === 'bass' ? 34 : 30}\n${G.eventsToTex(events, tuning)}\n`;
G.exToTex = (ex, title) => {
  const tuning = G.exTuning(ex);
  const { events } = G.parseRiff(ex.riff, tuning.length);
  return `\\title "${(title || ex.title).replace(/"/g, "'")}"\n\\tempo ${G.data && G.data.tempo[ex.id] || ex.bpm}\n.\n` +
    G.trackTex(ex.inst === 'bass' ? 'Бас' : 'Гитара', ex.inst, events, tuning);
};
G.etudeToTex = et => {
  let s = `\\title "${et.title}"\n\\subtitle "${G.STYLE_RU[et.style] || ''}"\n\\tempo ${et.bpm}\n.\n`;
  for (const inst of ['guitar', 'bass']) {
    const ex = G.exById(et.parts[inst]);
    const tuning = G.TUNINGS[inst][ex.tuning || 'std'].notes;
    s += G.trackTex(inst === 'bass' ? 'Бас' : 'Гитара', inst, G.parseRiff(ex.riff, tuning.length).events, tuning);
  }
  return s;
};
})();
