// SVGのグラフ。色は style.css の --series-1 / --grid などのCSS変数を使う。
// どの印も data-tip を持ち、タップするとグラフ下の読み取り欄に値が出る(app.js)。

const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const md = (iso) => { const [, m, d] = iso.split('-'); return `${Number(m)}/${Number(d)}`; };

function niceTicks(lo, hi, n = 3) {
  const span = hi - lo || 1;
  const raw = span / n;
  const mag = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 2.5, 5, 10].map((k) => k * mag).find((s) => s >= raw);
  const start = Math.floor(lo / step) * step;
  const ticks = [];
  for (let v = start; v <= hi + step * 0.001; v += step) ticks.push(Number(v.toFixed(6)));
  if (ticks.at(-1) < hi) ticks.push(Number((ticks.at(-1) + step).toFixed(6)));
  return ticks;
}

const fmt = (v) => (Math.abs(v) >= 1000 ? Math.round(v).toLocaleString() : Number.isInteger(v) ? String(v) : v.toFixed(1));

// レーダー。axes: [{key, name, value(0〜100)|null, label}]
// compare: 比べる相手 {values, labels}(フレンド)。2系列目は破線と四角い点で描き、色だけに頼らない
// refAt: 基準の輪(0〜100)と、そのラベル
export function radar(axes, { compare = null, interactive = true, refAt = null, refLabel = '' } = {}) {
  const W = 340; const H = 300; const cx = W / 2; const cy = 150; const R = 92;
  const n = axes.length;
  const ang = (i) => -Math.PI / 2 + (2 * Math.PI * i) / n;
  const pt = (i, r) => [cx + r * Math.cos(ang(i)), cy + r * Math.sin(ang(i))];
  const ring = (v) => axes.map((_, i) => pt(i, (R * v) / 100).map((c) => c.toFixed(1)).join(',')).join(' ');

  const rings = [20, 40, 60, 80, 100].map((v) => `<polygon points="${ring(v)}" class="grid" />`).join('')
    + (refAt !== null ? `<polygon points="${ring(refAt)}" class="grid-ref" />
      <text x="${cx + 3}" y="${(cy - (R * refAt) / 100 - 3).toFixed(1)}" class="t-axis">${esc(refLabel)}</text>` : '');
  const spokes = axes.map((_, i) => { const [x, y] = pt(i, R); return `<line x1="${cx}" y1="${cy}" x2="${x.toFixed(1)}" y2="${y.toFixed(1)}" class="grid" />`; }).join('');

  const polyOf = (vals) => vals.map((v, i) => pt(i, (R * (v ?? 0)) / 100).map((c) => c.toFixed(1)).join(',')).join(' ');
  const other = compare ? `<polygon points="${polyOf(compare.values)}" class="area area-2" />${compare.values.map((v, i) => {
    if (v === null) return '';
    const [x, y] = pt(i, (R * v) / 100);
    return `<rect x="${(x - 4).toFixed(1)}" y="${(y - 4).toFixed(1)}" width="8" height="8" class="dot-2" />`;
  }).join('')}` : '';
  const dots = axes.map((a, i) => {
    if (a.value === null) return '';
    const [x, y] = pt(i, (R * a.value) / 100);
    return `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="4" class="dot" />`;
  }).join('');

  const labels = axes.map((a, i) => {
    const [x, y] = pt(i, R + 28);
    const anchor = Math.abs(x - cx) < 4 ? 'middle' : x > cx ? 'start' : 'end';
    const dx = anchor === 'start' ? -10 : anchor === 'end' ? 10 : 0;
    const val = compare ? `${a.label} / ${compare.labels[i]}` : a.label;
    const act = interactive ? `data-action="detail" data-stat="${a.key}" role="button" tabindex="0"` : '';
    return `<g class="radar-label${interactive ? '' : ' static'}" ${act} aria-label="${esc(a.name)} ${esc(val)}">
      <rect x="${(x + dx - (anchor === 'end' ? 70 : anchor === 'middle' ? 35 : 0)).toFixed(1)}" y="${(y - 20).toFixed(1)}" width="70" height="40" class="hit" />
      <text x="${(x + dx).toFixed(1)}" y="${(y - 4).toFixed(1)}" text-anchor="${anchor}" class="t-sub">${esc(a.name)}</text>
      <text x="${(x + dx).toFixed(1)}" y="${(y + 14).toFixed(1)}" text-anchor="${anchor}" class="t-val">${esc(val)}</text>
    </g>`;
  }).join('');

  return `<svg viewBox="0 0 ${W} ${H}" class="chart radar" role="img" aria-label="能力のレーダーチャート">
    ${rings}${spokes}${other}
    <polygon points="${polyOf(axes.map((a) => a.value))}" class="area" />
    ${dots}${labels}
  </svg>`;
}

// 人体図(前・後ろ)。parts: {arm: {letter, label}, ...}。letter(0〜9)で塗り分け、ランクは一覧でも文字で示す
export function bodyMap(parts) {
  const fill = (k) => (parts[k]?.letter === null || parts[k]?.letter === undefined ? 'bm-none' : `bm-${parts[k].letter}`);
  const shape = (k, el) => el.replace('/>', ` class="bm-part ${fill(k)}" data-action="detail" data-stat="part:${k}"><title>${esc(parts[k]?.name ?? '')} ${esc(parts[k]?.label ?? '')}</title></${el.match(/^<(\w+)/)[1]}>`);
  const figure = (cx, side) => {
    const limbs = (k, x, y, w, h) => [
      shape(k, `<rect x="${cx - x - w}" y="${y}" width="${w}" height="${h}" rx="${w / 2}" />`),
      shape(k, `<rect x="${cx + x}" y="${y}" width="${w}" height="${h}" rx="${w / 2}" />`),
    ].join('');
    const torso = side === 'front'
      ? shape('chest', `<rect x="${cx - 30}" y="58" width="60" height="42" rx="12" />`)
        + shape('abs', `<rect x="${cx - 24}" y="104" width="48" height="56" rx="10" />`)
      : shape('back', `<rect x="${cx - 30}" y="58" width="60" height="102" rx="12" />`);
    const hips = side === 'back' ? shape('leg', `<rect x="${cx - 28}" y="164" width="56" height="30" rx="14" />`) : '';
    const legTop = side === 'back' ? 198 : 166;
    return `<circle cx="${cx}" cy="30" r="18" class="bm-head" />
      ${shape('shoulder', `<circle cx="${cx - 40}" cy="70" r="14" />`)}${shape('shoulder', `<circle cx="${cx + 40}" cy="70" r="14" />`)}
      ${torso}${hips}
      ${limbs('arm', 36, 86, 16, 52)}${limbs('arm', 40, 142, 14, 50)}
      ${limbs('leg', 2, legTop, 25, side === 'back' ? 58 : 70)}${limbs('leg', 4, side === 'back' ? 260 : 240, 20, side === 'back' ? 50 : 62)}
      <text x="${cx}" y="326" text-anchor="middle" class="t-sub">${side === 'front' ? '前' : '後ろ'}</text>`;
  };
  return `<svg viewBox="0 0 340 334" class="chart bodymap" role="img" aria-label="部位ごとのランクの人体図">
    ${figure(88, 'front')}${figure(252, 'back')}
  </svg>`;
}

// 折れ線(1系列)。pts: [{date, value}], ref: {value, label}
export function lineChart({ pts, unit, ref, id, dots = true }) {
  if (!pts.length) return '';
  const W = 340; const H = 170; const L = 40; const Rt = 14; const T = 14; const B = 26;
  const pw = W - L - Rt; const ph = H - T - B;
  const vals = pts.map((p) => p.value).concat(ref ? [ref.value] : []);
  let lo = Math.min(...vals); let hi = Math.max(...vals);
  const pad = (hi - lo) * 0.15 || Math.max(1, Math.abs(hi) * 0.05);
  lo -= pad; hi += pad;
  const ticks = niceTicks(lo, hi);
  lo = ticks[0]; hi = ticks.at(-1);
  const t0 = Date.parse(pts[0].date); const t1 = Date.parse(pts.at(-1).date);
  const X = (d) => (t1 === t0 ? L + pw / 2 : L + ((Date.parse(d) - t0) / (t1 - t0)) * pw);
  const Y = (v) => T + ph - ((v - lo) / (hi - lo)) * ph;

  const grid = ticks.map((v) => `<line x1="${L}" x2="${W - Rt}" y1="${Y(v).toFixed(1)}" y2="${Y(v).toFixed(1)}" class="grid" />
    <text x="${L - 6}" y="${(Y(v) + 4).toFixed(1)}" text-anchor="end" class="t-axis">${fmt(v)}</text>`).join('');
  const refLine = ref ? `<line x1="${L}" x2="${W - Rt}" y1="${Y(ref.value).toFixed(1)}" y2="${Y(ref.value).toFixed(1)}" class="ref" />
    <text x="${W - Rt}" y="${(Y(ref.value) - 5).toFixed(1)}" text-anchor="end" class="t-axis">${esc(ref.label)}</text>` : '';
  const path = pts.map((p, i) => `${i ? 'L' : 'M'}${X(p.date).toFixed(1)},${Y(p.value).toFixed(1)}`).join('');
  const marks = pts.map((p) => {
    const x = X(p.date).toFixed(1); const y = Y(p.value).toFixed(1);
    const tip = `${md(p.date)} · ${fmt(p.value)} ${unit}`;
    return `${dots ? `<circle cx="${x}" cy="${y}" r="4" class="dot" />` : ''}<circle cx="${x}" cy="${y}" r="${dots ? 16 : 6}" class="hit" data-tip="${esc(tip)}" />`;
  }).join('');
  const last = pts.at(-1);
  return `<figure class="fig">
    <svg viewBox="0 0 ${W} ${H}" class="chart" role="img" aria-label="推移のグラフ" data-chart="${esc(id)}">
      ${grid}${refLine}
      <path d="${path}" class="line" />${marks}
      <text x="${L}" y="${H - 6}" class="t-axis">${md(pts[0].date)}</text>
      ${pts.length > 1 ? `<text x="${W - Rt}" y="${H - 6}" text-anchor="end" class="t-axis">${md(last.date)}</text>` : ''}
    </svg>
    <figcaption class="readout" data-readout="${esc(id)}">最新 ${md(last.date)} · ${fmt(last.value)} ${esc(unit)}</figcaption>
  </figure>`;
}

function barPath(x, y, w, h, r) {
  r = Math.min(r, w / 2, h);
  return `M${x},${y + h}L${x},${y + r}Q${x},${y} ${x + r},${y}L${x + w - r},${y}Q${x + w},${y} ${x + w},${y + r}L${x + w},${y + h}Z`;
}

// 日ごとの棒(1系列)。days: [{date, value|null}]
export function barChart({ days, unit, ref, id }) {
  const W = 340; const H = 160; const L = 40; const Rt = 14; const T = 14; const B = 26;
  const pw = W - L - Rt; const ph = H - T - B;
  const vals = days.map((d) => d.value).filter((v) => v !== null);
  if (!vals.length) return '';
  const hi0 = Math.max(...vals, ref ? ref.value : 0) * 1.1 || 1;
  const ticks = niceTicks(0, hi0);
  const hi = ticks.at(-1);
  const Y = (v) => T + ph - (v / hi) * ph;
  const slot = pw / days.length; const bw = slot - 2;

  const grid = ticks.map((v) => `<line x1="${L}" x2="${W - Rt}" y1="${Y(v).toFixed(1)}" y2="${Y(v).toFixed(1)}" class="${v === 0 ? 'baseline' : 'grid'}" />
    <text x="${L - 6}" y="${(Y(v) + 4).toFixed(1)}" text-anchor="end" class="t-axis">${fmt(v)}</text>`).join('');
  const bars = days.map((d, i) => {
    const x = L + i * slot + 1;
    const tip = d.value === null ? `${md(d.date)} · 記録なし` : `${md(d.date)} · ${fmt(d.value)} ${unit}`;
    const bar = d.value ? `<path d="${barPath(x, Y(d.value), bw, Y(0) - Y(d.value), 4)}" class="bar" />` : '';
    return `${bar}<rect x="${(x - 1).toFixed(1)}" y="${T}" width="${slot.toFixed(1)}" height="${ph}" class="hit" data-tip="${esc(tip)}" />`;
  }).join('');
  const refLine = ref ? `<line x1="${L}" x2="${W - Rt}" y1="${Y(ref.value).toFixed(1)}" y2="${Y(ref.value).toFixed(1)}" class="ref" />
    <text x="${W - Rt}" y="${(Y(ref.value) - 5).toFixed(1)}" text-anchor="end" class="t-axis">${esc(ref.label)}</text>` : '';
  const last = [...days].reverse().find((d) => d.value !== null);
  return `<figure class="fig">
    <svg viewBox="0 0 ${W} ${H}" class="chart" role="img" aria-label="日ごとのグラフ" data-chart="${esc(id)}">
      ${grid}${bars}${refLine}
      <text x="${L}" y="${H - 6}" class="t-axis">${md(days[0].date)}</text>
      <text x="${W - Rt}" y="${H - 6}" text-anchor="end" class="t-axis">${md(days.at(-1).date)}</text>
    </svg>
    <figcaption class="readout" data-readout="${esc(id)}">${last ? `最新 ${md(last.date)} · ${fmt(last.value)} ${esc(unit)}` : ''}</figcaption>
  </figure>`;
}
