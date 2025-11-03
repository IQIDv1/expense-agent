import { randomUUID } from 'node:crypto';

import { NextResponse } from 'next/server';

import { supa } from '@/lib/supabase';

export const runtime = 'nodejs';

export async function GET() {
  const requestId = randomUUID();
  const startedAt = Date.now();

  try {
    const draftPromise = supa
      .from('expense_drafts')
      .select('status, extraction, employee_id, functional_team_code, trip_id, created_at');

    const [drafts] = await Promise.all([draftPromise]);

    if (drafts.error) throw drafts.error;

    const rows = drafts.data ?? [];

    const statusCounts: Record<string, number> = {};
    const categoryTotals: Record<string, number> = {};
    const teamTotals: Record<string, number> = {};
    const employeeTotals: Record<string, number> = {};
    const tripTotals: Record<string, number> = {};

    for (const row of rows) {
      const status = row.status ?? 'unknown';
      statusCounts[status] = (statusCounts[status] ?? 0) + 1;

      const extraction = row.extraction ?? {};
      const amount = Number(extraction?.amountTotal ?? 0) || 0;

      if (extraction?.category) {
        const key = extraction.category.toString();
        categoryTotals[key] = (categoryTotals[key] ?? 0) + amount;
      }

      if (row.functional_team_code) {
        const key = row.functional_team_code.toString();
        teamTotals[key] = (teamTotals[key] ?? 0) + amount;
      }

      if (row.employee_id) {
        const key = row.employee_id.toString();
        employeeTotals[key] = (employeeTotals[key] ?? 0) + amount;
      }

      if (row.trip_id) {
        const key = row.trip_id.toString();
        tripTotals[key] = (tripTotals[key] ?? 0) + amount;
      }
    }

    return NextResponse.json(
      {
        statusCounts,
        categoryTotals,
        teamTotals,
        employeeTotals,
        tripTotals,
      },
      { headers: { 'x-request-id': requestId } },
    );
  } catch (error) {
    console.error('analytics error', { requestId, error });
    return NextResponse.json(
      { error: 'analytics_failed' },
      { status: 500, headers: { 'x-request-id': requestId } },
    );
  } finally {
    console.log('analytics', { requestId, duration: Date.now() - startedAt });
  }
}

