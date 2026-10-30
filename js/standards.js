// 基準値と採点ロジック。
// 数値はすべて SOURCES の出典に紐づける。出典で確かめきれていないものは check に【要確認】の内容を書く。
// 点数への換算(基準値到達=60点 など)はゲーム用の約束ごとで、医学的な判定ではない。

export const SOURCES = {
  pa2023: { name: '健康づくりのための身体活動・運動ガイド2023', org: '厚生労働省' },
  pa2013: {
    name: '健康づくりのための身体活動基準2013(性・年代別の全身持久力の基準)', org: '厚生労働省',
    check: '2023ガイドでの全身持久力の基準値の扱い(参考値として残っているか)を確認',
  },
  sleep2023: { name: '健康づくりのための睡眠ガイド2023', org: '厚生労働省' },
  alcohol: { name: '健康に配慮した飲酒に関するガイドライン(2024年)', org: '厚生労働省' },
  kenko21: { name: '健康日本21(第三次)', org: '厚生労働省' },
  dri2025: {
    name: '日本人の食事摂取基準(2025年版)', org: '厚生労働省',
    check: '目標とするBMI・たんぱく質推奨量・食塩目標量が2020年版から変わっていないか本文で確認',
  },
  bp: {
    name: '高血圧治療ガイドライン2019(家庭血圧の分類・測定法)', org: '日本高血圧学会',
    check: '最新版(高血圧管理・治療ガイドライン2025)で家庭血圧の分類・測定法に変更がないか確認',
  },
  metabo: { name: 'メタボリックシンドロームの定義と診断基準(2005年)', org: '日本内科学会ほか' },
  bmi: { name: '肥満症診療ガイドライン2022', org: '日本肥満学会' },
  balance: { name: '食事バランスガイド(2005年)', org: '厚生労働省・農林水産省' },
  uth: {
    name: 'Uth N, et al. Eur J Appl Physiol. 2004;91:111-5', org: '安静時心拍からのVO2max推定式(VO2max=15.3×HRmax/HRrest)',
    check: '巻・ページを原著で確認',
  },
  tanaka: { name: 'Tanaka H, et al. J Am Coll Cardiol. 2001;37:153-6', org: '最大心拍数の推定式(HRmax=208−0.7×年齢)' },
  app: { name: 'アプリ独自の点数換算', org: '基準値に届いたら60点、などのゲーム用の約束ごと(医学的な判定ではない)' },
};

// 測定項目(不定期に測るもの)
export const MEASURES = {
  vo2max: { label: 'VO2max(実測)', unit: 'ml/kg/分', step: 0.1, stat: 'endurance', hint: 'Apple Watchの「心肺機能」の値など' },
  rhr: { label: '安静時心拍数', unit: '拍/分', step: 1, stat: 'endurance', hint: '朝、起床後に座って1分間' },
  pushup: { label: '腕立て伏せ(連続)', unit: '回', step: 1, stat: 'strength', hint: 'フォームが崩れたら終了' },
  chair30: { label: '30秒椅子立ち上がり', unit: '回', step: 1, stat: 'strength', hint: '腕を胸の前で組み、30秒で立ち座りした回数' },
  plank: { label: 'プランク', unit: '秒', step: 1, stat: 'strength', hint: '肘とつま先で体をまっすぐ保てた時間' },
  grip: { label: '握力(左右の良い方)', unit: 'kg', step: 0.1, stat: 'strength', hint: '握力計がある場合' },
  weight: { label: '体重', unit: 'kg', step: 0.1, stat: 'body', hint: '朝、排尿後・朝食前' },
  bodyfat: { label: '体脂肪率', unit: '%', step: 0.1, stat: 'body', hint: '記録のみ(採点なし)' },
  waist: { label: '腹囲', unit: 'cm', step: 0.1, stat: 'body', hint: '立って軽く息を吐いた時、へその高さ' },
  sbp: { label: '家庭血圧(上)', unit: 'mmHg', step: 1, stat: 'body', hint: '朝、2回測った平均' },
  dbp: { label: '家庭血圧(下)', unit: 'mmHg', step: 1, stat: 'body', hint: '朝、2回測った平均' },
};

export const STRENGTH_KEYS = ['pushup', 'chair30', 'plank', 'grip'];

export const STATS = [
  { key: 'endurance', name: '持久力', short: '持久' },
  { key: 'strength', name: '筋力', short: '筋力' },
  { key: 'body', name: 'からだ', short: 'からだ' },
  { key: 'recovery', name: '回復力', short: '回復' },
  { key: 'habit', name: '生活習慣', short: '習慣' },
  { key: 'knowledge', name: '薬学知識', short: '知識' },
];

// 純アルコール量(g)= 量(ml)× 度数(%)/100 × 0.8(アルコールの比重)— 出典: alcohol
export const DRINKS = [
  { label: 'ビール350ml', g: 14 },
  { label: 'ビール500ml', g: 20 },
  { label: '日本酒1合', g: 22 },
  { label: 'ワイン120ml', g: 12 },
  { label: '酎ハイ7% 350ml', g: 20 },
];

// ---------- 共通の小道具 ----------

export function ageOf(profile, today = new Date()) {
  return today.getFullYear() - Number(profile.birthYear);
}

// 折れ線の補間。範囲外は端の点数で止める
export function lin(x, pts) {
  if (x <= pts[0][0]) return pts[0][1];
  for (let i = 1; i < pts.length; i++) {
    const [x1, y1] = pts[i];
    if (x <= x1) {
      const [x0, y0] = pts[i - 1];
      return y0 + ((y1 - y0) * (x - x0)) / (x1 - x0);
    }
  }
  return pts[pts.length - 1][1];
}

const clamp = (v, lo = 0, hi = 100) => Math.max(lo, Math.min(hi, v));
const mean = (a) => (a.length ? a.reduce((s, v) => s + v, 0) / a.length : null);
const round = (v) => Math.round(v);

export function series(measures, key) {
  return measures.filter((m) => m.key === key).sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : a.t - b.t));
}
const latestOf = (measures, key) => series(measures, key).at(-1) ?? null;

export function isoDate(d) {
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

export function lastDays(n, today = new Date()) {
  const out = [];
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(today.getFullYear(), today.getMonth(), today.getDate() - i);
    out.push(isoDate(d));
  }
  return out;
}

// ---------- 基準値 ----------

// 全身持久力の基準(METs)。1 MET = 3.5 ml/kg/分。70歳以上の値は示されていないため60〜69歳を使う — 出典: pa2013
export function vo2Ref(sex, age) {
  const bands = sex === 'f'
    ? [[39, 9.5, '18〜39歳'], [59, 8.5, '40〜59歳'], [Infinity, 7.5, '60〜69歳']]
    : [[39, 11.0, '18〜39歳'], [59, 10.0, '40〜59歳'], [Infinity, 9.0, '60〜69歳']];
  const [, mets, band] = bands.find(([max]) => age <= max);
  return { ml: mets * 3.5, mets, band: age >= 70 ? `${band}の値を代用` : band };
}

// 目標とするBMIの範囲 — 出典: dri2025
export function bmiRange(age) {
  if (age < 50) return [18.5, 24.9];
  if (age < 65) return [20.0, 24.9];
  return [21.5, 24.9];
}

// 腹囲の基準(以上で該当) — 出典: metabo
export const waistLimit = (sex) => (sex === 'f' ? 90 : 85);

// 家庭血圧の分類(上下の高い方の分類をとる) — 出典: bp
const HOME_BP = [
  { name: '正常血圧', s: 115, d: 75, score: 100 },
  { name: '正常高値血圧', s: 125, d: 75, score: 80 },
  { name: '高値血圧', s: 135, d: 85, score: 60 },
  { name: 'I度高血圧', s: 145, d: 90, score: 40 },
  { name: 'II度高血圧', s: 160, d: 100, score: 20 },
  { name: 'III度高血圧', s: Infinity, d: Infinity, score: 0 },
];
export function homeBpClass(s, d) {
  const bySys = HOME_BP.findIndex((c) => s < c.s);
  // 拡張期は「正常」「正常高値」とも75未満なので、75未満なら収縮期だけで決まる
  const byDia = HOME_BP.findIndex((c) => d < c.d);
  return HOME_BP[Math.max(bySys, byDia)];
}

// 1日の歩数の目安:成人 約8,000歩、高齢者 約6,000歩 — 出典: pa2023
export const stepsTarget = (age) => (age >= 65 ? 6000 : 8000);
// 息が弾み汗をかく程度以上の運動:週60分以上(成人) — 出典: pa2023
export const EXERCISE_MIN_WEEK = 60;
// 筋力トレーニング:週2〜3日 — 出典: pa2023
export const STRENGTH_DAYS_WEEK = 2;
// 生活習慣病のリスクを高める飲酒量(1日平均の純アルコール量) — 出典: kenko21, alcohol
export const alcoholLimit = (sex) => (sex === 'f' ? 20 : 40);
// 野菜 350g/日 ≒ 小鉢5皿(1皿約70g) — 出典: kenko21, balance
export const VEG_DISHES = 5;
// 主菜(肉・魚・卵・大豆料理)3つ(SV)を「3食で主菜をとる」に読み替え — 出典: balance
export const PROTEIN_MEALS = 3;

// ---------- 採点 ----------

function endurance(st, age) {
  const ref = vo2Ref(st.profile.sex, age);
  const direct = latestOf(st.measures, 'vo2max');
  const rhr = latestOf(st.measures, 'rhr');
  let v; let how; const src = ['pa2013', 'app'];
  if (direct) {
    v = direct.value; how = `実測値(${direct.date})`;
  } else if (rhr) {
    v = (15.3 * (208 - 0.7 * age)) / rhr.value;
    how = `安静時心拍 ${rhr.value} 拍/分 から推定(${rhr.date})`;
    src.push('uth', 'tanaka');
  } else {
    return { score: null, parts: [], missing: '「VO2max」か「安静時心拍数」を測ると採点されます' };
  }
  const score = lin(v, [[ref.ml - 15.75, 0], [ref.ml - 10.5, 20], [ref.ml, 60], [ref.ml + 10.5, 100]]);
  return {
    score: round(score),
    parts: [{
      label: 'VO2max', value: `${v.toFixed(1)} ml/kg/分`, score: round(score),
      note: `${how}。基準 ${ref.ml.toFixed(1)}(${ref.mets} METs・${ref.band})で60点、±3 METsで±40点`,
      src,
    }],
  };
}

export function strengthTarget(st, key) {
  const s = series(st.measures, key);
  if (!s.length) return null;
  const base = s[0].value;
  const target = st.targets?.[key] ?? Math.max(base + 1, Math.ceil(base * 1.3));
  return { base, target };
}

function strength(st) {
  const parts = [];
  for (const key of STRENGTH_KEYS) {
    const s = series(st.measures, key);
    if (!s.length) continue;
    const { base, target } = strengthTarget(st, key);
    const cur = s.at(-1).value;
    const score = target > base ? clamp(50 + (50 * (cur - base)) / (target - base)) : (cur >= target ? 100 : 50);
    parts.push({
      label: MEASURES[key].label, value: `${cur} ${MEASURES[key].unit}`, score: round(score),
      note: `自己基準:初回 ${base} で50点 → 目標 ${target} で100点`, src: ['app'],
    });
  }
  if (!parts.length) return { score: null, parts, missing: '筋力テストを1つ以上測ると採点されます' };
  return { score: round(mean(parts.map((p) => p.score))), parts, selfBased: true };
}

function body(st, age) {
  const { sex, height } = st.profile;
  const parts = [];
  const w = latestOf(st.measures, 'weight');
  if (w && height) {
    const bmi = w.value / (height / 100) ** 2;
    const [lo, hi] = bmiRange(age);
    const dist = bmi < lo ? lo - bmi : bmi > hi ? bmi - hi : 0;
    const score = clamp(100 - 25 * dist);
    parts.push({
      label: 'BMI', value: bmi.toFixed(1), score: round(score),
      note: `目標範囲 ${lo}〜${hi}(${age < 50 ? '18〜49' : age < 65 ? '50〜64' : '65'}歳${age < 65 ? '' : '以上'})。範囲内で100点、1離れるごとに−25点`,
      src: ['dri2025', 'bmi', 'app'],
    });
  }
  const waist = latestOf(st.measures, 'waist');
  if (waist) {
    const lim = waistLimit(sex);
    const score = waist.value < lim ? 100 : clamp(70 - 6 * (waist.value - lim));
    parts.push({
      label: '腹囲', value: `${waist.value} cm`, score: round(score),
      note: `${sex === 'f' ? '女性' : '男性'}は ${lim}cm 以上が基準該当。未満で100点`, src: ['metabo', 'app'],
    });
  }
  const s = latestOf(st.measures, 'sbp');
  const d = latestOf(st.measures, 'dbp');
  if (s && d) {
    const c = homeBpClass(s.value, d.value);
    parts.push({
      label: '家庭血圧', value: `${s.value}/${d.value}`, score: c.score,
      note: `家庭血圧の分類:${c.name}`, src: ['bp', 'app'],
    });
  }
  if (!parts.length) return { score: null, parts, missing: '体重(身長の設定が必要)・腹囲・家庭血圧のどれかを測ると採点されます' };
  return { score: round(mean(parts.map((p) => p.score))), parts };
}

function recentDaily(st, n = 7) {
  return lastDays(n).map((date) => st.daily[date]).filter(Boolean);
}
const nums = (rows, key) => rows.map((r) => r[key]).filter((v) => v !== undefined && v !== null && v !== '').map(Number);

function recovery(st) {
  const rows = recentDaily(st);
  const parts = [];
  const sl = nums(rows, 'sleepH');
  if (sl.length) {
    const h = mean(sl);
    const score = h < 5 ? 20 : h < 6 ? 45 : h < 7 ? 80 : h < 9 ? 100 : 85;
    parts.push({
      label: '睡眠時間', value: `${h.toFixed(1)} 時間`, score,
      note: `直近7日(${sl.length}日分)の平均。成人は6時間以上が目安`, src: ['sleep2023', 'app'],
    });
  }
  const rest = nums(rows, 'rest');
  if (rest.length) {
    const q = mean(rest);
    parts.push({
      label: '睡眠休養感', value: `${q.toFixed(1)} / 5`, score: round(((q - 1) / 4) * 100),
      note: '「睡眠で休養がとれた」感覚。直近7日の平均', src: ['sleep2023', 'app'],
    });
  }
  if (!parts.length) return { score: null, parts, missing: '毎日の記録で睡眠を入れると採点されます' };
  return { score: round(mean(parts.map((p) => p.score))), parts };
}

function habit(st, age) {
  const rows = recentDaily(st);
  const parts = [];
  const steps = nums(rows, 'steps');
  if (steps.length) {
    const t = stepsTarget(age);
    const a = mean(steps);
    parts.push({ label: '歩数', value: `${round(a).toLocaleString()} 歩/日`, score: round(clamp((a / t) * 100)), note: `目安 ${t.toLocaleString()} 歩/日`, src: ['pa2023', 'app'] });
  }
  if (rows.length) {
    const ex = nums(rows, 'exMin').reduce((s, v) => s + v, 0);
    parts.push({ label: '運動', value: `${ex} 分/週`, score: round(clamp((ex / EXERCISE_MIN_WEEK) * 100)), note: '息が弾み汗をかく程度の運動を週60分以上', src: ['pa2023', 'app'] });
    const days = rows.filter((r) => r.strength).length;
    parts.push({ label: '筋トレ', value: `${days} 日/週`, score: days >= STRENGTH_DAYS_WEEK ? 100 : days * 50, note: '週2〜3日が目安', src: ['pa2023', 'app'] });
  }
  const alc = nums(rows, 'alcoholG');
  if (alc.length) {
    const a = mean(alc);
    const lim = alcoholLimit(st.profile.sex);
    parts.push({ label: '飲酒', value: `純アルコール ${a.toFixed(1)} g/日`, score: round(clamp(100 - (70 * a) / lim)), note: `${lim}g/日以上で生活習慣病のリスクが高まる。0gで100点、${lim}gで30点`, src: ['kenko21', 'alcohol', 'app'] });
  }
  const veg = nums(rows, 'veg');
  if (veg.length) {
    const a = mean(veg);
    parts.push({ label: '野菜', value: `${a.toFixed(1)} 皿/日`, score: round(clamp((a / VEG_DISHES) * 100)), note: '1日350g(小鉢5皿)が目標', src: ['kenko21', 'balance', 'app'] });
  }
  const pr = nums(rows, 'protein');
  if (pr.length) {
    const a = mean(pr);
    parts.push({ label: '主菜', value: `${a.toFixed(1)} 食/日`, score: round(clamp((a / PROTEIN_MEALS) * 100)), note: '肉・魚・卵・大豆料理を3食でとる', src: ['balance', 'app'] });
  }
  if (!parts.length) return { score: null, parts, missing: '毎日の記録をつけると採点されます' };
  return { score: round(mean(parts.map((p) => p.score))), parts };
}

function knowledge(st, quizTotal) {
  const answered = Object.values(st.quiz);
  if (!answered.length) return { score: null, parts: [], missing: '「学ぶ」タブのクイズに答えると採点されます' };
  const mastered = answered.filter((q) => q.last).length;
  const score = round((mastered / quizTotal) * 100);
  return {
    score,
    parts: [{ label: 'マスターした問題', value: `${mastered} / ${quizTotal} 問`, score, note: '最後に正解した問題をマスターと数える', src: ['app'] }],
  };
}

export function computeStats(st, quizTotal) {
  const age = ageOf(st.profile);
  return {
    endurance: endurance(st, age),
    strength: strength(st),
    body: body(st, age),
    recovery: recovery(st),
    habit: habit(st, age),
    knowledge: knowledge(st, quizTotal),
  };
}

export function overall(stats) {
  const s = Object.values(stats).map((x) => x.score).filter((v) => v !== null);
  return s.length ? round(mean(s)) : null;
}

export function rankOf(score) {
  if (score === null || score === undefined) return '−';
  if (score >= 90) return 'S';
  if (score >= 80) return 'A';
  if (score >= 65) return 'B';
  if (score >= 50) return 'C';
  if (score >= 35) return 'D';
  return 'E';
}

// レベル n → n+1 に必要なXPは 100 + 50×(n−1)
export function levelFromXp(xp) {
  let level = 1; let need = 100; let rest = xp;
  while (rest >= need) { rest -= need; level++; need = 100 + 50 * (level - 1); }
  return { level, into: rest, need };
}
