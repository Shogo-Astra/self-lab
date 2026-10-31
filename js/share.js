// フレンド共有カード。サーバーは使わず、点数とランクだけをURLの # 以降(サーバーに送られない部分)に入れて渡す。
// 載せるもの(v3):ID・ニックネーム・日付・レベル・総合ランク・身体能力7項目と9部位とコンディション4項目のランク段階・連続記録日数。
// v2(部位6:腕・肩・胸・腹・背中・お尻と脚)も読み、脚の値を4つの脚の部位に広げる。
// 測定値そのものは載せない。ランク段階は 0(G−)〜29(SSS+)。

const B64 = { '+': '-', '/': '_', '=': '' };

export function encodeCard(card) {
  const bytes = new TextEncoder().encode(JSON.stringify(card));
  let bin = '';
  bytes.forEach((b) => { bin += String.fromCharCode(b); });
  return btoa(bin).replace(/[+/=]/g, (c) => B64[c]);
}

const isStep = (v) => v === null || (Number.isInteger(v) && v >= 0 && v <= 29);
const steps = (a, n) => Array.isArray(a) && a.length === n && a.every(isStep);

// v2 の部位(6)を v3 の部位(9)に広げる
export const upgradeParts = (p) => (p.length === 6 ? [...p.slice(0, 5), p[5], p[5], p[5], p[5]] : p);

// 受け取ったコードは信用せず、形を確かめてから使う。古い形式(v1)は 'old' を返す
export function decodeCard(code) {
  try {
    const b64 = code.replace(/-/g, '+').replace(/_/g, '/');
    const bin = atob(b64 + '='.repeat((4 - (b64.length % 4)) % 4));
    const c = JSON.parse(new TextDecoder().decode(Uint8Array.from(bin, (ch) => ch.charCodeAt(0))));
    if (c?.v === 1) return 'old';
    const ok = c && (c.v === 2 || c.v === 3)
      && typeof c.id === 'string' && /^[a-z0-9]{6,16}$/.test(c.id)
      && typeof c.n === 'string' && c.n.trim().length >= 1 && c.n.length <= 20
      && typeof c.d === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(c.d)
      && Number.isInteger(c.lv) && c.lv >= 1 && c.lv <= 999
      && isStep(c.ov) && steps(c.a, 7) && steps(c.p, c.v === 2 ? 6 : 9) && steps(c.c, 4)
      && Number.isInteger(c.sk) && c.sk >= 0 && c.sk <= 9999;
    if (!ok) return null;
    return { v: 3, id: c.id, n: c.n.trim(), d: c.d, lv: c.lv, ov: c.ov, a: c.a, p: upgradeParts(c.p), c: c.c, sk: c.sk };
  } catch {
    return null;
  }
}

// 貼り付けられた文(メッセージ全体・URL・コードのみ)からコードを取り出す
export function findCode(text) {
  const m = String(text).match(/#f=([A-Za-z0-9_-]+)/) ?? String(text).trim().match(/^([A-Za-z0-9_-]{20,})$/);
  return m ? m[1] : null;
}

export const newId = () => Array.from(crypto.getRandomValues(new Uint8Array(8)), (b) => (b % 36).toString(36)).join('');
