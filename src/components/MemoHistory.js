import React, { useState } from 'react';
import { fetchMemoHtml } from '../lib/memos';

// The memo a committee decided on is a fixed document. The screening model
// underneath it is not: SOFR moves, criteria get retuned, scoring gets
// corrected. This is the notice that says so, in the one place where the
// difference matters, which is the moment an analyst reopens a screened deal
// and sees a number that is not the number in the file.

function formatDate(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
}

function formatSofr(rate) {
  return typeof rate === 'number' ? `${(rate * 100).toFixed(2)}%` : null;
}

function authorOf(memo) {
  return memo?.profiles?.full_name || memo?.profiles?.email || '';
}

// Open the stored artifact, not a re-render. This is the document that went
// to committee, so the version now in the codebase is not consulted.
function openStoredMemo(html) {
  const w = window.open('', '_blank');
  if (!w) return;
  w.document.write(html);
  w.document.close();
  w.focus();
}

export default function MemoHistory({ memos = [], drift = null }) {
  const [expanded, setExpanded] = useState(false);
  const [openingId, setOpeningId] = useState(null);
  const [openError, setOpenError] = useState('');

  if (!memos.length) return null;

  const latest = memos[0];
  const earlier = memos.slice(1);
  const hasDrift = !!drift?.hasDrift;

  const handleOpen = async (memoId) => {
    setOpeningId(memoId);
    setOpenError('');
    const { data, error } = await fetchMemoHtml(memoId);
    setOpeningId(null);
    if (error || !data) {
      setOpenError('Could not load that memo.');
      return;
    }
    openStoredMemo(data);
  };

  const latestSofr = formatSofr(latest.sofr);
  const author = authorOf(latest);

  // What the memo said. Everything here is read off the stored row, so it
  // stays true no matter what the live deal does afterwards.
  const memoLine = [
    `Screened ${latest.score != null ? Math.round(latest.score) : 'unscored'}`,
    latest.verdict ? ` ${latest.verdict}` : '',
    ` on ${formatDate(latest.created_at)}`,
    latestSofr ? ` at ${latestSofr} SOFR` : '',
    author ? ` by ${author}` : '',
    '.',
  ].join('');

  // What moved. Only the parts that actually changed are named, so the
  // notice stays readable when one thing moved and honest when three did.
  let driftLine = '';
  if (hasDrift) {
    const parts = [];
    if (drift.score.changed || drift.verdict.changed) {
      const score = drift.score.now != null ? drift.score.now : 'unscored';
      const verdict = drift.verdict.now || '';
      parts.push(`the live model scores it ${score}${verdict ? ` ${verdict}` : ''}`);
    }
    if (drift.sofr.changed) {
      parts.push(`SOFR is now ${formatSofr(drift.sofr.now)}`);
    }
    driftLine = `Today ${parts.join(', and ')}.`;
  }

  return (
    <div
      className={`rounded-2xl border p-4 ${
        hasDrift ? 'border-amber-200 bg-amber-50/60' : 'border-gray-200 bg-white'
      }`}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-[10px] font-bold uppercase tracking-widest text-gray-500">
            {hasDrift ? 'Memo on file has drifted' : 'Memo on file'}
          </p>
          <p className="mt-1.5 text-[12px] leading-relaxed text-gray-900">{memoLine}</p>
          {hasDrift && (
            <p className="mt-1 text-[12px] leading-relaxed text-amber-900">
              {driftLine} The memo below is unchanged. Download a new one to record the current view.
            </p>
          )}
          {openError && <p className="mt-1.5 text-[11px] text-rose-600">{openError}</p>}
        </div>

        <button
          onClick={() => handleOpen(latest.id)}
          disabled={openingId === latest.id}
          className="shrink-0 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-[11px] font-medium text-gray-600 transition-all hover:border-gray-300 hover:text-gray-900 disabled:opacity-50"
        >
          {openingId === latest.id ? 'Opening...' : 'Open memo'}
        </button>
      </div>

      {earlier.length > 0 && (
        <div className="mt-3 border-t border-gray-200/70 pt-2.5">
          <button
            onClick={() => setExpanded((v) => !v)}
            className="text-[11px] font-medium text-gray-500 hover:text-gray-900"
          >
            {expanded ? 'Hide' : `Show ${earlier.length} earlier memo${earlier.length === 1 ? '' : 's'}`}
          </button>

          {expanded && (
            <ul className="mt-2 space-y-1.5">
              {earlier.map((m) => (
                <li key={m.id} className="flex items-center justify-between gap-3">
                  <span className="truncate text-[11px] text-gray-500">
                    {formatDate(m.created_at)}
                    {m.score != null ? `, scored ${Math.round(m.score)}` : ''}
                    {m.verdict ? ` ${m.verdict}` : ''}
                    {authorOf(m) ? `, by ${authorOf(m)}` : ''}
                  </span>
                  <button
                    onClick={() => handleOpen(m.id)}
                    disabled={openingId === m.id}
                    className="shrink-0 text-[11px] font-medium text-gray-500 hover:text-gray-900 disabled:opacity-50"
                  >
                    {openingId === m.id ? 'Opening...' : 'Open'}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
