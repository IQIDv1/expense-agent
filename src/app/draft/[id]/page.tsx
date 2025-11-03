
'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { use, useCallback, useEffect, useRef, useState, type ChangeEvent } from 'react';

import type {
  AISplitAllocation,
  ExpenseDraft,
  LineItem,
  PolicyFinding,
  ReceiptExtractedData,
} from '@/types/domain';

interface DraftData {
  id: string;
  extraction: ReceiptExtractedData | null;
  validation: PolicyFinding[];
  status: string;
  employee_id?: string | null;
  functional_team_code?: string | null;
  trip_id?: string | null;
  ai_labels?: string[] | null;
  gl_account?: string | null;
  business_category?: string | null;
  ai_confidence?: number | null;
  ai_allocations?: AISplitAllocation[] | null;
}

interface EmployeeOption {
  id: string;
  name: string;
  email?: string | null;
  teamCode?: string | null;
}

interface TeamOption {
  code: string;
  name: string;
}

interface TripOption {
  id: string;
  name: string;
  startDate?: string | null;
  endDate?: string | null;
}

export default function DraftPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: draftId } = use(params);
  const [draft, setDraft] = useState<DraftData | null>(null);
  const [form, setForm] = useState<ReceiptExtractedData | null>(null);
  const initializedRef = useRef(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [employees, setEmployees] = useState<EmployeeOption[]>([]);
  const [teams, setTeams] = useState<TeamOption[]>([]);
  const [trips, setTrips] = useState<TripOption[]>([]);
  const [selectedEmployee, setSelectedEmployee] = useState<string | null>(null);
  const [selectedTeam, setSelectedTeam] = useState<string | null>(null);
  const [selectedTrip, setSelectedTrip] = useState<string | null>(null);
  const [aiNotes, setAiNotes] = useState<string[]>([]);
  const [categorizing, setCategorizing] = useState(false);
  const [categorizeError, setCategorizeError] = useState<string | null>(null);
  const [glAccount, setGlAccount] = useState<string | null>(null);
  const [businessCategory, setBusinessCategory] = useState<string | null>(null);
  const [aiConfidence, setAiConfidence] = useState<number | null>(null);
  const [aiAllocations, setAiAllocations] = useState<AISplitAllocation[]>([]);
  const router = useRouter();
  const calculateLineTotal = useCallback((items: LineItem[]) => {
    const total = items.reduce((sum, item) => sum + (Number(item.amount) || 0), 0);
    return Number(total.toFixed(2));
  }, []);

  const normalizeLineItems = useCallback((raw?: LineItem[] | null): LineItem[] => {
    return (raw ?? []).map((item) => {
      const amountValue = Number(item?.amount ?? 0);
      return {
        description: (item?.description ?? '').toString(),
        amount: Number.isFinite(amountValue) ? Number(Number(amountValue).toFixed(2)) : 0,
      } satisfies LineItem;
    });
  }, []);

  const saveDraft = useCallback(
    async ({
      silent = false,
      statusOverride,
    }: {
      silent?: boolean;
      statusOverride?: ExpenseDraft['status'];
    } = {}) => {
      if (!draftId || !form) return false;
      if (!silent) {
        setSaving(true);
        setSaveMessage(null);
        setSaveError(null);
      }

      const normalizedItems = normalizeLineItems(form.items as LineItem[] | undefined);
      const payloadExtraction: ReceiptExtractedData = {
        ...form,
        items: normalizedItems,
        amountTotal:
          normalizedItems.length > 0
            ? calculateLineTotal(normalizedItems)
            : form.amountTotal,
      };

      try {
        const res = await fetch(`/api/draft/${draftId}/update`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            extraction: payloadExtraction,
            employeeId: selectedEmployee,
            functionalTeamCode: selectedTeam,
            tripId: selectedTrip,
            aiLabels: aiNotes,
            glAccount,
            businessCategory,
            aiConfidence,
            aiAllocations,
            status: statusOverride ?? draft?.status ?? 'needs-info',
          }),
        });
        if (!res.ok) {
          throw new Error('Update failed');
        }
        const data = await res.json();
        const mergedExtraction: ReceiptExtractedData = data.extraction
          ? { ...payloadExtraction, ...data.extraction }
          : payloadExtraction;
        const normalizedServerItems = normalizeLineItems(
          mergedExtraction.items as LineItem[] | undefined,
        );
        const finalExtraction: ReceiptExtractedData = {
          ...mergedExtraction,
          items: normalizedServerItems,
          amountTotal:
            normalizedServerItems.length > 0
              ? calculateLineTotal(normalizedServerItems)
              : mergedExtraction.amountTotal,
        };
        setDraft((prev) =>
          prev
            ? {
                ...prev,
                extraction: finalExtraction,
                status: data.status ?? prev.status,
                employee_id: data.employeeId ?? selectedEmployee,
                functional_team_code: data.functionalTeamCode ?? selectedTeam,
                trip_id: data.tripId ?? selectedTrip,
                ai_labels: data.aiLabels ?? aiNotes,
                gl_account: data.glAccount ?? glAccount,
                business_category: data.businessCategory ?? businessCategory,
                ai_confidence: data.aiConfidence ?? aiConfidence,
                ai_allocations: data.aiAllocations ?? aiAllocations,
              }
            : prev,
        );
        setForm(finalExtraction);
        setSelectedEmployee(data.employeeId ?? selectedEmployee ?? null);
        setSelectedTeam(data.functionalTeamCode ?? selectedTeam ?? null);
        setSelectedTrip(data.tripId ?? selectedTrip ?? null);
        setAiNotes(data.aiLabels ?? aiNotes ?? []);
        setGlAccount(data.glAccount ?? glAccount ?? null);
        setBusinessCategory(data.businessCategory ?? businessCategory ?? null);
        setAiConfidence(
          typeof data.aiConfidence === 'number'
            ? Number(data.aiConfidence)
            : aiConfidence,
        );
        setAiAllocations(Array.isArray(data.aiAllocations) ? data.aiAllocations : aiAllocations);
        initializedRef.current = true;
        if (!silent) {
          setSaveMessage('Changes saved');
          setSaving(false);
        }
        return true;
      } catch (error) {
        console.error(error);
        if (!silent) {
          setSaveError('Unable to save changes. Please try again.');
          setSaving(false);
        }
        return false;
      }
    },
    [aiNotes, calculateLineTotal, draftId, form, normalizeLineItems, selectedEmployee, selectedTeam, selectedTrip],
  );

  const handleSubmit = useCallback(async () => {
    if (!draftId) return;
    setSubmitting(true);
    setSubmitError(null);
    const saved = await saveDraft({ silent: true });
    if (!saved) {
      setSubmitError('Unable to save changes before submitting. Try again.');
      setSubmitting(false);
      return;
    }

    try {
      const res = await fetch(`/api/draft/${draftId}/submit`, {
        method: 'POST',
      });
      if (!res.ok) {
        throw new Error('Submit failed');
      }
      router.push('/receipts');
      router.refresh();
    } catch (error) {
      console.error(error);
      setSubmitError('Unable to submit right now. Please try again.');
      setSubmitting(false);
    }
  }, [draftId, router, saveDraft]);

  useEffect(() => {
    let isMounted = true;
    initializedRef.current = false;
    setForm(null);
    setSelectedEmployee(null);
    setSelectedTeam(null);
    setSelectedTrip(null);
    setAiNotes([]);
    Promise.all([
      fetch(`/api/get-draft/${draftId}`).then((res) =>
        res.ok ? res.json() : Promise.reject(res),
      ),
      fetch('/api/employees').then((res) => (res.ok ? res.json() : Promise.reject(res))),
      fetch('/api/teams').then((res) => (res.ok ? res.json() : Promise.reject(res))),
      fetch('/api/trips').then((res) => (res.ok ? res.json() : Promise.reject(res))),
    ])
      .then(([draftData, employeesData, teamsData, tripsData]: [
        DraftData,
        EmployeeOption[],
        TeamOption[],
        TripOption[],
      ]) => {
        if (!isMounted) return;
        setDraft(draftData);
        setEmployees(employeesData ?? []);
        setTeams(teamsData ?? []);
        setTrips(tripsData ?? []);
      })
      .catch((error) => {
        console.error('load draft meta error', error);
        if (isMounted) {
          setDraft(null);
          setEmployees([]);
          setTeams([]);
          setTrips([]);
        }
      });
    return () => {
      isMounted = false;
    };
  }, [draftId]);

  useEffect(() => {
    if (!draft || initializedRef.current) return;

    const base: ReceiptExtractedData = {
      merchant: draft.extraction?.merchant ?? null,
      amountTotal: draft.extraction?.amountTotal ?? null,
      amountTax: draft.extraction?.amountTax ?? null,
      currency: draft.extraction?.currency ?? 'USD',
      items: draft.extraction?.items ?? [],
      date: draft.extraction?.date ?? null,
      location: draft.extraction?.location,
      paymentMethod: draft.extraction?.paymentMethod ?? null,
      category: draft.extraction?.category ?? null,
      invoiceNumber: draft.extraction?.invoiceNumber ?? null,
    };

    const normalizedItems = normalizeLineItems(base.items as LineItem[] | undefined);
    const amountFromItems =
      normalizedItems.length > 0 ? calculateLineTotal(normalizedItems) : base.amountTotal;

    setSelectedEmployee(draft.employee_id ?? null);
    setSelectedTeam(draft.functional_team_code ?? null);
    setSelectedTrip(draft.trip_id ?? null);
    setAiNotes(draft.ai_labels ?? []);
    setGlAccount(draft.gl_account ?? null);
    setBusinessCategory(draft.business_category ?? null);
    setAiConfidence(
      typeof draft.ai_confidence === 'number' ? Number(draft.ai_confidence) : null,
    );
    setAiAllocations(Array.isArray(draft.ai_allocations) ? draft.ai_allocations : []);

    setForm({
      ...base,
      items: normalizedItems,
      amountTotal: amountFromItems,
    });
    initializedRef.current = true;
  }, [calculateLineTotal, draft, normalizeLineItems]);

  const items = (form?.items as LineItem[] | undefined) ?? [];
  const computedLineTotal =
    items.length > 0 ? calculateLineTotal(items) : form?.amountTotal ?? null;

  const handleStringFieldChange = useCallback(
    (field: 'merchant' | 'invoiceNumber' | 'currency' | 'date' | 'category' | 'paymentMethod') =>
      (event: ChangeEvent<HTMLInputElement>) => {
        const rawValue = event.target.value;
        const value = rawValue.trim().length === 0
          ? null
          : field === 'currency'
          ? rawValue.toUpperCase()
          : rawValue;
        setForm((prev) => (prev ? { ...prev, [field]: value } : prev));
        setSaveMessage(null);
        setSaveError(null);
      },
    [],
  );

  const handleLineItemChange = useCallback(
    (index: number, field: 'description' | 'amount') =>
      (event: ChangeEvent<HTMLInputElement>) => {
        const rawValue = event.target.value;
        setForm((prev) => {
          if (!prev) return prev;
          const currentItems = [...((prev.items as LineItem[] | undefined) ?? [])];
          const existing = currentItems[index] ?? { description: '', amount: 0 };
          const updatedItem =
            field === 'amount'
              ? { ...existing, amount: Number(rawValue) || 0 }
              : { ...existing, description: rawValue };
          currentItems[index] = updatedItem;
          const newTotal =
            currentItems.length > 0 ? calculateLineTotal(currentItems) : prev.amountTotal;
          return {
            ...prev,
            items: currentItems,
            amountTotal: currentItems.length > 0 ? newTotal : prev.amountTotal,
          };
        });
        setSaveMessage(null);
        setSaveError(null);
      },
    [calculateLineTotal],
  );

  const handleAddLineItem = useCallback(() => {
    setForm((prev) => {
      if (!prev) return prev;
      const currentItems = [...((prev.items as LineItem[] | undefined) ?? [])];
      currentItems.push({ description: '', amount: 0 });
      const newTotal =
        currentItems.length > 0 ? calculateLineTotal(currentItems) : prev.amountTotal;
      return {
        ...prev,
        items: currentItems,
        amountTotal: currentItems.length > 0 ? newTotal : prev.amountTotal,
      };
    });
    setSaveMessage(null);
    setSaveError(null);
  }, [calculateLineTotal]);

  const handleRemoveLineItem = useCallback(
    (index: number) => {
      setForm((prev) => {
        if (!prev) return prev;
        const currentItems = [...((prev.items as LineItem[] | undefined) ?? [])];
        currentItems.splice(index, 1);
        const newTotal =
          currentItems.length > 0 ? calculateLineTotal(currentItems) : null;
        return {
          ...prev,
          items: currentItems,
          amountTotal: currentItems.length > 0 ? newTotal : null,
        };
      });
      setSaveMessage(null);
      setSaveError(null);
    },
    [calculateLineTotal],
  );

  const handleCreateEmployee = useCallback(async () => {
    const name = window.prompt('New employee name');
    if (!name) return;
    try {
      const res = await fetch('/api/employees', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name }),
      });
      if (!res.ok) throw new Error('failed');
      const employee: EmployeeOption = await res.json();
      setEmployees((prev) => [...prev, employee]);
      setSelectedEmployee(employee.id);
    } catch (error) {
      console.error(error);
      window.alert('Unable to create employee.');
    }
  }, []);

  const handleCreateTeam = useCallback(async () => {
    const code = window.prompt('New functional team code (e.g. ENG)');
    if (!code) return;
    const name = window.prompt('Team name');
    if (!name) return;
    try {
      const res = await fetch('/api/teams', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code, name }),
      });
      if (!res.ok) throw new Error('failed');
      const team: TeamOption = await res.json();
      setTeams((prev) => [...prev, team]);
      setSelectedTeam(team.code);
    } catch (error) {
      console.error(error);
      window.alert('Unable to create team.');
    }
  }, []);

  const handleCreateTrip = useCallback(async () => {
    const name = window.prompt('Trip name');
    if (!name) return;
    try {
      const res = await fetch('/api/trips', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name }),
      });
      if (!res.ok) throw new Error('failed');
      const trip: TripOption = await res.json();
      setTrips((prev) => [trip, ...prev]);
      setSelectedTrip(trip.id);
    } catch (error) {
      console.error(error);
      window.alert('Unable to create trip.');
    }
  }, []);

  const handleAskAI = useCallback(async () => {
    if (!draftId) return;
    setCategorizing(true);
    setCategorizeError(null);
    try {
      const res = await fetch(`/api/draft/${draftId}/categorize`, { method: 'POST' });
      const payload = await res
        .clone()
        .json()
        .catch(() => ({ error: 'unknown', requestId: undefined }));
      if (!res.ok) {
        const message =
          typeof payload?.error === 'string' ? payload.error : `status ${res.status}`;
        const reqId = payload?.requestId ? ` (requestId ${payload.requestId})` : '';
        throw new Error(`${message}${reqId}`);
      }
      const data = typeof payload === 'object' && payload !== null ? payload : await res.json();
      if (data.category) {
        setForm((prev) => (prev ? { ...prev, category: data.category } : prev));
      }
      if (data.functionalTeamCode) {
        setSelectedTeam(data.functionalTeamCode);
      }
      if (data.employeeId) {
        setSelectedEmployee(data.employeeId);
      }
      if (data.tripId) {
        setSelectedTrip(data.tripId);
      }
      if (data.glAccount) {
        setGlAccount(data.glAccount);
      }
      if (data.businessCategory) {
        setBusinessCategory(data.businessCategory);
      }
      if (typeof data.confidence === 'number') {
        setAiConfidence(Number(data.confidence));
      }
      if (Array.isArray(data.splitAllocations)) {
        setAiAllocations(data.splitAllocations);
      }
      if (Array.isArray(data.notes)) {
        setAiNotes(data.notes);
      }
      setCategorizing(false);
    } catch (error) {
      console.error('categorize failed', error);
      setCategorizeError(
        error instanceof Error ? error.message : 'Unable to categorize automatically.',
      );
      setCategorizing(false);
    }
  }, [draftId]);

  if (!draft || !form) {
    return <div className="p-8 text-sm text-zinc-500">Loading…</div>;
  }

  return (
    <div className="min-h-screen p-8">
      <div className="mx-auto mb-6 flex w-full max-w-6xl flex-col gap-2">
        <div className="flex items-center justify-between">
          <div>
            <span className="rounded-full bg-[#ede9fe] px-3 py-1 text-xs font-semibold uppercase tracking-[0.25em] text-[#5b21b6]">
              Review queue
            </span>
            <h1 className="mt-3 text-3xl font-semibold text-[#2d1c66]">Review & Approve</h1>
            <p className="text-sm text-[#58458f]">
              Double-check the extracted fields, address policy findings, then submit.
            </p>
          </div>
          <div className="flex gap-3 text-sm font-medium">
            <Link
              className="rounded-full border border-[#c9b6ff] bg-white/80 px-4 py-2 text-[#4c1d95] transition hover:bg-[#ede9fe]"
              href="/receipts"
            >
              View receipts
            </Link>
            <Link
              className="rounded-full bg-gradient-to-r from-[#7f46ff] to-[#5b2ddb] px-4 py-2 text-white shadow-md shadow-[#7c3aed]/20 transition hover:from-[#6e38f5] hover:to-[#4c23c9]"
              href="/"
            >
              Upload new receipt
            </Link>
          </div>
        </div>
      </div>
      <div className="mx-auto grid max-w-6xl grid-cols-12 gap-8">
        <aside className="col-span-12 rounded-3xl border border-dashed border-[#d7caff] bg-white/75 p-6 text-[#5b4c90] shadow-lg shadow-[#7c3aed]/10 backdrop-blur lg:col-span-4">
          <div className="grid h-60 place-items-center text-sm">
            Drop additional files here
          </div>
        </aside>

        <section className="col-span-12 space-y-6 lg:col-span-8">
          <div className="rounded-3xl border border-white/70 bg-white/80 p-6 shadow-lg shadow-[#7c3aed]/10 backdrop-blur">
            <h2 className="mb-4 text-lg font-semibold text-[#342076]">Vendor</h2>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <input
                className="rounded-xl border border-[#dcd2ff] bg-white/90 px-3 py-3 text-sm text-[#2d1c66]"
                value={form.merchant ?? ''}
                onChange={handleStringFieldChange('merchant')}
                placeholder="Legal name"
              />
              <input
                className="rounded-xl border border-[#dcd2ff] bg-white/90 px-3 py-3 text-sm text-[#2d1c66]"
                value={form.paymentMethod ?? ''}
                onChange={handleStringFieldChange('paymentMethod')}
                placeholder="Payment method (optional)"
              />
            </div>
          </div>

          <div className="rounded-3xl border border-white/70 bg-white/80 p-6 shadow-lg shadow-[#7c3aed]/10 backdrop-blur">
            <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
              <div>
                <h2 className="text-lg font-semibold text-[#342076]">Assignment</h2>
                <p className="text-xs uppercase tracking-[0.3em] text-[#7c3aed]">
                  Route approvals & analytics
                </p>
              </div>
              <button
                type="button"
                onClick={handleAskAI}
                disabled={categorizing}
                className="rounded-full bg-gradient-to-r from-[#8b5cf6] to-[#7c3aed] px-4 py-2 text-xs font-semibold uppercase tracking-wide text-white shadow-md shadow-[#7c3aed]/20 transition hover:from-[#7c3aed] hover:to-[#5b2ddb] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {categorizing ? 'Asking AI…' : 'Ask AI to categorize'}
              </button>
            </div>

            <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-3">
              <div className="flex flex-col gap-2">
                <label className="text-xs font-semibold uppercase tracking-wide text-[#5b4c90]">
                  Employee
                </label>
                <select
                  className="rounded-xl border border-[#dcd2ff] bg-white/90 px-3 py-3 text-sm text-[#2d1c66]"
                  value={selectedEmployee ?? ''}
                  onChange={(event) => setSelectedEmployee(event.target.value || null)}
                >
                  <option value="">Unassigned</option>
                  {employees.map((employee) => (
                    <option key={employee.id} value={employee.id}>
                      {employee.name}
                      {employee.email ? ` — ${employee.email}` : ''}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={handleCreateEmployee}
                  className="self-start rounded-full border border-dashed border-[#c9b6ff] px-3 py-1 text-xs font-medium text-[#4c1d95] transition hover:bg-[#ede9fe]"
                >
                  + Add employee
                </button>
              </div>

              <div className="flex flex-col gap-2">
                <label className="text-xs font-semibold uppercase tracking-wide text-[#5b4c90]">
                  Functional team
                </label>
                <select
                  className="rounded-xl border border-[#dcd2ff] bg-white/90 px-3 py-3 text-sm text-[#2d1c66]"
                  value={selectedTeam ?? ''}
                  onChange={(event) => setSelectedTeam(event.target.value || null)}
                >
                  <option value="">Unassigned</option>
                  {teams.map((team) => (
                    <option key={team.code} value={team.code}>
                      {team.code} — {team.name}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={handleCreateTeam}
                  className="self-start rounded-full border border-dashed border-[#c9b6ff] px-3 py-1 text-xs font-medium text-[#4c1d95] transition hover:bg-[#ede9fe]"
                >
                  + Add team
                </button>
              </div>

              <div className="flex flex-col gap-2">
                <label className="text-xs font-semibold uppercase tracking-wide text-[#5b4c90]">
                  Trip / event
                </label>
                <select
                  className="rounded-xl border border-[#dcd2ff] bg-white/90 px-3 py-3 text-sm text-[#2d1c66]"
                  value={selectedTrip ?? ''}
                  onChange={(event) => setSelectedTrip(event.target.value || null)}
                >
                  <option value="">Unassigned</option>
                  {trips.map((trip) => (
                    <option key={trip.id} value={trip.id}>
                      {trip.name}
                      {trip.startDate ? ` — ${trip.startDate}` : ''}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={handleCreateTrip}
                  className="self-start rounded-full border border-dashed border-[#c9b6ff] px-3 py-1 text-xs font-medium text-[#4c1d95] transition hover:bg-[#ede9fe]"
                >
                  + Add trip
                </button>
              </div>
            </div>

            {categorizeError ? (
              <p className="mt-4 text-sm text-[#a21caf]">{categorizeError}</p>
            ) : null}
            {aiNotes.length > 0 ? (
              <div className="mt-4 rounded-2xl border border-[#ede7ff] bg-[#f8f5ff] px-4 py-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-[#5b21b6]">
                  AI suggestions
                </p>
                <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-[#4c1d95]">
                  {aiNotes.map((note, index) => (
                    <li key={index}>{note}</li>
                  ))}
                </ul>
              </div>
            ) : null}
          </div>

          <div className="rounded-3xl border border-white/70 bg-white/80 p-6 shadow-lg shadow-[#7c3aed]/10 backdrop-blur">
            <h2 className="mb-4 text-lg font-semibold text-[#342076]">Bill details</h2>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <label className="flex flex-col gap-1 text-xs font-semibold uppercase tracking-wide text-[#5b4c90]">
                Category
                <input
                  className="rounded-xl border border-[#dcd2ff] bg-white/90 px-3 py-3 text-sm text-[#2d1c66]"
                  value={form.category ?? ''}
                  onChange={handleStringFieldChange('category')}
                  placeholder="Category"
                />
              </label>
              <label className="flex flex-col gap-1 text-xs font-semibold uppercase tracking-wide text-[#5b4c90]">
                Business category
                <input
                  className="rounded-xl border border-[#dcd2ff] bg-white/90 px-3 py-3 text-sm text-[#2d1c66]"
                  value={businessCategory ?? ''}
                  onChange={(event) => {
                    const value = event.target.value.trim();
                    setBusinessCategory(value.length > 0 ? value : null);
                    setSaveMessage(null);
                    setSaveError(null);
                  }}
                  placeholder="e.g., Client Entertainment"
                />
              </label>
              <label className="flex flex-col gap-1 text-xs font-semibold uppercase tracking-wide text-[#5b4c90]">
                Invoice number
                <input
                  className="rounded-xl border border-[#dcd2ff] bg-white/90 px-3 py-3 text-sm text-[#2d1c66]"
                  value={form.invoiceNumber ?? ''}
                  onChange={handleStringFieldChange('invoiceNumber')}
                  placeholder="Invoice number"
                />
              </label>
              <label className="flex flex-col gap-1 text-xs font-semibold uppercase tracking-wide text-[#5b4c90]">
                Currency
                <input
                  className="rounded-xl border border-[#dcd2ff] bg-white/90 px-3 py-3 text-sm text-[#2d1c66]"
                  value={form.currency ?? 'USD'}
                  onChange={handleStringFieldChange('currency')}
                  placeholder="Currency"
                />
              </label>
              <label className="flex flex-col gap-1 text-xs font-semibold uppercase tracking-wide text-[#5b4c90]">
                GL account
                <input
                  className="rounded-xl border border-[#dcd2ff] bg-white/90 px-3 py-3 text-sm text-[#2d1c66]"
                  value={glAccount ?? ''}
                  onChange={(event) => {
                    const value = event.target.value.trim();
                    setGlAccount(value.length > 0 ? value : null);
                    setSaveMessage(null);
                    setSaveError(null);
                  }}
                  placeholder="e.g., Meals / Lodging"
                />
              </label>
              <label className="flex flex-col gap-1 text-xs font-semibold uppercase tracking-wide text-[#5b4c90]">
                Calculated total
                <input
                  className="rounded-xl border border-[#dcd2ff] bg-white/70 px-3 py-3 text-sm text-[#2d1c66]"
                  value={computedLineTotal != null ? computedLineTotal.toFixed(2) : ''}
                  readOnly
                />
                <span className="text-xs font-normal normal-case text-[#6b5b99]">
                  Auto-updated from line items
                </span>
              </label>
              <label className="flex flex-col gap-1 text-xs font-semibold uppercase tracking-wide text-[#5b4c90]">
                Date
                <input
                  type="date"
                  className="rounded-xl border border-[#dcd2ff] bg-white/90 px-3 py-3 text-sm text-[#2d1c66]"
                  value={form.date ? form.date.substring(0, 10) : ''}
                  onChange={handleStringFieldChange('date')}
                />
              </label>
              <label className="flex flex-col gap-1 text-xs font-semibold uppercase tracking-wide text-[#5b4c90]">
                AI confidence
                <input
                  className="rounded-xl border border-[#dcd2ff] bg-white/70 px-3 py-3 text-sm text-[#2d1c66]"
                  value={
                    aiConfidence != null ? `${Math.round(aiConfidence * 100)}% confident` : '—'
                  }
                  readOnly
                />
              </label>
            </div>

            {aiAllocations.length > 0 ? (
              <div className="mt-4 rounded-2xl border border-[#ede7ff] bg-[#f6f2ff] px-4 py-3 text-sm text-[#4c1d95]">
                <p className="text-xs font-semibold uppercase tracking-wide text-[#5b21b6]">
                  Proposed split allocations
                </p>
                <ul className="mt-2 space-y-1">
                  {aiAllocations.map((allocation, index) => (
                    <li key={`${allocation.glAccount}-${index}`} className="flex flex-wrap gap-2">
                      <span className="rounded-full bg-white/80 px-2 py-1 text-xs font-semibold text-[#5b21b6]">
                        {allocation.glAccount}
                      </span>
                      {allocation.amount != null ? (
                        <span>${allocation.amount.toFixed(2)}</span>
                      ) : null}
                      {allocation.percent != null ? (
                        <span>{allocation.percent}%</span>
                      ) : null}
                      {allocation.notes ? <span className="text-xs text-[#6b5b99]">{allocation.notes}</span> : null}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </div>

          <div className="rounded-3xl border border-white/70 bg-white/80 p-6 shadow-lg shadow-[#7c3aed]/10 backdrop-blur">
            <h2 className="mb-4 text-lg font-semibold text-[#342076]">Line items</h2>
            <div className="space-y-3">
              {items.map((item, index) => (
                <div key={index} className="grid grid-cols-1 items-start gap-3 md:grid-cols-7">
                  <input
                    className="md:col-span-4 rounded-xl border border-[#dcd2ff] bg-white/90 px-3 py-3 text-sm text-[#2d1c66]"
                    value={item.description}
                    onChange={handleLineItemChange(index, 'description')}
                    placeholder="Description"
                  />
                  <input
                    type="number"
                    step="0.01"
                    className="md:col-span-2 rounded-xl border border-[#dcd2ff] bg-white/90 px-3 py-3 text-sm text-[#2d1c66]"
                    value={item.amount ?? 0}
                    onChange={handleLineItemChange(index, 'amount')}
                    placeholder="Amount"
                  />
                  <button
                    type="button"
                    onClick={() => handleRemoveLineItem(index)}
                    className="md:col-span-1 rounded-full border border-[#e5dcff] bg-white/80 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-[#7c3aed] transition hover:bg-[#ede9fe]"
                  >
                    Remove
                  </button>
                </div>
              ))}
              {items.length === 0 ? (
                <p className="text-sm text-[#5b4c90]">No line items detected.</p>
              ) : null}
              <button
                type="button"
                onClick={handleAddLineItem}
                className="rounded-full border border-dashed border-[#c9b6ff] bg-white/70 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-[#4c1d95] transition hover:bg-[#ede9fe]"
              >
                + Add line item
              </button>
            </div>
          </div>

          <div className="rounded-3xl border border-white/70 bg-white/80 p-6 shadow-lg shadow-[#7c3aed]/10 backdrop-blur">
            <h2 className="mb-4 text-lg font-semibold text-[#342076]">Policy</h2>
            <ul className="list-disc space-y-2 pl-6 text-sm text-[#2d1c66]">
              {draft.validation?.map((finding) => (
                <li key={finding.code}>
                  <span className="rounded-full bg-[#ede9fe] px-2 py-0.5 text-xs font-semibold text-[#5b21b6]">
                    {finding.severity.toUpperCase()}
                  </span>{' '}
                  <span className="font-medium">{finding.message}</span>{' '}
                  <span className="text-[#5b4c90]">{finding.evidence}</span>
                </li>
              ))}
              {(!draft.validation || draft.validation.length === 0) && (
                <li className="text-[#5b4c90]">No issues found.</li>
              )}
            </ul>
          </div>

          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div className="text-sm">
              {saveMessage ? (
                <p className="text-[#4c1d95]">{saveMessage}</p>
              ) : null}
              {saveError ? <p className="text-[#a21caf]">{saveError}</p> : null}
              {submitError ? <p className="text-[#a21caf]">{submitError}</p> : null}
            </div>
            <div className="flex flex-wrap justify-end gap-3">
              <a
                className="rounded-full border border-[#c9b6ff] bg-white/80 px-4 py-2 text-sm font-semibold text-[#4c1d95] transition hover:bg-[#ede9fe]"
                href={`/api/export/${draft.id}.csv`}
              >
                Export CSV
              </a>
              <button
                type="button"
                onClick={() => {
                  void saveDraft();
                }}
                disabled={saving || submitting}
                className="rounded-full border border-[#c9b6ff] bg-white/80 px-5 py-2 text-sm font-semibold text-[#4c1d95] shadow-sm shadow-[#7c3aed]/10 transition hover:bg-[#ede9fe] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {saving ? 'Saving…' : 'Save changes'}
              </button>
              <button
                type="button"
                onClick={() => {
                  void handleSubmit();
                }}
                disabled={submitting}
                className="rounded-full bg-gradient-to-r from-[#7f46ff] to-[#5b2ddb] px-5 py-2 text-sm font-semibold text-white shadow-md shadow-[#7c3aed]/20 transition hover:from-[#6e38f5] hover:to-[#4c23c9] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {submitting ? 'Submitting…' : 'Submit'}
              </button>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}

