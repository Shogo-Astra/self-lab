import {
  SOURCES, MEASURES, STATS, STRENGTH_KEYS, DRINKS, computeStats, overall, rankOf, levelFromXp,
  series, isoDate, lastDays, strengthTarget, ageOf, vo2Ref, bmiRange, waistLimit, stepsTarget, alcoholLimit,
} from './standards.js';
import { TIPS, QUIZ, QUIZ_CATS } from './content.js';
import { radar, lineChart, barChart } from './charts.js';

const VERSION = '0.1.0';
const KEY = 'sp-health-v1';
const DEFAULT = { v: 1, profile: null, measures: [], daily: {}, quiz: {}, targets: {}, xp: 0, awarded: {} };

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
const save = () => localStorage.setItem(KEY, JSON.stringify(state));

const ui = { tab: state.profile ? 'home' : 'settings', logMode: 'daily', logDate: isoDate(new Date()), detail: null, quiz: null };

// ---------- 小道具 ----------

const $ = (sel) => document.querySelector(sel);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const today = () => isoDate(new Date());
const md = (iso) => { const [, m, d] = iso.split('-'); return `${Number(m)}/${Number(d)}`; };
const shuffle = (a) => { const b = [...a]; for (let i = b.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [b[i], b[j]] = [b[j], b[i]]; } return b; };
const srcName = (k) => SOURCES[k]?.name ?? k;
const srcCheck = (k) => SOURCES[k]?.check;

function toast(msg) {
  const el = $('#toast');
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(toast.t);
  toast.t = setTimeout(() => el.classList.remove('show'), 2200);
}

function gainXp(n, awardKey) {
  if (awardKey) {
    if (state.awarded[awardKey]) return 0;
    state.awarded[awardKey] = 1;
  }
  const before = levelFromXp(state.xp).level;
  state.xp += n;
  const after = levelFromXp(state.xp).level;
  if (after > before) setTimeout(() => toast(`レベルアップ! Lv.${after}`), 2300);
  return n;
}

function streak() {
  let d = new Date();
  if (!state.daily[isoDate(d)]) d.setDate(d.getDate() - 1);
  let n = 0;
  while (state.daily[isoDate(d)]) { n++; d.setDate(d.getDate() - 1); }
  return n;
}

const srcList = (keys) => (keys?.length
  ? `<p class="src">出典:${keys.map((k) => esc(srcName(k))).join(' / ')}${keys.some(srcCheck) ? ' <span class="chk">【要確認あり】</span>' : ''}</p>`
  : '');

// ---------- ステータス ----------

function viewHome() {
  if (!state.profile) {
    return `<section class="card"><h2>はじめに</h2><p>年代・性別ごとの基準値で採点するため、まずプロフィールを設定してください。</p>
      <button class="btn primary" data-action="tab" data-tab="settings">プロフィールを設定</button></section>`;
  }
  const stats = computeStats(state, QUIZ.length);
  const ov = overall(stats);
  const lv = levelFromXp(state.xp);
  const sk = streak();
  const axes = STATS.map((s) => ({ key: s.key, name: s.name, score: stats[s.key].score, rank: rankOf(stats[s.key].score) }));
  const loggedToday = !!state.daily[today()];

  return `
  <section class="hero card">
    <div class="hero-top">
      <div><p class="t-label">レベル</p><p class="lv">Lv.${lv.level}</p></div>
      <div class="hero-rank"><p class="t-label">総合ランク</p><p class="rank-big">${rankOf(ov)}<span>${ov ?? '—'}</span></p></div>
    </div>
    <div class="xpbar" role="progressbar" aria-valuemin="0" aria-valuemax="${lv.need}" aria-valuenow="${lv.into}"><i style="width:${(lv.into / lv.need) * 100}%"></i></div>
    <p class="t-muted">次のレベルまで ${lv.need - lv.into} XP ・ 連続記録 ${sk} 日</p>
  </section>
  ${loggedToday ? '' : `<button class="card cta" data-action="tab" data-tab="log">今日のチェックインがまだです <b>記録する +20XP</b></button>`}
  <section class="card">${radar(axes)}<p class="t-muted center">項目をタップすると内訳と伸ばし方が見られます</p></section>
  <section class="card list">
    ${axes.map((a) => `<button class="row" data-action="detail" data-stat="${a.key}">
      <span class="badge r-${a.rank}">${a.rank}</span>
      <span class="row-name">${a.name}${stats[a.key].selfBased ? '<small>自己基準</small>' : ''}</span>
      <span class="meter"><i style="width:${a.score ?? 0}%"></i></span>
      <span class="row-val">${a.score ?? '—'}</span>
    </button>`).join('')}
  </section>
  <p class="t-muted center small">点数はゲーム用の目安で、医学的な判定ではありません。</p>`;
}

function detailCharts(key) {
  const m = state.measures;
  const line = (k, ref) => { const s = series(m, k); return s.length ? `<h3>${MEASURES[k].label}</h3>${lineChart({ pts: s, unit: MEASURES[k].unit, ref, id: k })}` : ''; };
  const days14 = lastDays(14);
  const bars = (field, label, unit, ref) => {
    const days = days14.map((date) => { const v = state.daily[date]?.[field]; return { date, value: v === undefined || v === '' || v === null ? null : Number(v) }; });
    const c = barChart({ days, unit, ref, id: field });
    return c ? `<h3>${label}(14日)</h3>${c}` : '';
  };
  const p = state.profile; const age = ageOf(p);
  switch (key) {
    case 'endurance': {
      const ref = vo2Ref(p.sex, age);
      return line('vo2max', { value: ref.ml, label: `基準 ${ref.ml.toFixed(1)}` }) + line('rhr');
    }
    case 'strength':
      return STRENGTH_KEYS.map((k) => { const t = strengthTarget(state, k); return line(k, t ? { value: t.target, label: `目標 ${t.target}` } : null); }).join('');
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
        + bars('exMin', '運動', '分') + bars('alcoholG', '純アルコール', 'g', { value: alcoholLimit(p.sex), label: `${alcoholLimit(p.sex)}g` })
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

function viewDetail(key) {
  const meta = STATS.find((s) => s.key === key);
  const r = computeStats(state, QUIZ.length)[key];
  const tips = TIPS[key] ?? [];
  return `<div class="sheet" role="dialog" aria-label="${meta.name}の詳細">
    <header class="sheet-head"><button class="btn ghost" data-action="close">‹ 戻る</button><h2>${meta.name}</h2><span></span></header>
    <section class="card score-head">
      <span class="badge big r-${rankOf(r.score)}">${rankOf(r.score)}</span>
      <div><p class="score-num">${r.score ?? '—'}<small> / 100</small></p>
      ${r.selfBased ? '<p class="t-muted">公的な年代別基準を確認できるまで、初回の測定値をもとにした自己基準で採点します</p>' : ''}
      ${r.missing ? `<p class="t-muted">${r.missing}</p>` : ''}</div>
    </section>
    ${r.parts.length ? `<section class="card"><h3>内訳</h3>${r.parts.map((p) => `<div class="part">
      <div class="part-top"><b>${esc(p.label)}</b><span>${esc(p.value)}</span><span class="part-score">${p.score}点</span></div>
      <span class="meter"><i style="width:${p.score}%"></i></span>
      <p class="t-muted">${esc(p.note)}</p>${srcList(p.src)}</div>`).join('')}</section>` : ''}
    ${(() => { const c = detailCharts(key); return c ? `<section class="card">${c}<p class="t-muted small">点や棒をタップすると値が表示されます</p></section>` : ''; })()}
    <section class="card"><h3>伸ばし方</h3>${tips.map((t) => `<details class="tip"><summary>${esc(t.title)}</summary><p>${esc(t.body)}</p>${srcList(t.src)}</details>`).join('')}
      ${key === 'knowledge' ? '<button class="btn primary" data-action="quiz-start">クイズに挑戦</button>' : ''}
      ${key === 'strength' ? '<button class="btn" data-action="tab" data-tab="settings">目標値を変える</button>' : ''}
    </section>
    ${key === 'knowledge' ? '' : `<button class="btn primary wide" data-action="log-for" data-mode="${key === 'recovery' || key === 'habit' ? 'daily' : 'measure'}">記録する</button>`}
  </div>`;
}

// ---------- 記録 ----------

function radios(name, opts, cur) {
  return `<div class="seg">${opts.map(([v, label]) => `<label><input type="radio" name="${name}" value="${v}" ${String(cur) === String(v) ? 'checked' : ''}><span>${label}</span></label>`).join('')}</div>`;
}
const val = (v) => (v === undefined || v === null ? '' : esc(v));

function viewDaily() {
  const d = state.daily[ui.logDate] ?? {};
  return `<form id="daily-form" class="card form" autocomplete="off">
    <label class="field"><span>日付</span><input type="date" name="date" value="${ui.logDate}" max="${today()}" data-action="log-date"></label>
    <h3>回復</h3>
    <label class="field"><span>睡眠時間</span><span class="unit-in"><input type="number" name="sleepH" inputmode="decimal" step="0.5" min="0" max="16" value="${val(d.sleepH)}" placeholder="7"><em>時間</em></span></label>
    <div class="field"><span>睡眠で休養がとれた感覚</span>${radios('rest', [[1, '1'], [2, '2'], [3, '3'], [4, '4'], [5, '5']], d.rest)}<small class="t-muted">1 まったく とれない 〜 5 十分とれた</small></div>
    <h3>活動</h3>
    <label class="field"><span>歩数</span><span class="unit-in"><input type="number" name="steps" inputmode="numeric" min="0" value="${val(d.steps)}" placeholder="8000"><em>歩</em></span></label>
    <label class="field"><span>息が弾む運動</span><span class="unit-in"><input type="number" name="exMin" inputmode="numeric" min="0" value="${val(d.exMin)}" placeholder="0"><em>分</em></span></label>
    <label class="field check"><input type="checkbox" name="strength" ${d.strength ? 'checked' : ''}><span>筋トレをした</span></label>
    <h3>食事・飲酒</h3>
    <label class="field"><span>野菜(小鉢)</span><span class="unit-in"><input type="number" name="veg" inputmode="numeric" min="0" max="10" value="${val(d.veg)}" placeholder="0"><em>皿</em></span></label>
    <div class="field"><span>主菜(肉・魚・卵・大豆)を食べた食事</span>${radios('protein', [[0, '0'], [1, '1'], [2, '2'], [3, '3']], d.protein)}</div>
    <label class="field"><span>純アルコール</span><span class="unit-in"><input type="number" name="alcoholG" inputmode="decimal" min="0" value="${val(d.alcoholG)}" placeholder="0"><em>g</em></span></label>
    <div class="chips">${DRINKS.map((x) => `<button type="button" class="chip" data-action="drink" data-g="${x.g}">+${x.label}(${x.g}g)</button>`).join('')}<button type="button" class="chip" data-action="drink" data-g="0">リセット</button></div>
    <label class="field"><span>メモ</span><input type="text" name="memo" value="${val(d.memo)}" placeholder="体調・気づいたこと"></label>
    <button class="btn primary wide" type="submit">${state.daily[ui.logDate] ? '更新する' : '保存する +20XP'}</button>
  </form>`;
}

function viewMeasure() {
  const groups = [['endurance', '持久力'], ['strength', '筋力'], ['body', 'からだ']];
  const recent = [...state.measures].sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : b.t - a.t)).slice(0, 20);
  return `<form id="measure-form" class="card form" autocomplete="off">
    <label class="field"><span>測定日</span><input type="date" name="date" value="${ui.logDate}" max="${today()}"></label>
    ${groups.map(([g, name]) => `<h3>${name}</h3>${Object.entries(MEASURES).filter(([, m]) => m.stat === g).map(([k, m]) => `
      <label class="field"><span>${m.label}<small>${m.hint}</small></span><span class="unit-in"><input type="number" name="${k}" inputmode="decimal" step="${m.step}" min="0"><em>${m.unit}</em></span></label>`).join('')}`).join('')}
    <button class="btn primary wide" type="submit">保存する +30XP</button>
  </form>
  ${recent.length ? `<section class="card"><h3>最近の測定</h3><div class="list">${recent.map((r) => `<div class="row static">
    <span class="row-name">${md(r.date)} ${esc(MEASURES[r.key]?.label ?? r.key)}</span><span class="row-val">${esc(r.value)} ${esc(MEASURES[r.key]?.unit ?? '')}</span>
    <button class="btn ghost small" data-action="del-measure" data-id="${esc(r.id)}" aria-label="削除">削除</button></div>`).join('')}</div></section>` : ''}`;
}

function viewLog() {
  if (!state.profile) return viewHome();
  return `<div class="seg big">${[['daily', '今日のチェックイン'], ['measure', '測定']].map(([k, l]) => `<button class="${ui.logMode === k ? 'on' : ''}" data-action="log-mode" data-mode="${k}">${l}</button>`).join('')}</div>
    ${ui.logMode === 'daily' ? viewDaily() : viewMeasure()}`;
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
  return `<section class="card"><h2>スポーツファーマシー・クイズ</h2><p class="t-muted">マスター ${mastered} / ${total} 問。正解 +10XP、不正解 +3XP</p>
    <button class="btn primary wide" data-action="quiz-start">5問チャレンジ</button>
    <div class="chips">${Object.entries(QUIZ_CATS).map(([c, n]) => `<button class="chip" data-action="quiz-start" data-cat="${c}">${n}</button>`).join('')}</div>
  </section>
  ${STATS.map((s) => `<section class="card"><h3>${s.name}を伸ばす</h3>${(TIPS[s.key] ?? []).map((t) => `<details class="tip"><summary>${esc(t.title)}</summary><p>${esc(t.body)}</p>${srcList(t.src)}</details>`).join('')}</section>`).join('')}`;
}

// ---------- 設定 ----------

function viewSettings() {
  const p = state.profile ?? {};
  const strength = STRENGTH_KEYS.map((k) => ({ k, t: strengthTarget(state, k) })).filter((x) => x.t);
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
  ${strength.length ? `<form id="target-form" class="card form"><h2>筋力の目標値(自己基準)</h2>
    <p class="t-muted">初回の測定値を50点、目標値を100点として採点します。</p>
    ${strength.map(({ k, t }) => `<label class="field"><span>${MEASURES[k].label}<small>初回 ${t.base} ${MEASURES[k].unit}</small></span><span class="unit-in"><input type="number" name="${k}" inputmode="decimal" step="${MEASURES[k].step}" value="${t.target}"><em>${MEASURES[k].unit}</em></span></label>`).join('')}
    <button class="btn primary wide" type="submit">保存する</button></form>` : ''}
  <section class="card"><h2>データ</h2>
    <p class="t-muted">記録はこのiPhoneのブラウザの中にだけあります。機種変更や削除に備えて、ときどき書き出してください。</p>
    <button class="btn wide" data-action="export">バックアップを書き出す</button>
    <label class="btn wide">バックアップから戻す<input type="file" accept="application/json,.json" id="import-file" hidden></label>
    <button class="btn danger wide" data-action="wipe">すべてのデータを消す</button>
  </section>
  <section class="card"><h2>採点のしかた</h2>
    <p>各能力は0〜100点。公的な基準値に届くと60点前後になるように換算し、S(90〜)・A(80〜)・B(65〜)・C(50〜)・D(35〜)・E に分けます。
    筋力は公的な年代別基準を確認できるまで自己基準です。点数はゲーム用の目安で、医学的な判定ではありません。</p>
    <h3>出典</h3><ul class="srcs">${Object.values(SOURCES).map((s) => `<li>${esc(s.name)}<small>${esc(s.org)}</small></li>`).join('')}</ul>
    <h3>要確認</h3><ul class="srcs chk">${checks.map((c) => `<li>${esc(c)}</li>`).join('')}</ul>
  </section>
  <p class="t-muted center small">Sports Pharmacy Self Lab v${VERSION}</p>`;
}

// ---------- 描画 ----------

function render() {
  const views = { home: viewHome, log: viewLog, learn: viewLearn, settings: viewSettings };
  $('#main').innerHTML = views[ui.tab]();
  $('#sheet').innerHTML = ui.detail ? viewDetail(ui.detail) : '';
  document.body.classList.toggle('sheet-open', !!ui.detail);
  document.querySelectorAll('#tabs button').forEach((b) => b.classList.toggle('on', b.dataset.tab === ui.tab));
}

function go(tab) { ui.tab = tab; ui.detail = null; render(); window.scrollTo(0, 0); }

// ---------- 操作 ----------

const actions = {
  tab: (el) => go(el.dataset.tab),
  detail: (el) => { ui.detail = el.dataset.stat; render(); $('#sheet').scrollTop = 0; },
  close: () => { ui.detail = null; render(); },
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

document.addEventListener('change', (e) => {
  if (e.target.dataset.action === 'log-date') { ui.logDate = e.target.value || today(); render(); }
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
      save(); toast('保存しました');
      if (first) go('home'); else render();
      break;
    }
    case 'daily-form': {
      const date = f.get('date') || today();
      const entry = {
        sleepH: num(f.get('sleepH')), rest: num(f.get('rest')), steps: num(f.get('steps')), exMin: num(f.get('exMin')),
        strength: f.get('strength') === 'on', veg: num(f.get('veg')), protein: num(f.get('protein')),
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
    case 'target-form': {
      for (const k of STRENGTH_KEYS) { const v = num(f.get(k)); if (v !== undefined) state.targets[k] = v; }
      save(); toast('目標値を保存しました'); render();
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

render();

if ('serviceWorker' in navigator && location.protocol !== 'file:') {
  navigator.serviceWorker.register('sw.js');
}
