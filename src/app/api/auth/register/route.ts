import { NextRequest, NextResponse } from 'next/server';
import { createSession, isExpertEmailApproved, registerUser, SESSION_COOKIE, type Sector, workspaceDestination } from '@/lib/auth';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json() as { name?: string; email?: string; password?: string; sector?: Sector };
    if (!body.name?.trim() || !/^\S+@\S+\.\S+$/.test(body.email || '') || !body.password || body.password.length < 8 || !['government', 'hack-query'].includes(body.sector || '')) return NextResponse.json({ error: 'Enter a name, valid email, password of at least 8 characters, and workspace.' }, { status: 400 });
    if (body.sector === 'government' && !isExpertEmailApproved(body.email!)) return NextResponse.json({ error: 'Expert access requires an administrator-approved email address. Create a Simple account or ask your SATQUERY administrator for access.' }, { status: 403 });
    const user = await registerUser({ name: body.name, email: body.email!, password: body.password, sector: body.sector! });
    const response = NextResponse.json({ user, destination: workspaceDestination(user.sector) }, { status: 201 });
    response.cookies.set(SESSION_COOKIE, createSession(user), { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', path: '/', maxAge: 60 * 60 * 24 * 7 });
    return response;
  } catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : 'Could not create account.' }, { status: 400 }); }
}
