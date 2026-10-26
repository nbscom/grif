// Универсальный гриф: строится от строя и инструмента
(() => {
'use strict';
// opts: { frets, dot(s,f) -> {cls,label,r}|null, hitFrom, hitTo, compact }
G.drawFretboard = (svg, opts) => {
  const T = G.T(), NS = T.length, F = opts.frets || G.nFrets();
  const W = 1320, nutX = 64, endX = W - 14, gap = NS === 4 ? 38 : 33, top = 28;
  const g = n => 0.62 * (1 - Math.pow(2, -n / 12)) / (1 - Math.pow(2, -F / 12)) + 0.38 * n / F;
  const X = n => nutX + (endX - nutX) * g(n);
  const Y = s => top + (NS - 1 - s) * gap;
  const CX = f => f === 0 ? nutX - 26 : (X(f - 1) + X(f)) / 2;
  const span = gap * (NS - 1), bot = top + span, mid = top + span / 2;
  let h = `<rect x="${nutX}" y="${top - 14}" width="${endX - nutX}" height="${span + 28}" rx="4" class="fb-wood"/>`;
  [3, 5, 7, 9, 15, 17, 19, 21].filter(f => f <= F).forEach(f => h += `<circle cx="${CX(f).toFixed(1)}" cy="${mid}" r="6.5" class="fb-inlay"/>`);
  if (F >= 12) [-1, 1].forEach(k => h += `<circle cx="${CX(12).toFixed(1)}" cy="${mid + k * gap * (NS === 4 ? 1 : 1)}" r="6.5" class="fb-inlay"/>`);
  for (let n = 1; n <= F; n++) h += `<line x1="${X(n).toFixed(1)}" x2="${X(n).toFixed(1)}" y1="${top - 14}" y2="${bot + 14}" class="fb-fret"/>`;
  h += `<rect x="${nutX - 5}" y="${top - 14}" width="7" height="${span + 28}" class="fb-nut"/>`;
  const swG = [2.8, 2.3, 1.9, 1.5, 1.1, 0.9], swB = [4, 3.4, 2.8, 2.2];
  for (let s = 0; s < NS; s++) {
    const w = NS === 4 ? swB[s] : swG[s];
    h += `<line x1="${nutX - 48}" x2="${endX}" y1="${Y(s)}" y2="${Y(s)}" class="fb-string${NS === 4 || s <= 3 ? ' w' : ''}" stroke-width="${w}"/>`;
    h += `<text x="4" y="${Y(s) + 4}" class="fb-sname">${G.stringNo(s)}</text>`;
  }
  [0, 1, 3, 5, 7, 9, 12, 15, 17, 19, 21].filter(f => f <= F).forEach(f => h += `<text x="${CX(f).toFixed(1)}" y="${bot + 34}" text-anchor="middle" class="fb-num">${f}</text>`);
  for (let s = 0; s < NS; s++) for (let f = 0; f <= F; f++) {
    const d = opts.dot(s, f);
    if (!d) continue;
    const x = CX(f).toFixed(1), y = Y(s), r = d.r || 11;
    h += `<circle cx="${x}" cy="${y}" r="${r}" class="dot ${d.cls}"/>`;
    if (d.label !== undefined && d.label !== '') h += `<text x="${x}" y="${y + 3.8}" text-anchor="middle" class="dtx${/\bacc\b/.test(d.cls) ? ' l' : ''}">${d.label}</text>`;
  }
  for (let s = 0; s < NS; s++) for (let f = 0; f <= F; f++) {
    const x0 = f === 0 ? nutX - 52 : X(f - 1), x1 = f === 0 ? nutX - 2 : X(f);
    h += `<rect x="${x0.toFixed(1)}" y="${Y(s) - gap / 2}" width="${(x1 - x0).toFixed(1)}" height="${gap}" class="hit" data-s="${s}" data-f="${f}"/>`;
  }
  svg.setAttribute('viewBox', `0 0 ${W} ${bot + 46}`);
  svg.setAttribute('aria-label', `Гриф: ${G.INST_RU[G.S.inst]}, ${F} ладов, строй ${G.tuningLetters()}`);
  svg.innerHTML = h;
};

// Диаграмма аккорда (гитара, 6 струн)
G.chordSVG = (fr, root, q, o = {}) => {
  const mini = !!o.mini, W = mini ? 64 : 210, NS = fr.length;
  const padL = mini ? 14 : 36, padR = mini ? 5 : 18, padT = mini ? 13 : 30;
  const gw = W - padL - padR, sx = gw / (NS - 1);
  const pos = fr.filter(f => f > 0);
  const maxF = pos.length ? Math.max(...pos) : 0, minF = pos.length ? Math.min(...pos) : 0;
  const start = maxF <= 5 ? 1 : minF;
  const rows = Math.max(mini ? 4 : 5, maxF - start + 1);
  const sy = sx * (mini ? 1.05 : 1.15), gh = sy * rows, H = padT + gh + (mini ? 4 : 30);
  const lbl = G.chordLbls({ root, q });
  let s = `<svg viewBox="0 0 ${W} ${H.toFixed(1)}" class="cd${mini ? ' mini' : ''}" role="img" aria-label="Аппликатура ${fr.map(f => f < 0 ? 'x' : f).join(' ')}">`;
  if (start === 1) s += `<rect x="${padL - 1}" y="${padT - (mini ? 3 : 5)}" width="${gw + 2}" height="${mini ? 3 : 5}" class="cd-nut"/>`;
  else s += `<text x="${padL - (mini ? 3 : 9)}" y="${(padT + sy * 0.5 + 4).toFixed(1)}" class="cd-fr" text-anchor="end">${start}</text>`;
  for (let i = 0; i <= rows; i++) s += `<line x1="${padL}" x2="${padL + gw}" y1="${(padT + i * sy).toFixed(1)}" y2="${(padT + i * sy).toFixed(1)}" class="cd-line"/>`;
  for (let i = 0; i < NS; i++) s += `<line x1="${(padL + i * sx).toFixed(1)}" x2="${(padL + i * sx).toFixed(1)}" y1="${padT}" y2="${(padT + gh).toFixed(1)}" class="cd-str"/>`;
  const r = mini ? 3.6 : 10;
  if (minF > 0 && !fr.includes(0)) {
    const at = fr.map((f, i) => f === minF ? i : -1).filter(i => i >= 0);
    if (at.length >= 2) {
      const a = at[0], b = at[at.length - 1];
      let ok = true; for (let i = a; i <= b; i++) if (fr[i] < minF) ok = false;
      if (ok) {
        const y = padT + (minF - start + 0.5) * sy;
        s += `<rect x="${(padL + a * sx - r).toFixed(1)}" y="${(y - r).toFixed(1)}" width="${((b - a) * sx + 2 * r).toFixed(1)}" height="${2 * r}" rx="${r}" class="cd-barre"/>`;
      }
    }
  }
  fr.forEach((f, i) => {
    const x = padL + i * sx;
    if (f < 0) s += `<text x="${x.toFixed(1)}" y="${padT - (mini ? 4 : 10)}" text-anchor="middle" class="cd-x">×</text>`;
    else if (f === 0) s += `<circle cx="${x.toFixed(1)}" cy="${padT - (mini ? 7 : 15)}" r="${mini ? 2.6 : 6}" class="cd-open${G.pcAt(i, 0) === root ? ' root' : ''}"/>`;
    else {
      const y = padT + (f - start + 0.5) * sy, pc = G.pcAt(i, f);
      s += `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${r}" class="cd-dot${pc === root ? ' root' : ''}"/>`;
      if (!mini) s += `<text x="${x.toFixed(1)}" y="${(y + 4).toFixed(1)}" text-anchor="middle" class="cd-in">${lbl[pc] || ''}</text>`;
    }
  });
  if (!mini) fr.forEach((f, i) => {
    if (f >= 0) s += `<text x="${(padL + i * sx).toFixed(1)}" y="${(padT + gh + 20).toFixed(1)}" text-anchor="middle" class="cd-note">${G.nn(G.pcAt(i, f))}</text>`;
  });
  return s + '</svg>';
};
})();
