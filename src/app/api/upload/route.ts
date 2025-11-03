import { NextRequest, NextResponse } from 'next/server';
import { createHash, randomUUID } from 'node:crypto';

import { putFile, publicKeyPath } from '@/lib/storage';
import { supa } from '@/lib/supabase';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  const requestId = randomUUID();
  const startedAt = Date.now();

  try {
    const formData = await req.formData();
    const file = formData.get('file');

    if (!(file instanceof File)) {
      return NextResponse.json(
        { error: 'file field missing' },
        { status: 400, headers: { 'x-request-id': requestId } },
      );
    }

    const arrayBuf = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuf);
    const sha256 = createHash('sha256').update(buffer).digest('hex');

    const insert = await supa
      .from('receipt_assets')
      .insert({
        employee_id: null,
        sha256,
        mime: file.type || 'application/octet-stream',
        filename: file.name,
        size_bytes: buffer.length,
        storage_key: '',
        ocr_status: 'pending',
      })
      .select('id')
      .single();

    if (insert.error || !insert.data) {
      throw insert.error ?? new Error('Failed to create receipt asset');
    }

    const key = publicKeyPath(insert.data.id, file.name);
    await putFile(buffer, key, file.type || 'application/octet-stream');

    const update = await supa
      .from('receipt_assets')
      .update({ storage_key: key })
      .eq('id', insert.data.id);
    if (update.error) {
      throw update.error;
    }

    return NextResponse.json(
      { receiptId: insert.data.id },
      { headers: { 'x-request-id': requestId } },
    );
  } catch (error) {
    console.error('upload error', { requestId, error });
    return NextResponse.json(
      { error: 'upload_failed' },
      { status: 500, headers: { 'x-request-id': requestId } },
    );
  } finally {
    const duration = Date.now() - startedAt;
    console.log('upload', { requestId, duration });
  }
}

