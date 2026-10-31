// 基準値と採点ロジック。
// 数値はすべて SOURCES の出典に紐づける。出典で確かめきれていないものは check に【要確認】の内容を書く。
// ランク・ポイント・天井・減少の数値はゲーム用の約束ごとで、医学的な判定ではない。

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
  shintairyoku: {
    name: '新体力テスト実施要項(20〜64歳対象・65〜79歳対象)', org: '文部科学省',
    check: '年代別の得点表を本文で確認し、握力・上体起こし・長座体前屈・反復横とび・立ち幅とび・開眼片足立ちの天井を自己基準から置き換える',
  },
  locomo: { name: 'ロコモ度テスト(立ち上がりテスト・2ステップテスト)', org: '日本整形外科学会' },
  sft: { name: 'Senior Fitness Test(Back Scratch Test)', org: 'Rikli RE, Jones CJ' },
  acsm2009: {
    name: 'ACSM Position Stand: Progression Models in Resistance Training for Healthy Adults(2009)', org: 'American College of Sports Medicine',
    check: '同じ筋群のトレーニング間隔(48時間程度)の記載を原文で確認',
  },
  garber2011: {
    name: 'Garber CE, et al. Med Sci Sports Exerc. 2011;43:1334-59(ACSM Position Stand)', org: '柔軟性運動:週2〜3日以上、1回10〜30秒保持',
    check: '柔軟性運動の頻度・保持時間の記載を原文で確認',
  },
  app: { name: 'アプリ独自のルール', org: 'ランク・ポイント・天井・減少の数値はゲーム用の約束ごと(医学的な判定ではない)' },
};

// ---------- ランク(G−〜SSS+ の30段階) ----------

const LETTERS = ['G', 'F', 'E', 'D', 'C', 'B', 'A', 'S', 'SS', 'SSS'];
export const RANKS = LETTERS.flatMap((l) => [`${l}−`, l, `${l}+`]);
export const MAX_STEP = RANKS.length - 1; // 29 = SSS+
export const C_MINUS = 12; // これ以上で減少ルールが働く
export const NO_MEASURE_CEIL = 11; // 測定していない項目の天井 = D+
export const SELF_BASE_CEIL = 14; // 自己基準の初回測定 = C+
export const SELF_MAX_STEP = 16; // 初期設定の自己評価で選べる上限 = B
export const SELF_DEFAULT_STEP = 10; // 自己評価の初期値 = D

// 次の段階に上がるのに必要なポイント。週2回(20pt/週)で C−まで約3か月、A−まで約1年、S−まで約2年
const COSTS = [10, 10, 10, 15, 15, 15, 20, 20, 20, 40, 40, 40, 80, 80, 80, 180, 180, 180, 350, 350, 350, 500, 500, 500, 600, 600, 600, 700, 700];
export const THRESH = COSTS.reduce((a, c) => [...a, a.at(-1) + c], [0]);

export const rankLabel = (step) => (step === null || step === undefined ? '—' : RANKS[step]);
export const letterOf = (step) => (step === null || step === undefined ? null : Math.floor(step / 3));
export function stepOfPoints(p) {
  let k = 0;
  while (k < MAX_STEP && p >= THRESH[k + 1]) k++;
  return k;
}
const clampStep = (s, lo = 0) => Math.max(lo, Math.min(MAX_STEP, s));

// ポイントのルール — 出典: pa2023(筋トレ週2〜3日)、acsm2009(同じ筋群は48時間程度あける)、app
export const GAIN = 10;
export const GAIN_SOON = 5; // 前回から48時間以内(回復途中)
export const WEEK_CAP = 30; // 7日間で得られる上限
export const DECAY_RATE = 0.01; // C−を超えた分の1%/日

// ---------- 項目 ----------

export const PARTS = [
  { key: 'arm', name: '腕', tests: ['pushup', 'grip'], decayDay: 5 },
  { key: 'shoulder', name: '肩', tests: ['pike'], decayDay: 5 },
  { key: 'chest', name: '胸', tests: ['pushup'], decayDay: 5 },
  { key: 'abs', name: '腹', tests: ['situp30', 'plank'], decayDay: 5 },
  { key: 'back', name: '背中', tests: ['backhold'], decayDay: 5 },
  { key: 'leg', name: 'お尻・脚', tests: ['chair30', 'wallsit'], decayDay: 5 },
];
export const PART_KEYS = PARTS.map((p) => p.key);

// decayDay:最後に鍛えた日から数えて、この日数たつと減少が始まる
export const ABILITIES = [
  { key: 'strength', name: '筋力', short: '筋力' },
  { key: 'endurance', name: '持久力', short: '持久', tests: ['vo2max', 'rhr'], train: 'cardio', decayDay: 5 },
  { key: 'flex', name: '柔軟性', short: '柔軟', tests: ['sitreach', 'shoulder'], train: 'flex', decayDay: 5 },
  { key: 'power', name: '瞬発力', short: '瞬発', tests: ['broadjump'], train: 'power', decayDay: 8 },
  { key: 'agility', name: '敏捷性', short: '敏捷', tests: ['sidestep'], train: 'agility', decayDay: 8 },
  { key: 'balance', name: 'バランス', short: 'バランス', tests: ['balanceClosed', 'balanceOpen'], train: 'balance', decayDay: 8 },
  { key: 'walk', name: '歩く力', short: '歩く', tests: ['twostep', 'standup'], train: 'walk', decayDay: 4, gain: 3, noSoon: true },
];

export const CONDITIONS = [
  { key: 'body', name: 'からだ' },
  { key: 'recovery', name: '回復力' },
  { key: 'habit', name: '生活習慣' },
  { key: 'knowledge', name: '薬学知識' },
];
export const CONDITION_MAX_STEP = 20; // コンディションは今の状態の評価なので A+ まで

// 毎日のチェックインで選ぶトレーニング
export const TRAININGS = [
  ...PARTS.map((p) => ({ key: p.key, label: p.name, kind: 'part' })),
  { key: 'cardio', label: '有酸素', kind: 'other' },
  { key: 'flex', label: 'ストレッチ', kind: 'other' },
  { key: 'power', label: 'ジャンプ', kind: 'other' },
  { key: 'agility', label: 'ステップ・球技', kind: 'other' },
  { key: 'balance', label: 'バランス', kind: 'other' },
];

export const STANDUP_LEVELS = ['両脚40cmもできない', '両脚40cm', '両脚30cm', '両脚20cm', '両脚10cm', '片脚40cm', '片脚30cm', '片脚20cm', '片脚10cm'];

// 測定項目。rule は天井の決め方:
//   vo2 / vo2est … 公的基準(身体活動基準2013)との差
//   pct … 自己基準。初回=C+、初回からの伸び率 pct ごとに1段階
//   abs … 自己基準。初回からの変化 abs ごとに1段階(マイナスは小さいほど良い項目)
//   level … 自己基準。1段階上の台ごとに level 段階
export const MEASURES = {
  vo2max: { label: 'VO2max(実測)', unit: 'ml/kg/分', step: 0.1, group: 'endurance', rule: { type: 'vo2' }, hint: 'Apple Watchの「心肺機能」の値など' },
  rhr: { label: '安静時心拍数', unit: '拍/分', step: 1, group: 'endurance', rule: { type: 'vo2est' }, hint: '朝、起床後に座って1分間' },
  pushup: { label: '腕立て伏せ(連続)', unit: '回', step: 1, group: 'strength', for: '腕・胸', rule: { pct: 0.1 }, hint: 'フォームが崩れたら終了' },
  grip: { label: '握力(左右の良い方)', unit: 'kg', step: 0.1, group: 'strength', for: '腕', rule: { pct: 0.03 }, hint: '握力計がある場合' },
  pike: { label: 'パイクプッシュアップ', unit: '回', step: 1, group: 'strength', for: '肩', rule: { pct: 0.1 }, hint: '腰を高く上げた「へ」の字の姿勢で、頭を床に近づける腕立て' },
  situp30: { label: '上体起こし(30秒)', unit: '回', step: 1, group: 'strength', for: '腹', rule: { pct: 0.05 }, src: 'shintairyoku', hint: '仰向けで膝を90度に曲げ、腕を胸の前で組む。両肘が太ももにつくまで起こした回数' },
  plank: { label: 'プランク', unit: '秒', step: 1, group: 'strength', for: '腹', rule: { pct: 0.1 }, hint: '肘とつま先で体をまっすぐ保てた時間' },
  backhold: { label: '背筋の保持', unit: '秒', step: 1, group: 'strength', for: '背中', rule: { pct: 0.1 }, hint: 'うつ伏せで両腕を前に伸ばし、胸と脚を床から浮かせて保てた時間' },
  chair30: { label: '30秒椅子立ち上がり', unit: '回', step: 1, group: 'strength', for: 'お尻・脚', rule: { pct: 0.1 }, hint: '腕を胸の前で組み、30秒で立ち座りした回数' },
  wallsit: { label: '空気椅子', unit: '秒', step: 1, group: 'strength', for: 'お尻・脚', rule: { pct: 0.1 }, hint: '壁に背をつけ、膝を90度に曲げて保てた時間' },
  sitreach: { label: '長座体前屈', unit: 'cm', step: 0.5, group: 'flex', rule: { abs: 1.5 }, src: 'shintairyoku', signed: true, hint: '壁に背とお尻をつけて長座し、床に置いた箱を前屈して押し出せた距離' },
  shoulder: { label: '背中で手を近づける', unit: 'cm', step: 0.5, group: 'flex', rule: { abs: -1.5 }, src: 'sft', signed: true, hint: '片手は肩の上から、もう片方は腰から背中に回し、中指どうしのすき間(重なったらマイナス)。左右の良い方' },
  broadjump: { label: '立ち幅とび', unit: 'cm', step: 1, group: 'power', rule: { pct: 0.02 }, src: 'shintairyoku', hint: '両足で踏み切り、踏み切り線から着地したかかとまでの距離' },
  sidestep: { label: '反復横とび(20秒)', unit: '回', step: 1, group: 'agility', rule: { pct: 0.05 }, src: 'shintairyoku', hint: '中央線の左右100cmに線を引き、サイドステップで線を越えた(踏んだ)回数' },
  balanceClosed: { label: '閉眼片足立ち', unit: '秒', step: 1, group: 'balance', rule: { pct: 0.1 }, hint: '目を閉じ、手を腰に当てて片足で立てた時間' },
  balanceOpen: { label: '開眼片足立ち', unit: '秒', step: 1, group: 'balance', rule: { pct: 0.1 }, src: 'shintairyoku', hint: '目を開け、手を腰に当てて片足で立てた時間(最大120秒)' },
  twostep: { label: '2ステップテスト(2歩幅)', unit: 'cm', step: 1, group: 'walk', rule: { pct: 0.02 }, src: 'locomo', hint: 'できるだけ大股で2歩進み、両足をそろえた距離。身長で割った値が2ステップ値' },
  standup: { label: '立ち上がりテスト', unit: '', step: 1, group: 'walk', rule: { level: 2 }, src: 'locomo', options: STANDUP_LEVELS, hint: '反動をつけずに立ち上がり、3秒保てた一番低い台' },
  weight: { label: '体重', unit: 'kg', step: 0.1, group: 'body', hint: '朝、排尿後・朝食前' },
  bodyfat: { label: '体脂肪率', unit: '%', step: 0.1, group: 'body', hint: '記録のみ(採点なし)' },
  waist: { label: '腹囲', unit: 'cm', step: 0.1, group: 'body', hint: '立って軽く息を吐いた時、へその高さ' },
  sbp: { label: '家庭血圧(上)', unit: 'mmHg', step: 1, group: 'body', hint: '朝、2回測った平均' },
  dbp: { label: '家庭血圧(下)', unit: 'mmHg', step: 1, group: 'body', hint: '朝、2回測った平均' },
};

export const MEASURE_GROUPS = [
  ['strength', '筋力(部位)'], ['endurance', '持久力'], ['flex', '柔軟性'], ['power', '瞬発力'],
  ['agility', '敏捷性'], ['balance', 'バランス'], ['walk', '歩く力'], ['body', 'からだ'],
];

// ---------- 共通の小道具 ----------

export function ageOf(profile, today = new Date()) {
  return today.getFullYear() - Number(profile.birthYear);
}

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
const parseIso = (iso) => { const [y, m, d] = iso.split('-').map(Number); return new Date(y, m - 1, d); };
export const daysBetween = (a, b) => Math.round((parseIso(b) - parseIso(a)) / 86400000);

export function lastDays(n, today = new Date()) {
  const out = [];
  for (let i = n - 1; i >= 0; i--) out.push(isoDate(new Date(today.getFullYear(), today.getMonth(), today.getDate() - i)));
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
// 安静時心拍からの推定 — 出典: uth, tanaka
export const vo2FromRhr = (rhr, age) => (15.3 * (208 - 0.7 * age)) / rhr;

export function bmiRange(age) { // 出典: dri2025
  if (age < 50) return [18.5, 24.9];
  if (age < 65) return [20.0, 24.9];
  return [21.5, 24.9];
}
export const waistLimit = (sex) => (sex === 'f' ? 90 : 85); // 出典: metabo

const HOME_BP = [ // 出典: bp
  { name: '正常血圧', s: 115, d: 75, score: 100 },
  { name: '正常高値血圧', s: 125, d: 75, score: 80 },
  { name: '高値血圧', s: 135, d: 85, score: 60 },
  { name: 'I度高血圧', s: 145, d: 90, score: 40 },
  { name: 'II度高血圧', s: 160, d: 100, score: 20 },
  { name: 'III度高血圧', s: Infinity, d: Infinity, score: 0 },
];
export function homeBpClass(s, d) {
  // 拡張期は「正常」「正常高値」とも75未満なので、75未満なら収縮期だけで決まる
  return HOME_BP[Math.max(HOME_BP.findIndex((c) => s < c.s), HOME_BP.findIndex((c) => d < c.d))];
}

// ロコモ度 — 出典: locomo
export function locomoTwoStep(ratio) {
  if (ratio < 0.9) return 'ロコモ度3';
  if (ratio < 1.1) return 'ロコモ度2';
  if (ratio < 1.3) return 'ロコモ度1';
  return '該当なし';
}
export function locomoStandup(level) {
  if (level < 2) return 'ロコモ度3'; // 両脚30cmができない
  if (level < 3) return 'ロコモ度2'; // 両脚20cmができない
  if (level < 5) return 'ロコモ度1'; // 片脚40cmができない
  return '該当なし';
}

export const stepsTarget = (age) => (age >= 65 ? 6000 : 8000); // 出典: pa2023
export const EXERCISE_MIN_WEEK = 60; // 出典: pa2023
export const STRENGTH_DAYS_WEEK = 2; // 出典: pa2023
export const alcoholLimit = (sex) => (sex === 'f' ? 20 : 40); // 出典: kenko21, alcohol
export const VEG_DISHES = 5; // 出典: kenko21, balance
export const PROTEIN_MEALS = 3; // 出典: balance

// 純アルコール量(g)= 量(ml)× 度数(%)/100 × 0.8 — 出典: alcohol
export const DRINKS = [
  { label: 'ビール350ml', g: 14 },
  { label: 'ビール500ml', g: 20 },
  { label: '日本酒1合', g: 22 },
  { label: 'ワイン120ml', g: 12 },
  { label: '酎ハイ7% 350ml', g: 20 },
];

// ---------- 天井(測定で決まる上限ランク) ----------

// base:自己基準の初回測定の段階(自己評価が C+ より高ければ、その段階から数える)
export function testCeil(key, first, latest, age, sex, base = SELF_BASE_CEIL) {
  const r = MEASURES[key].rule;
  if (r.type === 'vo2' || r.type === 'vo2est') {
    const v = r.type === 'vo2' ? latest : vo2FromRhr(latest, age);
    // 基準値で B+、1.5 ml/kg/分(約0.4 METs)ごとに1段階
    return clampStep(17 + Math.trunc((v - vo2Ref(sex, age).ml) / 1.5), 3);
  }
  if (r.pct) return first > 0 ? clampStep(base + Math.trunc((latest - first) / first / r.pct + 1e-9), 6) : base;
  if (r.abs) return clampStep(base + Math.trunc((latest - first) / r.abs + 1e-9), 6);
  if (r.level) return clampStep(base + r.level * (latest - first), 6);
  return NO_MEASURE_CEIL;
}

export function testInfo(key, first, latest, profile, base = SELF_BASE_CEIL) {
  const r = MEASURES[key].rule;
  const b = RANKS[base];
  if (r.type === 'vo2') return `基準 ${vo2Ref(profile.sex, ageOf(profile)).ml.toFixed(1)} で B+、1.5 ごとに1段階`;
  if (r.type === 'vo2est') return `推定VO2max ${vo2FromRhr(latest, ageOf(profile)).toFixed(1)}(Uth式)。基準 ${vo2Ref(profile.sex, ageOf(profile)).ml.toFixed(1)} で B+`;
  if (r.pct) return `自己基準:初回 ${first} で ${b}、${Math.round(r.pct * 100)}%伸びるごとに1段階`;
  if (r.abs) return `自己基準:初回 ${first} で ${b}、${Math.abs(r.abs)}cm ${r.abs > 0 ? '伸びる' : '縮まる'}ごとに1段階`;
  if (r.level) return `自己基準:初回「${STANDUP_LEVELS[first]}」で ${b}、1つ低い台ごとに${r.level}段階`;
  return '';
}

// ---------- 身体能力:日ごとにポイントを再計算する ----------

function trainedOn(def, row, age) {
  if (!row) return false;
  const key = def.train ?? def.key;
  if (row.trained?.includes(key)) return true;
  if (key === 'cardio' && Number(row.exMin) > 0) return true;
  if (key === 'walk' && Number(row.steps) >= stepsTarget(age)) return true;
  return false;
}

function replay(def, st, days, age, sers) {
  const sex = st.profile.sex;
  const idx = Object.fromEntries(def.tests.map((k) => [k, 0]));
  const gainBase = def.gain ?? GAIN;
  // 初期設定の自己評価:その日に自己評価のランクのポイントから始め、減少の日数もその日から数える
  const self = st.selfInit?.steps?.[def.key] ?? null;
  const selfIdx = self === null ? -1 : days.indexOf(st.selfInit.date);
  const base = Math.max(SELF_BASE_CEIL, self ?? 0);
  let pts = 0; let last = null; let anchor = null; let ceil = NO_MEASURE_CEIL;
  const gains = []; const history = [];
  days.forEach((d, i) => {
    if (i === selfIdx) { pts = Math.max(pts, THRESH[self]); anchor = i; }
    // その日までの測定で天井を決める
    const ceils = [];
    for (const k of def.tests) {
      const s = sers[k];
      while (idx[k] < s.length && s[idx[k]].date <= d) idx[k]++;
      if (idx[k] > 0) ceils.push(testCeil(k, s[0].value, s[idx[k] - 1].value, age, sex, base));
    }
    ceil = Math.max(ceils.length ? Math.max(...ceils) : NO_MEASURE_CEIL, selfIdx >= 0 && i >= selfIdx ? self : 0);
    const cap = ceil >= MAX_STEP ? Infinity : THRESH[ceil + 1] - 1e-6;

    if (trainedOn(def, st.daily[d], age)) {
      let g = !def.noSoon && last !== null && i - last < 2 ? GAIN_SOON : gainBase;
      const week = gains.filter((x) => x.i > i - 7).reduce((s, x) => s + x.g, 0);
      g = Math.max(0, Math.min(g, WEEK_CAP - week, cap - pts));
      if (g > 0) { pts += g; gains.push({ i, g }); }
      last = i; anchor = i;
    } else if (anchor !== null && i - anchor >= def.decayDay && pts > THRESH[C_MINUS]) {
      pts -= DECAY_RATE * (pts - THRESH[C_MINUS]);
    }
    history.push({ date: d, value: Math.round(pts * 10) / 10 });
  });

  const n = days.length - 1;
  const rawStep = stepOfPoints(pts);
  const step = Math.min(rawStep, ceil);
  // since:減少の判定に使う日数(最後に鍛えた日か自己評価の日から)。trainedSince:実際に鍛えてからの日数
  const since = anchor === null ? null : n - anchor;
  const trainedSince = last === null ? null : n - last;
  const decaying = since !== null && since >= def.decayDay && rawStep >= C_MINUS;
  return {
    key: def.key, name: def.name, pts, step, ceil, rawStep, decayDay: def.decayDay,
    atCeil: rawStep >= ceil && ceil < MAX_STEP,
    last: last === null ? null : days[last], since, trainedSince, decaying, self, base,
    recent: days.slice(-28).map((d) => trainedOn(def, st.daily[d], age)),
    history: history.slice(-120),
    tests: def.tests.filter((k) => sers[k].length).map((k) => ({
      key: k, first: sers[k][0].value, latest: sers[k].at(-1).value,
      ceil: testCeil(k, sers[k][0].value, sers[k].at(-1).value, age, sex, base),
    })),
  };
}

export function physicalStatus(st, today = isoDate(new Date())) {
  const age = ageOf(st.profile);
  const all = [...Object.keys(st.daily), ...st.measures.map((m) => m.date), ...(st.selfInit ? [st.selfInit.date] : [])].filter((d) => d <= today).sort();
  const start = all[0] ?? today;
  const days = [];
  for (let d = parseIso(start); isoDate(d) <= today; d.setDate(d.getDate() + 1)) days.push(isoDate(d));
  const sers = Object.fromEntries(Object.keys(MEASURES).map((k) => [k, series(st.measures, k).filter((m) => m.date <= today)]));

  const parts = Object.fromEntries(PARTS.map((p) => [p.key, replay(p, st, days, age, sers)]));
  const abilities = {};
  for (const a of ABILITIES) {
    if (a.key === 'strength') {
      const steps = PARTS.map((p) => parts[p.key].step);
      abilities.strength = { key: 'strength', name: a.name, step: Math.floor(mean(steps)), parts: true };
    } else {
      abilities[a.key] = replay(a, st, days, age, sers);
    }
  }
  const overallStep = Math.floor(mean(ABILITIES.map((a) => abilities[a.key].step)));
  return { parts, abilities, overallStep };
}

// 部位・項目の今の状態(回復中/鍛えどき/減少中)
export function restState(s) {
  if (s.since === null) return { label: '未記録', tone: 'muted' };
  if (s.decaying) return { label: '減少中', tone: 'bad' };
  if (s.trainedSince !== null && s.trainedSince < 2 && !ABILITIES.find((a) => a.key === s.key)?.noSoon) return { label: '回復中', tone: 'rest' };
  const left = s.decayDay - s.since;
  if (s.rawStep >= C_MINUS && left <= 2) return { label: `あと${left}日で減少`, tone: 'warn' };
  if (s.since >= s.decayDay) return { label: `${s.since}日休み`, tone: 'muted' };
  return { label: '鍛えどき', tone: 'good' };
}

// 強み・弱み:身体能力6項目と筋力の6部位(計12)を段階の高い順・低い順に並べる
export function strengthsWeaknesses(items, n = 3) {
  const sorted = [...items].sort((a, b) => b.step - a.step);
  if (!sorted.length || sorted[0].step === sorted.at(-1).step) return null;
  const top = sorted.slice(0, n).filter((x) => x.step > sorted.at(-1).step);
  const bottom = sorted.slice(-n).reverse().filter((x) => x.step < sorted[0].step);
  return { top, bottom };
}

// ---------- コンディション(0〜100点 → A+ までのランク) ----------

function body(st, age) {
  const { sex, height } = st.profile;
  const parts = [];
  const w = latestOf(st.measures, 'weight');
  if (w && height) {
    const bmi = w.value / (height / 100) ** 2;
    const [lo, hi] = bmiRange(age);
    const dist = bmi < lo ? lo - bmi : bmi > hi ? bmi - hi : 0;
    parts.push({
      label: 'BMI', value: bmi.toFixed(1), score: round(clamp(100 - 25 * dist)),
      note: `目標範囲 ${lo}〜${hi}。範囲内で100点、1離れるごとに−25点`, src: ['dri2025', 'bmi', 'app'],
    });
  }
  const waist = latestOf(st.measures, 'waist');
  if (waist) {
    const lim = waistLimit(sex);
    parts.push({
      label: '腹囲', value: `${waist.value} cm`, score: round(waist.value < lim ? 100 : clamp(70 - 6 * (waist.value - lim))),
      note: `${sex === 'f' ? '女性' : '男性'}は ${lim}cm 以上が基準該当。未満で100点`, src: ['metabo', 'app'],
    });
  }
  const s = latestOf(st.measures, 'sbp');
  const d = latestOf(st.measures, 'dbp');
  if (s && d) {
    const c = homeBpClass(s.value, d.value);
    parts.push({ label: '家庭血圧', value: `${s.value}/${d.value}`, score: c.score, note: `家庭血圧の分類:${c.name}`, src: ['bp', 'app'] });
  }
  if (!parts.length) return { score: null, parts, missing: '体重(身長の設定が必要)・腹囲・家庭血圧のどれかを測ると評価されます' };
  return { score: round(mean(parts.map((p) => p.score))), parts };
}

const recentDaily = (st, n = 7) => lastDays(n).map((date) => st.daily[date]).filter(Boolean);
const nums = (rows, key) => rows.map((r) => r[key]).filter((v) => v !== undefined && v !== null && v !== '').map(Number);
export const didStrength = (row) => !!row && (row.strength || (row.trained ?? []).some((t) => PART_KEYS.includes(t)));

function recovery(st) {
  const rows = recentDaily(st);
  const parts = [];
  const sl = nums(rows, 'sleepH');
  if (sl.length) {
    const h = mean(sl);
    parts.push({
      label: '睡眠時間', value: `${h.toFixed(1)} 時間`, score: h < 5 ? 20 : h < 6 ? 45 : h < 7 ? 80 : h < 9 ? 100 : 85,
      note: `直近7日(${sl.length}日分)の平均。成人は6時間以上が目安`, src: ['sleep2023', 'app'],
    });
  }
  const rest = nums(rows, 'rest');
  if (rest.length) {
    const q = mean(rest);
    parts.push({ label: '睡眠休養感', value: `${q.toFixed(1)} / 5`, score: round(((q - 1) / 4) * 100), note: '「睡眠で休養がとれた」感覚。直近7日の平均', src: ['sleep2023', 'app'] });
  }
  if (!parts.length) return { score: null, parts, missing: '毎日のチェックインで睡眠を入れると評価されます' };
  return { score: round(mean(parts.map((p) => p.score))), parts };
}

function habit(st, age) {
  const rows = recentDaily(st);
  const parts = [];
  const steps = nums(rows, 'steps');
  if (steps.length) {
    const t = stepsTarget(age); const a = mean(steps);
    parts.push({ label: '歩数', value: `${round(a).toLocaleString()} 歩/日`, score: round(clamp((a / t) * 100)), note: `目安 ${t.toLocaleString()} 歩/日`, src: ['pa2023', 'app'] });
  }
  if (rows.length) {
    const ex = nums(rows, 'exMin').reduce((s, v) => s + v, 0);
    parts.push({ label: '運動', value: `${ex} 分/週`, score: round(clamp((ex / EXERCISE_MIN_WEEK) * 100)), note: '息が弾み汗をかく程度の運動を週60分以上', src: ['pa2023', 'app'] });
    const days = rows.filter(didStrength).length;
    parts.push({ label: '筋トレ', value: `${days} 日/週`, score: days >= STRENGTH_DAYS_WEEK ? 100 : days * 50, note: '週2〜3日が目安', src: ['pa2023', 'app'] });
  }
  const alc = nums(rows, 'alcoholG');
  if (alc.length) {
    const a = mean(alc); const lim = alcoholLimit(st.profile.sex);
    parts.push({ label: '飲酒', value: `純アルコール ${a.toFixed(1)} g/日`, score: round(clamp(100 - (70 * a) / lim)), note: `${lim}g/日以上で生活習慣病のリスクが高まる。0gで100点、${lim}gで30点`, src: ['kenko21', 'alcohol', 'app'] });
  }
  const veg = nums(rows, 'veg');
  if (veg.length) parts.push({ label: '野菜', value: `${mean(veg).toFixed(1)} 皿/日`, score: round(clamp((mean(veg) / VEG_DISHES) * 100)), note: '1日350g(小鉢5皿)が目標', src: ['kenko21', 'balance', 'app'] });
  const pr = nums(rows, 'protein');
  if (pr.length) parts.push({ label: '主菜', value: `${mean(pr).toFixed(1)} 食/日`, score: round(clamp((mean(pr) / PROTEIN_MEALS) * 100)), note: '肉・魚・卵・大豆料理を3食でとる', src: ['balance', 'app'] });
  if (!parts.length) return { score: null, parts, missing: '毎日のチェックインをつけると評価されます' };
  return { score: round(mean(parts.map((p) => p.score))), parts };
}

function knowledge(st, quizTotal) {
  const answered = Object.values(st.quiz);
  if (!answered.length) return { score: null, parts: [], missing: '「学ぶ」タブのクイズに答えると評価されます' };
  const mastered = answered.filter((q) => q.last).length;
  const score = round((mastered / quizTotal) * 100);
  return { score, parts: [{ label: 'マスターした問題', value: `${mastered} / ${quizTotal} 問`, score, note: '最後に正解した問題をマスターと数える', src: ['app'] }] };
}

export const conditionStep = (score) => (score === null ? null : Math.round((score / 100) * CONDITION_MAX_STEP));

export function conditionStatus(st, quizTotal) {
  const age = ageOf(st.profile);
  const out = { body: body(st, age), recovery: recovery(st), habit: habit(st, age), knowledge: knowledge(st, quizTotal) };
  for (const v of Object.values(out)) v.step = conditionStep(v.score);
  return out;
}

// レベル n → n+1 に必要なXPは 100 + 50×(n−1)
export function levelFromXp(xp) {
  let level = 1; let need = 100; let rest = xp;
  while (rest >= need) { rest -= need; level++; need = 100 + 50 * (level - 1); }
  return { level, into: rest, need };
}
