import { randomUUID } from 'node:crypto';

import { NextRequest, NextResponse } from 'next/server';

import { supa } from '@/lib/supabase';

export const runtime = 'nodejs';

export async function POST(
  _req: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const requestId = randomUUID();
  const startedAt = Date.now();

  try {
    const { id } = await context.params;

    const { data: draft, error } = await supa
      .from('expense_drafts')
      .select('status')
      .eq('id', id)
      .single();

    if (error || !draft) {
      return NextResponse.json(
        { error: 'not_found' },
        { status: 404, headers: { 'x-request-id': requestId } },
      );
    }

    if (draft.status === 'submitted') {
      return NextResponse.json(
        { status: 'submitted' },
        { headers: { 'x-request-id': requestId } },
      );
    }

    const { error: updateError } = await supa
      .from('expense_drafts')
      .update({ status: 'submitted', updated_at: new Date().toISOString() })
      .eq('id', id);

    if (updateError) {
      throw updateError;
    }

    return NextResponse.json(
      { status: 'submitted' },
      { headers: { 'x-request-id': requestId } },
    );
  } catch (error) {
    console.error('submit draft error', { requestId, error });
    return NextResponse.json(
      { error: 'submit_failed' },
      { status: 500, headers: { 'x-request-id': requestId } },
    );
  } finally {
    const duration = Date.now() - startedAt;
    console.log('submit draft', { requestId, duration });
  }
}

