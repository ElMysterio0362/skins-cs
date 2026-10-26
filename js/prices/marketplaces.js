// Carrega data/marketplaces.json e aplica as escolhas locais do usuário
// (ativar/desativar fontes) guardadas no localStorage.
import { load, save } from '../lib/storage.js';

let registry = null;
let loading = null;
let overrides = load('marketplaces:enabled', {}) || {};

export function loadMarketplaces() {
  if (registry) return Promise.resolve(registry);
  loading ||= fetch('data/marketplaces.json')
    .then((r) => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json(); })
    .then((d) => { registry = d; return d; })
    .finally(() => { loading = null; });
  return loading;
}

export const getMarketplaces = () => registry?.marketplaces || [];
export const getMarketplace = (id) => getMarketplaces().find((m) => m.id === id) || null;

// Fontes 'ativo' começam ligadas; 'proposto' começam desligadas até o usuário aprovar.
export function isEnabled(m) {
  if (!m) return false;
  if (m.id in overrides) return overrides[m.id];
  return m.status === 'ativo';
}
export function setEnabled(id, on) {
  overrides = { ...overrides, [id]: !!on };
  save('marketplaces:enabled', overrides);
}

export function linkFor(m, marketName, fallback = null) {
  if (fallback) return fallback;
  if (m?.linkSkin) return m.linkSkin.replace('{market_hash_name}', encodeURIComponent(marketName));
  return m?.url || null;
}

// Preço final estimado para o comprador, quando a taxa é conhecida.
export function finalPrice(m, price) {
  if (price == null) return { value: null, known: false };
  const t = m?.taxa?.comprador;
  if (!t || t.percentual == null) return { value: price, known: false };
  return { value: price * (1 + t.percentual / 100) + (t.fixo || 0), known: true };
}
