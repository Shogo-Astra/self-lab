// ヘルスケア連携。Webアプリはヘルスケアを直接読めないので、iPhoneの「ショートカット」がコピーした文字を読み取る。
// データはiPhoneの中でコピー&貼り付けされるだけで、サーバーには送らない。
// 形式:1行目に SELFLAB、以降は「key=値」。値に単位や桁区切りが付いていてもよい(ショートカットの出し方がiOSで変わりうるため)。

export const HEALTH_KEYS = {
  steps: { label: '歩数', unit: '歩', to: 'daily', field: 'steps', min: 1, max: 100000, digits: 0 },
  sleep: { label: '睡眠時間', unit: '時間', to: 'daily', field: 'sleepH', min: 0.5, max: 24, digits: 1 },
  exercise: { label: 'エクササイズ時間', unit: '分', to: 'daily', field: 'exMin', min: 0, max: 1440, digits: 0 },
  rhr: { label: '安静時心拍数', unit: '拍/分', to: 'measure', field: 'rhr', min: 25, max: 200, digits: 0 },
  vo2max: { label: 'VO2max', unit: 'ml/kg/分', to: 'measure', field: 'vo2max', min: 10, max: 100, digits: 1 },
  weight: { label: '体重', unit: 'kg', to: 'measure', field: 'weight', min: 20, max: 300, digits: 1 },
  bodyfat: { label: '体脂肪率', unit: '%', to: 'measure', field: 'bodyfat', min: 2, max: 70, digits: 1 },
  sbp: { label: '家庭血圧(上)', unit: 'mmHg', to: 'measure', field: 'sbp', min: 60, max: 260, digits: 0 },
  dbp: { label: '家庭血圧(下)', unit: 'mmHg', to: 'measure', field: 'dbp', min: 30, max: 160, digits: 0 },
};

// ショートカットの「テキスト」に貼る雛形
export const HEALTH_TEMPLATE = ['SELFLAB', 'day=', ...Object.keys(HEALTH_KEYS).map((k) => `${k}=`)].join('\n');

const toHalf = (s) => s.replace(/[０-９Ａ-Ｚａ-ｚ．，：＝]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xfee0));
const firstNumber = (s) => { const m = s.replace(/,/g, '').match(/-?\d+(?:\.\d+)?/); return m ? Number(m[0]) : null; };

// 単位をそろえる。睡眠は時間、エクササイズは分、体重はkg、体脂肪率は%
function normalize(key, raw) {
  const s = raw.replace(/,/g, '');
  if (key === 'sleep' || key === 'exercise') {
    const hm = s.match(/(\d+(?:\.\d+)?)\s*(?:時間|h|hr)\s*(\d+(?:\.\d+)?)\s*(?:分|m|min)/i);
    // ショートカットの時計形式の継続時間:1時間以上は h:mm:ss、1時間未満は m:ss(例 1:06:52、28:09)
    const clock = s.match(/^\s*(\d+):(\d{1,2})(?::(\d{1,2}))?\s*$/);
    let minutes;
    if (hm) minutes = Number(hm[1]) * 60 + Number(hm[2]);
    else if (clock) minutes = clock[3] !== undefined ? Number(clock[1]) * 60 + Number(clock[2]) + Number(clock[3]) / 60 : Number(clock[1]) + Number(clock[2]) / 60;
    else {
      const v = firstNumber(s);
      if (v === null) return null;
      if (/秒|sec/i.test(s)) minutes = v / 60;
      else if (/分|min/i.test(s)) minutes = v;
      else if (/時間|hr|\dh\b/i.test(s)) minutes = v * 60;
      // 単位がないときは大きさで判断する(睡眠:24以下は時間、それより大きければ分、1440超は秒)
      else if (key === 'sleep') minutes = v > 1440 ? v / 60 : v > 24 ? v : v * 60;
      else minutes = v > 1440 ? v / 60 : v;
    }
    return key === 'sleep' ? minutes / 60 : minutes;
  }
  const v = firstNumber(s);
  if (v === null) return null;
  if (key === 'bodyfat' && v < 1) return v * 100; // 0.182 のような割合で来たとき
  if (key === 'weight' && v > 1000) return v / 1000; // ショートカットはグラムで返す(53099.99… → 53.1kg。2026-11-01 実機で確認)
  return v;
}

// 歩数のサンプル(ショートカット v6〜)。iPhone と Apple Watch の両方が歩数を記録し、ショートカットの「日ごとに集計」は
// それを単純に足すため二重に数えてしまう(2026-11-01 実機:ヘルスケアアプリ 9,891歩に対し 22,660歩)。
// ヘルスケアアプリと同じく、Apple Watch → iPhone → そのほかの順に優先し、上位のデータがある時間帯は下位のデータを数えない。
export const SAMPLE_MARK = '#steps-samples';

// 「2026/11/01 0:12」「2026/11/01 午後8:12」「11/1/2026, 8:12:05 PM」→ その日の0時からの秒
function timeOfDay(s) {
  const m = s.match(/(午前|午後|AM|PM)?\s*(\d{1,2}):(\d{2})(?::(\d{2}))?\s*(午前|午後|AM|PM)?\s*$/i);
  if (!m) return null;
  let h = Number(m[2]); const ap = (m[1] ?? m[5] ?? '').toUpperCase();
  if ((ap === '午後' || ap === 'PM') && h < 12) h += 12;
  if ((ap === '午前' || ap === 'AM') && h === 12) h = 0;
  return h * 3600 + Number(m[3]) * 60 + Number(m[4] ?? 0);
}

// 継続時間 → 秒(「1:06:52」「28:09」「1時間6分52秒」、単位なしの数は秒)
function seconds(s) {
  const c = s.match(/^\s*(\d+):(\d{1,2})(?::(\d{1,2}))?\s*$/);
  if (c) return c[3] !== undefined ? Number(c[1]) * 3600 + Number(c[2]) * 60 + Number(c[3]) : Number(c[1]) * 60 + Number(c[2]);
  const j = s.match(/(?:(\d+)\s*時間)?\s*(?:(\d+)\s*分)?\s*(?:(\d+(?:\.\d+)?)\s*秒)?/);
  if (j && (j[1] || j[2] || j[3])) return Number(j[1] ?? 0) * 3600 + Number(j[2] ?? 0) * 60 + Number(j[3] ?? 0);
  return firstNumber(s);
}

// #src / #val / #start / #dur / #end で区切られた4つの一覧(同じ順番)を、サンプルの配列にする
function sampleBlock(lines) {
  const names = ['#src', '#val', '#start', '#dur', '#end'];
  const idx = names.map((n) => lines.findIndex((l) => l.trim() === n));
  if (idx.some((i, k) => i < 0 || (k && i <= idx[k - 1]))) return null;
  const [src, val, start, dur] = [0, 1, 2, 3].map((k) => lines.slice(idx[k] + 1, idx[k + 1]).map((l) => l.trim()).filter((l) => l !== ''));
  if ([val, start, dur].some((a) => a.length !== src.length)) return null;
  return src.map((name, i) => ({ src: name, value: firstNumber(val[i]) ?? 0, start: timeOfDay(start[i]), dur: seconds(dur[i]) ?? 0 }));
}

const rank = (src) => (/watch/i.test(src) ? 0 : /iphone/i.test(src) ? 1 : 2);
function unite(iv) {
  const out = [];
  for (const [s, e] of iv.sort((a, b) => a[0] - b[0])) {
    const last = out[out.length - 1];
    if (last && s <= last[1]) last[1] = Math.max(last[1], e); else out.push([s, e]);
  }
  return out;
}

// 優先順位の高いソースから数え、すでに数えた時間帯と重なる部分は、重なった時間の割合だけ差し引く
export function mergeSteps(samples) {
  const bySrc = new Map();
  for (const x of samples) if (x.start !== null) { if (!bySrc.has(x.src)) bySrc.set(x.src, []); bySrc.get(x.src).push(x); }
  const order = [...bySrc.keys()].sort((a, b) => rank(a) - rank(b) || a.localeCompare(b));
  let covered = []; let total = 0; const sources = [];
  const overlap = (a, b) => covered.reduce((n, [s, e]) => n + Math.max(0, Math.min(b, e) - Math.max(a, s)), 0);
  for (const src of order) {
    const list = bySrc.get(src); let sum = 0; let used = 0;
    for (const x of list) {
      sum += x.value;
      if (x.dur > 0) used += x.value * Math.max(0, 1 - overlap(x.start, x.start + x.dur) / x.dur);
      else if (!covered.some(([a, b]) => x.start >= a && x.start < b)) used += x.value;
    }
    total += used;
    sources.push({ src, sum: Math.round(sum), used: Math.round(used), n: list.length });
    covered = unite([...covered, ...list.filter((x) => x.dur > 0).map((x) => [x.start, x.start + x.dur])]);
  }
  return { total: Math.round(total), sources, n: samples.length };
}

export function parseHealth(text) {
  const t = toHalf(String(text ?? ''));
  if (!/SELFLAB/i.test(t)) return null;
  // all:範囲外も含めて読めた数値(同じ数字ばかりでないかの確認用)、steps:歩数をサンプルから計算したときの内訳
  const out = { day: null, values: {}, skipped: [], all: {}, steps: null };
  const put = (key, raw, v) => {
    const def = HEALTH_KEYS[key];
    out.all[key] = v;
    if (v < def.min || v > def.max) {
      // 歩数0・睡眠0は「データなし」なので黙って飛ばす
      if (!((key === 'steps' || key === 'sleep') && v === 0)) out.skipped.push(`${def.label}(${raw})`);
      return;
    }
    out.values[key] = Number(v.toFixed(def.digits));
  };
  const lines = t.split(/\r?\n/);
  const cut = lines.findIndex((l) => l.trim().startsWith(SAMPLE_MARK));
  for (const line of cut < 0 ? lines : lines.slice(0, cut)) {
    const m = line.match(/^\s*([a-z0-9]+)\s*[=:]\s*(.*)$/i);
    if (!m) continue;
    const key = m[1].toLowerCase(); const raw = m[2].trim();
    if (key === 'day') {
      const d = raw.match(/(\d{4})\s*[-/年.]\s*(\d{1,2})\s*[-/月.]\s*(\d{1,2})/);
      if (d) out.day = `${d[1]}-${d[2].padStart(2, '0')}-${d[3].padStart(2, '0')}`;
      continue;
    }
    if (!HEALTH_KEYS[key] || raw === '') continue;
    const v = normalize(key, raw);
    if (v === null || Number.isNaN(v)) continue;
    put(key, raw, v);
  }
  if (cut >= 0) {
    const samples = sampleBlock(lines.slice(cut + 1));
    if (!samples) out.skipped.push('歩数(サンプルを読み取れませんでした)');
    else { out.steps = mergeSteps(samples); put('steps', String(out.steps.total), out.steps.total); }
  }
  return out;
}
