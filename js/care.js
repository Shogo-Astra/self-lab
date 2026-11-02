// けが・体の痛み・体調不良の記録と、ケアの目安。
// 日数の目安は、出典の本文で確かめられたものだけを書く(出典がないものは日数を出さず、受診の目安だけを出す)。
// 内容は一般的な目安で、診断ではない。迷ったら医療機関へ。
// けが(cat: 'injury')を記録している間は、その部位のポイントが毎日1%減る(standards.js の INJURY_DECAY。2026-11-02 ユーザーが決定)。

// 体の場所。parts はけがのときにポイントが減る部位(standards.js の PARTS のキー)、
// avoid はおまかせで外す鍛える所(omakase.js の種目の targets。部位のほか power・agility・balance・cardio)
export const AREAS = [
  { key: 'neck', name: '首', parts: [], avoid: ['shoulder'] },
  { key: 'shoulder', name: '肩', parts: ['shoulder'], avoid: ['shoulder', 'chest'] },
  { key: 'arm', name: '肘・腕', parts: ['arm'], avoid: ['arm', 'chest', 'shoulder'] },
  { key: 'hand', name: '手首・指', parts: ['arm'], avoid: ['arm', 'chest', 'shoulder'] },
  { key: 'chest', name: '胸', parts: ['chest'], avoid: ['chest'] },
  { key: 'back', name: '腰・背中', parts: ['back'], avoid: ['back', 'abs', 'power', 'agility'] },
  { key: 'abs', name: 'お腹', parts: ['abs'], avoid: ['abs'] },
  { key: 'hip', name: '股関節・お尻', parts: ['glute'], avoid: ['glute', 'power', 'agility'] },
  { key: 'knee', name: '膝・太もも前', parts: ['quad'], avoid: ['quad', 'power', 'agility', 'cardio'] },
  { key: 'ham', name: '太もも裏', parts: ['ham'], avoid: ['ham', 'power', 'agility', 'cardio'] },
  { key: 'calf', name: 'ふくらはぎ・アキレス腱', parts: ['calf'], avoid: ['calf', 'power', 'agility', 'cardio', 'balance'] },
  { key: 'ankle', name: '足首・足', parts: ['calf'], avoid: ['calf', 'quad', 'power', 'agility', 'cardio', 'balance'] },
];

// RICE処置(JSOA 3)。四肢のけが(捻挫・肉離れなど)の応急処置
const RICE = '応急処置はRICE:安静(固定)・冷却(氷を袋に入れて15〜20分冷やし、痛みが戻ったらまた冷やす。1〜3日)・圧迫(弾性包帯などで軽く)・挙上(心臓より高く)';
const EMERGENCY = '意識がない、頭・首・背中のけが、大量の出血、関節の脱臼、骨折を疑う大きな変形があるときは、すぐに救急車か医師を呼び、むやみに動かさない';

// 種類。cat:injury=けが(ポイントが減る)・pain=痛み(減らない)・condition=体調(おまかせは休みの提案だけ)
// span:回復の目安(出典で確かめた数字だけ)、days:目安の日数(過ぎたら知らせる。出典の数字の上限)、care:すること、see:受診の目安
export const ISSUE_TYPES = [
  {
    key: 'sprain', cat: 'injury', name: '捻挫',
    span: '足首の捻挫では、靱帯の安定性が反対側と同じに戻るまで、軽い捻挫(1度)で約2週間、靱帯の部分断裂・完全断裂(2・3度)で約6週間かかったという研究があります。痛みが消えても、安定性はまだ戻っていないことがあります',
    days: 14,
    care: [RICE, '重い捻挫(3度)では2〜3週間固定することがあります', 'スポーツへの復帰は段階的に:①悪化させない(RICE)→ ②足首の動き・筋力を戻す → ③バランス練習、ジョギング・ダッシュ・切り返し。リハビリをせずに復帰すると、捻挫を繰り返しやすくなります'],
    see: ['体重をかけられない、腫れが強い、内出血がある場合は受診を(子どもは小さな骨折を伴うことが多い)', EMERGENCY],
    src: ['jsoa2', 'jsoa3', 'uchida2025'],
  },
  {
    key: 'strain', cat: 'injury', name: '肉離れ',
    span: null,
    care: [RICE, 'ストレッチしたときの痛みがなくなり、反対側と同じ「伸ばされている感じ」になるまで、ジャンプやダッシュは避ける'],
    see: ['重症度によって必要な治療が変わるため、医師の診断を受けてください', EMERGENCY],
    src: ['jsoa5', 'jsoa3'],
  },
  {
    key: 'finger', cat: 'injury', name: '突き指',
    span: null,
    care: [RICE],
    see: ['「突き指」には骨折・脱臼・腱や靱帯の断裂が含まれることがあり、すぐに手術が必要なこともあります。軽く考えず、整形外科で診断を受けてください'],
    src: ['joaFinger', 'jsoa3'],
  },
  {
    key: 'lowback', cat: 'injury', name: 'ぎっくり腰',
    span: null,
    care: ['腰に負担がかかる姿勢(中腰など)を避ける'],
    see: ['安静にしても痛みが軽くならない、だんだん悪化する、熱がある、脚がしびれる・力が入らない、尿が漏れる場合は、すみやかに整形外科へ', 'いつもと違う強い腰痛のときは、整形外科で正しい診断を'],
    src: ['joaBack'],
  },
  {
    key: 'bruise', cat: 'injury', name: '打撲',
    span: null,
    care: [RICE],
    see: [EMERGENCY, '痛みや腫れが強い、続く場合は整形外科へ'],
    src: ['jsoa3'],
  },
  {
    key: 'otherInjury', cat: 'injury', name: 'そのほかのけが',
    span: null,
    care: [RICE],
    see: [EMERGENCY, '痛みや腫れが強い、続く場合は整形外科へ'],
    src: ['jsoa3'],
  },
  {
    key: 'doms', cat: 'pain', name: '筋肉痛',
    span: '運動による筋肉痛は、運動の24〜72時間後に一番強くなり、5〜7日で消えるとされています',
    days: 7,
    care: ['強い筋肉痛が出たあとの1〜2日は、運動の強さと時間を減らす'],
    see: ['運動中に関節や筋肉の強い痛みが出たら、すぐに中止'],
    src: ['ranchordas2020', 'cheung2003', 'pa2023'],
  },
  {
    key: 'nechigae', cat: 'pain', name: '寝違え',
    span: '起きたときに痛くなり、数時間から数日で良くなっていくのが一般的です',
    days: 3,
    care: ['痛い方向には動かさない', '痛みを我慢してのストレッチは逆効果のことがある'],
    see: ['治らない場合や、手足のしびれ・動かしにくさがある場合は整形外科へ'],
    src: ['joaNeck'],
  },
  {
    key: 'ache', cat: 'pain', name: '痛み・違和感',
    span: null,
    care: ['痛みが出る動きは避ける', '運動中に関節や筋肉の強い痛みが出たら、すぐに中止'],
    see: ['足腰の痛みが強い日は無理に運動せず休み、必要に応じて受診を'],
    src: ['pa2023'],
  },
  // 体調:厚生労働省「身体活動・運動を安全に行うためのポイント」表3 運動前の体調確認。1つでも当てはまれば、無理に運動をせず休む
  {
    key: 'cold', cat: 'condition', name: '風邪気味(鼻・のど・咳)',
    span: '風邪(感冒)は、発症から3日目前後が症状のピークで、7〜10日で良くなっていくとされています。咳は3週間ほど続くこともあります',
    days: 10,
    care: ['無理に運動せず休養をとる'],
    see: ['症状がだんだん悪くなる、いったん良くなってから再び悪くなる場合は、細菌の感染症を合併していることがあるため受診を'],
    src: ['tebiki4', 'pa2023'],
  },
  { key: 'fever', cat: 'condition', name: '熱がある', span: null, care: ['無理に運動せず休養をとる'], see: ['必要に応じて医療機関を受診'], src: ['pa2023'] },
  { key: 'tired', cat: 'condition', name: '体がだるい・過労気味', span: null, care: ['無理に運動せず休養をとる'], see: ['必要に応じて医療機関を受診'], src: ['pa2023'] },
  { key: 'headache', cat: 'condition', name: '頭痛・めまい・耳鳴り', span: null, care: ['無理に運動せず休養をとる'], see: ['必要に応じて医療機関を受診'], src: ['pa2023'] },
  { key: 'stomach', cat: 'condition', name: '吐き気・腹痛・下痢・食欲がない', span: null, care: ['無理に運動せず休養をとる'], see: ['必要に応じて医療機関を受診'], src: ['pa2023'] },
  { key: 'chest', cat: 'condition', name: '胸の痛み・動悸・息切れ', span: null, care: ['運動はしない。運動中に胸の痛み・動悸が出たら、すぐに中止'], see: ['必要に応じて医療機関を受診'], src: ['pa2023'] },
  { key: 'nosleep', cat: 'condition', name: '睡眠不足', span: null, care: ['無理に運動せず休養をとる'], see: [], src: ['pa2023'] },
  { key: 'hangover', cat: 'condition', name: '二日酔い', span: null, care: ['無理に運動せず休養をとる'], see: [], src: ['pa2023'] },
];

export const CATS = [['injury', 'けが'], ['pain', '痛み'], ['condition', '体調']];
export const typeOf = (key) => ISSUE_TYPES.find((t) => t.key === key);
export const areaOf = (key) => AREAS.find((a) => a.key === key);

// その日に続いている記録(start ≦ day、治った日 end より前)
export const activeOn = (issues, day) => (issues ?? []).filter((x) => x.start <= day && (!x.end || day < x.end));

// けがでポイントが減る部位(その日)
export function injuredParts(issues, day) {
  const out = new Set();
  for (const x of activeOn(issues, day)) if (typeOf(x.type)?.cat === 'injury') areaOf(x.area)?.parts.forEach((p) => out.add(p));
  return out;
}

// おまかせへの影響:avoid は外す鍛える所、rest は体調不良(休みの提案だけにする)
export function careForPlan(issues, day) {
  const act = activeOn(issues, day);
  const avoid = new Set(); const why = [];
  for (const x of act) {
    const t = typeOf(x.type); const a = areaOf(x.area);
    if (t?.cat === 'condition' || !a) continue;
    a.avoid.forEach((k) => avoid.add(k));
    why.push(`${a.name}(${t.name})`);
  }
  const rest = act.filter((x) => typeOf(x.type)?.cat === 'condition').map((x) => typeOf(x.type).name);
  return { avoid: [...avoid], why, rest };
}

// 記録の見出し(例:足首・足の捻挫、熱がある)
export const issueTitle = (x) => {
  const t = typeOf(x.type); const a = areaOf(x.area);
  return t?.cat === 'condition' || !a ? t?.name ?? '' : `${a.name}の${t?.name ?? ''}`;
};
