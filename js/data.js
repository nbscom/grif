// Данные занятий: минуты, результаты, рабочие темпы, план, песни. localStorage + резервная копия в JSON.
// Импортированные файлы табов хранятся в IndexedDB.
(() => {
'use strict';
const KEY = 'grif-data';
const EMPTY = () => ({
  v: 1,
  days: {},          // 'YYYY-MM-DD' -> { sec, guitar, bass, blocks: {warmup:sec,...} }
  results: [],       // { ex, d, at, bpm, acc, inst, early, n }
  tempo: {},         // exId -> рабочий темп
  plan: { guitar: { day: 1, last: '' }, bass: { day: 1, last: '' } },
  goals: [],         // { id, title, artist, status, bpm, note }
  quiz: [],          // { d, ok, total, src }
});
let D;
try { D = Object.assign(EMPTY(), JSON.parse(localStorage.getItem(KEY) || '{}')); } catch (e) { D = EMPTY(); }
D.plan = Object.assign(EMPTY().plan, D.plan);
G.data = D;
let saveT = null;
G.saveData = () => {
  clearTimeout(saveT);
  saveT = setTimeout(() => { try { localStorage.setItem(KEY, JSON.stringify(D)); } catch (e) { console.warn('Не удалось сохранить данные', e); } }, 200);
};
try { navigator.storage && navigator.storage.persist && navigator.storage.persist(); } catch (e) {}

// Учёт времени практики (секунды) за сегодня
G.addPractice = (sec, block) => {
  if (!(sec > 0)) return;
  const day = D.days[G.today()] = D.days[G.today()] || { sec: 0, guitar: 0, bass: 0, blocks: {} };
  day.sec += sec; day[G.S.inst] = (day[G.S.inst] || 0) + sec;
  if (block) day.blocks[block] = (day.blocks[block] || 0) + sec;
  G.saveData();
};
G.addResult = r => {
  D.results.push(Object.assign({ d: G.today(), at: Date.now(), inst: G.S.inst }, r));
  if (D.results.length > 5000) D.results.splice(0, D.results.length - 5000);
  G.saveData(); G.emit('data');
};
G.on('quizAnswer', a => {
  let q = D.quiz.find(x => x.d === G.today() && x.src === G.S.quizSrc);
  if (!q) D.quiz.push(q = { d: G.today(), ok: 0, total: 0, src: G.S.quizSrc });
  q.total++; if (a.ok) q.ok++;
  G.saveData();
});
G.streak = () => {
  const has = d => D.days[d] && D.days[d].sec >= 300;
  let n = 0, d = new Date();
  if (!has(G.today(d))) d.setDate(d.getDate() - 1);
  while (has(G.today(d))) { n++; d.setDate(d.getDate() - 1); }
  return n;
};

// Экспорт / импорт резервной копии
G.exportJSON = () => JSON.stringify({ app: 'grif', exported: new Date().toISOString(), settings: G.S, data: D }, null, 1);
G.importJSON = text => {
  const o = JSON.parse(text);
  if (!o || o.app !== 'grif' || !o.data) throw new Error('Это не резервная копия «Грифа».');
  const nd = Object.assign(EMPTY(), o.data);
  Object.keys(D).forEach(k => delete D[k]); Object.assign(D, nd);
  if (o.settings) { Object.assign(G.S, o.settings); G.save(); }
  try { localStorage.setItem(KEY, JSON.stringify(D)); } catch (e) {}
};

// ---------- IndexedDB для файлов ----------
let dbp = null;
function idb() {
  if (dbp) return dbp;
  dbp = new Promise((res, rej) => {
    if (!window.indexedDB) return rej(new Error('IndexedDB недоступна'));
    const r = indexedDB.open('grif', 1);
    r.onupgradeneeded = () => r.result.createObjectStore('files', { keyPath: 'id' });
    r.onsuccess = () => res(r.result);
    r.onerror = () => rej(r.error);
  });
  return dbp;
}
const tx = async (mode, fn) => {
  const db = await idb();
  return new Promise((res, rej) => {
    const t = db.transaction('files', mode), st = t.objectStore('files');
    const req = fn(st);
    t.oncomplete = () => res(req && req.result);
    t.onerror = () => rej(t.error);
  });
};
G.files = {
  put: f => tx('readwrite', st => st.put(f)),
  all: () => tx('readonly', st => st.getAll()).catch(() => []),
  get: id => tx('readonly', st => st.get(id)),
  del: id => tx('readwrite', st => st.delete(id)),
};
})();
