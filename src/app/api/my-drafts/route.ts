import { randomUUID } from 'node:crypto';

import { NextResponse } from 'next/server';

import { supa } from '@/lib/supabase';

export const runtime = 'nodejs';

export async function GET() {
  const requestId = randomUUID();
  const startedAt = Date.now();

  try {
    const { data, error } = await supa
      .from('expense_drafts')
      .select('id, extraction, status')
      .order('created_at', { ascending: false })
      .limit(20);

    if (error) throw error;

    return NextResponse.json(data ?? [], {
      headers: { 'x-request-id': requestId },
    });
  } catch (error) {
    console.error('list drafts error', { requestId, error });
    return NextResponse.json(
      [],
      { status: 500, headers: { 'x-request-id': requestId } },
    );
  } finally {
    const duration = Date.now() - startedAt;
    console.log('list drafts', { requestId, duration });
  }
}

