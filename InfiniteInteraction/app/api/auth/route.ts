import {modelFeatures} from '@/server/models/source-mode';
import { authenticate, checkOrigin, login, logout, sessionCookie } from '@/server/auth';
import { publicError, requireCondition } from '@/server/errors';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export async function GET(request: Request) {
  try { return Response.json({...await authenticate(request),...modelFeatures()}, { headers: { 'Cache-Control': 'no-store' } }); } catch (error) { return publicError(error); }
}
export async function POST(request: Request) {
  try {
    checkOrigin(request);
    requireCondition(Number(request.headers.get('content-length') || 0) < 4096, 413, 'BODY_TOO_LARGE', '请求过大。');
    const text = await request.text(); requireCondition(text.length < 4096, 413, 'BODY_TOO_LARGE', '请求过大。');
    const { username, password } = JSON.parse(text);
    const { token, actor } = await login(username, password);
    return Response.json({...actor,...modelFeatures()}, { headers: { 'Set-Cookie': sessionCookie(token), 'Cache-Control': 'no-store' } });
  } catch (error) { if (error instanceof SyntaxError) return Response.json({ error: '请求格式不正确。' }, { status: 400 }); return publicError(error); }
}
export async function DELETE(request: Request) {
  try { checkOrigin(request); await logout(request); return Response.json({ ok: true }, { headers: { 'Set-Cookie': sessionCookie('', 0) } }); } catch (error) { return publicError(error); }
}
