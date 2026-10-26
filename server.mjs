// Servidor local opcional, sem dependências.
// Motivos para existir:
//  1. ES modules não funcionam abrindo index.html via file://; é preciso HTTP.
//  2. /api/skinport e /api/steam-price: consultam preços no servidor (CORS/limites).
//  3. /img?u=... repassa imagens da CDN da Steam para o <canvas> conseguir ler
//     os pixels (cor dominante) caso a CDN não envie cabeçalho CORS.
// Uso: node server.mjs  (porta 8080, ou PORT=3000 node server.mjs)
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { extname, join, normalize, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { skinportItems, steamPrice } from './lib/upstream.mjs';

const ROOT = dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT) || 8080;
const IMG_HOSTS = [/\.steamstatic\.com$/, /^steamcommunity-a\.akamaihd\.net$/];
const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8', '.svg': 'image/svg+xml',
  '.png': 'image/png', '.ico': 'image/x-icon', '.webp': 'image/webp', '.txt': 'text/plain; charset=utf-8',
};
const imgCache = new Map(); // memória simples, até 3000 imagens

async function proxyImage(target, res) {
  let url;
  try { url = new URL(target); } catch { return send(res, 400, 'URL inválida'); }
  if (url.protocol !== 'https:' || !IMG_HOSTS.some((re) => re.test(url.hostname))) return send(res, 403, 'Host não permitido');
  const hit = imgCache.get(url.href);
  if (hit) return sendImage(res, hit);
  try {
    const r = await fetch(url, { signal: AbortSignal.timeout(15000) });
    if (!r.ok) return send(res, r.status, 'Falha na origem');
    const type = r.headers.get('content-type') || 'image/png';
    if (!type.startsWith('image/')) return send(res, 415, 'Não é imagem');
    const body = Buffer.from(await r.arrayBuffer());
    if (imgCache.size > 3000) imgCache.delete(imgCache.keys().next().value);
    const entry = { type, body };
    imgCache.set(url.href, entry);
    sendImage(res, entry);
  } catch {
    send(res, 502, 'Origem indisponível');
  }
}

function sendImage(res, { type, body }) {
  res.writeHead(200, { 'Content-Type': type, 'Cache-Control': 'public, max-age=86400', 'Access-Control-Allow-Origin': '*' });
  res.end(body);
}

function send(res, code, text, type = 'text/plain; charset=utf-8') {
  res.writeHead(code, { 'Content-Type': type });
  res.end(text);
}

async function serveFile(pathname, res) {
  const safe = normalize(decodeURIComponent(pathname)).replace(/^([/\\])+/, '');
  if (safe.startsWith('..') || safe.split(/[/\\]/).some((seg) => seg.startsWith('.'))) return send(res, 403, 'Proibido');
  let file = join(ROOT, safe || 'index.html');
  try {
    if ((await stat(file)).isDirectory()) file = join(file, 'index.html');
    const body = await readFile(file);
    res.writeHead(200, { 'Content-Type': MIME[extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-cache' });
    res.end(body);
  } catch {
    try {
      res.writeHead(404, { 'Content-Type': MIME['.html'] });
      res.end(await readFile(join(ROOT, '404.html')));
    } catch {
      send(res, 404, 'Não encontrado');
    }
  }
}

createServer((req, res) => {
  const url = new URL(req.url, 'http://localhost');
  if (url.pathname === '/api/health') return send(res, 200, JSON.stringify({ ok: true, imgProxy: true }), MIME['.json']);
  if (url.pathname === '/img') return proxyImage(url.searchParams.get('u'), res);
  if (url.pathname === '/api/skinport') return skinportItems().then((r) => { res.writeHead(r.status, r.headers); res.end(r.body); });
  if (url.pathname === '/api/steam-price') return steamPrice(url.searchParams.get('name')).then((r) => { res.writeHead(r.status, r.headers); res.end(r.body); });
  if (req.method !== 'GET' && req.method !== 'HEAD') return send(res, 405, 'Método não permitido');
  return serveFile(url.pathname, res);
}).listen(PORT, () => console.log(`Skins CS rodando em http://localhost:${PORT}`));
