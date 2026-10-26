// Вход с гитары: выбор устройства, захват без обработки, AudioWorklet, события нот
(() => {
'use strict';
const S = G.S;
const I = G.input = {
  active: false, starting: false, error: '', devices: [], label: '',
  level: 0, peak: 0, lastSignal: 0, inputLatency: 0,
};
let stream = null, srcNode = null, node = null;
const MOOER = /mooer|\bge[\s-]?\d{2,3}\b|\bge\b/i;
I.inClaude = (() => { try { return window.top !== window.self || /claude/.test(location.hostname); } catch (e) { return true; } })();
I.SITE = 'https://nbscom.github.io/grif/';
I.supported = () => !!(window.isSecureContext && navigator.mediaDevices && navigator.mediaDevices.getUserMedia && window.AudioWorkletNode);

function constraints(deviceId) {
  const a = { echoCancellation: false, noiseSuppression: false, autoGainControl: false, channelCount: { ideal: 2 }, latency: { ideal: 0 } };
  if (deviceId) a.deviceId = { exact: deviceId };
  return { audio: a, video: false };
}
async function loadWorklet(ctx) {
  if (ctx._pitchLoaded) return;
  try { await ctx.audioWorklet.addModule('js/pitch-worklet.js'); }
  catch (e) {
    // запасной путь: загрузить код и подключить через blob:
    const code = await (await fetch('js/pitch-worklet.js')).text();
    await ctx.audioWorklet.addModule(URL.createObjectURL(new Blob([code], { type: 'text/javascript' })));
  }
  ctx._pitchLoaded = true;
}
I.listDevices = async () => {
  try { I.devices = (await navigator.mediaDevices.enumerateDevices()).filter(d => d.kind === 'audioinput'); }
  catch (e) { I.devices = []; }
  return I.devices;
};
I.minFreq = () => G.isBass() ? 34 : 60;

I.start = async (deviceId) => {
  if (I.starting) return;
  I.error = '';
  if (!I.supported()) {
    I.error = I.inClaude
      ? 'Внутри claude.ai браузер не даёт страницам доступ к микрофону.'
      : 'Браузер не даёт доступ к аудиовходу: нужна страница по HTTPS (или localhost) и современный Chrome, Safari или Firefox.';
    G.emit('inputState'); return;
  }
  I.starting = true; G.emit('inputState');
  try {
    I.stop(true);
    const ctx = G.audio.ctx();
    let want = deviceId !== undefined ? deviceId : S.input.deviceId;
    try { stream = await navigator.mediaDevices.getUserMedia(constraints(want)); }
    catch (e) {
      if (want && (e.name === 'OverconstrainedError' || e.name === 'NotFoundError')) { want = ''; stream = await navigator.mediaDevices.getUserMedia(constraints('')); }
      else throw e;
    }
    await I.listDevices();
    // Mooer по умолчанию, если пользователь ещё ничего не выбирал
    if (!S.input.deviceId && deviceId === undefined) {
      const m = I.devices.find(d => MOOER.test(d.label));
      const curId = stream.getAudioTracks()[0].getSettings().deviceId;
      if (m && m.deviceId !== curId) {
        stream.getTracks().forEach(t => t.stop());
        stream = await navigator.mediaDevices.getUserMedia(constraints(m.deviceId));
      }
    }
    const track = stream.getAudioTracks()[0], set = track.getSettings();
    I.label = track.label || 'Аудиовход';
    S.input.deviceId = set.deviceId || ''; S.input.deviceLabel = I.label; G.save();
    I.inputLatency = typeof set.latency === 'number' ? set.latency : 0;
    I.settings = set;
    await loadWorklet(ctx);
    srcNode = ctx.createMediaStreamSource(stream);
    node = new AudioWorkletNode(ctx, 'pitch-processor', { numberOfInputs: 1, numberOfOutputs: 0, channelCount: 2, channelCountMode: 'explicit' });
    node.port.postMessage({ threshold: S.input.threshold, minFreq: I.minFreq() });
    node.port.onmessage = onMsg;
    srcNode.connect(node);
    I.active = true; I.lastSignal = 0;
    track.addEventListener('ended', () => { I.stop(); I.error = 'Устройство ввода отключено.'; G.emit('inputState'); });
  } catch (e) {
    I.active = false;
    I.error = e.name === 'NotAllowedError'
      ? (I.inClaude ? 'Внутри claude.ai браузер не даёт страницам доступ к микрофону.' : 'Доступ к аудиовходу запрещён. Разрешите микрофон для этого сайта в настройках браузера (значок слева от адреса).')
      : e.name === 'NotFoundError' ? 'Не найдено ни одного аудиовхода. Подключите Mooer по USB и нажмите «Включить» ещё раз.'
      : 'Не удалось включить вход: ' + (e.message || e.name);
  }
  I.starting = false;
  G.emit('inputState');
};
I.stop = (silent) => {
  if (node) { try { node.port.onmessage = null; node.disconnect(); } catch (e) {} node = null; }
  if (srcNode) { try { srcNode.disconnect(); } catch (e) {} srcNode = null; }
  if (stream) { stream.getTracks().forEach(t => t.stop()); stream = null; }
  I.active = false; I.level = 0;
  if (!silent) G.emit('inputState');
};
I.setThreshold = v => { S.input.threshold = v; G.save(); if (node) node.port.postMessage({ threshold: v }); };
G.on('instrument', () => { if (node) node.port.postMessage({ minFreq: I.minFreq() }); });

// Полная задержка между «щелчком метронома» и тем, как атака видна во входе (сек):
// выходная задержка + входная + ручная поправка из калибровки
I.totalLatency = () => {
  const c = G.audio.ctx();
  return (c.outputLatency || c.baseLatency || 0) + (I.inputLatency || 0) + (S.input.latencyMs || 0) / 1000;
};

// ---------- обработка сообщений ворклета ----------
const hist = [];
let pendingOnset = null;
let lastNoteEmit = null;
function onMsg(e) {
  const m = e.data;
  if (m.type === 'level') {
    I.level = m.rms; I.peak = m.peak;
    if (m.rms > S.input.threshold * 0.5) I.lastSignal = performance.now();
    G.emit('level', m);
  } else if (m.type === 'onset') {
    // быстрые ноты: предыдущая атака ещё ждёт подтверждения — отдаём то, что успели измерить
    if (pendingOnset) {
      const r = pendingOnset.reads || [];
      G.emit('note', { midi: r.length ? r[r.length - 1] : null, onset: true, t: pendingOnset.t, rms: pendingOnset.rms });
    }
    pendingOnset = { t: m.t, rms: m.rms };
    G.emit('onset', m);
  } else if (m.type === 'pitch') {
    const ok = m.f > 0 && m.clarity > 0.8 && m.rms > S.input.threshold * 0.6;
    if (!ok) { hist.length = 0; G.emit('pitch', { f: 0, rms: m.rms, t: m.t }); }
    else {
      const midi = G.midiOfFreq(m.f);
      hist.push(midi); if (hist.length > 5) hist.shift();
      const sorted = hist.slice().sort((a, b) => a - b), med = sorted[sorted.length >> 1];
      // подавление октавных скачков: берём медиану, если текущее значение далеко
      const use = Math.abs(midi - med) > 0.6 && hist.length >= 3 ? med : midi;
      const p = { f: G.freqOf(use), midi: use, clarity: m.clarity, rms: m.rms, t: m.t };
      G.emit('pitch', p);
      // окно анализа ~93 мс: ждём, пока оно целиком окажется после атаки, и сверяем два показания
      if (pendingOnset && m.t >= pendingOnset.t + 0.1) {
        pendingOnset.reads = pendingOnset.reads || [];
        pendingOnset.reads.push(midi);
        const r = pendingOnset.reads;
        if (r.length >= 2 && Math.abs(r[r.length - 1] - r[r.length - 2]) < 0.5 || (r.length >= 1 && m.t > pendingOnset.t + 0.3)) {
          lastNoteEmit = { midi: r[r.length - 1], onset: true, t: pendingOnset.t, rms: pendingOnset.rms, clarity: m.clarity };
          G.emit('note', lastNoteEmit);
          pendingOnset = null;
        }
      }
    }
    if (pendingOnset && m.t > pendingOnset.t + 0.35) {
      // атака без чистой высоты (глушение, аккорд, шум): сообщаем как удар без ноты
      G.emit('note', { midi: null, onset: true, t: pendingOnset.t, rms: pendingOnset.rms });
      pendingOnset = null;
    }
  }
}

// ---------- индикатор во всём приложении ----------
function chip() {
  const el = G.$('inChip'), tx = G.$('inChipText');
  if (!el) return;
  const silent = I.active && performance.now() - I.lastSignal > 4000;
  el.classList.toggle('on', I.active && !silent);
  el.classList.toggle('warn', I.active && silent);
  tx.textContent = !I.active ? 'Вход с гитары выключен' : silent ? 'Вход включён, сигнала нет' : 'Вход: ' + shortLabel(I.label);
}
const shortLabel = l => l.replace(/\s*\([0-9a-f]{4}:[0-9a-f]{4}\)\s*$/i, '').slice(0, 28);
I.shortLabel = shortLabel;
G.on('inputState', chip);
setInterval(chip, 1000);
})();
