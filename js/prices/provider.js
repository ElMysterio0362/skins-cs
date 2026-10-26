// Camada de preços abstrata (priceProvider).
// - Um adaptador por fonte (Steam, Skinport, manual/importação).
// - Fila por fonte com intervalo mínimo entre chamadas; pausa ao receber 429.
// - Cache com validade de 1 h (localStorage; a lista da Skinport vai no IndexedDB por ser grande).
// - Falhas nunca derrubam a interface: viram status da fonte.
import { load, save } from '../lib/storage.js';
import { idbGet, idbSet, idbDel } from '../lib/idb.js';
import { toBRL } from './fx.js';
import { getMarketplaces, isEnabled } from './marketplaces.js';

export const TTL = 60 * 60 * 1000;
const KEY = 'prices:v1';

let store = load(KEY, {}) || {}; // "fonte|nome" -> registro
const listeners = new Set();
const status = {}; // fonte -> { state: 'ok'|'carregando'|'limitado'|'erro'|'indisponivel', msg, at, until }

function persist() {
  if (!save(KEY, store)) console.warn('[preços] cache cheio; registros antigos de API serão descartados.');
}

function emit(source) {
  for (const fn of listeners) {
    try { fn(source); } catch (e) { console.error(e); }
  }
}
export function onPrices(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

function setStatus(source, state, msg = '', until = 0) {
  status[source] = { state, msg, at: new Date().toISOString(), until };
  emit(source);
}
export const getStatus = (source) => status[source] || null;

const key = (source, name) => source + '|' + name;
const isFresh = (rec) => rec && Date.now() - new Date(rec.fetchedAt || rec.at).getTime() < TTL;

function put(rec) {
  rec.brl = toBRL(rec.price, rec.currency);
  store[key(rec.source, rec.name)] = rec;
}

// ---------------- Adaptador: Skinport (lista inteira) ----------------
const skinport = {
  id: 'skinport',
  data: null, // { fetchedAt, items: Map }
  loadingCache: null,
  inflight: null,
  blockedUntil: 0,

  async ensureCache() {
    if (this.data) return;
    this.loadingCache ||= idbGet('skinport:v1').then((d) => {
      if (d?.items) this.data = { fetchedAt: d.fetchedAt, items: new Map(d.items.map((i) => [i.n, i])) };
    }).catch(() => {});
    await this.loadingCache;
  },

  async refresh(force = false) {
    await this.ensureCache();
    if (!force && this.data && Date.now() - new Date(this.data.fetchedAt).getTime() < TTL) return;
    if (Date.now() < this.blockedUntil) return;
    this.inflight ||= (async () => {
      setStatus(this.id, 'carregando', 'Baixando lista de preços…');
      try {
        const r = await fetch('api/skinport', { cache: 'no-store' });
        if (r.status === 429) {
          const s = Number(r.headers.get('Retry-After')) || 300;
          this.blockedUntil = Date.now() + s * 1000;
          return setStatus(this.id, 'limitado', `Limite de consultas atingido. Nova tentativa em ${Math.ceil(s / 60)} min.`, this.blockedUntil);
        }
        if (r.status === 404) return setStatus(this.id, 'indisponivel', 'Proxy de preços ausente: rode pelo server.mjs ou pela Vercel.');
        const d = await r.json().catch(() => null);
        if (!r.ok || !Array.isArray(d?.items)) return setStatus(this.id, 'erro', d?.error || `HTTP ${r.status}`);
        this.data = { fetchedAt: d.fetchedAt, items: new Map(d.items.map((i) => [i.n, i])) };
        idbSet('skinport:v1', { fetchedAt: d.fetchedAt, items: d.items }).catch(() => {});
        setStatus(this.id, 'ok', `${d.items.length} itens`);
      } catch (e) {
        setStatus(this.id, navigator.onLine ? 'erro' : 'indisponivel', navigator.onLine ? (e?.message || 'Falha de rede') : 'Offline');
      } finally {
        this.inflight = null;
      }
    })();
    return this.inflight;
  },

  get(name) {
    const i = this.data?.items.get(name);
    if (!i) return null;
    return {
      source: this.id, name, price: i.p ?? i.s, currency: 'BRL', kind: 'api',
      at: this.data.fetchedAt, fetchedAt: this.data.fetchedAt, url: i.u,
      extra: { quantidade: i.q, sugerido: i.s, semOferta: i.p == null },
      brl: i.p ?? i.s,
    };
  },
};

// ---------------- Adaptador: Steam (um item por chamada) ----------------
const STEAM_GAP = 3500;
const steam = {
  id: 'steam',
  queue: [],
  pending: new Map(), // nome -> Promise
  running: false,
  blockedUntil: 0,

  request(name) {
    if (this.pending.has(name)) return this.pending.get(name);
    const p = new Promise((resolve) => this.queue.push({ name, resolve }));
    this.pending.set(name, p);
    this.pump();
    return p;
  },

  async pump() {
    if (this.running) return;
    this.running = true;
    while (this.queue.length) {
      if (Date.now() < this.blockedUntil) {
        await new Promise((r) => setTimeout(r, this.blockedUntil - Date.now()));
      }
      const { name, resolve } = this.queue.shift();
      setStatus(this.id, 'carregando', `Consultando (${this.queue.length} na fila)…`);
      try {
        const r = await fetch('api/steam-price?name=' + encodeURIComponent(name));
        if (r.status === 429) {
          const s = Number(r.headers.get('Retry-After')) || 60;
          this.blockedUntil = Date.now() + s * 1000;
          this.queue.unshift({ name, resolve }); // tenta de novo depois da pausa
          setStatus(this.id, 'limitado', `A Steam limitou as consultas. Pausado por ${s} s.`, this.blockedUntil);
          continue;
        }
        if (r.status === 404) {
          setStatus(this.id, 'indisponivel', 'Proxy de preços ausente: rode pelo server.mjs ou pela Vercel.');
          this.queue.forEach((q) => { this.pending.delete(q.name); q.resolve(); });
          this.queue = [];
          this.pending.delete(name);
          resolve();
          break;
        }
        const d = await r.json().catch(() => null);
        if (r.ok && d) {
          put({
            source: this.id, name, price: d.found ? (d.lowest ?? d.median) : null, currency: 'BRL', kind: 'api',
            at: d.fetchedAt, fetchedAt: d.fetchedAt, url: null,
            extra: { mediana: d.median, volume24h: d.volume, semOferta: !d.found },
          });
          persist();
          setStatus(this.id, 'ok', '');
        } else {
          setStatus(this.id, 'erro', d?.error || `HTTP ${r.status}`);
        }
      } catch (e) {
        setStatus(this.id, navigator.onLine ? 'erro' : 'indisponivel', navigator.onLine ? (e?.message || 'Falha de rede') : 'Offline');
      }
      this.pending.delete(name);
      resolve();
      emit(this.id);
      if (this.queue.length) await new Promise((r) => setTimeout(r, STEAM_GAP));
    }
    this.running = false;
  },
};

// ---------------- API pública ----------------

// Preços conhecidos (cache) de um item, em todas as fontes ativas. Síncrono.
export function getPrices(name) {
  const out = [];
  for (const m of getMarketplaces()) {
    if (!isEnabled(m)) continue;
    const manual = store[key(m.id, name)];
    if (m.id === 'skinport') {
      const api = skinport.get(name);
      if (api) out.push(api);
      else if (manual) out.push(manual);
    } else if (manual) out.push(manual);
  }
  return out;
}

// Busca preços nas fontes com API, respeitando cache e limites.
export async function fetchPrices(names, { force = false } = {}) {
  const list = Array.isArray(names) ? names : [names];
  const tasks = [];
  const mp = Object.fromEntries(getMarketplaces().map((m) => [m.id, m]));
  if (isEnabled(mp.skinport)) tasks.push(skinport.refresh(force).then(() => emit('skinport')));
  if (isEnabled(mp.steam)) {
    for (const n of list) {
      const rec = store[key('steam', n)];
      if (force || !(rec?.kind === 'api' && isFresh(rec))) tasks.push(steam.request(n));
    }
  }
  await Promise.allSettled(tasks);
}

export async function initPrices() {
  await skinport.ensureCache();
  emit(null);
}

export const skinportInfo = () => (skinport.data ? { fetchedAt: skinport.data.fetchedAt, count: skinport.data.items.size } : null);
export const refreshSkinport = (force = true) => skinport.refresh(force);

// Preço manual por skin (nunca tratado como tempo real).
export function setManualPrice(source, name, price, currency = 'BRL') {
  const v = Number(String(price).replace(/\./g, '').replace(',', '.'));
  if (!Number.isFinite(v) || v <= 0) throw new Error('Preço inválido.');
  const now = new Date().toISOString();
  put({ source, name, price: v, currency, kind: 'manual', at: now, fetchedAt: now, url: null, extra: {} });
  persist();
  emit(source);
}
export function removePrice(source, name) {
  delete store[key(source, name)];
  persist();
  emit(source);
}

// Importação CSV/JSON. Colunas: market_hash_name, source, price, currency (opcional, BRL), date (opcional).
export function parseImport(text) {
  const trimmed = text.trim();
  let rows;
  if (trimmed.startsWith('[') || trimmed.startsWith('{')) {
    const d = JSON.parse(trimmed);
    rows = Array.isArray(d) ? d : d.prices;
    if (!Array.isArray(rows)) throw new Error('JSON deve ser uma lista de preços.');
  } else {
    const lines = trimmed.split(/\r?\n/).filter((l) => l.trim());
    const sep = lines[0].includes(';') ? ';' : ',';
    const split = (l) => {
      const out = []; let cur = ''; let q = false;
      for (const ch of l) {
        if (ch === '"') q = !q;
        else if (ch === sep && !q) { out.push(cur); cur = ''; }
        else cur += ch;
      }
      out.push(cur);
      return out.map((s) => s.trim());
    };
    const head = split(lines[0]).map((h) => h.toLowerCase());
    rows = lines.slice(1).map((l) => Object.fromEntries(split(l).map((v, i) => [head[i], v])));
  }
  const ok = []; const errors = [];
  const ids = new Set(getMarketplaces().map((m) => m.id));
  rows.forEach((r, i) => {
    const line = i + 2;
    const name = r.market_hash_name || r.name;
    const source = (r.source || r.fonte || '').toLowerCase();
    const raw = String(r.price ?? r.preco ?? '').trim();
    const price = Number(/,\d{1,2}$/.test(raw) ? raw.replace(/\./g, '').replace(',', '.') : raw.replace(/,/g, ''));
    const currency = (r.currency || r.moeda || 'BRL').toUpperCase();
    const date = r.date || r.data ? new Date(r.date || r.data) : new Date();
    if (!name) return errors.push(`Linha ${line}: falta market_hash_name.`);
    if (!ids.has(source)) return errors.push(`Linha ${line}: fonte "${source}" não existe em marketplaces.json.`);
    if (!Number.isFinite(price) || price <= 0) return errors.push(`Linha ${line}: preço inválido.`);
    if (!['BRL', 'USD'].includes(currency)) return errors.push(`Linha ${line}: moeda ${currency} não suportada (use BRL ou USD).`);
    if (Number.isNaN(date.getTime())) return errors.push(`Linha ${line}: data inválida.`);
    ok.push({ source, name, price, currency, kind: 'import', at: date.toISOString(), fetchedAt: date.toISOString(), url: null, extra: {} });
  });
  return { ok, errors };
}

export function applyImport(records) {
  for (const r of records) put(r);
  persist();
  emit(null);
  return records.length;
}

export function priceCacheStats() {
  const recs = Object.values(store);
  return {
    api: recs.filter((r) => r.kind === 'api').length,
    manual: recs.filter((r) => r.kind === 'manual').length,
    import: recs.filter((r) => r.kind === 'import').length,
    skinport: skinportInfo(),
  };
}

// Limpa só dados de API (manuais/importados ficam).
export async function clearApiCache() {
  for (const [k, r] of Object.entries(store)) if (r.kind === 'api') delete store[k];
  persist();
  skinport.data = null;
  skinport.loadingCache = null;
  await idbDel('skinport:v1').catch(() => {});
  emit(null);
}

// Recalcula BRL depois que o câmbio muda.
export function recomputeBRL() {
  for (const r of Object.values(store)) r.brl = toBRL(r.price, r.currency);
  persist();
  emit(null);
}
