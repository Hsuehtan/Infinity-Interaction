import { createHash, randomBytes, randomUUID, scrypt as scryptCallback, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';
import { database, transaction } from './db';
import { AppError, requireCondition } from './errors';

const scrypt = promisify(scryptCallback);
export const SESSION_COOKIE = 'ii_session';
export type Actor = { id: string; username: string };
export const tokenHash = (value: string) => createHash('sha256').update(value).digest('hex');
function normalizeUsername(value: unknown) {
  requireCondition(typeof value === 'string' && /^[a-zA-Z0-9@._+-]{3,80}$/.test(value), 400, 'INVALID_USERNAME', '账号格式不正确。');
  return value.toLowerCase();
}
export async function provisionUser(username: string, password: string) {
  username = normalizeUsername(username);
  requireCondition(typeof password === 'string' && password.length >= 12 && password.length <= 256, 400, 'INVALID_PASSWORD', '密码需为 12–256 个字符。');
  const salt = randomBytes(16).toString('hex');
  const hash = (await scrypt(password, salt, 64)) as Buffer;
  const id = randomUUID();
  await database().query('INSERT INTO users(id,username,password_hash) VALUES($1,$2,$3)', [id, username, `${salt}:${hash.toString('hex')}`]);
  return { id, username };
}
export async function login(username: unknown, password: unknown) {
  username = normalizeUsername(username);
  requireCondition(typeof password === 'string' && password.length > 0 && password.length <= 256, 401, 'INVALID_LOGIN', '账号或密码不正确。');
  const allowed = await transaction(async client => {
    await client.query('INSERT INTO login_limits(username) VALUES($1) ON CONFLICT DO NOTHING', [username]);
    const { rows: [limit] } = await client.query('SELECT * FROM login_limits WHERE username=$1 FOR UPDATE', [username]);
    if (Date.now() - new Date(limit.window_start).getTime() > 15 * 60_000) {
      await client.query('UPDATE login_limits SET attempts=1,window_start=now() WHERE username=$1', [username]);
      return true;
    }
    if (limit.attempts >= 10) return false;
    await client.query('UPDATE login_limits SET attempts=attempts+1 WHERE username=$1', [username]);
    return true;
  });
  requireCondition(allowed, 429, 'LOGIN_LIMIT', '尝试次数过多，请 15 分钟后再试。');
  const { rows: [user] } = await database().query('SELECT * FROM users WHERE username=$1', [username]);
  const [salt, expected] = (user?.password_hash ?? `${'0'.repeat(32)}:${'0'.repeat(128)}`).split(':');
  const hash = (await scrypt(password, salt, 64)) as Buffer;
  requireCondition(user && timingSafeEqual(hash, Buffer.from(expected, 'hex')), 401, 'INVALID_LOGIN', '账号或密码不正确。');
  const token = randomBytes(32).toString('hex');
  await transaction(async client => {
    await client.query('INSERT INTO sessions(token_hash,user_id,expires_at) VALUES($1,$2,now()+interval \'7 days\')', [tokenHash(token), user.id]);
    await client.query('DELETE FROM login_limits WHERE username=$1', [username]);
  });
  return { token, actor: { id: user.id, username: user.username } as Actor };
}
export async function authenticate(request: Request): Promise<Actor> {
  const cookie = request.headers.get('cookie')?.split(';').map(v => v.trim()).find(v => v.startsWith(`${SESSION_COOKIE}=`));
  const token = cookie?.slice(SESSION_COOKIE.length + 1);
  requireCondition(token && /^[a-f0-9]{64}$/.test(token), 401, 'UNAUTHENTICATED', '请先登录。');
  const { rows: [actor] } = await database().query('SELECT u.id,u.username FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.token_hash=$1 AND s.expires_at>now()', [tokenHash(token)]);
  requireCondition(actor, 401, 'UNAUTHENTICATED', '登录已过期，请重新登录；未保存修改仍保留在当前页面。');
  return actor;
}
export async function logout(request: Request) {
  const token = request.headers.get('cookie')?.split(';').map(v => v.trim()).find(v => v.startsWith(`${SESSION_COOKIE}=`))?.slice(SESSION_COOKIE.length + 1);
  if (token) await database().query('DELETE FROM sessions WHERE token_hash=$1', [tokenHash(token)]);
}
export function checkOrigin(request: Request) {
  const configured = process.env.APP_ORIGIN;
  if (!configured) throw new AppError(503, 'MISSING_ORIGIN', '服务尚未完成安全配置。');
  requireCondition(request.headers.get('origin') === new URL(configured).origin, 403, 'INVALID_ORIGIN', '请求来源不受信任。');
}
export function sessionCookie(token: string, maxAge = 7 * 86400) {
  const secure = process.env.APP_ORIGIN?.startsWith('https://') || process.env.NODE_ENV === 'production';
  return `${SESSION_COOKIE}=${token}; HttpOnly; Path=/; SameSite=Lax; Max-Age=${maxAge}${secure ? '; Secure' : ''}`;
}
