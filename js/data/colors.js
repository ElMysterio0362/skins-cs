// Extração da cor dominante das imagens das skins via <canvas>.
// - Fila com concorrência limitada e pausa entre lotes.
// - Resultado guardado no localStorage (chave por id da skin).
// - Se a CDN da Steam não liberar CORS, tenta o proxy local /img do server.mjs.
import { load, save } from '../lib/storage.js';
import { analyzePixels } from './colorAlgo.js';

const KEY = 'colors:v1';
const RETRY_FAIL_MS = 24 * 3600 * 1000;
const SIZE = 48;
const CONCURRENCY = 6;

let cache = load(KEY, {}) || {};
const listeners = new Set();
const queue = [];
const queued = new Set();
let running = 0;
let saveTimer = null;
let proxyAvailable = null; // null = ainda não testado
let canvas = null;
let consecutiveFails = 0;
let stalled = false; // pausa automática quando as imagens parecem inacessíveis
const STALL_AFTER = 25;

export const getColor = (id) => {
  const c = cache[id];
  return c && !c.err ? c : null;
};
export const hasResult = (id) => {
  const c = cache[id];
  if (!c) return false;
  return !c.err || Date.now() - c.t < RETRY_FAIL_MS;
};
export const isFailed = (id) => !!cache[id]?.err;

export function onColor(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function stats(skins) {
  let done = 0; let failed = 0;
  for (const s of skins) {
    const c = cache[s.id];
    if (c?.err) failed++;
    else if (c) done++;
  }
  return { done, failed, total: skins.length, pending: queue.length + running, stalled };
}

// Throttle (não debounce): com a fila rodando, um debounce nunca chegaria a salvar.
function persist() {
  if (saveTimer) return;
  saveTimer = setTimeout(() => { saveTimer = null; save(KEY, cache); }, 1000);
}
addEventListener('pagehide', () => save(KEY, cache));

// Retoma após pausa automática; falhas antigas voltam a ser tentadas.
export function resumeColors() {
  stalled = false;
  consecutiveFails = 0;
  for (const id of Object.keys(cache)) if (cache[id].err) delete cache[id];
}

export function clearColors() {
  stalled = false;
  consecutiveFails = 0;
  cache = {};
  queue.length = 0;
  queued.clear();
  save(KEY, cache);
  emit(null);
}

function emit(id) {
  for (const fn of listeners) {
    try { fn(id, id ? cache[id] : null); } catch (e) { console.error(e); }
  }
}

async function checkProxy() {
  if (proxyAvailable !== null) return proxyAvailable;
  try {
    const r = await fetch('api/health', { cache: 'no-store' });
    proxyAvailable = r.ok && (await r.json())?.imgProxy === true;
  } catch {
    proxyAvailable = false;
  }
  return proxyAvailable;
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.decoding = 'async';
    const timer = setTimeout(() => { img.src = ''; reject(new Error('timeout')); }, 15000);
    img.onload = () => { clearTimeout(timer); resolve(img); };
    img.onerror = () => { clearTimeout(timer); reject(new Error('load')); };
    img.src = src;
  });
}

function readPixels(img) {
  canvas ||= Object.assign(document.createElement('canvas'), { width: SIZE, height: SIZE });
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  ctx.clearRect(0, 0, SIZE, SIZE);
  // Mantém a proporção para não distorcer a área ocupada por cada cor.
  const ratio = Math.min(SIZE / img.naturalWidth, SIZE / img.naturalHeight) || 1;
  const w = img.naturalWidth * ratio; const h = img.naturalHeight * ratio;
  ctx.drawImage(img, (SIZE - w) / 2, (SIZE - h) / 2, w, h);
  return ctx.getImageData(0, 0, SIZE, SIZE).data; // lança SecurityError se o canvas estiver "contaminado"
}

async function analyze(skin) {
  if (!skin.image) throw new Error('sem imagem');
  const sources = [skin.image];
  if (await checkProxy()) sources.push('img?u=' + encodeURIComponent(skin.image));
  let lastErr;
  for (const src of sources) {
    try {
      const result = analyzePixels(readPixels(await loadImage(src)));
      if (!result) throw new Error('imagem vazia');
      return result;
    } catch (e) {
      lastErr = e;
    }
  }
  throw lastErr;
}

async function pump() {
  while (running < CONCURRENCY && queue.length) {
    const skin = queue.shift();
    running++;
    analyze(skin)
      .then((res) => {
        cache[skin.id] = { hex: res.hex, families: res.families };
        consecutiveFails = 0;
      })
      .catch((e) => {
        cache[skin.id] = { err: String(e?.message || e), t: Date.now() };
        if (++consecutiveFails >= STALL_AFTER && !stalled) {
          stalled = true;
          cancelBackground();
          console.info('[cores] análise pausada: imagens inacessíveis (offline ou sem CORS).');
        }
      })
      .finally(() => {
        running--;
        queued.delete(skin.id);
        persist();
        emit(skin.id);
        setTimeout(pump, 30);
      });
  }
}

// priority=true coloca na frente da fila (cards visíveis na tela).
export function requestColors(skins, { priority = false } = {}) {
  if (stalled && !priority) return;
  const fresh = skins.filter((s) => !hasResult(s.id) && !queued.has(s.id));
  for (const s of fresh) queued.add(s.id);
  if (priority) queue.unshift(...fresh);
  else queue.push(...fresh);
  pump();
}

export function cancelBackground() {
  for (const s of queue) queued.delete(s.id);
  queue.length = 0;
}
