// Versão Vercel do /api/health do server.mjs.
export function GET() {
  return Response.json({ ok: true, imgProxy: true });
}
