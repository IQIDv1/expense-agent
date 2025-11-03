import { randomUUID } from 'node:crypto';

import { NextRequest, NextResponse } from 'next/server';

import { supa } from '@/lib/supabase';

export const runtime = 'nodejs';

export async function GET() {
  const requestId = randomUUID();
  const startedAt = Date.now();
  try {
    const { data, error } = await supa
      .from('trips')
      .select('id, name, start_date, end_date, city, country, created_at')
      .order('start_date', { ascending: false });
    if (error) throw error;
    return NextResponse.json(
      (data ?? []).map((row) => ({
        id: row.id,
        name: row.name,
        startDate: row.start_date,
        endDate: row.end_date,
        city: row.city,
        country: row.country,
        createdAt: row.created_at,
      })),
      { headers: { 'x-request-id': requestId } },
    );
  } catch (error) {
    console.error('list trips error', { requestId, error });
    return NextResponse.json(
      { error: 'trips_failed' },
      { status: 500, headers: { 'x-request-id': requestId } },
    );
  } finally {
    console.log('trips', { requestId, duration: Date.now() - startedAt });
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
    const { data, error } = await supa
      .from('trips')
      .insert({
        name,
        start_date: body?.startDate ?? null,
        end_date: body?.endDate ?? null,
        city: body?.city ?? null,
        country: body?.country ?? null,
      })
      .select('id, name, start_date, end_date, city, country, created_at')
      .single();
    if (error || !data) throw error ?? new Error('insert failed');
    return NextResponse.json(
      {
        id: data.id,
        name: data.name,
        startDate: data.start_date,
        endDate: data.end_date,
        city: data.city,
        country: data.country,
        createdAt: data.created_at,
      },
      { status: 201, headers: { 'x-request-id': requestId } },
    );
  } catch (error) {
    console.error('create trip error', { requestId, error });
    return NextResponse.json(
      { error: 'trip_create_failed' },
      { status: 500, headers: { 'x-request-id': requestId } },
    );
  } finally {
    console.log('trips-create', { requestId, duration: Date.now() - startedAt });
  }
}

