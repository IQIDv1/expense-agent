import { randomUUID } from 'node:crypto';

import { NextRequest, NextResponse } from 'next/server';

import { runPolicy, statusFrom } from '@/lib/policy';
import type { PolicyRule } from '@/types/domain';
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
    const draft = await supa
      .from('expense_drafts')
      .select('*')
      .eq('id', id)
      .single();

    if (draft.error || !draft.data) {
      return NextResponse.json(
        { error: 'not_found' },
        { status: 404, headers: { 'x-request-id': requestId } },
      );
    }

    const rulesRes = await supa.from('policy_rules').select('*');
    if (rulesRes.error) {
      throw rulesRes.error;
    }

    const rules = (rulesRes.data ?? []).map((row) => {
      const payload = row.rule as unknown;

      const base: PolicyRule = {
        code: row.code,
        description: '',
        appliesTo: {},
      };

      if (typeof payload === 'object' && payload !== null) {
        const record = payload as Record<string, unknown>;
        if (typeof record.description === 'string') {
          base.description = record.description;
        }

        const applies = record.appliesTo;
        if (typeof applies === 'object' && applies !== null) {
          const appliesRecord = applies as Record<string, unknown>;
          base.appliesTo = {
            category:
              typeof appliesRecord.category === 'string'
                ? appliesRecord.category
                : undefined,
            city:
              typeof appliesRecord.city === 'string' ? appliesRecord.city : undefined,
          };
        }

        if (typeof record.limit === 'number') {
          base.limit = record.limit;
        }

        const requires = record.requires;
        if (typeof requires === 'object' && requires !== null) {
          const requiresRecord = requires as Record<string, unknown>;
          base.requires = {
            receipt:
              typeof requiresRecord.receipt === 'boolean'
                ? requiresRecord.receipt
                : undefined,
            managerApproval:
              typeof requiresRecord.managerApproval === 'boolean'
                ? requiresRecord.managerApproval
                : undefined,
          };
        }
      }

      return base;
    });

    const findings = runPolicy(draft.data.extraction, rules);
    const status = statusFrom(findings);

    const update = await supa
      .from('expense_drafts')
      .update({ validation: findings, status })
      .eq('id', draft.data.id)
      .select('status')
      .single();

    if (update.error || !update.data) {
      throw update.error ?? new Error('Failed to update draft');
    }

    return NextResponse.json(
      { status: update.data.status, findings },
      { headers: { 'x-request-id': requestId } },
    );
  } catch (error) {
    console.error('policy error', { requestId, error });
    return NextResponse.json(
      { error: 'policy_failed' },
      { status: 500, headers: { 'x-request-id': requestId } },
    );
  } finally {
    const duration = Date.now() - startedAt;
    console.log('policy', { requestId, duration });
  }
}

