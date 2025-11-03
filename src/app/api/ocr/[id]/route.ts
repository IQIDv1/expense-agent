import { randomUUID } from 'node:crypto';

import { NextRequest, NextResponse } from 'next/server';

import { guessCategory } from '@/data/categories';
import { normalizeCurrency, normalizeMerchant } from '@/lib/normalize';
import { runOpenAIVision } from '@/lib/ocr';
import { getFile } from '@/lib/storage';
import { supa } from '@/lib/supabase';

export const runtime = 'nodejs';

export async function POST(
  _req: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const requestId = randomUUID();
  const startedAt = Date.now();
  let receiptId = '';

  try {
    const { id } = await context.params;
    receiptId = id;
    const receipt = await supa
      .from('receipt_assets')
      .select('*')
      .eq('id', id)
      .single();

    if (receipt.error || !receipt.data) {
      return NextResponse.json(
        { error: 'not_found' },
        { status: 404, headers: { 'x-request-id': requestId } },
      );
    }

    const download = await getFile(receipt.data.storage_key);
    const bytes = Buffer.from(await download.arrayBuffer());

    const rawExtraction = await runOpenAIVision({
      bytes,
      filename: receipt.data.filename,
      mime: receipt.data.mime,
    });

    const normalizedExtraction = {
      ...rawExtraction,
      merchant: normalizeMerchant(rawExtraction.merchant),
      currency: normalizeCurrency(rawExtraction.currency),
    };

    const lineItems = normalizedExtraction.items ?? [];
    const lineTotal = lineItems.reduce((sum: number, item: { amount: number }) => {
      const value = typeof item.amount === 'number' ? item.amount : Number(item.amount);
      return sum + (Number.isFinite(value) ? value : 0);
    }, 0);
    if (lineItems.length > 0) {
      normalizedExtraction.amountTotal = Number(lineTotal.toFixed(2));
    }

    if (!normalizedExtraction.category && normalizedExtraction.merchant) {
      normalizedExtraction.category = guessCategory(normalizedExtraction.merchant);
    }

    const draftInsert = await supa
      .from('expense_drafts')
      .insert({
        receipt_id: receipt.data.id,
        extraction: normalizedExtraction,
        validation: [],
        status: 'needs-info',
      })
      .select('id')
      .single();

    if (draftInsert.error || !draftInsert.data) {
      throw draftInsert.error ?? new Error('Failed to create draft');
    }

    const updateAsset = await supa
      .from('receipt_assets')
      .update({
        ocr_status: 'done',
        ocr_model: 'openai:gpt-4o-mini',
      })
      .eq('id', receipt.data.id);
    if (updateAsset.error) {
      throw updateAsset.error;
    }

    return NextResponse.json(
      { draftId: draftInsert.data.id, extraction: normalizedExtraction },
      { headers: { 'x-request-id': requestId } },
    );
  } catch (error) {
    console.error('ocr error', { requestId, error });
    if (receiptId) {
      await supa
        .from('receipt_assets')
        .update({ ocr_status: 'error' })
        .eq('id', receiptId);
    }
    return NextResponse.json(
      { error: 'ocr_failed' },
      { status: 500, headers: { 'x-request-id': requestId } },
    );
  } finally {
    const duration = Date.now() - startedAt;
    console.log('ocr', { requestId, duration });
  }
}

