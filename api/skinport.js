import { skinportItems } from '../lib/upstream.mjs';

export async function GET() {
  const r = await skinportItems();
  return new Response(r.body, { status: r.status, headers: r.headers });
}
