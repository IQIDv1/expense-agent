import { randomUUID } from 'node:crypto';

import { NextRequest, NextResponse } from 'next/server';

import { supa } from '@/lib/supabase';

export const runtime = 'nodejs';

export async function GET(
  _req: NextRequest,
  context: { params: Promise<{ path: string[] }> },
) {
  const requestId = randomUUID();
  const startedAt = Date.now();

  try {
    const { path } = await context.params;
    const raw = path?.join('/') ?? '';
    if (!raw.endsWith('.csv')) {
      return new NextResponse('bad request', {
        status: 400,
        headers: { 'x-request-id': requestId },
      });
    }

    const draftId = raw.slice(0, -4);

    const { data, error } = await supa
      .from('expense_drafts')
      .select('*')
      .eq('id', draftId)
      .single();

    if (error || !data) {
      return new NextResponse('not found', {
        status: 404,
        headers: { 'x-request-id': requestId },
      });
    }

    const extraction = data.extraction || {};
    const csv = [
      'merchant,amount,currency,date,category,invoice_number',
      `${extraction.merchant ?? ''},${extraction.amountTotal ?? ''},${extraction.currency ?? 'USD'},${extraction.date ?? ''},${extraction.category ?? ''},${extraction.invoiceNumber ?? ''}`,
    ].join('\n');

    return new NextResponse(csv, {
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': `attachment; filename="draft-${draftId}.csv"`,
        'x-request-id': requestId,
      },
    });
  } catch (error) {
    console.error('export error', { requestId, error });
    return new NextResponse('export_failed', {
      status: 500,
      headers: { 'x-request-id': requestId },
    });
  } finally {
    const duration = Date.now() - startedAt;
    console.log('export', { requestId, duration });
  }
}

