'use client';

import Link from 'next/link';
import { startTransition, useEffect, useMemo, useState } from 'react';

interface DraftRow {
  id: string;
  status: string;
  extraction: {
    merchant?: string | null;
    amountTotal?: number | null;
    currency?: string | null;
    date?: string | null;
    category?: string | null;
  } | null;
}

export default function ReceiptsPage() {
  const [drafts, setDrafts] = useState<DraftRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    startTransition(() => setLoading(true));
    fetch('/api/my-drafts')
      .then((res) => (res.ok ? res.json() : Promise.reject(res)))
      .then((data: DraftRow[]) => {
        setDrafts(data || []);
        setError(null);
      })
      .catch(() => {
        setDrafts([]);
        setError('Failed to load receipts. Please try again.');
      })
      .finally(() => setLoading(false));
  }, []);

  const savedDrafts = useMemo(
    () => drafts.filter((draft) => draft.status === 'needs-info'),
    [drafts],
  );
  const submittedDrafts = useMemo(
    () => drafts.filter((draft) => draft.status !== 'needs-info'),
    [drafts],
  );

  return (
    <div className="mx-auto flex min-h-full w-full max-w-6xl flex-col gap-8 px-6 py-10">
      <header className="rounded-3xl border border-white/60 bg-white/75 px-8 py-6 shadow-lg shadow-[#7c3aed]/10 backdrop-blur">
        <h1 className="text-3xl font-semibold text-[#2d1c66]">Receipts Library</h1>
        <p className="mt-2 max-w-3xl text-sm text-[#58458f]">
          Track everything in one place. Move saved receipts to ready-to-submit once they
          meet policy and keep an audit trail for finance.
        </p>
      </header>

      {error ? (
        <div className="rounded-2xl border border-[#f0c1ff] bg-[#fff5ff] px-5 py-4 text-sm text-[#8b1fa9] shadow-sm shadow-[#f0c1ff]/40">
          {error}
        </div>
      ) : null}

      {loading ? (
        <div className="rounded-3xl border border-dashed border-[#d9c8ff] bg-white/70 p-8 text-sm text-[#5b4c90] shadow-inner shadow-white">
          Loading receipts…
        </div>
      ) : (
        <div className="grid gap-8 lg:grid-cols-2">
          <section className="flex h-full flex-col rounded-3xl border border-white/60 bg-white/85 p-6 shadow-xl shadow-[#7c3aed]/10 backdrop-blur">
            <div>
              <h2 className="text-lg font-semibold text-[#342076]">Saved (Needs Info)</h2>
              <p className="mb-4 text-xs uppercase tracking-[0.2em] text-[#7c3aed]">
                Waiting for review
              </p>
            </div>
            <ul className="space-y-3">
              {savedDrafts.map((draft) => (
                <li
                  key={draft.id}
                  className="rounded-2xl border border-[#dcd2ff] bg-gradient-to-r from-white/90 to-[#f5f0ff] px-5 py-4 text-sm text-[#422981] shadow-sm shadow-[#7c3aed]/10"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="space-y-1">
                      <p className="font-semibold">
                        {draft.extraction?.merchant || 'Untitled draft'}
                      </p>
                      <p className="text-xs text-[#5c4c92]">
                        {draft.extraction?.date || 'Date unknown'} ·{' '}
                        {draft.extraction?.currency || 'USD'}{' '}
                        {draft.extraction?.amountTotal ?? '—'}
                      </p>
                    </div>
                    <Link
                      href={`/draft/${draft.id}`}
                      className="rounded-full bg-gradient-to-r from-[#a855f7] to-[#7c3aed] px-4 py-2 text-xs font-semibold uppercase text-white shadow-md shadow-[#a855f7]/30 transition hover:from-[#9333ea] hover:to-[#6d28d9]"
                    >
                      Continue
                    </Link>
                  </div>
                </li>
              ))}
              {savedDrafts.length === 0 ? (
                <li className="rounded-2xl border border-dashed border-[#d1c4ff] bg-white/70 px-5 py-6 text-sm text-[#5b4c90]">
                  Nothing saved right now. Upload a new receipt to get started.
                </li>
              ) : null}
            </ul>
          </section>

          <section className="flex h-full flex-col rounded-3xl border border-white/60 bg-white/85 p-6 shadow-xl shadow-[#7c3aed]/10 backdrop-blur">
            <div>
              <h2 className="text-lg font-semibold text-[#342076]">Submitted / Cleared</h2>
              <p className="mb-4 text-xs uppercase tracking-[0.2em] text-[#7c3aed]">
                Ready for export
              </p>
            </div>
            <ul className="space-y-3">
              {submittedDrafts.map((draft) => (
                <li
                  key={draft.id}
                  className="rounded-2xl border border-[#d5c7ff] bg-gradient-to-r from-white/90 to-[#efe7ff] px-5 py-4 text-sm text-[#422981] shadow-sm shadow-[#7c3aed]/10"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="space-y-1">
                      <p className="font-semibold">
                        {draft.extraction?.merchant || 'Submitted draft'}
                      </p>
                      <p className="text-xs text-[#5c4c92]">
                        {draft.status.toUpperCase()} · {draft.extraction?.date || 'Date unknown'}
                      </p>
                    </div>
                    <Link
                      href={`/draft/${draft.id}`}
                      className="rounded-full border border-[#c9b6ff] bg-white/70 px-4 py-2 text-xs font-semibold uppercase text-[#4c1d95] transition hover:bg-[#ede9fe]"
                    >
                      View
                    </Link>
                  </div>
                </li>
              ))}
              {submittedDrafts.length === 0 ? (
                <li className="rounded-2xl border border-dashed border-[#d1c4ff] bg-white/70 px-5 py-6 text-sm text-[#5b4c90]">
                  No submitted receipts yet. Approve a draft to move it here.
                </li>
              ) : null}
            </ul>
          </section>
        </div>
      )}
    </div>
  );
}

