// 今日のトレーニングを「おまかせ」で決める。
// 回復中(48時間以内に鍛えた)の部位は避け、減少中・もうすぐ減る・休みが長い・ランクが低い項目を優先し、
// 上半身・下半身・体幹が偏らないように選ぶ。準備運動 → 種目 → 有酸素(時間があれば)→ ストレッチの順に並べる。
// 回数・セット数・休みの長さは初心者向けの一般的な範囲(SOURCES の acsm2009・garber2011・pa2023)。メニューはゲーム用の提案で、医学的な指示ではない
import { PARTS, restState } from './standards.js';

export const PLACES = [['home', '自宅'], ['gym', 'ジム'], ['outdoor', '屋外']];
export const TIMES = [10, 20, 30, 45, 60];
export const COUNTS = [2, 3, 4, 5, 6];
export const FOCUSES = [['upper', '上半身'], ['lower', '下半身'], ['core', '体幹']];
export const DEFAULT_PREFS = { time: 20, place: 'home', count: null, focus: null }; // count・focus の null は「おまかせ」

// 種目。targets はチェックインのトレーニングのキー(先頭が主に鍛える所)。記録するとここに入る
// kind:reps=回数、time=秒数、cardio=有酸素(分)、stretch=ストレッチ(分)
export const EXERCISES = [
  // 上半身
  { key: 'pushup', name: '腕立て伏せ', targets: ['chest', 'arm'], places: ['home', 'gym', 'outdoor'], kind: 'reps', dose: '8〜15回', how: '手は肩幅より少し広く、頭からかかとまでまっすぐ', easier: 'きつければ膝をついて' },
  { key: 'dips', name: '椅子ディップス', targets: ['arm'], places: ['home', 'outdoor'], kind: 'reps', dose: '8〜12回', how: '椅子(公園ならベンチ)の縁に後ろ手をつき、肘を曲げ伸ばし', easier: '膝を曲げて足を近づける' },
  { key: 'curl', name: 'ダンベルカール', targets: ['arm'], places: ['gym'], kind: 'reps', dose: '10〜12回', how: '肘を体の横に固定して、ゆっくり上げ下げ' },
  { key: 'pike', name: 'パイクプッシュアップ', targets: ['shoulder', 'arm'], places: ['home', 'outdoor'], kind: 'reps', dose: '6〜10回', how: '腰を高く上げた「へ」の字の姿勢で、頭を床に近づける' },
  { key: 'sideraise', name: 'サイドレイズ', targets: ['shoulder'], places: ['home', 'gym'], kind: 'reps', dose: '12〜15回', how: 'ダンベル(自宅なら水の入ったペットボトル)を持ち、腕を肩の高さまで横に上げる' },
  { key: 'shoulderpress', name: 'ショルダープレス', targets: ['shoulder', 'arm'], places: ['gym'], kind: 'reps', dose: '8〜12回', how: 'マシンかダンベルで、頭の上へ押し上げる' },
  { key: 'chestpress', name: 'チェストプレス', targets: ['chest', 'arm'], places: ['gym'], kind: 'reps', dose: '8〜12回', how: 'マシンで胸の前へ押し出す。肩はすくめない' },
  { key: 'backext', name: 'バックエクステンション', targets: ['back'], places: ['home', 'gym'], kind: 'reps', dose: '10〜15回', how: 'うつ伏せで、上体をゆっくり起こして1秒止める' },
  { key: 'superman', name: 'スーパーマン', targets: ['back', 'glute'], places: ['home'], kind: 'time', dose: '20秒', how: 'うつ伏せで、両腕と両脚を同時に浮かせて保つ' },
  { key: 'latpull', name: 'ラットプルダウン', targets: ['back', 'arm'], places: ['gym'], kind: 'reps', dose: '10〜12回', how: 'バーを胸の上まで引き下ろす。反動を使わない' },
  { key: 'row', name: 'シーテッドロー', targets: ['back', 'arm'], places: ['gym'], kind: 'reps', dose: '10〜12回', how: '胸を張って、肘を後ろへ引く' },
  { key: 'invrow', name: '斜め懸垂', targets: ['back', 'arm'], places: ['outdoor'], kind: 'reps', dose: '6〜10回', how: '低い鉄棒を握って体をまっすぐにし、胸を引き寄せる' },
  // 体幹
  { key: 'plank', name: 'プランク', targets: ['abs'], places: ['home', 'gym', 'outdoor'], kind: 'time', dose: '30秒', how: '肘とつま先で支え、頭からかかとまでまっすぐ保つ(屋外は芝生の上か、ベンチに手をついて)', easier: '膝をついて' },
  { key: 'crunch', name: 'クランチ', targets: ['abs'], places: ['home', 'gym'], kind: 'reps', dose: '12〜20回', how: '膝を立て、おへそをのぞき込むように上体を少し起こす' },
  { key: 'legraise', name: 'レッグレイズ', targets: ['abs'], places: ['home', 'gym'], kind: 'reps', dose: '10〜15回', how: '仰向けで脚をそろえて上げ下げ。腰が反らない範囲で' },
  { key: 'kneetuck', name: 'ニートゥチェスト', targets: ['abs'], places: ['outdoor'], kind: 'reps', dose: '10〜15回', how: 'ベンチに浅く座って手で支え、膝を胸に引き寄せる' },
  { key: 'birddog', name: 'バードドッグ', targets: ['balance', 'back', 'abs'], places: ['home', 'gym'], kind: 'reps', dose: '左右8回', how: '四つ這いで、対角の手と脚を伸ばして2秒止める' },
  // 下半身
  { key: 'squat', name: 'スクワット', targets: ['quad', 'glute'], places: ['home', 'gym', 'outdoor'], kind: 'reps', dose: '12〜15回', how: '椅子に座るようにお尻を引く。膝はつま先と同じ向き' },
  { key: 'lunge', name: 'ランジ', targets: ['quad', 'glute', 'ham'], places: ['home', 'outdoor'], kind: 'reps', dose: '左右8〜10回', how: '大きく1歩踏み出して腰を落とし、元に戻る' },
  { key: 'bulgarian', name: 'ブルガリアンスクワット', targets: ['quad', 'glute'], places: ['home', 'gym'], kind: 'reps', dose: '左右8回', how: '後ろ足の甲を椅子(台)にのせ、前の脚でしゃがむ' },
  { key: 'stepup', name: 'ステップアップ', targets: ['quad', 'glute'], places: ['outdoor'], kind: 'reps', dose: '左右10回', how: 'ベンチや段差に片脚で上がり、ゆっくり下りる' },
  { key: 'hiplift', name: 'ヒップリフト', targets: ['glute', 'ham'], places: ['home', 'gym'], kind: 'reps', dose: '12〜15回', how: '仰向けで膝を立て、お尻を上げて1秒止める' },
  { key: 'slhiplift', name: '片脚ヒップリフト', targets: ['ham', 'glute'], places: ['home', 'gym'], kind: 'reps', dose: '左右8〜10回', how: '片脚を浮かせたままお尻を上げ下げ。かかとは遠めに置く' },
  { key: 'legpress', name: 'レッグプレス', targets: ['quad', 'glute'], places: ['gym'], kind: 'reps', dose: '10〜12回', how: '膝を伸ばし切らない範囲で押す' },
  { key: 'legcurl', name: 'レッグカール', targets: ['ham'], places: ['gym'], kind: 'reps', dose: '10〜12回', how: 'かかとをお尻へ引き寄せる' },
  { key: 'wallsit', name: '空気椅子', targets: ['quad'], places: ['home'], kind: 'time', dose: '30秒', how: '壁に背をつけ、膝を90度に曲げて保つ' },
  { key: 'calfraise', name: 'カーフレイズ', targets: ['calf'], places: ['home', 'gym', 'outdoor'], kind: 'reps', dose: '15〜20回', how: '壁や手すりに手を添え、かかとを高く上げ下げ' },
  // 瞬発力・敏捷性・バランス
  { key: 'squatjump', name: 'スクワットジャンプ', targets: ['power', 'quad'], places: ['home', 'gym', 'outdoor'], kind: 'reps', dose: '8〜10回', how: '軽くしゃがんで真上に跳ぶ。着地はやわらかく(集合住宅では静かに)' },
  { key: 'jumprope', name: 'なわとび', targets: ['power', 'calf'], places: ['outdoor'], kind: 'time', dose: '30〜60秒', how: '一定のリズムで、つま先で軽く跳ぶ' },
  { key: 'dash', name: 'ダッシュ', targets: ['power'], places: ['outdoor'], kind: 'time', dose: '10〜15秒', how: '短い距離を全力で。上り坂ならなお良い' },
  { key: 'sidestep', name: '反復横とび', targets: ['agility'], places: ['home', 'gym', 'outdoor'], kind: 'time', dose: '20秒', how: '左右に引いた線をサイドステップでまたぐ' },
  { key: 'skater', name: 'スケータージャンプ', targets: ['agility', 'glute'], places: ['home', 'gym', 'outdoor'], kind: 'reps', dose: '左右10回', how: '左右に大きく跳び、片脚でぴたりと止まる' },
  { key: 'zigzag', name: 'ジグザグ走', targets: ['agility'], places: ['outdoor'], kind: 'time', dose: '20秒', how: '目印を置き、細かいステップで左右に切り返す' },
  { key: 'onelegstand', name: '片足立ち(目を閉じて)', targets: ['balance'], places: ['home', 'gym', 'outdoor'], kind: 'time', dose: '左右30秒', how: '壁のそばで、手を腰に当てて立つ' },
  // 有酸素
  { key: 'stepbox', name: '踏み台昇降', targets: ['cardio'], places: ['home'], kind: 'cardio', how: '階段の1段目や台で、一定のリズムで上り下り' },
  { key: 'kneeup', name: 'その場もも上げ', targets: ['cardio'], places: ['home'], kind: 'cardio', how: '腕を振って、ももを高く上げて足踏み' },
  { key: 'bike', name: 'エアロバイク', targets: ['cardio'], places: ['gym'], kind: 'cardio', how: '息が弾むくらいの重さで' },
  { key: 'treadmill', name: 'トレッドミル', targets: ['cardio'], places: ['gym'], kind: 'cardio', how: '早歩き〜軽いジョギング' },
  { key: 'jog', name: 'ジョギング', targets: ['cardio'], places: ['outdoor'], kind: 'cardio', how: '会話ができるくらいの速さで' },
  { key: 'brisk', name: '早歩き', targets: ['cardio'], places: ['outdoor'], kind: 'cardio', how: '大股で、少し息が弾むくらいの速さで' },
];
const STRETCH = { key: 'stretch', name: 'ストレッチ', targets: ['flex'], kind: 'stretch', how: '太もも裏・お尻・胸・肩を、反動をつけずに各20〜30秒伸ばす' };
const WARMUP = {
  home: 'その場足踏み・肩回し・軽いスクワット',
  gym: 'バイクかウォーキングを軽く・肩回し',
  outdoor: 'ゆっくり歩く・肩回し・軽い屈伸',
};

// 時間ごとの組み立て(分)。rest はセット間の休み(秒)。短い時間は休みを短くして回す
const PRESETS = {
  10: { warm: 1, cardio: 0, stretch: 1, count: 3, rest: 20 },
  20: { warm: 3, cardio: 0, stretch: 3, count: 4, rest: 45 },
  30: { warm: 3, cardio: 5, stretch: 4, count: 5, rest: 60 },
  45: { warm: 5, cardio: 8, stretch: 5, count: 5, rest: 60 },
  60: { warm: 5, cardio: 12, stretch: 8, count: 6, rest: 60 },
};
const WORK = 40; // 1セットの運動の長さ(秒)の目安
const SWITCH = 0.5; // 種目の切り替え(分)

// どの部位・能力の状態で優先度を決めるか(有酸素は持久力、ストレッチは柔軟性)
const STATUS_KEY = { cardio: 'endurance', flex: 'flex', power: 'power', agility: 'agility', balance: 'balance' };
const REGION = { arm: 'upper', shoulder: 'upper', chest: 'upper', back: 'upper', abs: 'core', balance: 'core', glute: 'lower', quad: 'lower', ham: 'lower', calf: 'lower', power: 'move', agility: 'move', cardio: 'move' };
const FOCUS = { upper: ['arm', 'shoulder', 'chest', 'back'], lower: ['glute', 'quad', 'ham', 'calf', 'power', 'agility'], core: ['abs', 'back', 'balance'] };
const PART_KEYS = PARTS.map((p) => p.key);

// 日付と「別のメニュー」の回数から決まる乱数(同じ条件なら同じメニューになる)
function rng(seedText) {
  let h = 2166136261;
  for (const c of seedText) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
  return () => {
    h = Math.imul(h ^ (h >>> 15), 2246822507); h = Math.imul(h ^ (h >>> 13), 3266489909);
    return ((h ^= h >>> 16) >>> 0) / 4294967296;
  };
}

export const AVOID_NAME = { arm: '腕', shoulder: '肩', chest: '胸', back: '背中', abs: '腹', glute: 'お尻', quad: '太もも前', ham: '太もも裏', calf: 'ふくらはぎ', power: 'ジャンプ・ダッシュ', agility: '切り返し', balance: '片脚立ち', cardio: '有酸素(走る・歩く・踏み台)' };
const statusOf = (phys, key) => phys.parts[key] ?? phys.abilities[STATUS_KEY[key] ?? key];

// 優先度。理由(why)は画面に出す。jitter はゆらぎの大きさ(「別のメニュー」を押すほど大きくして、違う種目が出やすくする)
function priority(phys, key, avgStep, minStep, rnd, jitter = 8) {
  const s = statusOf(phys, key);
  const r = restState(s);
  const why = [];
  let sc = 0;
  if (s.decaying) { sc += 50; why.push('減少中'); } else if (r.label.startsWith('あと')) { sc += 30; why.push(r.label); }
  if (s.trainedSince === null) { sc += 12; why.push('まだ鍛えた記録なし'); } else {
    sc += Math.min(s.trainedSince, 10) * 2;
    if (s.trainedSince >= 4 && !why.length) why.push(`${s.trainedSince}日休み`);
  }
  sc += (avgStep - s.step) * 3;
  if (s.step <= minStep + 1) why.push('弱み');
  const recovering = r.label === '回復中';
  if (recovering) sc -= 100;
  if (!why.length) why.push(recovering ? '回復中' : '鍛えどき');
  return { key, sc: sc + rnd() * jitter, why, recovering };
}

function doseText(ex, sets, minutes) {
  if (ex.kind === 'cardio') return `${minutes}分(少し息が弾むくらい)`;
  if (ex.kind === 'stretch') return `${minutes}分`;
  return `${ex.dose} × ${sets}セット`;
}

// phys:physicalStatus の結果、prefs:{ time, place, count, focus }、seed:乱数の元(日付+回数)
// care:けが・痛みの記録から外す鍛える所(care.js の careForPlan。{ avoid, why })
export function buildPlan(phys, prefs, seed, reroll = 0, care = { avoid: [], why: [] }) {
  const p = { ...DEFAULT_PREFS, ...prefs };
  const pre = PRESETS[p.time] ?? PRESETS[20];
  const rnd = rng(`${seed}|${p.time}|${p.place}|${p.count}|${p.focus}`);
  const avoid = new Set(care.avoid);
  const pool = EXERCISES.filter((e) => e.places.includes(p.place) && !e.targets.some((t) => avoid.has(t)));

  // 候補:部位9つ+瞬発力・敏捷性・バランス(短い時間のときは有酸素も種目の1つとして候補にする)
  let keys = [...PART_KEYS, 'power', 'agility', 'balance', ...(pre.cardio ? [] : ['cardio'])].filter((k) => !avoid.has(k));
  if (p.focus) keys = keys.filter((k) => FOCUS[p.focus].includes(k));
  keys = keys.filter((k) => pool.some((e) => e.targets[0] === k || (e.targets.includes(k) && PART_KEYS.includes(k))));
  const steps = keys.map((k) => statusOf(phys, k).step);
  const avg = steps.reduce((a, b) => a + b, 0) / (steps.length || 1); const min = Math.min(...steps);
  const jitter = Math.min(8 + reroll * 12, 44);
  const pr = Object.fromEntries(keys.map((k) => [k, priority(phys, k, avg, min, rnd, jitter)]));

  const count = p.count ?? pre.count;
  const mainMin = p.time - pre.warm - pre.cardio - pre.stretch;
  const perSet = (WORK + pre.rest) / 60;
  const sets = Math.max(1, Math.min(4, Math.round((mainMin / count - SWITCH) / perSet)));
  const slotMin = Math.max(2, Math.round(sets * perSet + SWITCH)); // 有酸素を種目の1つにするときの分数

  // 上半身・下半身・体幹が偏らないよう、同じ区分を選ぶたびに優先度を15下げる(減少中の+50でも3つ目は他の区分が勝つ)。動き(瞬発・敏捷・有酸素)は3種目に1つまで
  const picked = []; const covered = new Set(); const used = new Set(); const regionN = {};
  const maxMove = p.focus ? count : Math.ceil(count / 3);
  for (let round = 0; picked.length < count && round < 2; round++) {
    while (picked.length < count) {
      const cand = keys.filter((k) => !covered.has(k) || round > 0)
        .filter((k) => REGION[k] !== 'move' || picked.filter((x) => REGION[x.target] === 'move').length < maxMove)
        .map((k) => ({ k, v: pr[k].sc - (regionN[REGION[k]] ?? 0) * 15 - (round && covered.has(k) ? 40 : 0) }))
        .sort((a, b) => b.v - a.v);
      let found = false;
      for (const { k } of cand) {
        // 主に鍛える所が合う種目を優先し、回復中の部位も一緒に使う種目は避ける
        const opts = pool.filter((e) => e.targets.includes(k) && !used.has(e.key) && e.kind !== 'stretch')
          .map((e) => ({ e, v: (e.targets[0] === k ? 10 : 0) - e.targets.filter((t) => pr[t]?.recovering && t !== k).length * 20 + rnd() * 3 }))
          .sort((a, b) => b.v - a.v);
        if (!opts.length) { covered.add(k); continue; }
        const ex = opts[0].e;
        used.add(ex.key); ex.targets.forEach((t) => covered.add(t));
        regionN[REGION[k]] = (regionN[REGION[k]] ?? 0) + 1;
        picked.push({ type: ex.kind === 'cardio' ? 'cardio' : 'main', ex, target: k, sets, why: pr[k].why, recovering: pr[k].recovering,
          min: ex.kind === 'cardio' ? slotMin : sets * perSet + SWITCH });
        found = true; break;
      }
      if (!found) break;
    }
  }

  const items = [{ type: 'warm', name: '準備運動', how: WARMUP[p.place], min: pre.warm, targets: [] }];
  for (const x of picked) {
    items.push({ type: x.type, slot: true, key: x.ex.key, name: x.ex.name, how: x.ex.how, easier: x.ex.easier, targets: x.ex.targets,
      dose: doseText(x.ex, x.sets, Math.round(x.min)), min: x.min, why: x.why, recovering: x.recovering });
  }
  const cardioEx = pool.filter((e) => e.kind === 'cardio').sort(() => rnd() - 0.5)[0];
  if (pre.cardio && cardioEx) {
    const ex = cardioEx;
    const cp = priority(phys, 'cardio', avg, min, rnd);
    items.push({ type: 'cardio', key: ex.key, name: ex.name, how: ex.how, targets: ex.targets, dose: doseText(ex, 0, pre.cardio), min: pre.cardio, why: cp.why });
  }
  items.push({ type: 'stretch', key: STRETCH.key, name: STRETCH.name, how: STRETCH.how, targets: STRETCH.targets, dose: doseText(STRETCH, 0, pre.stretch), min: pre.stretch });

  const total = Math.round(items.reduce((a, x) => a + x.min, 0));
  const notes = [];
  if (care.why.length) notes.push(`${care.why.join('・')}のため、${[...avoid].map((k) => AVOID_NAME[k] ?? k).join('・')}を使う種目を外しました。痛みが出る動きはやめてください`);
  if (pre.cardio && !cardioEx) notes.push('けがの部位に負担がかかるため、有酸素運動は入れていません');
  if (picked.length < count) notes.push(`この場所でできる種目が足りないため、${picked.length}種目にしました`);
  if (total > p.time + 3) notes.push(`種目が多いため、予定より長い約${total}分になります。時間がなければ種目を減らしてください`);
  if (picked.some((x) => x.recovering)) notes.push('回復中の部位も入っています。きつければ軽めに');
  return { prefs: p, items, total, rest: pre.rest, sets, notes };
}

// 記録するトレーニングのキー(チェックインの「鍛えた部位・そのほかのトレーニング」)と、有酸素の分数
export function planRecord(plan, done) {
  const trained = new Set(); let cardioMin = 0;
  plan.items.forEach((x, i) => {
    if (!done[i] || x.type === 'warm') return;
    x.targets.forEach((t) => trained.add(t));
    if (x.type === 'cardio') cardioMin += Math.round(x.min);
  });
  return { trained: [...trained], cardioMin };
}
