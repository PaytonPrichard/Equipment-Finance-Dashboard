// ============================================================
// DealSheetUpload — upload a deal sheet, extract fields server-side,
// prefill the deal input form for analyst review.
//
// Module-agnostic: the server owns per-module extraction specs and
// rejects unsupported asset classes. The extracted values are never
// scored directly; they populate the form and the analyst reviews
// them before anything is saved.
// ============================================================

import { useRef, useState } from 'react';
import { supabase } from '../lib/supabase';
import { isDemoMode } from '../lib/demoMode';

// Keep in sync with SUPPORTED_MODULES in server-lib/extract.js.
const SUPPORTED_MODULES = ['equipment_finance'];

const ACCEPT = '.pdf,.png,.jpg,.jpeg,.webp,.gif,.txt,.csv';
const MAX_FILE_BYTES = 3 * 1024 * 1024; // mirror of server cap

// Field keys → short labels for the extraction report.
const FIELD_LABELS = {
  companyName: 'Company',
  annualRevenue: 'Revenue',
  priorYearRevenue: 'Prior revenue',
  ebitda: 'EBITDA',
  priorYearEbitda: 'Prior EBITDA',
  yearsInBusiness: 'Years in business',
  totalExistingDebt: 'Existing debt',
  actualAnnualDebtService: 'Annual DS',
  maintenanceCapex: 'Maintenance capex',
  cashOnHand: 'Cash',
  availableLiquidity: 'Liquidity',
  industrySector: 'Industry',
  creditRating: 'Credit rating',
  equipmentType: 'Equipment type',
  equipmentCondition: 'Condition',
  equipmentCost: 'Equipment cost',
  downPayment: 'Down payment',
  financingType: 'Structure',
  usefulLife: 'Useful life',
  loanTerm: 'Term',
  essentialUse: 'Essential use',
};

function labelFor(key) {
  return FIELD_LABELS[key] || key;
}

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result || '';
      // Strip the data URL prefix ("data:application/pdf;base64,")
      const idx = result.indexOf('base64,');
      resolve(idx >= 0 ? result.slice(idx + 7) : result);
    };
    reader.onerror = () => reject(new Error('Could not read file'));
    reader.readAsDataURL(file);
  });
}

export default function DealSheetUpload({ activeModule, onExtracted }) {
  const fileInputRef = useRef(null);
  const [status, setStatus] = useState('idle'); // idle | parsing | done | error
  const [report, setReport] = useState(null);
  const [error, setError] = useState(null);
  const [showMissing, setShowMissing] = useState(false);

  if (isDemoMode()) return null;
  if (!SUPPORTED_MODULES.includes(activeModule)) return null;

  async function handleFile(file) {
    if (!file) return;
    if (file.size > MAX_FILE_BYTES) {
      setStatus('error');
      setError('File too large. Maximum size is 3MB.');
      return;
    }
    setStatus('parsing');
    setError(null);
    setReport(null);

    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData?.session?.access_token;
      if (!token) throw new Error('Not authenticated');

      const base64 = await fileToBase64(file);
      const res = await fetch('/api/parse-deal', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          asset_class: activeModule,
          file: {
            name: file.name,
            media_type: file.type || 'application/pdf',
            data: base64,
          },
        }),
      });

      let payload = null;
      try { payload = await res.json(); } catch { payload = null; }

      if (!res.ok) {
        throw new Error(payload?.error || `Parsing failed (HTTP ${res.status})`);
      }

      setReport({
        fileName: file.name,
        found: payload.found || [],
        missing: payload.missing || [],
        warnings: payload.warnings || [],
        notes: payload.notes || null,
      });
      setStatus('done');
      if (payload.inputs && Object.keys(payload.inputs).length > 0) {
        onExtracted(payload.inputs);
      }
    } catch (err) {
      setStatus('error');
      setError(err.message || 'Parsing failed');
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  }

  return (
    <div className="rounded-2xl border border-gray-200 bg-white px-4 py-3 mb-3">
      <input
        ref={fileInputRef}
        type="file"
        accept={ACCEPT}
        className="hidden"
        onChange={(e) => handleFile(e.target.files?.[0])}
      />

      {status === 'idle' && (
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="text-[13px] font-semibold text-gray-900">Upload a deal sheet</div>
            <div className="text-[12px] text-gray-500">PDF or image. Extracted fields prefill the form for your review.</div>
          </div>
          <button
            onClick={() => fileInputRef.current?.click()}
            className="flex-shrink-0 px-3 py-1.5 rounded-lg text-[12px] font-semibold text-white bg-black hover:bg-gray-800 transition-colors"
          >
            Choose file
          </button>
        </div>
      )}

      {status === 'parsing' && (
        <div className="flex items-center gap-2 text-[13px] text-gray-600">
          <svg className="animate-spin h-4 w-4 text-gray-400" viewBox="0 0 24 24" fill="none">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
          </svg>
          Reading deal sheet…
        </div>
      )}

      {status === 'done' && report && (
        <div>
          <div className="flex items-center justify-between gap-3">
            <div className="text-[13px] text-gray-900">
              <span className="font-semibold">{report.found.length} fields extracted</span>
              <span className="text-gray-500"> from {report.fileName}. Review before saving.</span>
            </div>
            <button
              onClick={() => { setStatus('idle'); setReport(null); }}
              className="flex-shrink-0 text-[12px] font-semibold text-gray-500 hover:text-gray-800 transition-colors"
            >
              Upload another
            </button>
          </div>

          {report.missing.length > 0 && (
            <button
              onClick={() => setShowMissing(!showMissing)}
              className="mt-1 text-[12px] text-gray-500 hover:text-gray-700 transition-colors"
            >
              {report.missing.length} not found in document {showMissing ? '▴' : '▾'}
            </button>
          )}
          {showMissing && report.missing.length > 0 && (
            <div className="mt-1 text-[12px] text-gray-400">
              {report.missing.map(labelFor).join(', ')}
            </div>
          )}

          {report.warnings.length > 0 && (
            <ul className="mt-1.5 space-y-0.5">
              {report.warnings.map((w, i) => (
                <li key={i} className="text-[12px] text-amber-700">{w}</li>
              ))}
            </ul>
          )}

          {report.notes && (
            <div className="mt-1.5 text-[12px] text-gray-500 italic">{report.notes}</div>
          )}
        </div>
      )}

      {status === 'error' && (
        <div className="flex items-center justify-between gap-3">
          <div className="text-[13px] text-red-700">{error}</div>
          <button
            onClick={() => { setStatus('idle'); setError(null); }}
            className="flex-shrink-0 px-3 py-1.5 rounded-lg text-[12px] font-semibold text-gray-700 bg-white border border-gray-200 hover:border-gray-300 transition-all"
          >
            Try again
          </button>
        </div>
      )}
    </div>
  );
}
