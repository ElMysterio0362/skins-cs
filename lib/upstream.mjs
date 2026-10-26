// Chamadas a APIs de preço feitas no servidor (o navegador não pode por CORS).
// Usado pelo server.mjs (local) e pelas funções em api/ (Vercel).
// Cada função devolve { status, body, headers } com corpo JSON.

const memo = new Map(); // cache em memória: chave -> { exp, value }

function cached(key) {
  const hit = memo.get(key);
  if (hit && hit.exp > Date.now()) return hit.value;
  memo.delete(key);
  return null;
}
function remember(key, value, ms) {
  if (memo.size > 5000) memo.delete(memo.keys().next().value);
  memo.set(key, { exp: Date.now() + ms, value });
}

const json = (status, data, extra = {}) => ({
  status,
  body: JSON.stringify(data),
  headers: { 'Content-Type': 'application/json; charset=utf-8', ...extra },
});

// ---- Skinport: lista inteira numa chamada (limite 8 req / 5 min) ----
const SKINPORT_URL = 'https://api.skinport.com/v1/items?app_id=730&currency=BRL';
const SKINPORT_TTL = 10 * 60 * 1000;
let skinportInflight = null;
let skinportBlockedUntil = 0;

export async function skinportItems() {
  const hit = cached('skinport');
  if (hit) return json(200, hit, { 'Cache-Control': 'public, s-maxage=600' });
  if (Date.now() < skinportBlockedUntil) {
    return json(429, { error: 'Limite da Skinport atingido; tente mais tarde.' }, { 'Retry-After': String(Math.ceil((skinportBlockedUntil - Date.now()) / 1000)) });
  }
  skinportInflight ||= (async () => {
    try {
      const r = await fetch(SKINPORT_URL, { headers: { 'Accept-Encoding': 'br' }, signal: AbortSignal.timeout(20000) });
      if (r.status === 429) {
        skinportBlockedUntil = Date.now() + 5 * 60 * 1000;
        return json(429, { error: 'Limite da Skinport atingido.' }, { 'Retry-After': '300' });
      }
      if (!r.ok) return json(502, { error: `Skinport respondeu HTTP ${r.status}` });
      const list = await r.json();
      if (!Array.isArray(list)) return json(502, { error: 'Resposta inesperada da Skinport.' });
      // Enxuga: só o que o site usa.
      const data = {
        fetchedAt: new Date().toISOString(),
        currency: 'BRL',
        items: list
          .filter((i) => i && i.market_hash_name && (i.min_price != null || i.suggested_price != null))
          .map((i) => ({ n: i.market_hash_name, p: i.min_price ?? null, s: i.suggested_price ?? null, q: i.quantity ?? null, u: i.item_page || null })),
      };
      remember('skinport', data, SKINPORT_TTL);
      return json(200, data, { 'Cache-Control': 'public, s-maxage=600' });
    } catch (e) {
      return json(502, { error: 'Skinport indisponível: ' + (e?.message || e) });
    } finally {
      skinportInflight = null;
    }
  })();
  return skinportInflight;
}

// ---- Steam: um item por chamada (endpoint não oficial) ----
const STEAM_TTL = 60 * 60 * 1000;
const STEAM_GAP = 3500;
let steamNext = 0;
let steamBlockedUntil = 0;

// "R$ 1.234,56" -> 1234.56
export function parseBRL(s) {
  if (typeof s !== 'string') return null;
  const clean = s.replace(/[^\d,.-]/g, '').replace(/\./g, '').replace(',', '.');
  const v = parseFloat(clean);
  return Number.isFinite(v) ? v : null;
}

export async function steamPrice(name) {
  if (!name || name.length > 200) return json(400, { error: 'Nome inválido.' });
  const key = 'steam:' + name;
  const hit = cached(key);
  if (hit) return json(200, hit, { 'Cache-Control': 'public, s-maxage=3600' });
  if (Date.now() < steamBlockedUntil) {
    return json(429, { error: 'Steam limitou as consultas; tente mais tarde.' }, { 'Retry-After': String(Math.ceil((steamBlockedUntil - Date.now()) / 1000)) });
  }
  // Espaça as chamadas para respeitar o limite.
  const wait = Math.max(0, steamNext - Date.now());
  steamNext = Date.now() + wait + STEAM_GAP;
  if (wait) await new Promise((r) => setTimeout(r, wait));
  try {
    const url = 'https://steamcommunity.com/market/priceoverview/?appid=730&currency=7&market_hash_name=' + encodeURIComponent(name);
    const r = await fetch(url, { signal: AbortSignal.timeout(15000) });
    if (r.status === 429) {
      steamBlockedUntil = Date.now() + 60 * 1000;
      return json(429, { error: 'Steam limitou as consultas.' }, { 'Retry-After': '60' });
    }
    if (!r.ok) return json(502, { error: `Steam respondeu HTTP ${r.status}` });
    const d = await r.json();
    const data = {
      fetchedAt: new Date().toISOString(),
      currency: 'BRL',
      found: d?.success === true && (d.lowest_price || d.median_price) ? true : false,
      lowest: parseBRL(d?.lowest_price),
      median: parseBRL(d?.median_price),
      volume: d?.volume ? Number(String(d.volume).replace(/\D/g, '')) || null : null,
    };
    remember(key, data, STEAM_TTL);
    return json(200, data, { 'Cache-Control': 'public, s-maxage=3600' });
  } catch (e) {
    return json(502, { error: 'Steam indisponível: ' + (e?.message || e) });
  }
}
