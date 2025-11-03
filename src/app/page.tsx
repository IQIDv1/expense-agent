'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';

interface DraftSummary {
  id: string;
  extraction: {
    merchant?: string | null;
  } | null;
  status: string;
}

export default function Home() {
  const [file, setFile] = useState<File | null>(null);
  const [drafts, setDrafts] = useState<DraftSummary[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function upload() {
    if (!file) return;
    setIsLoading(true);
    setError(null);
    try {
      const formData = new FormData();
      formData.append('file', file);

      const uploadRes = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      }).then((r) => r.json());

      if (!uploadRes?.receiptId) {
        throw new Error('upload failed');
      }

      const ocrRes = await fetch(`/api/ocr/${uploadRes.receiptId}`, {
        method: 'POST',
      }).then((r) => r.json());

      if (!ocrRes?.draftId) {
        throw new Error('ocr failed');
      }

      await fetch(`/api/policy/${ocrRes.draftId}`, { method: 'POST' });
      window.location.href = `/draft/${ocrRes.draftId}`;
    } catch (err) {
      setError('Upload failed. Please try again.');
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    fetch('/api/my-drafts')
      .then((r) => r.json())
      .then((data) => setDrafts(data || []))
      .catch(() => setDrafts([]));
  }, []);

  return (
    <main className="p-8">
      <div className="mx-auto grid w-full max-w-5xl gap-8">
        <section className="rounded-3xl border border-white/60 bg-white/80 px-10 py-12 shadow-xl shadow-[#7c3aed]/10 backdrop-blur">
          <div className="mx-auto flex max-w-3xl flex-col items-center text-center">
            <span className="rounded-full bg-gradient-to-r from-[#ede9fe] to-[#ddd6fe] px-4 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-[#4c1d95]">
              EMA Fast Track
            </span>
            <h1 className="mt-4 text-3xl font-semibold text-[#2d1c66]">
              Upload a receipt, we’ll extract the data and flag policy risks instantly.
            </h1>
            <p className="mt-3 text-sm text-[#4f3c8a]">
              Drop any photo or PDF. We run vision OCR, normalize details, and highlight
              anything your finance team needs before approval.
            </p>
            <div className="mt-8 flex w-full flex-col items-center gap-4">
              <label
                className="flex w-full cursor-pointer flex-col items-center gap-3 rounded-2xl border border-dashed border-[#c9b6ff] bg-white/70 px-6 py-6 text-sm text-[#4c1d95] transition hover:border-[#a78bfa]"
              >
                <span className="font-medium">Choose file</span>
                <input
                  className="hidden"
                  type="file"
                  accept="image/*,application/pdf"
                  onChange={(event) => setFile(event.target.files?.[0] ?? null)}
                />
                {file ? <span>{file.name}</span> : <span>No file selected</span>}
              </label>
              <button
                onClick={upload}
                disabled={!file || isLoading}
                className="inline-flex items-center justify-center rounded-full bg-gradient-to-r from-[#7f46ff] to-[#5b2ddb] px-6 py-2 text-sm font-semibold text-white shadow-lg shadow-[#7c3aed]/20 transition hover:from-[#6e38f5] hover:to-[#4c23c9] disabled:pointer-events-none disabled:opacity-60"
              >
                {isLoading ? 'Processing…' : 'Upload & Extract'}
              </button>
              {error ? (
                <p className="text-sm text-[#a21caf]">{error}</p>
              ) : null}
            </div>
          </div>
        </section>

        <section className="rounded-3xl border border-white/60 bg-white/80 p-6 shadow-lg shadow-[#7c3aed]/10 backdrop-blur">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-[#2d1c66]">Recent drafts</h2>
              <p className="text-xs text-[#5b4c90]">
                We keep the last 20 receipts you touched right here.
              </p>
            </div>
            <Link
              href="/receipts"
              className="rounded-full border border-[#c9b6ff] bg-white/70 px-4 py-2 text-sm font-medium text-[#4c1d95] transition hover:bg-[#ede9fe]"
            >
              View all
            </Link>
          </div>
          <ul className="mt-5 grid gap-3">
            {drafts.map((draft) => (
              <li
                key={draft.id}
                className="flex items-center justify-between rounded-2xl border border-white/70 bg-gradient-to-r from-white to-[#f4f0ff] px-5 py-4 text-sm shadow-sm shadow-[#7c3aed]/10"
              >
                <div>
                  <p className="font-semibold text-[#35206d]">
                    {draft.extraction?.merchant || 'Draft'}
                  </p>
                  <p className="text-xs text-[#5b4c90]">Status: {draft.status}</p>
                </div>
                <Link
                  className="rounded-full bg-[#7c3aed] px-4 py-2 text-xs font-semibold uppercase tracking-wide text-white shadow-sm shadow-[#7c3aed]/20 transition hover:bg-[#6d28d9]"
                  href={`/draft/${draft.id}`}
                >
                  Open
                </Link>
              </li>
            ))}
            {drafts.length === 0 ? (
              <li className="rounded-2xl border border-dashed border-[#d1c4ff] bg-white/70 px-5 py-6 text-sm text-[#5b4c90]">
                No drafts yet. Upload a receipt to get started.
              </li>
            ) : null}
          </ul>
        </section>
      </div>
    </main>
  );
}
