import {
  SOURCES, MEASURES, MEASURE_GROUPS, PARTS, ABILITIES, CONDITIONS, TRAININGS, DRINKS, STANDUP_LEVELS,
  RANKS, MAX_STEP, C_MINUS, NO_MEASURE_CEIL, THRESH, GAIN, GAIN_SOON, WEEK_CAP, SELF_MAX_STEP, SELF_DEFAULT_STEP,
  physicalStatus, conditionStatus, restState, rankLabel, letterOf, levelFromXp, testInfo, strengthsWeaknesses,
  TRAINING_EFFECTS, RELATED, LEG_KEYS, sourcesOf, SPORTS, SPORT_WEIGHT, exerciseMinutes,
  series, isoDate, lastDays, ageOf, bmiRange, waistLimit, stepsTarget, alcoholLimit, locomoTwoStep, locomoStandup,
} from './standards.js';
import { TIPS, PART_TIPS, QUIZ, QUIZ_CATS } from './content.js';
import { radar, bodyMap, lineChart, barChart } from './charts.js';
import { encodeCard, decodeCard, findCode, newId, upgradeParts } from './share.js';
import { CHANGELOG, isNewer } from './changelog.js';
import { HEALTH_KEYS, HEALTH_TEMPLATE, SAMPLE_MARK, parseHealth } from './health.js';

const VERSION = CHANGELOG[0].version;
const KEY = 'sp-health-v1';
const DEFAULT = { v: 1, profile: null, measures: [], daily: {}, quiz: {}, targets: {}, xp: 0, awarded: {}, me: null, friends: {}, selfInit: null, decayNotified: [], seenVersion: null, healthLast: null };

// ---------- 保存 ----------

function load() {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY));
    return raw ? { ...structuredClone(DEFAULT), ...raw } : structuredClone(DEFAULT);
  } catch {
    return structuredClone(DEFAULT);
  }
}
let state = load();
let cache = null;
const save = () => { cache = null; localStorage.setItem(KEY, JSON.stringify(state)); };

// 身体能力は記録を日ごとにたどって計算するので、描画のたびに作り直さないよう覚えておく
function status() {
  if (!state.profile) return null;
  if (!cache || cache.day !== today()) {
    cache = { day: today(), phys: physicalStatus(state), cond: conditionStatus(state, QUIZ.length) };
  }
  return cache;
}

const ui = {
  tab: state.profile ? 'home' : 'settings', logMode: 'daily', logDate: isoDate(new Date()),
  detail: null, quiz: null, friend: null, incoming: null, setup: false, health: null, healthGuide: false,
};
// iPhoneではホーム画面のアプリとSafariで保存場所が別になる
const standalone = navigator.standalone === true || matchMedia('(display-mode: standalone)').matches;

// ---------- 小道具 ----------

const $ = (sel) => document.querySelector(sel);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const today = () => isoDate(new Date());
const md = (iso) => { const [, m, d] = iso.split('-'); return `${Number(m)}/${Number(d)}`; };
const shuffle = (a) => { const b = [...a]; for (let i = b.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [b[i], b[j]] = [b[j], b[i]]; } return b; };
const srcName = (k) => SOURCES[k]?.name ?? k;
const srcCheck = (k) => SOURCES[k]?.check;
const pct = (step) => (step === null || step === undefined ? null : (step / MAX_STEP) * 100);
const badge = (step, big = false) => `<span class="badge lv-${letterOf(step) ?? 'none'}${big ? ' big' : ''}">${rankLabel(step)}</span>`;
const stateChip = (s) => { const r = restState(s); return `<span class="state ${r.tone}">${r.label}</span>`; };

// 今の段階の中で、次の段階にどこまで近づいたか(0〜100)
function progress(s) {
  if (s.step >= MAX_STEP) return 100;
  if (s.atCeil) return 100;
  const lo = THRESH[s.step]; const hi = THRESH[s.step + 1];
  return Math.max(0, Math.min(100, ((s.pts - lo) / (hi - lo)) * 100));
}

function fmtMeasure(key, v) {
  const m = MEASURES[key];
  if (!m) return String(v);
  if (key === 'standup') return STANDUP_LEVELS[v] ?? String(v);
  if (key === 'twostep' && state.profile?.height) return `${v} cm(2ステップ値 ${(v / state.profile.height).toFixed(2)})`;
  return `${v} ${m.unit}`;
}

function toast(msg) {
  const el = $('#toast');
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(toast.t);
  toast.t = setTimeout(() => el.classList.remove('show'), 2400);
}

function gainXp(n, awardKey) {
  if (awardKey) {
    if (state.awarded[awardKey]) return 0;
    state.awarded[awardKey] = 1;
  }
  const before = levelFromXp(state.xp).level;
  state.xp += n;
  const after = levelFromXp(state.xp).level;
  if (after > before) setTimeout(() => toast(`レベルアップ! Lv.${after}`), 2500);
  return n;
}

function streak() {
  const d = new Date();
  if (!state.daily[isoDate(d)]) d.setDate(d.getDate() - 1);
  let n = 0;
  while (state.daily[isoDate(d)]) { n++; d.setDate(d.getDate() - 1); }
  return n;
}

const srcList = (keys) => (keys?.length
  ? `<p class="src">出典:${keys.map((k) => esc(srcName(k))).join(' / ')}${keys.some(srcCheck) ? ' <span class="chk">【要確認あり】</span>' : ''}</p>`
  : '');
const tipList = (tips) => tips.map((t) => `<details class="tip"><summary>${esc(t.title)}</summary><p>${esc(t.body)}</p>${srcList(t.src)}</details>`).join('');

// 自己評価する12項目(筋力の6部位と、筋力以外の6能力)
const SELF_ITEMS = [...PARTS.map((p) => ({ ...p, group: 'part' })), ...ABILITIES.filter((a) => a.key !== 'strength').map((a) => ({ ...a, group: 'ability' }))];
const DECAY_NOTE = '筋力の部位・持久力・柔軟性は5日、瞬発力・敏捷性・バランスは8日、歩く力は4日';

const targetName = (k) => (PARTS.find((p) => p.key === k) ?? ABILITIES.find((a) => a.key === k))?.name ?? k;
const trainingName = (k) => TRAININGS.find((t) => t.key === k)?.label ?? k;

// トレーニングと、ポイントが入る項目の関係(直接=全部、関係=半分)
function effectsTable() {
  return `<table class="cmp eff"><thead><tr><th>トレーニング</th><th>全部(+${GAIN}pt)</th><th>半分(+${GAIN * RELATED}pt)</th></tr></thead><tbody>
    ${Object.entries(TRAINING_EFFECTS).map(([t, eff]) => {
      const full = Object.keys(eff).filter((k) => eff[k] === 1).map(targetName);
      const half = Object.keys(eff).filter((k) => eff[k] < 1).map(targetName);
      return `<tr><td>${trainingName(t)}</td><td>${full.join('・')}</td><td>${half.join('・') || '—'}</td></tr>`;
    }).join('')}
  </tbody></table>
  <table class="cmp eff"><thead><tr><th>スポーツ</th><th>関わる能力・部位すべてに半分(+${GAIN * SPORT_WEIGHT}pt)</th></tr></thead><tbody>
    ${SPORTS.map((x) => `<tr><td>${x.label}</td><td>${[...x.main, ...x.related].map(targetName).join('・')}</td></tr>`).join('')}
  </tbody></table>
  <p class="t-muted small">息が弾む運動の分数を入れた日は「有酸素」、歩数が目安以上の日は「歩く力」に全部(歩く力は+3pt)入ります。同じ日に同じ項目へ複数のトレーニングやスポーツから入るときは、一番大きい分だけが入ります。</p>`;
}

// ---------- ステータス ----------

function viewHome() {
  const S = status();
  if (!S) {
    return `<section class="card"><h2>はじめに</h2><p>年代・性別ごとの基準値で評価するため、まずプロフィールを設定してください。</p>
      <button class="btn primary" data-action="tab" data-tab="settings">プロフィールを設定</button></section>`;
  }
  const { phys, cond } = S;
  const lv = levelFromXp(state.xp);
  const axes = ABILITIES.map((a) => ({ key: a.key, name: a.name, value: pct(phys.abilities[a.key].step), label: rankLabel(phys.abilities[a.key].step) }));
  const loggedToday = !!state.daily[today()];

  // 部位の今日の状態
  const groups = {};
  for (const p of PARTS) {
    const r = restState(phys.parts[p.key]);
    const k = r.tone === 'bad' || r.tone === 'warn' ? 'warn' : r.tone === 'good' ? 'good' : r.tone === 'rest' ? 'rest' : null;
    if (k) (groups[k] ??= []).push(p.name);
  }

  return `
  <section class="hero card">
    <div class="hero-top">
      <div><p class="t-label">レベル</p><p class="lv">Lv.${lv.level}</p></div>
      <div class="hero-rank"><p class="t-label">総合ランク</p><p class="rank-big">${rankLabel(phys.overallStep)}</p></div>
    </div>
    <div class="xpbar" role="progressbar" aria-valuemin="0" aria-valuemax="${lv.need}" aria-valuenow="${lv.into}"><i style="width:${(lv.into / lv.need) * 100}%"></i></div>
    <p class="t-muted">次のレベルまで ${lv.need - lv.into} XP ・ 連続記録 ${streak()} 日</p>
  </section>
  ${state.selfInit ? '' : `<button class="card cta" data-action="setup-open">自己評価で、今の自分のランクを決めましょう <b>はじめる</b></button>`}
  ${decayInfo(phys)}
  ${loggedToday ? '' : `<button class="card cta" data-action="tab" data-tab="log">今日のチェックインがまだです <b>記録する +20XP</b></button>`}
  <button class="card today-parts" data-action="detail" data-stat="strength">
    <h3>今日の部位</h3>
    ${groups.good ? `<p><span class="state good">鍛えどき</span>${groups.good.join('・')}</p>` : ''}
    ${groups.rest ? `<p><span class="state rest">回復中</span>${groups.rest.join('・')}</p>` : ''}
    ${groups.warn ? `<p><span class="state warn">要注意</span>${groups.warn.join('・')}</p>` : ''}
    ${!groups.good && !groups.rest && !groups.warn ? '<p class="t-muted">チェックインで鍛えた部位を記録すると、回復状況が表示されます</p>' : ''}
  </button>
  <section class="card"><h3>身体能力</h3>${radar(axes, { refAt: pct(C_MINUS), refLabel: 'C−' })}<p class="t-muted center small">点線の輪がC−(これより上は休みすぎると減少)。項目をタップすると詳細</p>
    ${swHtml(SELF_ITEMS.map((x) => ({ key: x.key, name: x.name, step: (x.group === 'part' ? phys.parts : phys.abilities)[x.key].step })))}</section>
  <section class="card list">
    ${ABILITIES.map((a) => {
      const s = phys.abilities[a.key];
      return `<button class="row" data-action="detail" data-stat="${a.key}">
        ${badge(s.step)}
        <span class="row-name">${a.name}${a.key === 'strength' ? '<small>6部位の平均</small>' : stateChip(s)}</span>
        <span class="meter"><i style="width:${a.key === 'strength' ? pct(s.step) : progress(s)}%"></i></span>
        <span class="row-val">${rankLabel(s.step)}</span>
      </button>`;
    }).join('')}
  </section>
  <section class="card list"><h3>コンディション</h3>
    ${CONDITIONS.map((c) => {
      const r = cond[c.key];
      return `<button class="row" data-action="detail" data-stat="${c.key}">
        ${badge(r.step)}<span class="row-name">${c.name}</span>
        <span class="meter"><i style="width:${r.score ?? 0}%"></i></span><span class="row-val">${r.score ?? '—'}</span>
      </button>`;
    }).join('')}
  </section>
  <p class="t-muted center small">ランクと点数はゲーム用の目安で、医学的な判定ではありません。</p>`;
}

function swHtml(items) {
  const sw = strengthsWeaknesses(items);
  if (!sw) return '';
  const li = (x) => `<li>${esc(x.name)} <b>${rankLabel(x.step)}</b></li>`;
  return `<div class="sw-box"><div><h4>強み</h4><ul>${sw.top.map(li).join('')}</ul></div><div><h4>弱み</h4><ul>${sw.bottom.map(li).join('')}</ul></div></div>`;
}

// 新しく C− 以上になった項目があれば、休みすぎると減ることを知らせる
function decayInfo(phys) {
  const fresh = SELF_ITEMS.filter((x) => (x.group === 'part' ? phys.parts : phys.abilities)[x.key].rawStep >= C_MINUS && !state.decayNotified.includes(x.key));
  if (!fresh.length) return '';
  return `<section class="card info" role="note"><h3>お知らせ:C− からはポイントが減ることがあります</h3>
    <p>${fresh.map((x) => esc(x.name)).join('・')} が C− 以上になりました。C− 以上の項目は、運動しない日が続くとポイントが減っていきます(${DECAY_NOTE}、鍛えない日が続くと始まります)。C− より下には減りません。</p>
    <button class="btn wide" data-action="decay-ok" data-keys="${fresh.map((x) => x.key).join(',')}">わかった</button></section>`;
}

// ---------- 初期設定の自己評価 ----------

function selfPreview(steps) {
  const ab = (k) => (k === 'strength' ? Math.floor(PARTS.reduce((a, p) => a + steps[p.key], 0) / PARTS.length) : steps[k]);
  const axes = ABILITIES.map((a) => ({ key: a.key, name: a.name, value: pct(ab(a.key)), label: rankLabel(ab(a.key)) }));
  const decayN = SELF_ITEMS.filter((x) => steps[x.key] >= C_MINUS).length;
  return `<h3>あなたのステータス</h3>${radar(axes, { interactive: false, refAt: pct(C_MINUS), refLabel: 'C−' })}
    ${swHtml(SELF_ITEMS.map((x) => ({ key: x.key, name: x.name, step: steps[x.key] })))}
    <p class="t-muted small center">${decayN ? `C− 以上(減少あり):${decayN}項目` : 'C− 以上の項目はありません(減少なし)'}</p>`;
}

function readSelfSteps() {
  return Object.fromEntries(SELF_ITEMS.map((x) => [x.key, Number(document.querySelector(`[data-self="${x.key}"]`)?.value ?? SELF_DEFAULT_STEP)]));
}

function viewSetup() {
  const S = status();
  const cur = (x) => {
    if (!state.selfInit || !S) return SELF_DEFAULT_STEP;
    return Math.min(SELF_MAX_STEP, (x.group === 'part' ? S.phys.parts : S.phys.abilities)[x.key].step);
  };
  const steps = Object.fromEntries(SELF_ITEMS.map((x) => [x.key, cur(x)]));
  const row = (x) => `<div class="srow">
    <div class="srow-top"><span>${x.name}</span><span class="state warn" data-tag="${x.key}" ${steps[x.key] >= C_MINUS ? '' : 'hidden'}>減少あり</span><b data-out="${x.key}">${RANKS[steps[x.key]]}</b></div>
    <input type="range" name="self_${x.key}" min="0" max="${SELF_MAX_STEP}" step="1" value="${steps[x.key]}" data-self="${x.key}" aria-label="${x.name}のランク">
    <div class="srow-scale"><span style="left:0">G−</span><span style="left:${(C_MINUS / SELF_MAX_STEP) * 100}%">C−</span><span style="left:100%">${RANKS[SELF_MAX_STEP]}</span></div>
  </div>`;
  return `<div class="sheet" role="dialog" aria-label="自己評価">
    <header class="sheet-head"><button class="btn ghost" data-action="setup-close">‹ 閉じる</button><h2>自己評価</h2><span></span></header>
    <section class="card"><p>今の自分の体力を、項目ごとに <b>G− 〜 ${RANKS[SELF_MAX_STEP]}</b> で決めてください。ここで決めたランクからスタートします。</p>
      <div class="info"><h3>C− 以上を選んだ項目について</h3>
        <p>C− 以上の項目は、運動しない日が続くとポイントが減っていきます(${DECAY_NOTE}、鍛えない日が続くと始まります。今日から数えます)。C− より下には減りません。</p></div>
      <p class="t-muted small">${RANKS[SELF_MAX_STEP]} より上へは、トレーニングを続け、測定で伸びを示すと上がっていきます。</p>
    </section>
    <section class="card" id="self-preview">${selfPreview(steps)}</section>
    <form id="self-form" class="card form">
      <h3>筋力(部位)</h3>${SELF_ITEMS.filter((x) => x.group === 'part').map(row).join('')}
      <h3>そのほかの能力</h3>${SELF_ITEMS.filter((x) => x.group === 'ability').map(row).join('')}
      <button class="btn primary wide" type="submit">この内容で始める</button>
      ${state.selfInit ? '<p class="t-muted small">やり直しても、今のポイントより下がることはありません。</p>' : '<button type="button" class="btn wide" data-action="setup-skip">スキップ(すべて G− から始める)</button>'}
    </form>
  </div>`;
}

function rankScale() {
  return `<div class="rk-scale" aria-label="ランクの色の目安">${['G', 'F', 'E', 'D', 'C', 'B', 'A', 'S', 'SS', 'SSS'].map((l, i) => `<span><i class="bm-${i}"></i>${l}</span>`).join('')}</div>`;
}

function viewBody() {
  const { phys } = status();
  const str = phys.abilities.strength;
  const parts = Object.fromEntries(PARTS.map((p) => [p.key, { name: p.name, letter: letterOf(phys.parts[p.key].step), label: rankLabel(phys.parts[p.key].step) }]));
  return `<div class="sheet" role="dialog" aria-label="筋力の詳細">
    <header class="sheet-head"><button class="btn ghost" data-action="close">‹ 戻る</button><h2>筋力</h2><span></span></header>
    <section class="card score-head">${badge(str.step, true)}<div><p class="score-num">${rankLabel(str.step)}</p><p class="t-muted">6部位のランクの平均</p></div></section>
    <section class="card">${bodyMap(parts)}${rankScale()}<p class="t-muted center small">部位をタップすると詳細</p></section>
    <section class="card list">${PARTS.map((p) => {
      const s = phys.parts[p.key];
      return `<button class="row" data-action="detail" data-stat="part:${p.key}">${badge(s.step)}
        <span class="row-name">${p.name}${stateChip(s)}</span>
        <span class="meter"><i style="width:${progress(s)}%"></i></span><span class="row-val">${rankLabel(s.step)}</span></button>`;
    }).join('')}</section>
    <section class="card"><h3>伸ばし方</h3>${tipList(TIPS.strength)}</section>
    <button class="btn primary wide" data-action="log-for" data-mode="daily">鍛えた部位を記録する</button>
  </div>`;
}

function viewStat(key) {
  const { phys } = status();
  const isPart = key.startsWith('part:');
  const k = isPart ? key.slice(5) : key;
  const def = isPart ? PARTS.find((p) => p.key === k) : ABILITIES.find((a) => a.key === k);
  const s = isPart ? phys.parts[k] : phys.abilities[k];
  const r = restState(s);
  const next = s.step < MAX_STEP ? THRESH[s.step + 1] : null;
  const src = sourcesOf(def.key);
  const full = def.key === 'walk' ? `目安の歩数(${stepsTarget(ageOf(state.profile)).toLocaleString()}歩)に届いた日に+${def.gain}pt` : `${src.direct.map(trainingName).join('・')}をした日に+${GAIN}pt(前回から48時間以内は+${GAIN_SOON}pt)`;
  const gainNote = `${full}${src.related.length ? `。${src.related.map(trainingName).join('・')}をした日にはその半分` : ''}${src.sports.length ? `。スポーツ(${src.sports.join('、')})をした日も半分` : ''}`;
  const strip = s.recent.map((w, i) => `<i class="${w >= 1 ? 'on' : w > 0 ? 'half' : ''}" title="${md(lastDays(28)[i])}"></i>`).join('');
  const measured = s.tests.map((t) => t.key);
  const testsHtml = def.tests.map((tk) => {
    const m = MEASURES[tk];
    const t = s.tests.find((x) => x.key === tk);
    if (!t) return `<div class="part"><div class="part-top"><b>${m.label}</b><span>未測定</span></div><p class="t-muted">${esc(m.hint)}</p></div>`;
    const ser = series(state.measures, tk);
    let extra = '';
    if (tk === 'twostep' && state.profile.height) extra = `ロコモ度:${locomoTwoStep(t.latest / state.profile.height)}`;
    if (tk === 'standup') extra = `ロコモ度:${locomoStandup(t.latest)}`;
    return `<div class="part"><div class="part-top"><b>${m.label}</b><span>${esc(fmtMeasure(tk, t.latest))}</span><span class="part-score">天井 ${rankLabel(t.ceil)}</span></div>
      <p class="t-muted">${esc(testInfo(tk, t.first, t.latest, state.profile, s.base))}${extra ? `。${extra}` : ''}</p>
      ${srcList([...(m.rule.type ? ['pa2013'] : []), ...(m.rule.type === 'vo2est' ? ['uth', 'tanaka'] : []), m.src, 'app'].filter(Boolean))}
      ${tk === 'standup' ? '' : lineChart({ pts: ser, unit: m.unit, id: `t-${tk}` })}</div>`;
  }).join('');

  return `<div class="sheet" role="dialog" aria-label="${def.name}の詳細">
    <header class="sheet-head"><button class="btn ghost" data-action="close">‹ 戻る</button><h2>${def.name}</h2><span></span></header>
    <section class="card score-head">${badge(s.step, true)}<div>
      <p class="score-num">${rankLabel(s.step)}<small> ${Math.round(s.pts)} pt</small></p>
      <p class="t-muted">${s.atCeil ? `天井(${rankLabel(s.ceil)})に到達。測定で伸びを示すと上がります` : next !== null ? `次の ${RANKS[s.step + 1]} まで あと ${Math.ceil(next - s.pts)} pt` : '最高ランクです'}</p>
      <p><span class="state ${r.tone}">${r.label}</span> <span class="t-muted">${s.last ? `最後に鍛えた日 ${md(s.last)}(${s.trainedSince === 0 ? '今日' : `${s.trainedSince}日前`})` : 'まだ鍛えた記録がありません'}</span></p>
      ${s.self !== null ? `<p class="t-muted small">自己評価:${RANKS[s.self]}(${md(state.selfInit.date)})</p>` : ''}
    </div></section>
    <section class="card"><h3>直近4週間</h3><div class="strip" aria-label="直近28日の鍛えた日">${strip}</div>
      <p class="t-muted small strip-ends"><span>${md(lastDays(28)[0])}</span><span>今日</span></p>
      <p class="t-muted small"><i class="sw sw-1"></i> 直接鍛えた日 <i class="sw sw-half"></i> 関係するトレーニングの日(半分)</p>
      ${s.history.length > 1 ? `<h3>ポイントの推移</h3>${lineChart({ pts: s.history, unit: 'pt', id: `p-${key}`, dots: false, ref: next !== null && !s.atCeil ? { value: next, label: RANKS[s.step + 1] } : null })}` : ''}
    </section>
    <section class="card"><h3>測定と天井</h3>
      <p class="t-muted">今の天井:<b>${rankLabel(s.ceil)}</b>(${measured.length ? '測定した項目のうち一番高いもの' : `未測定のため ${RANKS[NO_MEASURE_CEIL]}`}${s.self !== null && s.self > NO_MEASURE_CEIL ? `。自己評価の ${RANKS[s.self]} までは測定なしでも認めます` : ''})</p>
      ${testsHtml}
      <button class="btn wide" data-action="log-for" data-mode="measure">測定する</button>
    </section>
    <section class="card"><h3>ポイントのルール</h3>
      <p class="small">${gainNote}。7日間で最大${WEEK_CAP}pt。ランクは天井を超えません。C−以上になると、最後に鍛えた日から${def.decayDay}日たった日から、C−を超えた分の1%ずつ毎日減ります(C−より下にはなりません)。</p>
      ${srcList(['pa2023', 'acsm2009', 'app'])}
    </section>
    <section class="card"><h3>伸ばし方</h3>
      ${isPart ? `<ul class="ex">${PART_TIPS[k].map((x) => `<li>${esc(x)}</li>`).join('')}</ul>${tipList(TIPS.strength)}` : tipList(TIPS[k] ?? [])}
    </section>
    <button class="btn primary wide" data-action="log-for" data-mode="daily">鍛えた日を記録する</button>
  </div>`;
}

function conditionCharts(key) {
  const line = (k, ref) => { const s = series(state.measures, k); return s.length ? `<h3>${MEASURES[k].label}</h3>${lineChart({ pts: s, unit: MEASURES[k].unit, ref, id: k })}` : ''; };
  const days14 = lastDays(14);
  const bars = (field, label, unit, ref, get = (row) => row?.[field]) => {
    const days = days14.map((date) => { const v = get(state.daily[date]); return { date, value: v === undefined || v === '' || v === null ? null : Number(v) }; });
    const c = barChart({ days, unit, ref, id: field });
    return c ? `<h3>${label}(14日)</h3>${c}` : '';
  };
  const p = state.profile; const age = ageOf(p);
  switch (key) {
    case 'body': {
      const [, hi] = bmiRange(age);
      const wRef = p.height ? { value: Number((hi * (p.height / 100) ** 2).toFixed(1)), label: `BMI${hi}の体重` } : null;
      return line('weight', wRef) + line('waist', { value: waistLimit(p.sex), label: `基準 ${waistLimit(p.sex)}` })
        + line('sbp', { value: 115, label: '正常 115未満' }) + line('dbp', { value: 75, label: '正常 75未満' }) + line('bodyfat');
    }
    case 'recovery':
      return bars('sleepH', '睡眠時間', '時間', { value: 6, label: '目安 6時間' }) + bars('rest', '睡眠休養感', '/5');
    case 'habit':
      return bars('steps', '歩数', '歩', { value: stepsTarget(age), label: `目安 ${stepsTarget(age).toLocaleString()}` })
        + bars('exMin', '運動', '分', null, exerciseMinutes) + bars('alcoholG', '純アルコール', 'g', { value: alcoholLimit(p.sex), label: `${alcoholLimit(p.sex)}g` })
        + bars('veg', '野菜', '皿', { value: 5, label: '5皿' });
    case 'knowledge':
      return `<h3>分野ごとのマスター</h3><div class="list">${Object.entries(QUIZ_CATS).map(([c, name]) => {
        const qs = QUIZ.filter((q) => q.cat === c);
        const done = qs.filter((q) => state.quiz[q.id]?.last).length;
        return `<div class="row static"><span class="row-name">${name}</span><span class="meter"><i style="width:${(done / qs.length) * 100}%"></i></span><span class="row-val">${done}/${qs.length}</span></div>`;
      }).join('')}</div>`;
    default: return '';
  }
}

function viewCondition(key) {
  const meta = CONDITIONS.find((c) => c.key === key);
  const r = status().cond[key];
  const charts = conditionCharts(key);
  return `<div class="sheet" role="dialog" aria-label="${meta.name}の詳細">
    <header class="sheet-head"><button class="btn ghost" data-action="close">‹ 戻る</button><h2>${meta.name}</h2><span></span></header>
    <section class="card score-head">${badge(r.step, true)}
      <div><p class="score-num">${r.score ?? '—'}<small> / 100</small></p>
      <p class="t-muted">コンディションは今の状態の評価なので、ランクはA+までです</p>
      ${r.missing ? `<p class="t-muted">${r.missing}</p>` : ''}</div>
    </section>
    ${r.parts.length ? `<section class="card"><h3>内訳</h3>${r.parts.map((p) => `<div class="part">
      <div class="part-top"><b>${esc(p.label)}</b><span>${esc(p.value)}</span><span class="part-score">${p.score}点</span></div>
      <span class="meter"><i style="width:${p.score}%"></i></span>
      <p class="t-muted">${esc(p.note)}</p>${srcList(p.src)}</div>`).join('')}</section>` : ''}
    ${charts ? `<section class="card">${charts}<p class="t-muted small">点や棒をタップすると値が表示されます</p></section>` : ''}
    <section class="card"><h3>伸ばし方</h3>${tipList(TIPS[key] ?? [])}
      ${key === 'knowledge' ? '<button class="btn primary" data-action="quiz-start">クイズに挑戦</button>' : ''}
    </section>
    ${key === 'knowledge' ? '' : `<button class="btn primary wide" data-action="log-for" data-mode="${key === 'body' ? 'measure' : 'daily'}">記録する</button>`}
  </div>`;
}

function viewDetail(key) {
  if (key === 'strength') return viewBody();
  if (CONDITIONS.some((c) => c.key === key)) return viewCondition(key);
  return viewStat(key);
}

// ---------- 記録 ----------

function radios(name, opts, cur) {
  return `<div class="seg">${opts.map(([v, label]) => `<label><input type="radio" name="${name}" value="${v}" ${String(cur) === String(v) ? 'checked' : ''}><span>${label}</span></label>`).join('')}</div>`;
}
const val = (v) => (v === undefined || v === null ? '' : esc(v));

function viewDaily() {
  const d = state.daily[ui.logDate] ?? {};
  const trained = new Set((d.trained ?? []).flatMap((t) => (t === 'leg' ? LEG_KEYS : [t])));
  const toggle = (t) => `<label class="tg"><input type="checkbox" name="trained" value="${t.key}" ${trained.has(t.key) ? 'checked' : ''}><span>${t.label}</span></label>`;
  return `<form id="daily-form" class="card form" autocomplete="off">
    <label class="field"><span>日付</span><input type="date" name="date" value="${ui.logDate}" max="${today()}" data-action="log-date"></label>
    <h3>トレーニング</h3>
    <div class="field"><span>鍛えた部位</span><div class="toggles">${TRAININGS.filter((t) => t.kind === 'part').map(toggle).join('')}</div></div>
    <div class="field"><span>そのほかのトレーニング</span><div class="toggles">${TRAININGS.filter((t) => t.kind === 'other').map(toggle).join('')}</div>
      <small class="t-muted">息が弾む運動の分数を入れた日は「有酸素」、歩数が目安以上の日は「歩く力」も自動で記録されます</small></div>
    <div class="field"><span>スポーツ</span><div class="toggles">${SPORTS.map((x) => `<label class="tg"><input type="checkbox" name="sport" value="${x.key}" ${(d.sports ?? []).includes(x.key) ? 'checked' : ''}><span>${x.label}</span></label>`).join('')}</div>
      <small class="t-muted">スポーツをした日は、その種目に関わる能力・部位すべてに半分のポイントが入ります</small>
      <details class="tip"><summary>どの能力にポイントが入る?</summary>${effectsTable()}</details></div>
    <label class="field"><span>スポーツの時間<small>生活習慣の「運動」に数えます(息が弾む運動の分数と大きいほう)</small></span><span class="unit-in"><input type="number" name="sportMin" inputmode="numeric" min="0" value="${val(d.sportMin)}" placeholder="0"><em>分</em></span></label>
    <label class="field"><span>息が弾む運動</span><span class="unit-in"><input type="number" name="exMin" inputmode="numeric" min="0" value="${val(d.exMin)}" placeholder="0"><em>分</em></span></label>
    <label class="field"><span>歩数</span><span class="unit-in"><input type="number" name="steps" inputmode="numeric" min="0" value="${val(d.steps)}" placeholder="8000"><em>歩</em></span></label>
    <h3>回復</h3>
    <label class="field"><span>睡眠時間</span><span class="unit-in"><input type="number" name="sleepH" inputmode="decimal" step="0.5" min="0" max="16" value="${val(d.sleepH)}" placeholder="7"><em>時間</em></span></label>
    <div class="field"><span>睡眠で休養がとれた感覚</span>${radios('rest', [[1, '1'], [2, '2'], [3, '3'], [4, '4'], [5, '5']], d.rest)}<small class="t-muted">1 まったくとれない 〜 5 十分とれた</small></div>
    <h3>食事・飲酒</h3>
    <label class="field"><span>野菜(小鉢)</span><span class="unit-in"><input type="number" name="veg" inputmode="numeric" min="0" max="10" value="${val(d.veg)}" placeholder="0"><em>皿</em></span></label>
    <div class="field"><span>主菜(肉・魚・卵・大豆)を食べた食事</span>${radios('protein', [[0, '0'], [1, '1'], [2, '2'], [3, '3']], d.protein)}</div>
    <label class="field"><span>純アルコール</span><span class="unit-in"><input type="number" name="alcoholG" inputmode="decimal" min="0" value="${val(d.alcoholG)}" placeholder="0"><em>g</em></span></label>
    <div class="chips">${DRINKS.map((x) => `<button type="button" class="chip" data-action="drink" data-g="${x.g}">+${x.label}(${x.g}g)</button>`).join('')}<button type="button" class="chip" data-action="drink" data-g="0">リセット</button></div>
    <label class="field"><span>メモ</span><input type="text" name="memo" value="${val(d.memo)}" placeholder="体調・気づいたこと"></label>
    <button class="btn primary wide" type="submit">${state.daily[ui.logDate] ? '更新する' : '保存する +20XP'}</button>
  </form>`;
}

function measureInput(k, m) {
  if (m.options) {
    return `<label class="field"><span>${m.label}<small>${esc(m.hint)}</small></span>
      <select name="${k}"><option value="">選ぶ</option>${m.options.map((o, i) => `<option value="${i}">${esc(o)}</option>`).join('')}</select></label>`;
  }
  return `<label class="field"><span>${m.label}${m.for ? `<b class="for">${m.for}</b>` : ''}<small>${esc(m.hint)}</small></span>
    <span class="unit-in"><input type="number" name="${k}" inputmode="decimal" step="${m.step}" ${m.signed ? '' : 'min="0"'}><em>${m.unit}</em></span></label>`;
}

function viewMeasure() {
  const recent = [...state.measures].sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : b.t - a.t)).slice(0, 20);
  return `<form id="measure-form" class="card form" autocomplete="off">
    <label class="field"><span>測定日</span><input type="date" name="date" value="${ui.logDate}" max="${today()}"></label>
    <p class="t-muted small">測れたものだけ入れれば大丈夫です。測定するとランクの天井が決まります。</p>
    ${MEASURE_GROUPS.map(([g, name], i) => `<details class="mgroup" ${i === 0 ? 'open' : ''}><summary>${name}</summary>
      ${Object.entries(MEASURES).filter(([, m]) => m.group === g).map(([k, m]) => measureInput(k, m)).join('')}</details>`).join('')}
    <button class="btn primary wide" type="submit">保存する +30XP</button>
  </form>
  ${recent.length ? `<section class="card"><h3>最近の測定</h3><div class="list">${recent.map((r) => `<div class="row static">
    <span class="row-name">${md(r.date)} ${esc(MEASURES[r.key]?.label ?? r.key)}</span><span class="row-val">${esc(fmtMeasure(r.key, r.value))}</span>
    <button class="btn ghost small" data-action="del-measure" data-id="${esc(r.id)}" aria-label="削除">削除</button></div>`).join('')}</div></section>` : ''}`;
}

// ---------- ヘルスケア連携 ----------

function healthCard() {
  return `<section class="card health">
    <div class="health-top"><h3>ヘルスケアから取り込む</h3>${state.healthLast ? `<small class="t-muted">前回 ${md(state.healthLast.at)}</small>` : ''}</div>
    <p class="t-muted small">ショートカットでコピーした歩数・睡眠などを取り込みます。</p>
    <button class="btn primary wide" data-action="health-clip">コピーした値を取り込む</button>
    <details class="tip"><summary>うまく取り込めないとき</summary>
      <form id="health-form"><textarea name="text" rows="4" placeholder="ショートカットがコピーした文字を、ここに貼り付け"></textarea>
      <button class="btn wide" type="submit">貼り付けた文字から取り込む</button></form></details>
    <button class="btn ghost" data-action="health-guide">ショートカットの作り方</button>
  </section>`;
}

function startHealthImport(text) {
  const parsed = parseHealth(text);
  if (!parsed) { toast('Self Lab用のデータが見つかりませんでした'); return; }
  if (!Object.keys(parsed.values).length) { toast(parsed.skipped.length ? '取り込める値がありませんでした(範囲外の値のみ)' : '取り込める値がありませんでした'); return; }
  const day = parsed.day && parsed.day <= today() ? parsed.day : today();
  // 種類の違う3つ以上の値が同じ数字なら、ショートカットが種類を読み分けられていない可能性が高い(範囲外の値も数える。0は除く)
  const freq = {};
  for (const v of Object.values(parsed.all)) if (v !== 0) freq[v] = (freq[v] ?? 0) + 1;
  const [same, n] = Object.entries(freq).sort((a, b) => b[1] - a[1])[0] ?? [null, 0];
  // 歩数のサンプルは長いので、元の文字の表示では件数だけにする
  const raw = String(text); const cut = raw.indexOf(SAMPLE_MARK);
  const shown = cut < 0 ? raw : `${raw.slice(0, cut)}${SAMPLE_MARK}(${parsed.steps ? `歩数のサンプル${parsed.steps.n}件は省略` : '歩数のサンプルは読み取れませんでした'})`;
  ui.health = { ...parsed, day, suspicious: n >= 3 ? same : null, raw: shown.slice(0, 6000) };
  render(); $('#sheet').scrollTop = 0;
}

function viewHealthImport() {
  const h = ui.health;
  const cur = state.daily[h.day] ?? {};
  const rows = Object.keys(HEALTH_KEYS).filter((k) => k in h.values).map((k) => {
    const def = HEALTH_KEYS[k]; const v = h.values[k];
    const before = def.to === 'daily' ? cur[def.field] : null;
    return `<div class="row static"><span class="row-name">${def.label}<small>${def.to === 'daily' ? 'チェックイン' : '測定'}</small></span>
      <span class="row-sub">${before !== undefined && before !== null && before !== v ? `今 ${esc(before)} →` : ''}</span>
      <span class="row-val">${esc(v.toLocaleString())} ${def.unit}</span></div>`;
  }).join('');
  return `<div class="sheet" role="dialog" aria-label="ヘルスケアから取り込む">
    <header class="sheet-head"><button class="btn ghost" data-action="health-close">‹ 閉じる</button><h2>取り込み</h2><span></span></header>
    <section class="card form">
      <label class="field"><span>日付<small>${h.day === today() ? '今日' : md(h.day)}のチェックインと測定に入ります</small></span>
        <input type="date" value="${h.day}" max="${today()}" data-action="health-day"></label>
      <div class="list">${rows}</div>
      ${h.steps && h.steps.sources.length > 1 ? `<p class="t-muted small">歩数は、ヘルスケアアプリと同じくApple Watchを優先し、iPhoneなどと同じ時間に数えた分を重ねずに計算しました(${h.steps.sources.map((x) => `${esc(x.src)} ${x.sum.toLocaleString()}歩`).join('、')} → ${h.steps.total.toLocaleString()}歩)。</p>` : ''}
      ${h.skipped.length ? `<p class="chk small">範囲外のため取り込まない:${esc(h.skipped.join('、'))}</p>` : ''}
      ${h.suspicious !== null ? `<div class="info"><h3>値がおかしいかもしれません</h3><p>種類の違う3つ以上の項目が、同じ数字(${esc(h.suspicious)})になっています。ショートカットがヘルスケアの種類を正しく読めていない可能性があります。ヘルスケアアプリの値と見比べてから取り込んでください。</p></div>` : ''}
      <p class="t-muted small">チェックインのほかの項目(鍛えた部位・睡眠休養感など)はそのまま残ります。測定は前回と同じ値なら追加しません。</p>
      <details class="tip"><summary>読み取った元の文字</summary><pre class="tmpl">${esc(h.raw)}</pre></details>
      <button class="btn ${h.suspicious !== null ? '' : 'primary '}wide" data-action="health-apply">${h.suspicious !== null ? 'このまま取り込む' : '取り込む'}</button>
    </section>
  </div>`;
}

function applyHealth() {
  const { day, values } = ui.health;
  const row = { ...(state.daily[day] ?? {}) };
  const isNewDay = !state.daily[day];
  let dailyN = 0; let measureN = 0;
  for (const [k, v] of Object.entries(values)) {
    const def = HEALTH_KEYS[k];
    if (def.to === 'daily') {
      if (v === 0 && row[def.field]) continue; // 0 で手入力の値を消さない
      if (row[def.field] !== v) { row[def.field] = v; dailyN++; }
    } else {
      const sameDay = state.measures.find((m) => m.key === def.field && m.date === day);
      if (sameDay) { if (sameDay.value !== v) { sameDay.value = v; measureN++; } continue; }
      const latest = series(state.measures, def.field).at(-1);
      if (latest && latest.value === v) continue; // 前回と同じ値(ヘルスケア側が更新されていない)
      state.measures.push({ id: `${Date.now().toString(36)}-${def.field}`, key: def.field, date: day, value: v, t: Date.now() });
      measureN++;
    }
  }
  let xp = 0;
  if (dailyN) { state.daily[day] = row; if (isNewDay) xp += gainXp(20, `d:${day}`); }
  if (measureN) xp += gainXp(30, `m:${day}`);
  state.healthLast = { at: today(), day };
  ui.health = null; save();
  toast(dailyN + measureN ? `${dailyN + measureN}件取り込みました${xp ? ` +${xp}XP` : ''}` : '新しい値はありませんでした');
  go('home');
}

function viewHealthGuide() {
  const step = (n, title, body) => `<li><b>${title}</b>${body}</li>`;
  return `<div class="sheet" role="dialog" aria-label="ショートカットの作り方">
    <header class="sheet-head"><button class="btn ghost" data-action="health-guide-close">‹ 戻る</button><h2>作り方</h2><span></span></header>
    <section class="card"><h3>しくみ</h3>
      <p class="small">Webアプリはヘルスケアを直接読めないため、iPhoneの「ショートカット」アプリが値を読み出してコピーし、Self Labがそれを取り込みます。データはiPhoneの中でコピーされるだけで、外には送られません。</p>
      <p class="small">夜(寝る前)に実行すると、その日の歩数・エクササイズ時間と、前の晩の睡眠時間がその日の記録に入ります。</p>
      <p class="t-muted small">iOSのバージョンによって、項目の名前が少し違うことがあります。</p>
    </section>
    <section class="card"><h3>ショートカットを作る(最初の1回だけ)</h3><ol class="guide">
      ${step(1, '新しいショートカットを作る', '「ショートカット」アプリを開き、右上の「+」をタップ。名前は「Self Lab 取り込み」など。')}
      ${step(2, '歩数', '「ヘルスケアサンプルを検索」を追加し、条件を「種類が歩数」「開始日が今日」にする。続けて「統計を計算」を追加して「合計」にし、「変数を設定」で名前を「歩数」にする。')}
      ${step(3, 'エクササイズ時間', '2と同じ手順で、種類を「エクササイズ時間」にして合計し、変数「運動」にする。')}
      ${step(4, '睡眠時間', '「ヘルスケアサンプルを検索」で「種類が睡眠分析」「終了日が今日」にし、値が「ベッド内」でも「覚醒」でもないもの(睡眠中・コア・深い・レム)に絞る。続けて「ヘルスケアサンプルの詳細を取得」で「継続時間」を選び、「統計を計算」で合計して、変数「睡眠」にする。')}
      ${step(5, '安静時心拍・VO2max・体重・体脂肪率・血圧', 'それぞれ「ヘルスケアサンプルを検索」で種類(安静時心拍数/最大酸素摂取量/体重/体脂肪率/収縮期血圧/拡張期血圧)を選び、「並べ替え:開始日(新しい順)」「制限:1」にして変数を設定する。使わない項目は作らなくて大丈夫。')}
      ${step(6, '日付', '「日付をフォーマット」を追加し、日付を「現在の日付」、形式を「カスタム」にして「yyyy-MM-dd」と入れ、変数「日付」にする。')}
      ${step(7, '取り込み用の文字', '「テキスト」を追加し、下の「雛形をコピー」で写した文字を貼り付ける。各行の「=」のうしろに、対応する変数を入れる(day=日付、steps=歩数、sleep=睡眠、exercise=運動、rhr=安静時心拍 …)。')}
      ${step(8, 'コピーする', '「クリップボードにコピー」を追加する。必要なら「通知を表示」で「Self Labを開いて取り込んでください」と出す。')}
      ${step(9, '一度実行する', 'ヘルスケアへのアクセスを聞かれたら「許可」する。')}
    </ol>
    <pre class="tmpl">${esc(HEALTH_TEMPLATE)}</pre>
    <button class="btn wide" data-action="health-template">雛形をコピー</button></section>
    <section class="card"><h3>毎日自動で実行する</h3>
      <p class="small">ショートカットアプリの「オートメーション」タブで新規作成し、「時刻」(例:毎日22:30)を選んで「すぐに実行」にし、作ったショートカットを選びます。iPhoneがロック中だとヘルスケアを読めないことがあるので、寝る前に手動で実行する方法も確実です。</p>
    </section>
    <section class="card"><h3>Self Labに取り込む</h3>
      <p class="small">記録タブの「コピーした値を取り込む」をタップし、「ペースト」を許可します。内容を確かめて「取り込む」を押せば完了です。</p>
    </section>
    <section class="card"><h3>うまくいかないとき</h3><ul class="ex">
      <li>睡眠時間が実際の2倍くらいになる:睡眠を複数のアプリ(Apple WatchとiPhoneなど)が記録しています。4の条件に「ソースが(使っている機器)」を加えてください。</li>
      <li>「データが見つかりません」と出る:テキストの1行目が「SELFLAB」になっているか確かめてください。</li>
      <li>友人に配る:作ったショートカットの共有ボタンから「iCloudリンクをコピー」で送れます。受け取った人は作らずに使えます。</li>
    </ul></section>
  </div>`;
}

function viewLog() {
  if (!state.profile) return viewHome();
  return `<div class="seg big">${[['daily', '今日のチェックイン'], ['measure', '測定']].map(([k, l]) => `<button class="${ui.logMode === k ? 'on' : ''}" data-action="log-mode" data-mode="${k}">${l}</button>`).join('')}</div>
    ${ui.logMode === 'daily' ? healthCard() + viewDaily() : viewMeasure()}`;
}

// ---------- 学ぶ ----------

function pickQuiz(cat) {
  const pool = QUIZ.filter((q) => !cat || q.cat === cat);
  const weak = shuffle(pool.filter((q) => !state.quiz[q.id]?.last));
  const rest = shuffle(pool.filter((q) => state.quiz[q.id]?.last));
  return [...weak, ...rest].slice(0, 5).map((q) => ({ q, order: shuffle(q.choices.map((_, i) => i)), picked: null }));
}

function viewQuiz() {
  const s = ui.quiz;
  if (s.i >= s.items.length) {
    const ok = s.items.filter((it) => it.picked === it.q.answer).length;
    return `<section class="card center"><h2>結果</h2><p class="score-num">${ok}<small> / ${s.items.length} 正解</small></p><p>+${s.gained} XP</p>
      <button class="btn primary wide" data-action="quiz-start" data-cat="${s.cat ?? ''}">もう一度</button>
      <button class="btn wide" data-action="quiz-end">終わる</button></section>
      ${s.items.filter((it) => it.picked !== it.q.answer).length ? '<p class="t-muted center small">間違えた問題は次回優先して出題されます</p>' : ''}`;
  }
  const it = s.items[s.i]; const q = it.q; const done = it.picked !== null;
  return `<section class="card quiz">
    <p class="t-muted">${s.i + 1} / ${s.items.length} ・ ${QUIZ_CATS[q.cat]}</p>
    <h2 class="q">${esc(q.q)}</h2>
    <div class="choices">${it.order.map((ci) => {
      const cls = !done ? '' : ci === q.answer ? 'correct' : ci === it.picked ? 'wrong' : 'dim';
      const mark = !done ? '' : ci === q.answer ? '○ ' : ci === it.picked ? '× ' : '';
      return `<button class="choice ${cls}" data-action="quiz-pick" data-ci="${ci}" ${done ? 'disabled' : ''}>${mark}${esc(q.choices[ci])}</button>`;
    }).join('')}</div>
    ${done ? `<div class="exp"><p class="verdict">${it.picked === q.answer ? '正解' : '不正解'}</p><p>${esc(q.exp)}</p>${srcList(q.src)}
      ${q.check ? `<p class="chk">【要確認】${esc(q.check)}</p>` : ''}</div>
      <button class="btn primary wide" data-action="quiz-next">${s.i + 1 < s.items.length ? '次へ' : '結果を見る'}</button>` : ''}
  </section>`;
}

function viewLearn() {
  if (ui.quiz) return viewQuiz();
  const total = QUIZ.length; const mastered = QUIZ.filter((q) => state.quiz[q.id]?.last).length;
  const topics = [...ABILITIES, ...CONDITIONS.filter((c) => c.key !== 'knowledge')];
  return `<section class="card"><h2>スポーツファーマシー・クイズ</h2><p class="t-muted">マスター ${mastered} / ${total} 問。正解 +10XP、不正解 +3XP</p>
    <button class="btn primary wide" data-action="quiz-start">5問チャレンジ</button>
    <div class="chips">${Object.entries(QUIZ_CATS).map(([c, n]) => `<button class="chip" data-action="quiz-start" data-cat="${c}">${n}</button>`).join('')}</div>
  </section>
  ${topics.map((t) => `<section class="card"><h3>${t.name}を伸ばす</h3>${tipList(TIPS[t.key] ?? [])}</section>`).join('')}`;
}

// ---------- フレンド ----------

function myCard() {
  const { phys, cond } = status();
  return {
    v: 3, id: state.me.id, n: state.me.nick, d: today(), lv: levelFromXp(state.xp).level, ov: phys.overallStep,
    a: ABILITIES.map((a) => phys.abilities[a.key].step), p: PARTS.map((p) => phys.parts[p.key].step),
    c: CONDITIONS.map((c) => cond[c.key].step), sk: streak(),
  };
}

const cardUrl = (card) => `${location.origin}${location.pathname}#f=${encodeCard(card)}`;
const OLD_CARD = '古い形式のカードです。相手にアプリを開き直してから、カードを送り直してもらってください';

function daysAgo(iso) {
  const n = Math.round((Date.parse(today()) - Date.parse(iso)) / 86400000);
  return n <= 0 ? '今日' : `${n}日前`;
}

function cardSummary(c) {
  if (c.v < 2) return `<div class="fcard"><b>${esc(c.n)}</b><p class="t-muted">${OLD_CARD}</p></div>`;
  return `<div class="fcard">
    <div class="fcard-top">${badge(c.ov)}
      <div><b>${esc(c.n)}</b><p class="t-muted">Lv.${c.lv} ・ 総合 ${rankLabel(c.ov)} ・ 連続記録 ${c.sk}日 ・ ${md(c.d)}時点</p></div></div>
    <div class="mini">${ABILITIES.map((a, i) => `<span><small>${a.short}</small><b>${rankLabel(c.a[i])}</b></span>`).join('')}</div>
  </div>`;
}

function viewFriends() {
  const friends = Object.values(state.friends).sort((a, b) => (a.d < b.d ? 1 : -1));
  let mine;
  if (!state.profile) {
    mine = '<p class="t-muted">自分のカードを作るには、先に設定タブでプロフィールを入れてください。</p>';
  } else if (!state.me?.nick) {
    mine = `<form id="nick-form" class="form"><label class="field"><span>ニックネーム<small>カードに表示される名前です(20文字まで)</small></span>
      <input type="text" name="nick" maxlength="20" required></label><button class="btn primary wide" type="submit">カードを作る</button></form>`;
  } else {
    mine = `${cardSummary(myCard())}
      <button class="btn primary wide" data-action="share">カードを送る</button>
      <details class="tip"><summary>ニックネームを変える</summary><form id="nick-form" class="form">
        <label class="field"><input type="text" name="nick" maxlength="20" value="${esc(state.me.nick)}" required></label>
        <button class="btn wide" type="submit">保存する</button></form></details>`;
  }
  return `<section class="card"><h2>自分のカード</h2>${mine}
    <p class="t-muted small">カードに入るのは、ニックネーム・レベル・各項目のランク・連続記録日数だけです。体重や血圧などの値は入りません。リンクを受け取った人は誰でも見られます。</p>
  </section>
  <form id="friend-form" class="card form"><h2>フレンドを追加</h2>
    <p class="t-muted">届いたメッセージ(リンク)をそのまま貼り付けてください。同じ人のカードは新しいものに置き換わります。</p>
    <textarea name="code" rows="3" placeholder="ここに貼り付け" required></textarea>
    <button class="btn primary wide" type="submit">追加する</button>
  </form>
  <section class="card list"><h2>フレンド</h2>
    ${friends.length ? friends.map((f) => `<button class="row" data-action="friend" data-id="${esc(f.id)}">
      ${f.v >= 2 ? badge(f.ov) : '<span class="badge lv-none">?</span>'}
      <span class="row-name">${esc(f.n)}<small>${f.v >= 2 ? daysAgo(f.d) : '送り直してもらう'}</small></span>
      <span class="row-sub">Lv.${f.lv}</span>
      <span class="row-val">${f.v >= 2 ? rankLabel(f.ov) : '—'}</span></button>`).join('')
    : '<p class="t-muted">まだいません。友人にカードを送ってもらい、上の欄に貼り付けてください。</p>'}
  </section>`;
}

function compareTable(mine, f) {
  const rows = (title, defs, a, b) => `<tr class="sec"><th colspan="3">${title}</th></tr>${defs.map((d, i) => `<tr><td>${d.name}</td><td>${rankLabel(a[i])}</td><td>${rankLabel(b[i])}</td></tr>`).join('')}`;
  return `<table class="cmp"><thead><tr><th></th><th>自分</th><th>${esc(f.n)}</th></tr></thead><tbody>
    ${rows('身体能力', ABILITIES, mine.a, f.a)}${rows('部位', PARTS, mine.p, upgradeParts(f.p))}${rows('コンディション', CONDITIONS, mine.c, f.c)}
  </tbody></table>`;
}

function viewFriend(id) {
  const f = state.friends[id];
  if (!f) return '';
  const head = `<header class="sheet-head"><button class="btn ghost" data-action="close">‹ 戻る</button><h2>${esc(f.n)}</h2><span></span></header>`;
  const remove = `<button class="btn danger wide" data-action="del-friend" data-id="${esc(f.id)}">フレンドから外す</button>`;
  if (f.v < 2) return `<div class="sheet" role="dialog">${head}<section class="card">${cardSummary(f)}</section>${remove}</div>`;
  const mine = state.profile && state.me?.id ? myCard() : { a: ABILITIES.map(() => null), p: PARTS.map(() => null), c: CONDITIONS.map(() => null) };
  const axes = ABILITIES.map((a, i) => ({ key: a.key, name: a.name, value: pct(mine.a[i]), label: rankLabel(mine.a[i]) }));
  return `<div class="sheet" role="dialog" aria-label="${esc(f.n)}との比較">${head}
    <section class="card">${cardSummary(f)}</section>
    <section class="card">
      <div class="legend"><span><i class="sw sw-1"></i>自分</span><span><i class="sw sw-2"></i>${esc(f.n)}</span></div>
      ${radar(axes, { compare: { values: f.a.map(pct), labels: f.a.map(rankLabel) }, interactive: false, refAt: pct(C_MINUS), refLabel: 'C−' })}
      ${compareTable(mine, f)}
    </section>
    <p class="t-muted center small">${md(f.d)}時点の状態です。最新の状態は、相手に新しいカードを送ってもらうと更新されます。</p>
    ${remove}
  </div>`;
}

function viewIncoming() {
  const { card } = ui.incoming;
  const axes = ABILITIES.map((a, i) => ({ key: a.key, name: a.name, value: pct(card.a[i]), label: rankLabel(card.a[i]) }));
  const self = card.id === state.me?.id;
  const known = state.friends[card.id];
  return `<div class="sheet" role="dialog" aria-label="フレンドのカード">
    <header class="sheet-head"><button class="btn ghost" data-action="close">‹ 閉じる</button><h2>フレンドのカード</h2><span></span></header>
    <section class="card">${cardSummary(card)}${radar(axes, { interactive: false, refAt: pct(C_MINUS), refLabel: 'C−' })}</section>
    ${self ? '<p class="t-muted center">これはあなた自身のカードです。</p>' : `
      ${standalone ? '' : `<section class="card"><p>ホーム画面のSelf Labに追加するときは、リンクをコピーしてアプリの「フレンド」タブに貼り付けてください。iPhoneでは、Safariとホーム画面のアプリで保存場所が別になっています。</p>
        <button class="btn wide" data-action="copy-card">リンクをコピー</button></section>`}
      <button class="btn primary wide" data-action="add-incoming">${known ? 'カードを更新する' : standalone ? 'フレンドに追加' : 'このブラウザでフレンドに追加'}</button>`}
  </div>`;
}

function addFriend(card) {
  if (card.id === state.me?.id) { toast('これは自分のカードです'); return false; }
  const known = state.friends[card.id];
  if (known?.v >= 2 && known.d > card.d) { toast('もっと新しいカードを登録済みです'); return false; }
  state.friends[card.id] = { ...card, added: known?.added ?? today() };
  save(); toast(known ? `${card.n}さんのカードを更新しました` : `${card.n}さんを追加しました`);
  return true;
}

// ---------- 設定 ----------

function viewSettings() {
  const p = state.profile ?? {};
  const checks = [
    ...Object.values(SOURCES).filter((s) => s.check).map((s) => `${s.name}:${s.check}`),
    ...QUIZ.filter((q) => q.check).map((q) => `クイズ ${q.id}:${q.check}`),
  ];
  return `<form id="profile-form" class="card form">
    <h2>プロフィール</h2>
    ${state.profile ? '' : '<p class="t-muted">年代・性別ごとの基準値を選ぶために使います。データはこのiPhoneの中にだけ保存されます。</p>'}
    <div class="field"><span>性別(基準値の選択に使用)</span>${radios('sex', [['m', '男性'], ['f', '女性']], p.sex ?? 'm')}</div>
    <label class="field"><span>生まれ年</span><span class="unit-in"><input type="number" name="birthYear" inputmode="numeric" min="1920" max="${new Date().getFullYear() - 10}" value="${val(p.birthYear)}" required><em>年</em></span></label>
    <label class="field"><span>身長</span><span class="unit-in"><input type="number" name="height" inputmode="decimal" step="0.1" min="100" max="230" value="${val(p.height)}"><em>cm</em></span></label>
    <button class="btn primary wide" type="submit">保存する</button>
  </form>
  ${state.profile ? `<section class="card"><h2>自己評価</h2>
    <p class="t-muted">${state.selfInit ? `${md(state.selfInit.date)} に設定済み。やり直しても、今のポイントより下がることはありません。` : 'まだ設定していません。'}</p>
    <button class="btn wide" data-action="setup-open">${state.selfInit ? '自己評価をやり直す' : '自己評価をする'}</button></section>` : ''}
  <section class="card"><h2>ヘルスケア連携</h2>
    <p class="t-muted">iPhoneの「ショートカット」を使って、歩数・睡眠・エクササイズ時間・安静時心拍・VO2max・体重・体脂肪率・血圧を取り込めます。${state.healthLast ? `前回の取り込み:${md(state.healthLast.at)}` : ''}</p>
    <button class="btn wide" data-action="health-guide">ショートカットの作り方</button></section>
  <section class="card"><h2>データ</h2>
    <p class="t-muted">記録はこのiPhoneのブラウザの中にだけあります。機種変更や削除に備えて、ときどき書き出してください。</p>
    <button class="btn wide" data-action="export">バックアップを書き出す</button>
    <label class="btn wide">バックアップから戻す<input type="file" accept="application/json,.json" id="import-file" hidden></label>
    <button class="btn danger wide" data-action="wipe">すべてのデータを消す</button>
  </section>
  ${changelogSection()}
  <section class="card"><h2>ランクのしくみ</h2>
    <p class="small"><b>ランク</b>:G−からSSS+までの30段階。最初は上がりやすく、上に行くほど長い継続が必要です(週2回の継続で C− まで約3か月、A− まで約1年、S− まで約2年が目安)。</p>
    <p class="small"><b>ポイント</b>:鍛えた日に+${GAIN}pt。同じ項目を48時間以内に続けた日は回復途中として+${GAIN_SOON}pt。急に上がらないよう、7日間で最大${WEEK_CAP}ptまで。</p>
    <p class="small"><b>天井</b>:ランクは測定結果で決まる上限を超えません。測定していない項目は ${RANKS[NO_MEASURE_CEIL]} まで。持久力は公的な基準値、そのほかは初回の測定値(C+)からの伸びで天井が上がります。</p>
    <p class="small"><b>トレーニングと能力</b>:脚や体幹の筋トレは、関係する能力にも半分のポイントが入ります。ジャンプなどの練習も、関係する部位に半分入ります。</p>
    <details class="tip"><summary>トレーニングと能力の関係</summary>${effectsTable()}</details>
    <p class="small"><b>自己評価</b>:最初に各項目を G− 〜 ${RANKS[SELF_MAX_STEP]} で自己評価し、そのランクからスタートします。自己評価のランクまでは測定なしでも認め、自己基準の測定はそのランクを起点に数えます。</p>
    <p class="small"><b>減少</b>:C− 以上の項目は、最後に鍛えてから一定の日数(筋力の部位・持久力・柔軟性は5日、瞬発力・敏捷性・バランスは8日、歩く力は4日)たつと、C− を超えた分の1%ずつ毎日減ります。C− より下にはなりません。</p>
    <p class="small"><b>コンディション</b>(からだ・回復力・生活習慣・薬学知識):今の状態を0〜100点で評価し、A+ までのランクで表示します。</p>
    <p class="t-muted small">ランク・ポイントはゲーム用の約束ごとで、医学的な判定ではありません。</p>
    <h3>出典</h3><ul class="srcs">${Object.values(SOURCES).map((s) => `<li>${esc(s.name)}<small>${esc(s.org)}</small></li>`).join('')}</ul>
    <h3>要確認</h3><ul class="srcs chk">${checks.map((c) => `<li>${esc(c)}</li>`).join('')}</ul>
  </section>
  <p class="t-muted center small">Sports Pharmacy Self Lab v${VERSION}</p>`;
}

// ---------- アップデート情報 ----------

// まだ見ていない更新内容。新しく使い始めた人には出さない。見たバージョンが記録されていない人には最新分だけ出す
function unseenNotes() {
  if (!state.profile || state.seenVersion === VERSION) return [];
  if (!state.seenVersion) return [CHANGELOG[0]];
  return CHANGELOG.filter((c) => isNewer(c.version, state.seenVersion));
}

const noteBody = (c) => `<ul class="ex">${c.items.map((x) => `<li>${esc(x)}</li>`).join('')}</ul>`;

function viewWhatsNew(notes) {
  return `<div class="modal-back"><div class="modal card" role="dialog" aria-modal="true" aria-labelledby="wn-title">
    <p class="t-label">アップデート情報</p>
    <h2 id="wn-title">v${VERSION} になりました</h2>
    ${notes.map((c) => `<h3>v${c.version} ${esc(c.title)}</h3>${noteBody(c)}`).join('')}
    <p class="t-muted small">設定タブの「アップデート情報」から、いつでも見返せます。</p>
    <button class="btn primary wide" data-action="whats-new-ok">閉じる</button>
  </div></div>`;
}

function changelogSection() {
  return `<section class="card"><h2>アップデート情報</h2><p class="t-muted">今のバージョン:v${VERSION}</p>
    ${CHANGELOG.map((c, i) => `<details class="tip" ${i === 0 ? 'open' : ''}><summary>v${c.version} ${esc(c.title)} <small class="t-muted">${md(c.date)}</small></summary>${noteBody(c)}</details>`).join('')}
  </section>`;
}

// ---------- 描画 ----------

function render() {
  const views = { home: viewHome, log: viewLog, learn: viewLearn, friends: viewFriends, settings: viewSettings };
  $('#main').innerHTML = views[ui.tab]();
  const sheet = ui.incoming ? viewIncoming() : ui.health ? viewHealthImport() : ui.healthGuide ? viewHealthGuide() : ui.setup && state.profile ? viewSetup() : ui.friend ? viewFriend(ui.friend) : ui.detail && status() ? viewDetail(ui.detail) : '';
  $('#sheet').innerHTML = sheet;
  const notes = ui.incoming ? [] : unseenNotes();
  $('#modal').innerHTML = notes.length ? viewWhatsNew(notes) : '';
  document.body.classList.toggle('sheet-open', !!sheet || !!notes.length);
  document.querySelectorAll('#tabs button').forEach((b) => b.classList.toggle('on', b.dataset.tab === ui.tab));
}

function go(tab) { ui.tab = tab; ui.detail = null; ui.friend = null; render(); window.scrollTo(0, 0); }

// ---------- 操作 ----------

const actions = {
  tab: (el) => go(el.dataset.tab),
  // 部位の詳細は筋力の詳細から開くので、戻ると筋力に戻れるよう前の画面を覚えておく
  detail: (el) => { ui.back = ui.detail; ui.detail = el.dataset.stat; render(); $('#sheet').scrollTop = 0; },
  close: () => {
    if (ui.incoming) ui.incoming = null;
    else if (ui.friend) ui.friend = null;
    else if (ui.detail?.startsWith('part:') && ui.back === 'strength') { ui.detail = 'strength'; ui.back = null; }
    else ui.detail = null;
    render();
  },
  friend: (el) => { ui.friend = el.dataset.id; render(); $('#sheet').scrollTop = 0; },
  'health-clip': async () => {
    try {
      startHealthImport(await navigator.clipboard.readText());
    } catch {
      toast('クリップボードを読めませんでした。「うまく取り込めないとき」から貼り付けてください');
      const det = document.querySelector('.health details'); if (det) det.open = true;
    }
  },
  'health-apply': () => applyHealth(),
  'health-close': () => { ui.health = null; render(); },
  'health-guide': () => { ui.healthGuide = true; render(); $('#sheet').scrollTop = 0; },
  'health-guide-close': () => { ui.healthGuide = false; render(); },
  'health-template': async () => {
    try { await navigator.clipboard.writeText(HEALTH_TEMPLATE); toast('雛形をコピーしました'); } catch { toast('コピーできませんでした。上の文字を長押ししてコピーしてください'); }
  },
  'whats-new-ok': () => { state.seenVersion = VERSION; save(); render(); },
  'setup-open': () => { ui.setup = true; render(); $('#sheet').scrollTop = 0; },
  'setup-close': () => { ui.setup = false; render(); },
  'setup-skip': () => {
    state.selfInit = { date: today(), steps: {} };
    ui.setup = false; save(); toast('スキップしました。設定タブからいつでも自己評価できます'); go('home');
  },
  'decay-ok': (el) => {
    state.decayNotified = [...new Set([...state.decayNotified, ...el.dataset.keys.split(',')])];
    save(); render();
  },
  'del-friend': (el) => {
    const f = state.friends[el.dataset.id];
    if (!f || !confirm(`${f.n}さんをフレンドから外しますか?`)) return;
    delete state.friends[f.id]; ui.friend = null; save(); render();
  },
  share: async () => {
    const card = myCard();
    const url = cardUrl(card);
    const text = `${card.n}さんのSelf Lab(${md(card.d)}時点 Lv.${card.lv}・総合${rankLabel(card.ov)})`;
    if (navigator.share) {
      try { await navigator.share({ title: 'Self Lab', text, url }); } catch { /* 共有シートを閉じた */ }
      return;
    }
    await navigator.clipboard.writeText(`${text}\n${url}`);
    toast('リンクをコピーしました');
  },
  'copy-card': async () => {
    await navigator.clipboard.writeText(cardUrl(ui.incoming.card));
    toast('コピーしました。アプリのフレンドタブに貼り付けてください');
  },
  'add-incoming': () => {
    if (addFriend(ui.incoming.card)) { ui.incoming = null; go('friends'); }
  },
  'log-for': (el) => { ui.logMode = el.dataset.mode; ui.logDate = today(); go('log'); },
  'log-mode': (el) => { ui.logMode = el.dataset.mode; render(); },
  drink: (el) => {
    const input = $('#daily-form [name=alcoholG]');
    const g = Number(el.dataset.g);
    input.value = g === 0 ? '' : String((Number(input.value) || 0) + g);
  },
  'del-measure': (el) => {
    if (!confirm('この測定を削除しますか?')) return;
    state.measures = state.measures.filter((m) => m.id !== el.dataset.id);
    save(); render();
  },
  'quiz-start': (el) => {
    const cat = el.dataset.cat || null;
    ui.quiz = { cat, items: pickQuiz(cat), i: 0, gained: 0 };
    go('learn');
  },
  'quiz-pick': (el) => {
    const it = ui.quiz.items[ui.quiz.i];
    if (it.picked !== null) return;
    it.picked = Number(el.dataset.ci);
    const ok = it.picked === it.q.answer;
    const rec = state.quiz[it.q.id] ?? { n: 0, c: 0 };
    state.quiz[it.q.id] = { n: rec.n + 1, c: rec.c + (ok ? 1 : 0), last: ok, date: today() };
    ui.quiz.gained += gainXp(ok ? 10 : 3);
    save(); render();
  },
  'quiz-next': () => { ui.quiz.i++; render(); window.scrollTo(0, 0); },
  'quiz-end': () => { ui.quiz = null; render(); },
  export: async () => {
    const name = `sp-health-${today()}.json`;
    const file = new File([JSON.stringify(state, null, 2)], name, { type: 'application/json' });
    if (navigator.canShare?.({ files: [file] })) {
      try { await navigator.share({ files: [file], title: name }); } catch { /* 共有シートを閉じた */ }
      return;
    }
    const a = document.createElement('a');
    a.href = URL.createObjectURL(file); a.download = name; a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  },
  wipe: () => {
    if (!confirm('すべての記録を消します。元に戻せません。よろしいですか?')) return;
    state = structuredClone(DEFAULT); save(); ui.quiz = null; go('settings');
  },
};

document.addEventListener('click', (e) => {
  const tip = e.target.closest('[data-tip]');
  if (tip) {
    const id = tip.closest('svg').dataset.chart;
    const out = document.querySelector(`[data-readout="${CSS.escape(id)}"]`);
    if (out) out.textContent = tip.dataset.tip;
    return;
  }
  const el = e.target.closest('[data-action]');
  if (el && actions[el.dataset.action]) { e.preventDefault(); actions[el.dataset.action](el); }
});

// 自己評価のスライダーを動かしたら、ラベルとプレビューをその場で更新する
document.addEventListener('input', (e) => {
  const key = e.target.dataset?.self;
  if (!key) return;
  const v = Number(e.target.value);
  document.querySelector(`[data-out="${key}"]`).textContent = RANKS[v];
  document.querySelector(`[data-tag="${key}"]`).hidden = v < C_MINUS;
  $('#self-preview').innerHTML = selfPreview(readSelfSteps());
});

document.addEventListener('change', (e) => {
  if (e.target.dataset.action === 'log-date') { ui.logDate = e.target.value || today(); render(); }
  if (e.target.dataset.action === 'health-day' && ui.health) { ui.health.day = e.target.value && e.target.value <= today() ? e.target.value : today(); render(); }
  if (e.target.id === 'import-file') importFile(e.target.files[0]);
});

const num = (v) => (v === '' || v === null || v === undefined ? undefined : Number(v));

document.addEventListener('submit', (e) => {
  e.preventDefault();
  const f = new FormData(e.target);
  switch (e.target.id) {
    case 'profile-form': {
      const first = !state.profile;
      state.profile = { sex: f.get('sex'), birthYear: Number(f.get('birthYear')), height: num(f.get('height')) };
      if (first) state.seenVersion = VERSION;
      save(); toast('保存しました');
      if (first) { ui.setup = true; go('home'); } else render();
      break;
    }
    case 'daily-form': {
      const date = f.get('date') || today();
      const trained = f.getAll('trained').filter((t) => TRAININGS.some((x) => x.key === t));
      const sports = f.getAll('sport').filter((t) => SPORTS.some((x) => x.key === t));
      const entry = {
        trained: trained.length ? trained : undefined,
        sports: sports.length ? sports : undefined, sportMin: num(f.get('sportMin')),
        sleepH: num(f.get('sleepH')), rest: num(f.get('rest')), steps: num(f.get('steps')), exMin: num(f.get('exMin')),
        veg: num(f.get('veg')), protein: num(f.get('protein')),
        alcoholG: num(f.get('alcoholG')), memo: (f.get('memo') || '').trim() || undefined,
      };
      state.daily[date] = JSON.parse(JSON.stringify(entry));
      const xp = gainXp(20, `d:${date}`);
      save(); toast(xp ? `保存しました +${xp}XP` : '更新しました'); go('home');
      break;
    }
    case 'measure-form': {
      const date = f.get('date') || today();
      const added = Object.keys(MEASURES).filter((k) => f.get(k) !== '' && f.get(k) !== null)
        .map((k) => ({ id: `${Date.now().toString(36)}-${k}`, key: k, date, value: Number(f.get(k)), t: Date.now() }));
      if (!added.length) { toast('値を1つ以上入れてください'); return; }
      state.measures.push(...added);
      const xp = gainXp(30, `m:${date}`);
      save(); toast(xp ? `${added.length}件保存 +${xp}XP` : `${added.length}件保存しました`); render();
      break;
    }
    case 'health-form': {
      startHealthImport(f.get('text'));
      break;
    }
    case 'self-form': {
      const steps = Object.fromEntries(SELF_ITEMS.map((x) => [x.key, Math.max(0, Math.min(SELF_MAX_STEP, Number(f.get(`self_${x.key}`)) || 0))]));
      state.selfInit = { date: today(), steps };
      // 自己評価の画面で減少のことは案内済み
      state.decayNotified = [...new Set([...state.decayNotified, ...SELF_ITEMS.filter((x) => steps[x.key] >= C_MINUS).map((x) => x.key)])];
      ui.setup = false; save(); toast('自己評価を保存しました'); go('home');
      break;
    }
    case 'nick-form': {
      const nick = String(f.get('nick') || '').trim().slice(0, 20);
      if (!nick) return;
      state.me = { id: state.me?.id ?? newId(), nick };
      save(); toast('保存しました'); render();
      break;
    }
    case 'friend-form': {
      const code = findCode(f.get('code'));
      const card = code && decodeCard(code);
      if (card === 'old') { toast(OLD_CARD); return; }
      if (!card) { toast('カードを読み取れませんでした。リンク全体を貼り付けてください'); return; }
      if (addFriend(card)) render();
      break;
    }
    default:
  }
});

async function importFile(file) {
  if (!file) return;
  try {
    const data = JSON.parse(await file.text());
    if (data?.v !== 1 || !Array.isArray(data.measures) || typeof data.daily !== 'object') throw new Error('形式が違います');
    if (!confirm('今のデータをバックアップの内容で置き換えます。よろしいですか?')) return;
    state = { ...structuredClone(DEFAULT), ...data }; save(); toast('バックアップから戻しました'); go('home');
  } catch (err) {
    toast(`読み込めませんでした:${err.message}`);
  }
}

// フレンドのカードのリンク(#f=...)で開かれたとき
function readHash() {
  const code = findCode(location.hash);
  if (!code) return;
  history.replaceState(null, '', location.pathname + location.search);
  const card = decodeCard(code);
  if (card && card !== 'old') ui.incoming = { card };
  else setTimeout(() => toast(card === 'old' ? OLD_CARD : 'カードを読み取れませんでした'), 300);
}
window.addEventListener('hashchange', () => { readHash(); render(); });

readHash();
render();

if ('serviceWorker' in navigator && location.protocol !== 'file:') {
  navigator.serviceWorker.register('sw.js');
}
