import React, { useRef, useState } from 'react';
import { parseCsvDeals } from '../utils/calculations';

const TEMPLATE_HEADERS =
  'CompanyName,YearsInBusiness,AnnualRevenue,EBITDA,TotalExistingDebt,IndustrySector,CreditRating,EquipmentType,EquipmentCondition,EquipmentCost,DownPayment,FinancingType,UsefulLife,LoanTerm,EssentialUse';
const TEMPLATE_ROW =
  'Acme Corp,10,50000000,8000000,20000000,Manufacturing,Adequate,Heavy Machinery,New,5000000,500000,EFA,15,84,true';

export default function CsvImport({ onImport }) {
  const fileRef = useRef(null);
  const [status, setStatus] = useState(null); // { type: 'success'|'error', message }

  const handleFile = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const text = evt.target.result;
        if (!text || !text.trim()) {
          setStatus({ type: 'error', message: 'File is empty.' });
          return;
        }

        const deals = parseCsvDeals(text);
        if (!deals || deals.length === 0) {
          setStatus({ type: 'error', message: 'No valid rows found in CSV.' });
          return;
        }

        onImport(deals);
        setStatus({ type: 'success', message: `Imported ${deals.length} deals` });
        setTimeout(() => setStatus(null), 4000);
      } catch (err) {
        setStatus({ type: 'error', message: err.message || 'Failed to parse CSV.' });
      }
    };
    reader.onerror = () => {
      setStatus({ type: 'error', message: 'Failed to read file.' });
    };
    reader.readAsText(file);

    // Reset so the same file can be re-selected
    e.target.value = '';
  };

  const downloadTemplate = () => {
    const csv = `${TEMPLATE_HEADERS}\n${TEMPLATE_ROW}\n`;
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'deal_import_template.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center gap-3">
        <button
          type="button"
          className="pill-btn px-3 py-1.5 rounded-lg text-[11px] font-medium text-slate-400 flex items-center gap-1.5"
          onClick={() => fileRef.current?.click()}
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="w-3.5 h-3.5"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2M7 10l5-5m0 0l5 5m-5-5v12" />
          </svg>
          Import CSV
        </button>

        <input
          ref={fileRef}
          type="file"
          accept=".csv"
          className="hidden"
          onChange={handleFile}
        />

        {status?.type === 'success' && (
          <span className="text-emerald-400 text-[11px]">{status.message}</span>
        )}
        {status?.type === 'error' && (
          <span className="text-rose-400 text-[11px]">{status.message}</span>
        )}
      </div>

      <div className="flex items-center gap-2 text-slate-500 text-[11px]">
        <span>Upload a CSV with deal data.</span>
        <span
          role="button"
          tabIndex={0}
          className="text-gold-400 hover:text-gold-300 text-[11px] underline cursor-pointer"
          onClick={downloadTemplate}
          onKeyDown={(e) => e.key === 'Enter' && downloadTemplate()}
        >
          Download Template
        </span>
      </div>
    </div>
  );
}
