import { randomUUID } from 'node:crypto';

import { NextRequest, NextResponse } from 'next/server';

import { supa } from '@/lib/supabase';

export const runtime = 'nodejs';

export async function GET() {
  const requestId = randomUUID();
  const startedAt = Date.now();
  try {
    const { data, error } = await supa
      .from('functional_teams')
      .select('code, name, description, created_at')
      .order('name', { ascending: true });
    if (error) throw error;
    return NextResponse.json(
      (data ?? []).map((row) => ({
        code: row.code,
        name: row.name,
        description: row.description,
        createdAt: row.created_at,
      })),
      { headers: { 'x-request-id': requestId } },
    );
  } catch (error) {
    console.error('list teams error', { requestId, error });
    return NextResponse.json(
      { error: 'teams_failed' },
      { status: 500, headers: { 'x-request-id': requestId } },
    );
  } finally {
    console.log('teams', { requestId, duration: Date.now() - startedAt });
  }
}

export async function POST(req: NextRequest) {
  const requestId = randomUUID();
  const startedAt = Date.now();
  try {
    const body = await req.json();
    const code = body?.code;
    const name = body?.name;
    if (!code || !name) {
      return NextResponse.json(
        { error: 'missing_code_or_name' },
        { status: 400, headers: { 'x-request-id': requestId } },
      );
    }
    const description = body?.description ?? null;
    const { data, error } = await supa
      .from('functional_teams')
      .insert({ code, name, description })
      .select('code, name, description, created_at')
      .single();
    if (error || !data) throw error ?? new Error('insert failed');
    return NextResponse.json(
      {
        code: data.code,
        name: data.name,
        description: data.description,
        createdAt: data.created_at,
      },
      { status: 201, headers: { 'x-request-id': requestId } },
    );
  } catch (error) {
    console.error('create team error', { requestId, error });
    return NextResponse.json(
      { error: 'team_create_failed' },
      { status: 500, headers: { 'x-request-id': requestId } },
    );
  } finally {
    console.log('teams-create', { requestId, duration: Date.now() - startedAt });
  }
}

