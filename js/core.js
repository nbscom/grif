// Ядро: состояние, хранение, теория (строи, ноты, аккорды, аппликатуры, гармония)
window.G = (() => {
'use strict';
const G = {};

// ================= строи и инструменты =================
const STD_G = [40, 45, 50, 55, 59, 64]; // эталон для форм аккордов
G.TUNINGS = {
  guitar: {
    std:    { name: 'Стандарт · E A D G B E',      notes: [40, 45, 50, 55, 59, 64] },
    dropD:  { name: 'Drop D · D A D G B E',        notes: [38, 45, 50, 55, 59, 64] },
    eb:     { name: 'E♭ · полтона вниз',           notes: [39, 44, 49, 54, 58, 63] },
    dropCs: { name: 'Drop C♯ · Drop D полтона вниз', notes: [37, 44, 49, 54, 58, 63] },
  },
  bass: {
    std:   { name: 'Стандарт · E A D G',   notes: [28, 33, 38, 43] },
    dropD: { name: 'Drop D · D A D G',     notes: [26, 33, 38, 43] },
    eb:    { name: 'E♭ · полтона вниз',    notes: [27, 32, 37, 42] },
  },
};
G.FRETS = { guitar: 22, bass: 20 };
G.INST_RU = { guitar: 'гитара', bass: 'бас' };

// ================= состояние =================
const DEFAULT = {
  tab: 'today', inst: 'guitar', tuning: { guitar: 'std', bass: 'std' },
  keyRoot: 9, keyMode: 'minor', drive: true, power: false,
  prog: [{ root: 9, q: 'm', v: 0 }, { root: 5, q: 'maj', v: 0 }, { root: 0, q: 'maj', v: 0 }, { root: 7, q: 'maj', v: 0 }],
  sel: 0, cur: { root: 9, q: 'm', v: 0 },
  fbMode: 'scale', fbLabels: 'names', scale: 'minPent', bpm: 96,
  metro: { bpm: 90, sig: '4/4', accent: true, sub: 1, vol: 0.8 },
  input: { deviceId: '', deviceLabel: '', latencyMs: 0, threshold: 0.01 },
  quizSrc: 'click',
};
let S;
try {
  const v2 = localStorage.getItem('grif-v2');
  const v1 = localStorage.getItem('grif-v1');
  S = Object.assign({}, DEFAULT, JSON.parse(v2 || v1 || '{}'));
} catch (e) { S = Object.assign({}, DEFAULT); }
for (const k of ['tuning', 'metro', 'input']) S[k] = Object.assign({}, DEFAULT[k], S[k] || {});
G.S = S;
G.save = () => { try { localStorage.setItem('grif-v2', JSON.stringify(S)); } catch (e) {} };

// простая шина событий между модулями
const subs = {};
G.on = (ev, fn) => {
  (subs[ev] = subs[ev] || []).push(fn);
  return () => { const a = subs[ev], i = a.indexOf(fn); if (i >= 0) a.splice(i, 1); };
};
G.emit = (ev, data) => (subs[ev] || []).forEach(fn => { try { fn(data); } catch (e) { console.error(e); } });

G.$ = id => document.getElementById(id);
G.esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

// ================= ноты =================
G.SHARP = ['C', 'C♯', 'D', 'D♯', 'E', 'F', 'F♯', 'G', 'G♯', 'A', 'A♯', 'B'];
G.FLAT = ['C', 'D♭', 'D', 'E♭', 'E', 'F', 'G♭', 'G', 'A♭', 'A', 'B♭', 'B'];
G.RU_S = ['до', 'до-диез', 'ре', 'ре-диез', 'ми', 'фа', 'фа-диез', 'соль', 'соль-диез', 'ля', 'ля-диез', 'си'];
G.RU_F = ['до', 'ре-бемоль', 'ре', 'ми-бемоль', 'ми', 'фа', 'соль-бемоль', 'соль', 'ля-бемоль', 'ля', 'си-бемоль', 'си'];
G.NATURAL = [0, 2, 4, 5, 7, 9, 11];

G.tuningId = () => S.tuning[S.inst];
G.T = () => G.TUNINGS[S.inst][G.tuningId()].notes;
G.NS = () => G.T().length;
G.nFrets = () => G.FRETS[S.inst];
G.isBass = () => S.inst === 'bass';
G.pcAt = (s, f) => (G.T()[s] + f) % 12;
G.midiAt = (s, f) => G.T()[s] + f;
G.stringNo = s => G.NS() - s; // 1 = самая тонкая
G.flats = () => {
  return S.keyMode === 'major' ? [5, 10, 3, 8, 1].includes(S.keyRoot) : [2, 7, 0, 5, 10, 3].includes(S.keyRoot);
};
G.nn = pc => (G.flats() ? G.FLAT : G.SHARP)[((pc % 12) + 12) % 12];
G.midiName = m => G.nn(m % 12) + (Math.floor(m / 12) - 1);
G.freqOf = m => 440 * Math.pow(2, (m - 69) / 12);
G.midiOfFreq = f => 69 + 12 * Math.log2(f / 440);
G.tuningLetters = () => G.T().map(m => (G.tuningId() === 'eb' ? G.FLAT : G.SHARP)[m % 12]).join(' ');

// ================= аккорды =================
G.QUAL = {
  maj:  { suf: '',     name: 'мажорное трезвучие',            iv: [0, 4, 7] },
  m:    { suf: 'm',    name: 'минорное трезвучие',            iv: [0, 3, 7] },
  '5':  { suf: '5',    name: 'пауэр-аккорд: тоника и квинта', iv: [0, 7] },
  '7':  { suf: '7',    name: 'доминантсептаккорд',            iv: [0, 4, 7, 10] },
  m7:   { suf: 'm7',   name: 'малый минорный септаккорд',     iv: [0, 3, 7, 10] },
  maj7: { suf: 'maj7', name: 'большой мажорный септаккорд',   iv: [0, 4, 7, 11] },
  sus2: { suf: 'sus2', name: 'секунда вместо терции',         iv: [0, 2, 7] },
  sus4: { suf: 'sus4', name: 'кварта вместо терции',          iv: [0, 5, 7] },
  '6':  { suf: '6',    name: 'мажор с секстой',               iv: [0, 4, 7, 9] },
  m6:   { suf: 'm6',   name: 'минор с секстой',               iv: [0, 3, 7, 9] },
  '9':  { suf: '9',    name: 'доминантовый нонаккорд',        iv: [0, 4, 7, 10, 14] },
  dim:  { suf: 'dim',  name: 'уменьшённое трезвучие',         iv: [0, 3, 6] },
  aug:  { suf: 'aug',  name: 'увеличенное трезвучие',         iv: [0, 4, 8] },
  m7b5: { suf: 'm7♭5', name: 'полууменьшённый септаккорд',    iv: [0, 3, 6, 10] },
};
G.QUAL_ORDER = ['maj', 'm', '5', '7', 'm7', 'maj7', 'sus2', 'sus4', '6', 'm6', '9', 'dim', 'aug', 'm7b5'];
G.IVL = { 0: '1', 2: '2', 3: '♭3', 4: '3', 5: '4', 6: '♭5', 7: '5', 8: '♯5', 9: '6', 10: '♭7', 11: '7', 14: '9' };
G.IVL_RU = { '1': 'тоника', '2': 'секунда', '♭3': 'малая терция', '3': 'большая терция', '4': 'кварта', '♭5': 'ум. квинта', '5': 'квинта', '♯5': 'ув. квинта', '6': 'секста', '♭7': 'малая септима', '7': 'большая септима', '9': 'нона' };
G.SC_IVL = ['1', '♭2', '2', '♭3', '3', '4', '♭5', '5', '♭6', '6', '♭7', '7'];
G.SCALES = {
  minPent: { name: 'минорная пентатоника', iv: [0, 3, 5, 7, 10] },
  majPent: { name: 'мажорная пентатоника', iv: [0, 2, 4, 7, 9] },
  blues:   { name: 'блюзовая гамма',       iv: [0, 3, 5, 6, 7, 10] },
  major:   { name: 'мажор (ионийский)',    iv: [0, 2, 4, 5, 7, 9, 11] },
  minor:   { name: 'натуральный минор',    iv: [0, 2, 3, 5, 7, 8, 10] },
  harm:    { name: 'гармонический минор',  iv: [0, 2, 3, 5, 7, 8, 11] },
  dorian:  { name: 'дорийский лад',        iv: [0, 2, 3, 5, 7, 9, 10] },
  mixo:    { name: 'миксолидийский лад',   iv: [0, 2, 4, 5, 7, 9, 10] },
};
G.chordName = c => G.nn(c.root) + G.QUAL[c.q].suf;
G.chordLbls = c => { const m = {}; G.QUAL[c.q].iv.forEach(i => m[(c.root + i) % 12] = G.IVL[i]); return m; };

// Подвижные формы (смещения от корня в стандартном строе), null = заглушена
const SHAPES = {
  E: { maj: [0, 2, 2, 1, 0, 0], m: [0, 2, 2, 0, 0, 0], '7': [0, 2, 0, 1, 0, 0], m7: [0, 2, 0, 0, 0, 0], maj7: [0, null, 1, 1, 0, null],
       sus2: [0, 2, 4, 4, null, null], sus4: [0, 2, 2, 2, 0, 0], '5': [0, 2, 2, null, null, null], '6': [0, null, -1, 1, 0, null],
       m6: [0, null, -1, 0, 0, null], '9': [0, null, 0, 1, 0, 2], dim: [0, 1, 2, 0, null, null], aug: [0, null, 2, 1, 1, null],
       m7b5: [0, null, 0, 0, -1, null] },
  A: { maj: [null, 0, 2, 2, 2, 0], m: [null, 0, 2, 2, 1, 0], '7': [null, 0, 2, 0, 2, 0], m7: [null, 0, 2, 0, 1, 0], maj7: [null, 0, 2, 1, 2, 0],
       sus2: [null, 0, 2, 2, 0, 0], sus4: [null, 0, 2, 2, 3, 0], '5': [null, 0, 2, 2, null, null], '6': [null, 0, 2, 2, 2, 2],
       m6: [null, 0, 2, -1, 1, null], '9': [null, 0, -1, 0, 0, 0], dim: [null, 0, 1, 2, 1, null], aug: [null, 0, -1, -2, -2, null],
       m7b5: [null, 0, 1, 0, 1, null] },
  D: { maj: [null, null, 0, 2, 3, 2], m: [null, null, 0, 2, 3, 1], '7': [null, null, 0, 2, 1, 2], m7: [null, null, 0, 2, 1, 1],
       maj7: [null, null, 0, 2, 2, 2], sus2: [null, null, 0, 2, 3, 0], sus4: [null, null, 0, 2, 3, 3] },
};
const SHAPE_STR = { E: 0, A: 1, D: 2 };
const SHAPE_KIND = { E: 'корень на 6-й струне', A: 'корень на 5-й струне', D: 'корень на 4-й струне' };
const OPEN = [
  [0, 'maj', 'x32010'], [9, 'maj', 'x02220'], [7, 'maj', '320003'], [4, 'maj', '022100'], [2, 'maj', 'xx0232'],
  [9, 'm', 'x02210'], [4, 'm', '022000'], [2, 'm', 'xx0231'],
  [9, '7', 'x02020'], [11, '7', 'x21202'], [0, '7', 'x32310'], [2, '7', 'xx0212'], [4, '7', '020100'], [7, '7', '320001'],
  [9, 'm7', 'x02010'], [4, 'm7', '022030'], [2, 'm7', 'xx0211'],
  [0, 'maj7', 'x32000'], [5, 'maj7', 'xx3210'], [9, 'maj7', 'x02120'], [2, 'maj7', 'xx0222'],
  [9, 'sus2', 'x02200'], [9, 'sus4', 'x02230'], [2, 'sus2', 'xx0230'], [2, 'sus4', 'xx0233'], [4, 'sus4', '022200'],
  [4, '5', '022xxx'], [9, '5', 'x022xx'], [2, '5', 'xx023x'],
  [0, '6', 'x32210'], [9, '6', 'x02222'], [7, '6', '320000'],
];
const parseTab = t => [...t].map(c => c === 'x' ? -1 : +c);

function validVoicing(fr, root, q) {
  const T = G.T(), iv = G.QUAL[q].iv, pcs = new Set(iv.map(i => (root + i) % 12));
  const snd = fr.map((f, s) => f < 0 ? null : (T[s] + f) % 12).filter(x => x !== null);
  if (snd.length < 2) return false;
  const low = fr.findIndex(f => f >= 0);
  if ((T[low] + fr[low]) % 12 !== root) return false;
  if (!snd.every(p => pcs.has(p))) return false;
  const need = iv.filter(i => !(iv.length >= 4 && i === 7)).map(i => (root + i) % 12);
  return need.every(p => snd.includes(p));
}
G.isDrop = () => !G.isBass() && G.T()[1] - G.T()[0] === 7;
const vCache = {};
G.voicings = (root, q) => {
  if (G.isBass()) return [];
  const key = G.tuningId() + ':' + root + q;
  if (vCache[key]) return vCache[key];
  const T = G.T(), off = T.map((m, i) => m - STD_G[i]);
  const out = [], seen = new Set();
  const add = (fr, kind, prio = 0) => {
    const k = fr.join(',');
    if (seen.has(k) || fr.some(f => f > 19) || !validVoicing(fr, root, q)) return;
    const pos = fr.filter(f => f > 0);
    if (pos.length && Math.max(...pos) - Math.min(...pos) > 4) return;
    seen.add(k); out.push({ fr, kind, prio });
  };
  // Drop-строй: квинта на 6–5–4 струнах одним пальцем
  if (q === '5' && G.isDrop()) {
    const r = (root - T[0] % 12 + 12) % 12;
    for (const b of [r, r + 12]) add([b, b, b, -1, -1, -1], b === 0 ? 'Drop: открытые 6–5–4 струны' : 'Drop: один палец на 6–5–4 струнах', -1);
  }
  // открытые формы: ноты сохраняются, если все звучащие струны сдвинуты одинаково
  for (const [r0, q0, tab] of OPEN) {
    if (q0 !== q) continue;
    const fr = parseTab(tab), snd = fr.map((f, i) => f >= 0 ? i : -1).filter(i => i >= 0);
    const d = off[snd[0]];
    if (!snd.every(i => off[i] === d)) continue;
    if ((r0 + d + 12) % 12 !== root) continue;
    add(fr, d === 0 ? 'открытая позиция' : 'открытая форма (звучит ниже)');
  }
  // подвижные формы: высота звуков сохраняется, лады пересчитываются под строй
  for (const form of ['E', 'A', 'D']) {
    const sh = SHAPES[form][q];
    if (!sh) continue;
    const rs = SHAPE_STR[form], r0 = (root - T[rs] % 12 + 12) % 12;
    for (const base of [r0, r0 + 12]) {
      const fr = sh.map((o, s) => o === null ? -1 : base + o - off[s] + off[rs]);
      if (fr.some(f => f < -1) || fr.some((f, s) => sh[s] !== null && f < 0)) continue;
      const shifted = sh.some((o, s) => o !== null && off[s] !== off[rs]);
      add(fr, base === 0 && !fr.some(f => f > 4) ? 'открытая позиция' : SHAPE_KIND[form] + (shifted ? ', поправка на строй' : ''));
    }
  }
  const sortKey = v => {
    const fr = v.fr, p = fr.filter(f => f > 0);
    const base = fr.includes(0) && Math.max(...fr) <= 4 ? 0 : (p.length ? Math.min(...p) : 0);
    return base + v.prio * 0.5;
  };
  out.sort((a, b) => sortKey(a) - sortKey(b));
  return (vCache[key] = out);
};
G.centerOf = fr => { const p = fr.filter(f => f > 0); return p.length ? p.reduce((a, b) => a + b, 0) / p.length : 0; };
G.nearestV = (root, q, ref) => {
  const vs = G.voicings(root, q);
  let best = 0, bd = Infinity;
  vs.forEach((v, i) => { const d = Math.abs(G.centerOf(v.fr) - ref); if (d < bd - 0.01) { bd = d; best = i; } });
  return best;
};
// Бас: позиции корня на нижних струнах до 12 лада
G.bassRootPositions = root => {
  const out = [];
  for (let s = 0; s < Math.min(2, G.NS()); s++) for (let f = 0; f <= 12; f++) if (G.pcAt(s, f) === root) out.push({ s, f });
  return out;
};
G.bassRootMidi = root => { const p = G.bassRootPositions(root)[0]; return G.midiAt(p.s, p.f); };

// ================= гармония =================
G.DEG = {
  major: { I: [0, 'maj'], ii: [2, 'm'], iii: [4, 'm'], IV: [5, 'maj'], V: [7, 'maj'], vi: [9, 'm'], 'vii°': [11, 'dim'],
           '♭VII': [10, 'maj'], iv: [5, 'm'], '♭VI': [8, 'maj'], 'V/V': [2, '7'], 'V/vi': [4, '7'], 'V/ii': [9, '7'], 'V/IV': [0, '7'] },
  minor: { i: [0, 'm'], 'ii°': [2, 'dim'], III: [3, 'maj'], iv: [5, 'm'], v: [7, 'm'], VI: [8, 'maj'], VII: [10, 'maj'],
           V: [7, 'maj'], IV: [5, 'maj'], 'V/iv': [0, '7'], '♭II': [1, 'maj'] },
};
G.TRANS = {
  major: {
    I:    [['IV', 3, 'Субдоминанта уводит от тоники и запускает движение.'],
           ['V', 3, 'Доминанта создаёт напряжение, которое тянет обратно к I.'],
           ['vi', 3, 'Параллельный минор: те же ноты гаммы, но грустнее.'],
           ['ii', 2, 'Мягкая подготовка доминанты, начало хода ii–V–I.'],
           ['♭VII', 1, 'Миксолидийский рок-ход, как у AC/DC и The Beatles.'],
           ['iii', 1, 'Тихий шаг: у iii и I два общих звука.']],
    ii:   [['V', 3, 'ii–V: самая сильная подготовка доминанты.'],
           ['IV', 2, 'Плавный подъём к субдоминанте.'],
           ['vii°', 1, 'Неустойчивый аккорд, усиливает тягу к I.']],
    iii:  [['vi', 3, 'Движение по квинтовому кругу: iii–vi.'],
           ['IV', 2, 'Шаг вверх на ступень, звучит светло.'],
           ['ii', 1, 'Спуск к подготовке доминанты.']],
    IV:   [['V', 3, 'IV–V: классический разгон перед тоникой.'],
           ['I', 3, 'Плагальный каданс, мягкое «аминь».'],
           ['ii', 2, 'Близкая замена субдоминанты.'],
           ['iv', 1, 'Минорная субдоминанта: щемящий оттенок, приём Radiohead и The Beatles.'],
           ['vi', 1, 'Уход в минорную краску.']],
    V:    [['I', 3, 'Автентический каданс: полное разрешение.'],
           ['vi', 2, 'Прерванный каданс: ухо ждёт I, а звучит минор.'],
           ['IV', 2, 'V–IV: блюзово-роковый откат.']],
    vi:   [['IV', 3, 'vi–IV: сердце поп-петли.'],
           ['ii', 2, 'Квинтовый круг: vi–ii–V–I.'],
           ['V', 2, 'Подъём к доминанте.'],
           ['iii', 1, 'Спуск на ступень вниз по гамме.']],
    'vii°': [['I', 3, 'Вводный тон разрешается в тонику.'],
           ['iii', 1, 'Мягкое разрешение в медиант.']],
    '♭VII': [['IV', 3, '♭VII–IV–I: рок-каданс.'],
           ['I', 3, 'Возврат домой через миксолидийский ход.']],
    iv:   [['I', 3, 'Минорная субдоминанта разрешается в мажорную тонику.'],
           ['V', 2, 'Минорная краска перед доминантой.']],
    '♭VI': [['♭VII', 3, '♭VI–♭VII–I: эпичный каданс из хард-рока.'],
           ['V', 2, 'Хроматический спуск к доминанте.'],
           ['I', 1, 'Резкий, кинематографичный возврат.']],
    'V/V': [['V', 3, 'Вторичная доминанта разрешается в V.']],
    'V/vi': [['vi', 3, 'Вторичная доминанта разрешается в vi.']],
    'V/ii': [['ii', 3, 'Вторичная доминанта разрешается в ii.']],
    'V/IV': [['IV', 3, 'Тоника с малой септимой тянет к IV, типично для блюза.']],
  },
  minor: {
    i:    [['VI', 3, 'Мажорная шестая ступень: эпичное звучание.'],
           ['VII', 3, 'Натуральный минор, звучание хард-рока и метала.'],
           ['iv', 3, 'Минорная субдоминанта.'],
           ['V', 2, 'Гармоническая доминанта с вводным тоном, сильная тяга в i.'],
           ['III', 2, 'Параллельный мажор: та же гамма, светлее.'],
           ['♭II', 1, 'Фригийский полутон вверх: тяжёлый, угрожающий ход, любимый в ню-метале.'],
           ['ii°', 1, 'Подготовка минорного каданса ii°–V–i.']],
    'ii°': [['V', 3, 'Минорный ход ii°–V–i.'],
           ['i', 1, 'Прямое возвращение к тонике.']],
    III:  [['VI', 3, 'Квинтовый ход III–VI.'],
           ['VII', 2, 'Шаг вниз по натуральному минору.'],
           ['iv', 2, 'Подъём к субдоминанте.']],
    iv:   [['V', 3, 'iv–V: разгон перед тоникой.'],
           ['i', 3, 'Плагальное разрешение.'],
           ['VII', 2, 'iv–VII–i: эолийская петля.'],
           ['VI', 1, 'Спуск на ступень вниз.']],
    v:    [['i', 3, 'Мягкое эолийское разрешение без вводного тона.'],
           ['VI', 2, 'Шаг вверх на ступень.']],
    V:    [['i', 3, 'Сильное разрешение благодаря вводному тону.'],
           ['VI', 2, 'Прерванный каданс.']],
    VI:   [['VII', 3, 'VI–VII–i: эпичный каданс, как у Iron Maiden.'],
           ['III', 2, 'Квинтовый ход к параллельному мажору.'],
           ['iv', 2, 'Спуск к субдоминанте.'],
           ['V', 1, 'Хроматический спуск к гармонической доминанте.']],
    VII:  [['i', 3, 'VII–i: эолийский каданс.'],
           ['III', 2, 'Разрешение в параллельный мажор.'],
           ['VI', 2, 'Шаг назад, качающаяся петля VI–VII.']],
    IV:   [['i', 3, 'Дорийский IV возвращается в тонику, как в «Oye Como Va».'],
           ['VII', 2, 'Рок-ход IV–VII.']],
    'V/iv': [['iv', 3, 'Вторичная доминанта ведёт в субдоминанту.']],
    '♭II': [['i', 3, 'Полутон вниз в тонику: давящее фригийское разрешение.']],
  },
};
G.W_LABEL = { 3: 'частый', 2: 'хороший', 1: 'краска' };
G.FAM = { maj: 'M', maj7: 'M', '6': 'M', sus2: 'M', sus4: 'M', m: 'm', m7: 'm', m6: 'm', '7': '7', '9': '7', dim: 'o', m7b5: 'o', aug: '+', '5': '5' };
G.PRESETS = {
  major: [
    ['Поп-петля · I–V–vi–IV', [[0, 'maj'], [7, 'maj'], [9, 'm'], [5, 'maj']]],
    ['Пятидесятые · I–vi–IV–V', [[0, 'maj'], [9, 'm'], [5, 'maj'], [7, 'maj']]],
    ['Рок-н-ролл · I–IV–V–IV', [[0, 'maj'], [5, 'maj'], [7, 'maj'], [5, 'maj']]],
    ['Миксолидийский рок · I–♭VII–IV–I', [[0, 'maj'], [10, 'maj'], [5, 'maj'], [0, 'maj']]],
    ['Джаз · ii–V–I', [[2, 'm7'], [7, '7'], [0, 'maj7'], [0, 'maj7']]],
    ['Блюз, 12 тактов', [[0, '7'], [0, '7'], [0, '7'], [0, '7'], [5, '7'], [5, '7'], [0, '7'], [0, '7'], [7, '7'], [5, '7'], [0, '7'], [7, '7']]],
  ],
  minor: [
    ['Эпичный минор · i–VI–III–VII', [[0, 'm'], [8, 'maj'], [3, 'maj'], [10, 'maj']]],
    ['Андалузский каданс · i–VII–VI–V', [[0, 'm'], [10, 'maj'], [8, 'maj'], [7, 'maj']]],
    ['Хард-рок · i–VI–VII–i', [[0, 'm'], [8, 'maj'], [10, 'maj'], [0, 'm']]],
    ['Гранж на квинтах · i–III–iv–VI', [[0, '5'], [3, '5'], [5, '5'], [8, '5']]],
    ['Ню-метал · i–♭II–i–VII', [[0, '5'], [1, '5'], [0, '5'], [10, '5']]],
    ['Минорный рок · i–iv–v–i', [[0, 'm'], [5, 'm'], [7, 'm'], [0, 'm']]],
    ['Минорный блюз, 12 тактов', [[0, 'm7'], [0, 'm7'], [0, 'm7'], [0, 'm7'], [5, 'm7'], [5, 'm7'], [0, 'm7'], [0, 'm7'], [8, '7'], [7, '7'], [0, 'm7'], [7, '7']]],
  ],
};
G.keyRu = prep => (G.flats() ? G.RU_F : G.RU_S)[S.keyRoot] + (S.keyMode === 'major' ? (prep ? ' мажоре' : ' мажор') : (prep ? ' миноре' : ' минор'));
G.degreeOf = (c, kr = S.keyRoot, km = S.keyMode) => {
  const d = G.DEG[km], iv = (c.root - kr + 12) % 12, f = G.FAM[c.q];
  const cand = Object.entries(d).filter(([, v]) => v[0] === iv);
  let hit = cand.find(([, v]) => v[1] === c.q) || cand.find(([, v]) => G.FAM[v[1]] === f);
  if (!hit && f === '7') hit = cand.find(([, v]) => G.FAM[v[1]] === 'M');
  if (!hit && f === 'M') hit = cand.find(([, v]) => G.FAM[v[1]] === '7');
  if (!hit && f === '5') hit = cand.find(([, v]) => G.FAM[v[1]] !== 'o');
  return hit ? hit[0] : null;
};
G.powerize = q => (S.power && (q === 'maj' || q === 'm')) ? '5' : q;
G.suggestions = (c, kr = S.keyRoot, km = S.keyMode) => {
  const deg = G.degreeOf(c, kr, km), out = [], seen = new Set();
  const push = (root, q, rn, w, why) => {
    const k = root + q;
    if (seen.has(k) || (root === c.root && q === c.q)) return;
    seen.add(k); out.push({ root, q, rn, w, why });
  };
  if (deg) {
    (G.TRANS[km][deg] || []).forEach(([id, w, why]) => {
      const [iv, q] = G.DEG[km][id];
      push((kr + iv) % 12, G.powerize(q), id, w, why);
    });
  } else {
    const r = c.root, f = G.FAM[c.q], self = G.chordName(c);
    if (f === '7') {
      push((r + 5) % 12, 'maj', 'разрешение', 3, 'Доминантсептаккорд разрешается на кварту вверх.');
      push((r + 5) % 12, 'm', 'разрешение', 2, 'То же разрешение, но в минор.');
    }
    const tq = km === 'major' ? 'maj' : 'm';
    push(kr, G.powerize(tq), km === 'major' ? 'I' : 'i', 3, 'Вернуться в тональность: тоника снимает напряжение.');
    push((r + 5) % 12, G.powerize('maj'), 'IV от ' + self, 2, 'Субдоминанта, если считать текущий аккорд тоникой.');
    push((r + 7) % 12, G.powerize('maj'), 'V от ' + self, 2, 'Доминанта от текущего аккорда.');
    if (f === 'm' || f === '5') {
      push((r + 8) % 12, G.powerize('maj'), 'VI от ' + self, 2, 'Мажорная шестая ступень от минорного аккорда.');
      push((r + 10) % 12, G.powerize('maj'), 'VII от ' + self, 1, 'Натуральный минор от текущего аккорда.');
    }
  }
  return out.sort((a, b) => b.w - a.w);
};
// Подобрать аппликатуры для списка аккордов цепочкой (рука не прыгает)
G.chainVoicings = list => {
  let ref = 2;
  return list.map(({ root, q }) => {
    if (G.isBass()) return { root, q, v: 0 };
    const vs = G.voicings(root, q);
    if (!vs.length) return { root, q, v: 0 };
    const v = G.nearestV(root, q, ref);
    ref = G.centerOf(vs[v].fr) || ref;
    return { root, q, v };
  });
};
G.revoice = () => { S.prog = G.chainVoicings(S.prog); if (S.sel >= 0 && S.prog[S.sel]) S.cur = { ...S.prog[S.sel] }; else S.cur.v = 0; };

// ================= разное =================
G.today = (d = new Date()) => { const z = n => String(n).padStart(2, '0'); return `${d.getFullYear()}-${z(d.getMonth() + 1)}-${z(d.getDate())}`; };
G.fmtTime = sec => { sec = Math.max(0, Math.round(sec)); return `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`; };
G.clamp = (x, a, b) => Math.min(b, Math.max(a, x));

return G;
})();
