import { randomUUID } from 'node:crypto';

import { NextRequest, NextResponse } from 'next/server';

import { supa } from '@/lib/supabase';

export const runtime = 'nodejs';

export async function GET(
  _req: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const requestId = randomUUID();
  const startedAt = Date.now();

  try {
    const { id } = await context.params;
    const { data, error } = await supa
      .from('expense_drafts')
      .select('*')
      .eq('id', id)
      .single();

    if (error || !data) {
      return NextResponse.json(
        { error: 'not_found' },
        { status: 404, headers: { 'x-request-id': requestId } },
      );
    }

    return NextResponse.json(data, {
      headers: { 'x-request-id': requestId },
    });
  } catch (error) {
    console.error('get draft error', { requestId, error });
    return NextResponse.json(
      { error: 'draft_failed' },
      { status: 500, headers: { 'x-request-id': requestId } },
    );
  } finally {
    const duration = Date.now() - startedAt;
    console.log('get draft', { requestId, duration });
  }
}

