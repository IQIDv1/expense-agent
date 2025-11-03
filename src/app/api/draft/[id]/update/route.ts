import { randomUUID } from 'node:crypto';

import { NextRequest, NextResponse } from 'next/server';

import { supa } from '@/lib/supabase';

export const runtime = 'nodejs';

export async function PATCH(
  req: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const requestId = randomUUID();
  const startedAt = Date.now();

  try {
    const { id } = await context.params;
    const body = await req.json();
    const extraction = body?.extraction;
    const employeeId = body?.employeeId ?? null;
    const functionalTeamCode = body?.functionalTeamCode ?? null;
    const tripId = body?.tripId ?? null;
    const aiLabels = body?.aiLabels ?? null;

    if (!extraction) {
      return NextResponse.json(
        { error: 'missing_extraction' },
        { status: 400, headers: { 'x-request-id': requestId } },
      );
    }

    const { data, error } = await supa
      .from('expense_drafts')
      .update({
        extraction,
        employee_id: employeeId,
        functional_team_code: functionalTeamCode,
        trip_id: tripId,
        ai_labels: aiLabels,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select('id, status, extraction, employee_id, functional_team_code, trip_id, ai_labels')
      .single();

    if (error || !data) {
      throw error ?? new Error('Update failed');
    }

    return NextResponse.json(
      {
        extraction: data.extraction,
        status: data.status,
        employeeId: data.employee_id,
        functionalTeamCode: data.functional_team_code,
        tripId: data.trip_id,
        aiLabels: data.ai_labels,
      },
      { headers: { 'x-request-id': requestId } },
    );
  } catch (error) {
    console.error('update draft error', { requestId, error });
    return NextResponse.json(
      { error: 'update_failed' },
      { status: 500, headers: { 'x-request-id': requestId } },
    );
  } finally {
    const duration = Date.now() - startedAt;
    console.log('update draft', { requestId, duration });
  }
}

