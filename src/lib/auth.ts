import { createHmac, randomBytes, scrypt as scryptCallback, timingSafeEqual } from 'crypto';
import { mkdir, readFile, writeFile } from 'fs/promises';
import { neon, type NeonQueryFunction } from '@neondatabase/serverless';
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

export class AuthStorageConfigurationError extends Error {
  constructor() {
    super('Account storage is not configured. Connect a Neon database to this Vercel project.');
    this.name = 'AuthStorageConfigurationError';
  }
}

export class DuplicateAccountError extends Error {
  constructor() {
    super('An account already exists for this email.');
    this.name = 'DuplicateAccountError';
  }
}

function getDatabase() {
  const databaseUrl = process.env.DATABASE_URL?.trim();
  if (!databaseUrl) {
    if (process.env.NODE_ENV === 'production') throw new AuthStorageConfigurationError();
    return null;
  }
  return neon(databaseUrl);
}

async function ensureUsersTable(sql: NeonQueryFunction<false, false>) {
  await sql`
    CREATE TABLE IF NOT EXISTS satquery_users (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      email TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      sector TEXT NOT NULL CHECK (sector IN ('government', 'hack-query')),
      created_at TIMESTAMPTZ NOT NULL
    )
  `;
}

async function findUserByEmail(email: string): Promise<User | null> {
  const sql = getDatabase();
  if (!sql) return (await readUsersFromFile()).find((user) => user.email === email) ?? null;
  await ensureUsersTable(sql);
  const rows = await sql`
    SELECT id, name, email, password_hash AS "passwordHash", sector, created_at AS "createdAt"
    FROM satquery_users WHERE email = ${email} LIMIT 1
  `;
  return (rows[0] as User | undefined) ?? null;
}

async function readUsersFromFile(): Promise<User[]> {
  try { return JSON.parse(await readFile(USERS_PATH, 'utf8')) as User[]; }
  catch (error: unknown) { if ((error as NodeJS.ErrnoException).code === 'ENOENT') return []; throw error; }
}

async function insertUser(user: User) {
  const sql = getDatabase();
  if (!sql) {
    const users = await readUsersFromFile();
    if (users.some((candidate) => candidate.email === user.email)) throw new DuplicateAccountError();
    await saveUsers([...users, user]);
    return;
  }

  await ensureUsersTable(sql);
  try {
    await sql`
      INSERT INTO satquery_users (id, name, email, password_hash, sector, created_at)
      VALUES (${user.id}, ${user.name}, ${user.email}, ${user.passwordHash}, ${user.sector}, ${user.createdAt})
    `;
  } catch (error: unknown) {
    if (typeof error === 'object' && error !== null && 'code' in error && error.code === '23505') {
      throw new DuplicateAccountError();
    }
    throw error;
  }
}

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
  const email = input.email.trim().toLowerCase();
  const user: User = { id: randomBytes(18).toString('hex'), name: input.name.trim(), email, passwordHash: await hashPassword(input.password), sector: input.sector, createdAt: new Date().toISOString() };
  await insertUser(user);
  return { id: user.id, name: user.name, email: user.email, sector: user.sector };
}

export async function authenticateUser(email: string, password: string): Promise<SessionUser | null> {
  const user = await findUserByEmail(email.trim().toLowerCase());
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
