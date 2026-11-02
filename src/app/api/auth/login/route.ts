import { NextRequest, NextResponse } from 'next/server';
import { authenticateUser, createSession, SESSION_COOKIE, workspaceDestination } from '@/lib/auth';

export async function POST(request: NextRequest) {
  const body = await request.json() as { email?: string; password?: string };
  const user = body.email && body.password ? await authenticateUser(body.email, body.password) : null;
  if (!user) return NextResponse.json({ error: 'Email or password is incorrect.' }, { status: 401 });
  const response = NextResponse.json({ user, destination: workspaceDestination(user.sector) });
  response.cookies.set(SESSION_COOKIE, createSession(user), { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', path: '/', maxAge: 60 * 60 * 24 * 7 });
  return response;
}
