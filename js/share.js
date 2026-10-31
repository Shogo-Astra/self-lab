// フレンド共有カード。サーバーは使わず、点数とランクだけをURLの # 以降(サーバーに送られない部分)に入れて渡す。
// 載せるもの:ID・ニックネーム・日付・レベル・総合点・6能力の点数・連続記録日数。測定値そのものは載せない。

const B64 = { '+': '-', '/': '_', '=': '' };

export function encodeCard(card) {
  const bytes = new TextEncoder().encode(JSON.stringify(card));
  let bin = '';
  bytes.forEach((b) => { bin += String.fromCharCode(b); });
  return btoa(bin).replace(/[+/=]/g, (c) => B64[c]);
}

const isScore = (v) => v === null || (Number.isInteger(v) && v >= 0 && v <= 100);

// 受け取ったコードは信用せず、形を確かめてから使う
export function decodeCard(code) {
  try {
    const b64 = code.replace(/-/g, '+').replace(/_/g, '/');
    const bin = atob(b64 + '='.repeat((4 - (b64.length % 4)) % 4));
    const c = JSON.parse(new TextDecoder().decode(Uint8Array.from(bin, (ch) => ch.charCodeAt(0))));
    const ok = c && c.v === 1
      && typeof c.id === 'string' && /^[a-z0-9]{6,16}$/.test(c.id)
      && typeof c.n === 'string' && c.n.trim().length >= 1 && c.n.length <= 20
      && typeof c.d === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(c.d)
      && Number.isInteger(c.lv) && c.lv >= 1 && c.lv <= 999
      && isScore(c.ov)
      && Array.isArray(c.s) && c.s.length === 6 && c.s.every(isScore)
      && Number.isInteger(c.sk) && c.sk >= 0 && c.sk <= 9999;
    if (!ok) return null;
    return { v: 1, id: c.id, n: c.n.trim(), d: c.d, lv: c.lv, ov: c.ov, s: c.s, sk: c.sk };
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
