// Versão Vercel do proxy /img do server.mjs: repassa imagens da CDN da Steam
// com CORS liberado, para o <canvas> conseguir ler as cores.
const IMG_HOSTS = [/\.steamstatic\.com$/, /^steamcommunity-a\.akamaihd\.net$/];

export async function GET(request) {
  let url;
  try {
    url = new URL(new URL(request.url).searchParams.get('u'));
  } catch {
    return new Response('URL inválida', { status: 400 });
  }
  if (url.protocol !== 'https:' || !IMG_HOSTS.some((re) => re.test(url.hostname))) {
    return new Response('Host não permitido', { status: 403 });
  }
  try {
    const r = await fetch(url, { signal: AbortSignal.timeout(15000) });
    const type = r.headers.get('content-type') || '';
    if (!r.ok) return new Response('Falha na origem', { status: r.status });
    if (!type.startsWith('image/')) return new Response('Não é imagem', { status: 415 });
    return new Response(r.body, {
      headers: {
        'Content-Type': type,
        'Access-Control-Allow-Origin': '*',
        // Cache na CDN da Vercel: cada imagem só passa pela função uma vez por dia.
        'Cache-Control': 'public, max-age=86400, s-maxage=604800',
      },
    });
  } catch {
    return new Response('Origem indisponível', { status: 502 });
  }
}
