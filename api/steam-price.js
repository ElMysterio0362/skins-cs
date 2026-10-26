import { steamPrice } from '../lib/upstream.mjs';

export async function GET(request) {
  const r = await steamPrice(new URL(request.url).searchParams.get('name'));
  return new Response(r.body, { status: r.status, headers: r.headers });
}
