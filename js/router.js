// Roteador por hash: #/rota/param?query. Funciona em qualquer servidor estático
// e gera URLs compartilháveis.

const routes = [];
let notFound = null;
let current = null;

export function route(pattern, handler) {
  const keys = [];
  const re = new RegExp('^' + pattern.replace(/:([a-zA-Z]+)/g, (_, k) => {
    keys.push(k);
    return '([^/]+)';
  }) + '/?$');
  routes.push({ re, keys, handler });
}

export function setNotFound(handler) { notFound = handler; }

export function parseHash(hash = location.hash) {
  const raw = hash.replace(/^#/, '') || '/';
  const [path, qs = ''] = raw.split('?');
  return { path: path || '/', query: new URLSearchParams(qs) };
}

export function buildHash(path, params = {}) {
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v == null || v === '' || v === false || (Array.isArray(v) && !v.length)) continue;
    q.set(k, Array.isArray(v) ? v.join(',') : String(v === true ? 1 : v));
  }
  const s = q.toString().replace(/%2C/gi, ',');
  return '#' + path + (s ? '?' + s : '');
}

export function navigate(hash) {
  if (location.hash === hash) resolve();
  else location.hash = hash;
}

// Atualiza a URL sem disparar nova renderização (filtros do catálogo).
export function replaceQuietly(hash) {
  history.replaceState(history.state, '', hash);
}

async function resolve() {
  const { path, query } = parseHash();
  for (const r of routes) {
    const m = path.match(r.re);
    if (m) {
      const params = Object.fromEntries(r.keys.map((k, i) => [k, decodeURIComponent(m[i + 1])]));
      return run(r.handler, { params, query, path });
    }
  }
  return run(notFound, { params: {}, query, path });
}

async function run(handler, ctx) {
  if (current?.destroy) {
    try { current.destroy(); } catch (e) { console.error(e); }
  }
  current = null;
  current = (await handler?.(ctx)) || null;
}

export function startRouter() {
  window.addEventListener('hashchange', resolve);
  return resolve();
}
