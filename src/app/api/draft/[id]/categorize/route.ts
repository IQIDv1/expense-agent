import { randomUUID } from 'node:crypto';

import { NextRequest, NextResponse } from 'next/server';

import { supa } from '@/lib/supabase';
import type { AISplitAllocation } from '@/types/domain';

export const runtime = 'nodejs';

export async function POST(
  _req: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const requestId = randomUUID();
  const startedAt = Date.now();

  try {
    console.time(`categorize-${requestId}`);

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      console.error('categorize missing key', { requestId });
      return NextResponse.json(
        { error: 'missing_openai_key', requestId },
        { status: 500, headers: { 'x-request-id': requestId } },
      );
    }

    const { id } = await context.params;
    const [draftResult, employeesResult, teamsResult, tripsResult] = await Promise.all([
      supa
        .from('expense_drafts')
        .select(
          'id, extraction, employee_id, functional_team_code, trip_id, ai_labels, gl_account, business_category, ai_confidence, ai_allocations',
        )
        .eq('id', id)
        .single(),
      supa
        .from('employees')
        .select('id, name, email, team_code')
        .order('name', { ascending: true }),
      supa
        .from('functional_teams')
        .select('code, name, description')
        .eq('active', true)
        .order('name', { ascending: true }),
      supa
        .from('trips')
        .select('id, name, start_date, end_date, city, country')
        .eq('active', true)
        .order('start_date', { ascending: false }),
    ]);

    if (draftResult.error || !draftResult.data) {
      return NextResponse.json(
        { error: 'not_found', requestId },
        { status: 404, headers: { 'x-request-id': requestId } },
      );
    }

    const draft = draftResult.data;
    const employees = employeesResult.data ?? [];
    const teams = teamsResult.data ?? [];
    const trips = tripsResult.data ?? [];

    const extraction = draft.extraction ?? {};

    const summary = {
      merchant: extraction?.merchant ?? null,
      date: extraction?.date ?? null,
      amountTotal: extraction?.amountTotal ?? null,
      currency: extraction?.currency ?? 'USD',
      category: extraction?.category ?? null,
      items: extraction?.items ?? [],
      location: extraction?.location ?? {},
      invoiceNumber: extraction?.invoiceNumber ?? null,
    };

    const context = {
      currentAssignment: {
        employeeId: draft.employee_id,
        functionalTeamCode: draft.functional_team_code,
        tripId: draft.trip_id,
        glAccount: draft.gl_account ?? null,
        businessCategory: draft.business_category ?? null,
      },
      employees: employees.map((employee) => ({
        id: employee.id,
        name: employee.name,
        email: employee.email,
        teamCode: employee.team_code,
      })),
      teams: teams.map((team) => ({
        code: team.code,
        name: team.name,
        description: team.description,
      })),
      trips: trips.map((trip) => ({
        id: trip.id,
        name: trip.name,
        startDate: trip.start_date,
        endDate: trip.end_date,
        city: trip.city,
        country: trip.country,
      })),
    };

    const prompt = `You are an accounting assistant. Review the receipt details, existing assignment, and organization reference data.

Receipt:
${JSON.stringify(summary, null, 2)}

Existing assignment:
${JSON.stringify(context.currentAssignment, null, 2)}

Employees:
${JSON.stringify(context.employees, null, 2)}

Teams:
${JSON.stringify(context.teams, null, 2)}

Trips:
${JSON.stringify(context.trips, null, 2)}

Return STRICT JSON with keys:
{
  "category": string, // updated expense category label
  "businessCategory": string | null, // optional business-facing grouping (e.g., Client Entertainment)
  "glAccount": string, // accounting GL code (Meals, Lodging, Transport, Supplies, Misc)
  "employeeId": string | null, // choose employee id or null
  "functionalTeamCode": string | null, // choose team code
  "tripId": string | null, // choose trip id
  "confidence": number, // 0-1 confidence score
  "notes": string[], // bullet reasoning
  "splitAllocations": [
    { "glAccount": string, "amount": number | null, "percent": number | null, "notes": string | null }
  ] // optional, set [] if not needed
}

Return JSON ONLY with those keys.`;

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: 'You are an expert accounting assistant returning strict JSON.' },
          { role: 'user', content: prompt },
        ],
        temperature: 0,
      }),
    });

    console.timeEnd(`openai-${requestId}`);

    if (!response.ok) {
      const text = await response.text();
      console.error('categorize openai error', { requestId, status: response.status, text });
      throw new Error(`OpenAI error ${response.status}: ${text}`);
    }

    const data = await response.json();
    let content: unknown = data.choices?.[0]?.message?.content ?? '{}';

    if (Array.isArray(content)) {
      content = content.map((part: any) => part?.text ?? '').join('\n');
    }

    if (typeof content !== 'string') {
      content = JSON.stringify(content);
    }

    const jsonString = content.match(/\{[\s\S]*\}/)?.[0]?.trim() ?? '{}';
    const parsed = JSON.parse(jsonString);

    const aiCategory = typeof parsed.category === 'string' ? parsed.category : null;
    const aiTeam = typeof parsed.functionalTeamCode === 'string' ? parsed.functionalTeamCode : null;
    const aiEmployeeId = typeof parsed.employeeId === 'string' ? parsed.employeeId : null;
    const aiTripId = typeof parsed.tripId === 'string' ? parsed.tripId : null;
    const aiBusinessCategory = typeof parsed.businessCategory === 'string' ? parsed.businessCategory : null;
    const aiGlAccount = typeof parsed.glAccount === 'string' ? parsed.glAccount : null;
    const aiConfidence =
      typeof parsed.confidence === 'number'
        ? Math.max(0, Math.min(1, Number(parsed.confidence)))
        : null;
    const aiNotesRaw = Array.isArray(parsed.notes) ? parsed.notes : [];
    const aiNotes = aiNotesRaw
      .map((note) => (typeof note === 'string' ? note.trim() : ''))
      .filter(Boolean);

    const aiSplitsRaw = Array.isArray(parsed.splitAllocations) ? parsed.splitAllocations : [];
    const aiSplits = aiSplitsRaw
      .map((item: any) => {
        if (!item || typeof item !== 'object') return null;
        if (typeof item.glAccount !== 'string' || !item.glAccount.trim()) return null;
        const allocation = {
          glAccount: item.glAccount.trim(),
          amount:
            typeof item.amount === 'number' && Number.isFinite(item.amount)
              ? Number(item.amount)
              : undefined,
          percent:
            typeof item.percent === 'number' && Number.isFinite(item.percent)
              ? Number(item.percent)
              : undefined,
          notes: typeof item.notes === 'string' ? item.notes.trim() : undefined,
        };
        return allocation;
      })
      .filter(Boolean) as AISplitAllocation[];

    const updates: Record<string, unknown> = {
      ai_labels: aiNotes.length > 0 ? aiNotes : null,
      gl_account: aiGlAccount,
      business_category: aiBusinessCategory,
      ai_confidence: aiConfidence,
      ai_allocations: aiSplits.length > 0 ? aiSplits : null,
      employee_id: aiEmployeeId,
      functional_team_code: aiTeam,
      trip_id: aiTripId,
      status: 'proposed',
      updated_at: new Date().toISOString(),
    };

    if (aiCategory) {
      updates.extraction = {
        ...(draft.extraction ?? {}),
        category: aiCategory,
      };
    }

    if (Object.keys(updates).length > 0) {
      const { error: updateError } = await supa
        .from('expense_drafts')
        .update(updates)
        .eq('id', id);
      if (updateError) {
        console.error('categorize update error', { requestId, error: updateError });
        throw updateError;
      }
    }

    return NextResponse.json(
      {
        category: aiCategory,
        functionalTeamCode: aiTeam,
        employeeId: aiEmployeeId,
        tripId: aiTripId,
        notes: aiNotes,
        businessCategory: aiBusinessCategory,
        glAccount: aiGlAccount,
        confidence: aiConfidence,
        splitAllocations: aiSplits,
        requestId,
      },
      { headers: { 'x-request-id': requestId } },
    );
  } catch (error) {
    console.error('categorize draft error', { requestId, error });
    return NextResponse.json(
      { error: 'categorize_failed', requestId },
      { status: 500, headers: { 'x-request-id': requestId } },
    );
  } finally {
    console.log('categorize draft', { requestId, duration: Date.now() - startedAt });
  }
}

