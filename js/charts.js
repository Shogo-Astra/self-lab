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
// 人体図(前・後ろ)。体の輪郭(灰色)の上に筋肉の形を重ね、9部位をランクの色で塗る。
// 座標は体の中心を x=0 とした右半身で書き、左右反転して全身にする
const BODY_BASE = [
  'M0,50 C14,52 30,52 42,58 C48,62 50,70 48,82 C44,90 38,96 36,100 C34,118 32,136 30,150 C34,160 37,170 37,180 L0,186 Z', // 胴
  'M42,60 C50,64 54,76 54,90 C56,104 56,118 55,130 C58,148 60,166 59,184 C60,192 58,202 54,204 C50,202 48,196 49,186 C46,166 44,150 42,136 C39,122 37,108 37,98 Z', // 腕・手
  'M2,180 C14,176 30,172 37,178 C38,200 34,222 31,240 C33,258 31,276 27,292 C30,296 31,302 27,305 L13,305 C11,300 12,296 14,292 C11,276 9,258 10,242 C7,222 4,202 2,186 Z', // 脚・足
];
const MUSCLES = {
  front: [
    ['shoulder', 'M24,56 C34,51 46,56 50,68 C52,78 50,88 46,93 C42,82 35,72 26,66 Z'], // 三角筋
    ['chest', 'M3,62 C13,58 25,60 33,66 C39,72 41,82 37,92 C27,99 13,99 3,95 Z'], // 大胸筋
    ['arm', 'M39,94 C45,91 52,98 53,110 C54,120 51,128 47,132 C43,127 40,117 39,107 Z'], // 上腕二頭筋
    ['arm', 'M46,135 C52,137 57,151 58,163 C58,172 57,179 55,183 L50,183 C48,169 45,152 45,140 Z'], // 前腕
    ['abs', 'M3,100 L17,100 C19,120 19,142 17,164 L3,168 Z'], // 腹直筋
    ['abs', 'M20,101 C27,105 31,113 31,128 C30,142 27,152 23,160 L20,161 C21,141 21,121 20,101 Z'], // 腹斜筋
    ['quad', 'M5,184 C13,177 28,175 34,182 C36,198 34,218 28,234 C22,239 14,239 10,235 C6,216 4,198 5,184 Z'], // 大腿四頭筋
  ],
  back: [
    ['back', 'M2,52 C14,54 26,56 34,60 C28,68 16,78 2,98 Z'], // 僧帽筋
    ['shoulder', 'M26,58 C36,53 46,57 50,68 C52,78 50,88 46,93 C42,82 36,74 30,70 Z'], // 三角筋(後ろ)
    ['back', 'M3,100 C14,84 26,72 35,72 C38,86 36,102 32,118 C28,132 22,146 3,156 Z'], // 広背筋・脊柱起立筋
    ['arm', 'M39,94 C45,91 52,98 53,110 C54,120 51,128 47,132 C43,127 40,117 39,107 Z'], // 上腕三頭筋
    ['arm', 'M46,135 C52,137 57,151 58,163 C58,172 57,179 55,183 L50,183 C48,169 45,152 45,140 Z'], // 前腕
    ['glute', 'M3,160 C14,155 30,157 35,169 C37,183 31,195 19,197 C11,197 5,193 3,189 Z'], // 大殿筋
    ['ham', 'M6,201 C14,198 26,198 32,202 C34,215 32,228 28,238 L12,238 C8,226 6,213 6,201 Z'], // ハムストリング
    ['calf', 'M11,245 C17,240 26,240 30,247 C32,259 30,272 26,283 L16,283 C12,273 10,259 11,245 Z'], // 下腿三頭筋
  ],
};
// 筋肉の境目の線(飾り。タップの邪魔をしない)
const MUSCLE_LINES = {
  front: ['M3,118 L18,118 M3,136 L18,136 M3,152 L18,152', 'M19,186 C22,204 22,220 19,234'],
  back: ['M3,128 C12,124 22,118 30,112', 'M19,203 L19,236'],
};

export function bodyMap(parts) {
  const fill = (k) => (parts[k]?.letter === null || parts[k]?.letter === undefined ? 'bm-none' : `bm-${parts[k].letter}`);
  const title = (k) => `<title>${esc(parts[k]?.name ?? '')} ${esc(parts[k]?.label ?? '')}</title>`;
  // 輪郭は「線だけの層」を先に描いてから塗りの層を重ね、左右の継ぎ目に線が出ないようにする
  const outline = BODY_BASE.map((d) => `<path d="${d}" class="bm-outline" />`).join('');
  const half = (side) => [
    ...BODY_BASE.map((d) => `<path d="${d}" class="bm-base" />`),
    ...MUSCLES[side].map(([k, d]) => `<path d="${d}" class="bm-part ${fill(k)}" data-action="detail" data-stat="part:${k}">${title(k)}</path>`),
    ...MUSCLE_LINES[side].map((d) => `<path d="${d}" class="bm-line" />`),
  ].join('');
  const head = (cls) => `<ellipse cx="0" cy="24" rx="14" ry="17" class="${cls}" /><rect x="-7" y="36" width="14" height="18" rx="4" class="${cls}" />`;
  const figure = (cx, side) => `<g transform="translate(${cx} 0)">
      ${head('bm-outline')}<g>${outline}</g><g transform="scale(-1 1)">${outline}</g>
      ${head('bm-base')}<g>${half(side)}</g><g transform="scale(-1 1)">${half(side)}</g>
      <text x="0" y="326" text-anchor="middle" class="t-sub">${side === 'front' ? '前' : '後ろ'}</text>
    </g>`;
  return `<svg viewBox="0 0 340 334" class="chart bodymap" role="img" aria-label="部位ごとのランクの人体図">
    ${figure(88, 'front')}${figure(252, 'back')}
  </svg>`;
}

// 折れ線(1系列)。pts: [{date, value}], ref: {value, label}
// best:強調する1点(最高記録)。オレンジの点に「最高」のラベルを付ける
export function lineChart({ pts, unit, ref, id, dots = true, best = null }) {
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
  const dotMarks = dots ? pts.map((p) => `<circle cx="${X(p.date).toFixed(1)}" cy="${Y(p.value).toFixed(1)}" r="4" class="dot" />`).join('') : '';
  let bestMark = '';
  if (best) {
    const bx = X(best.date); const by = Y(best.value);
    // 「最高」の文字は点の上 → 下 → 左の順に、枠の中に収まり、平均の文字(右端)と重ならない場所に置く
    const box = (x, y, a) => { const w = 26; const x0 = a === 'end' ? x - w : a === 'start' ? x : x - w / 2; return [x0, y - 11, x0 + w, y + 2]; };
    const textW = (t) => [...t].reduce((w, c) => w + (c.charCodeAt(0) > 0xff ? 11 : 6.5), 0); // 11px の文字のおよその幅
    const refBox = ref ? [W - Rt - textW(ref.label), Y(ref.value) - 16, W - Rt, Y(ref.value) - 3] : null;
    const hit = (a, b) => b && a[0] < b[2] && b[0] < a[2] && a[1] < b[3] && b[1] < a[3];
    const side = bx > W - Rt - 16 ? 'end' : bx < L + 16 ? 'start' : 'middle';
    const spots = [[bx, by - 10, side], [bx, by + 19, side], [bx - 10, by + 4, 'end'], [bx + 10, by + 4, 'start']];
    const [lx, ly, anchor] = spots.find(([x, y, a]) => { const b = box(x, y, a); return b[1] >= 0 && b[3] <= H - B && b[0] >= 0 && b[2] <= W && !hit(b, refBox); }) ?? spots[0];
    bestMark = `<circle cx="${bx.toFixed(1)}" cy="${by.toFixed(1)}" r="5.5" class="dot-best" />
      <text x="${lx.toFixed(1)}" y="${ly.toFixed(1)}" text-anchor="${anchor}" class="t-axis t-best">最高</text>`;
  }
  const hits = pts.map((p) => {
    const tip = `${md(p.date)} · ${fmt(p.value)} ${unit}`;
    return `<circle cx="${X(p.date).toFixed(1)}" cy="${Y(p.value).toFixed(1)}" r="${dots ? 16 : 6}" class="hit" data-tip="${esc(tip)}" />`;
  }).join('');
  const marks = dotMarks + bestMark + hits;
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
