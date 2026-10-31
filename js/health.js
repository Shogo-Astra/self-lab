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

// 単位をそろえる。睡眠は時間、エクササイズは分、体脂肪率は%
function normalize(key, raw) {
  const s = raw.replace(/,/g, '');
  if (key === 'sleep' || key === 'exercise') {
    const hm = s.match(/(\d+(?:\.\d+)?)\s*(?:時間|h|hr)\s*(\d+(?:\.\d+)?)\s*(?:分|m|min)/i) ?? s.match(/^\s*(\d+):(\d{1,2})(?::\d{1,2})?\s*$/);
    let minutes;
    if (hm) minutes = Number(hm[1]) * 60 + Number(hm[2]);
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
  return v;
}

export function parseHealth(text) {
  const t = toHalf(String(text ?? ''));
  if (!/SELFLAB/i.test(t)) return null;
  const out = { day: null, values: {}, skipped: [] };
  for (const line of t.split(/\r?\n/)) {
    const m = line.match(/^\s*([a-z0-9]+)\s*[=:]\s*(.*)$/i);
    if (!m) continue;
    const key = m[1].toLowerCase(); const raw = m[2].trim();
    if (key === 'day') {
      const d = raw.match(/(\d{4})\s*[-/年.]\s*(\d{1,2})\s*[-/月.]\s*(\d{1,2})/);
      if (d) out.day = `${d[1]}-${d[2].padStart(2, '0')}-${d[3].padStart(2, '0')}`;
      continue;
    }
    const def = HEALTH_KEYS[key];
    if (!def || raw === '') continue;
    const v = normalize(key, raw);
    if (v === null || Number.isNaN(v)) continue;
    if (v < def.min || v > def.max) {
      // 歩数0・睡眠0は「データなし」なので黙って飛ばす
      if (!((key === 'steps' || key === 'sleep') && v === 0)) out.skipped.push(`${def.label}(${raw})`);
      continue;
    }
    out.values[key] = Number(v.toFixed(def.digits));
  }
  return out;
}
