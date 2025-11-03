import { randomUUID } from 'node:crypto';

import { NextRequest, NextResponse } from 'next/server';

import { supa } from '@/lib/supabase';

export const runtime = 'nodejs';

export async function GET() {
  const requestId = randomUUID();
  const startedAt = Date.now();
  try {
    const { data, error } = await supa
      .from('employees')
      .select('id, name, email, team_code, created_at')
      .order('created_at', { ascending: true });
    if (error) throw error;
    return NextResponse.json(
      (data ?? []).map((row) => ({
        id: row.id,
        name: row.name,
        email: row.email,
        teamCode: row.team_code,
        createdAt: row.created_at,
      })),
      { headers: { 'x-request-id': requestId } },
    );
  } catch (error) {
    console.error('list employees error', { requestId, error });
    return NextResponse.json(
      { error: 'employees_failed' },
      { status: 500, headers: { 'x-request-id': requestId } },
    );
  } finally {
    console.log('employees', { requestId, duration: Date.now() - startedAt });
  }
}

export async function POST(req: NextRequest) {
  const requestId = randomUUID();
  const startedAt = Date.now();
  try {
    const body = await req.json();
    const name = body?.name;
    if (!name) {
      return NextResponse.json(
        { error: 'missing_name' },
        { status: 400, headers: { 'x-request-id': requestId } },
      );
    }
    const email = body?.email ?? null;
    const teamCode = body?.teamCode ?? null;
    const { data, error } = await supa
      .from('employees')
      .insert({ name, email, team_code: teamCode })
      .select('id, name, email, team_code, created_at')
      .single();
    if (error || !data) throw error ?? new Error('insert failed');
    return NextResponse.json(
      {
        id: data.id,
        name: data.name,
        email: data.email,
        teamCode: data.team_code,
        createdAt: data.created_at,
      },
      { status: 201, headers: { 'x-request-id': requestId } },
    );
  } catch (error) {
    console.error('create employee error', { requestId, error });
    return NextResponse.json(
      { error: 'employee_create_failed' },
      { status: 500, headers: { 'x-request-id': requestId } },
    );
  } finally {
    console.log('employees-create', { requestId, duration: Date.now() - startedAt });
  }
}

