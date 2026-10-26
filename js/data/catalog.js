// Carregamento e indexação do catálogo.
// Ordem: cache local (IndexedDB, se o usuário atualizou) → snapshot do projeto (data/skins.json).
import { idbGet, idbSet } from '../lib/idb.js';
import { fold } from '../lib/dom.js';
import { normalizeCatalog } from './normalize.js';
import { tierInfo } from './labels.js';

export const REMOTE_URL = 'https://raw.githubusercontent.com/ByMykel/CSGO-API/main/public/api/en/skins.json';
const CACHE_KEY = 'catalog:v1';

let state = null; // { skins, byId, meta, weapons, collections }
let loading = null;

function index(skins, meta) {
  const byId = new Map();
  const weapons = new Map();
  const collections = new Map();
  for (const s of skins) {
    byId.set(s.id, s);
    s._search = fold([s.name, s.pattern, s.weapon.name, s.phase, ...s.collections.map((c) => c.name)].join(' '));
    s._rank = tierInfo(s.tier).rank;
    if (s.weapon.id && !weapons.has(s.weapon.id)) weapons.set(s.weapon.id, { id: s.weapon.id, name: s.weapon.name, cat: s.cat });
    for (const c of s.collections) if (!collections.has(c.id)) collections.set(c.id, c);
  }
  const sortByName = (a, b) => a.name.localeCompare(b.name, 'pt-BR');
  return {
    skins,
    byId,
    meta,
    weapons: [...weapons.values()].sort(sortByName),
    collections: [...collections.values()].sort(sortByName),
  };
}

export function loadCatalog() {
  if (state) return Promise.resolve(state);
  if (loading) return loading;
  loading = (async () => {
    let cached = null;
    try { cached = await idbGet(CACHE_KEY); } catch (e) { console.warn('[catálogo] cache indisponível:', e?.message); }
    if (cached?.skins?.length) {
      state = index(cached.skins, { ...cached.meta, origin: 'cache' });
      return state;
    }
    const res = await fetch('data/skins.json');
    if (!res.ok) throw new Error(`Não foi possível ler o catálogo local (HTTP ${res.status}).`);
    const data = await res.json();
    state = index(data.skins, { ...data.meta, origin: 'snapshot' });
    return state;
  })();
  loading.catch(() => { loading = null; });
  return loading;
}

// "Atualizar catálogo": baixa o dataset original, normaliza e grava no cache.
export async function refreshCatalog() {
  const res = await fetch(REMOTE_URL, { cache: 'no-store' });
  if (!res.ok) throw new Error(`O GitHub respondeu HTTP ${res.status}.`);
  const skins = normalizeCatalog(await res.json());
  if (!skins.length) throw new Error('O catálogo baixado veio vazio.');
  const meta = { source: REMOTE_URL, generatedAt: new Date().toISOString(), count: skins.length };
  try { await idbSet(CACHE_KEY, { meta, skins }); } catch (e) { console.warn('[catálogo] não foi possível gravar cache:', e?.message); }
  state = index(skins, { ...meta, origin: 'cache' });
  loading = null;
  return state;
}

export const getCatalog = () => state;
