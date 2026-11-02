import { createHmac, randomBytes, scrypt as scryptCallback, timingSafeEqual } from 'crypto';
import { mkdir, readFile, writeFile } from 'fs/promises';
import path from 'path';
import { promisify } from 'util';

const scrypt = promisify(scryptCallback);
const USERS_PATH = path.join(process.cwd(), 'data', 'satquery-users.json');
const SESSION_SECRET = process.env.SATQUERY_SESSION_SECRET || 'local-development-only-change-this-secret';
export const SESSION_COOKIE = 'satquery_session';

export type Sector = 'government' | 'hack-query';
export type WorkspaceDestination = '/' | '/government';
type User = { id: string; name: string; email: string; passwordHash: string; sector: Sector; createdAt: string };
export type SessionUser = Pick<User, 'id' | 'name' | 'email' | 'sector'>;

/**
 * Keep post-authentication routing in one typed place. The standalone Simple
 * landing screen has been removed, so Simple accounts enter the live map
 * directly. Expert accounts use the Expert global dashboard route.
 */
export function workspaceDestination(sector: Sector): WorkspaceDestination {
  return sector === 'government' ? '/government' : '/';
}

/**
 * Only accounts explicitly approved by the deployment administrator may be
 * created as Expert users. Existing Expert accounts remain valid; this gate
 * protects new registrations from granting themselves global-dashboard access.
 * Configure a comma-separated list in SATQUERY_EXPERT_EMAILS.
 */
export function isExpertEmailApproved(email: string) {
  const approved = (process.env.SATQUERY_EXPERT_EMAILS || '')
    .split(',')
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean);
  return approved.includes(email.trim().toLowerCase());
}

async function readUsers(): Promise<User[]> {
  try { return JSON.parse(await readFile(USERS_PATH, 'utf8')) as User[]; }
  catch (error: unknown) { if ((error as NodeJS.ErrnoException).code === 'ENOENT') return []; throw error; }
}

async function saveUsers(users: User[]) {
  await mkdir(path.dirname(USERS_PATH), { recursive: true });
  await writeFile(USERS_PATH, JSON.stringify(users, null, 2), { encoding: 'utf8', mode: 0o600 });
}

export async function hashPassword(password: string) {
  const salt = randomBytes(16).toString('hex');
  const hash = (await scrypt(password, salt, 64)) as Buffer;
  return `${salt}:${hash.toString('hex')}`;
}

async function passwordsMatch(password: string, stored: string) {
  const [salt, expected] = stored.split(':');
  if (!salt || !expected) return false;
  const actual = (await scrypt(password, salt, 64)) as Buffer;
  const expectedBuffer = Buffer.from(expected, 'hex');
  return expectedBuffer.length === actual.length && timingSafeEqual(expectedBuffer, actual);
}

export async function registerUser(input: { name: string; email: string; password: string; sector: Sector }): Promise<SessionUser> {
  const users = await readUsers();
  const email = input.email.trim().toLowerCase();
  if (users.some((user) => user.email === email)) throw new Error('An account already exists for this email.');
  const user: User = { id: randomBytes(18).toString('hex'), name: input.name.trim(), email, passwordHash: await hashPassword(input.password), sector: input.sector, createdAt: new Date().toISOString() };
  await saveUsers([...users, user]);
  return { id: user.id, name: user.name, email: user.email, sector: user.sector };
}

export async function authenticateUser(email: string, password: string): Promise<SessionUser | null> {
  const user = (await readUsers()).find((candidate) => candidate.email === email.trim().toLowerCase());
  if (!user || !(await passwordsMatch(password, user.passwordHash))) return null;
  return { id: user.id, name: user.name, email: user.email, sector: user.sector };
}

function signature(value: string) { return createHmac('sha256', SESSION_SECRET).update(value).digest('base64url'); }
export function createSession(user: SessionUser) {
  const payload = Buffer.from(JSON.stringify({ ...user, exp: Date.now() + 7 * 24 * 60 * 60 * 1000 })).toString('base64url');
  return `${payload}.${signature(payload)}`;
}
export function getSession(token?: string): SessionUser | null {
  if (!token) return null;
  const [payload, suppliedSignature] = token.split('.');
  if (!payload || !suppliedSignature) return null;
  const expectedSignature = signature(payload);
  if (suppliedSignature.length !== expectedSignature.length || !timingSafeEqual(Buffer.from(suppliedSignature), Buffer.from(expectedSignature))) return null;
  try { const decoded = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as SessionUser & { exp: number }; return decoded.exp > Date.now() && (decoded.sector === 'government' || decoded.sector === 'hack-query') ? { id: decoded.id, name: decoded.name, email: decoded.email, sector: decoded.sector } : null; } catch { return null; }
}
