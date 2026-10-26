// Câmbio USD→BRL (para fontes internacionais cotadas em dólar).
// Fonte automática: AwesomeAPI (gratuita, brasileira). Também aceita valor manual.
import { load, save } from '../lib/storage.js';

const KEY = 'fx:v1';
export const FX_URL = 'https://economia.awesomeapi.com.br/json/last/USD-BRL';

let fx = load(KEY, null); // { rate, at, source: 'awesomeapi'|'manual' }

export const getFx = () => fx;

export async function refreshFx() {
  const r = await fetch(FX_URL, { cache: 'no-store' });
  if (!r.ok) throw new Error(`Cotação indisponível (HTTP ${r.status}).`);
  const d = await r.json();
  const rate = parseFloat(d?.USDBRL?.bid);
  if (!Number.isFinite(rate) || rate <= 0) throw new Error('Resposta de câmbio inesperada.');
  const ts = Number(d.USDBRL.timestamp);
  fx = { rate, at: Number.isFinite(ts) ? new Date(ts * 1000).toISOString() : new Date().toISOString(), source: 'awesomeapi' };
  save(KEY, fx);
  return fx;
}

export function setManualFx(rate) {
  const v = Number(String(rate).replace(',', '.'));
  if (!Number.isFinite(v) || v <= 0) throw new Error('Informe uma taxa válida, ex.: 5,40');
  fx = { rate: v, at: new Date().toISOString(), source: 'manual' };
  save(KEY, fx);
  return fx;
}

// Converte para BRL. Retorna null se faltar câmbio.
export function toBRL(amount, currency) {
  if (amount == null || !Number.isFinite(amount)) return null;
  if (!currency || currency === 'BRL') return amount;
  if (currency === 'USD') return fx?.rate ? amount * fx.rate : null;
  return null;
}

export const formatBRL = (v) => (v == null || !Number.isFinite(v) ? '—' : v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }));
