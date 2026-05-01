import React, { useState, useEffect } from 'react';

const SECTIONS = [
  {
    id: 'overview',
    title: 'Overview',
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <rect x="2" y="7" width="20" height="14" rx="2" ry="2" />
        <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" />
      </svg>
    ),
    content: [
      {
        heading: 'What is Tranche?',
        body: 'Pre-origination deal screening for ABL lenders. Enter borrower and collateral details to get a risk score, pass/flag/fail verdict, and structure recommendations in under 2 minutes.',
      },
      {
        heading: 'What it does not do',
        body: 'This is a screening tool, not a credit decision engine. All outputs are preliminary and do not replace underwriting or credit committee review.',
      },
    ],
  },
  {
    id: 'faq',
    title: 'Common Questions',
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <circle cx="12" cy="12" r="10" />
        <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" strokeLinecap="round" />
        <line x1="12" y1="17" x2="12.01" y2="17" strokeLinecap="round" />
      </svg>
    ),
    content: [
      {
        heading: 'How do I screen a deal?',
        body: 'Two ways. For a single deal, fill in borrower financials and collateral details on the left side of the New Deal screen. Score, metrics, and recommendation update live on the right. For many deals at once, switch to Bulk and download the Excel template, fill in your roster, and upload. Each row gets its own screening result. No save button needed for screening; you only save when you want to add a deal to your pipeline.',
      },
      {
        heading: 'Is my data secure?',
        body: 'Yes. All data is encrypted in transit and at rest. Each organization is isolated via Postgres row-level security, so no firm can access another firm\'s deals. We never share customer data across orgs, and we don\'t train models on your inputs.',
      },
      {
        heading: 'Can I screen multiple deals at once?',
        body: 'Yes. On the New Deal screen, switch to Bulk and download the Excel template. It includes column descriptions in cell comments (hover any header), dropdowns for industry and equipment type, and required fields marked with a red asterisk. Fill it in, upload, and each row gets a screening result. Templates are specific per asset class.',
      },
      {
        heading: 'What if my deal\'s industry or equipment type isn\'t listed?',
        body: 'Pick the closest match. For Industry, "Other" is treated as moderate-risk. For Equipment Type, "Other" uses default useful life and advance rate assumptions. Reach out if you keep hitting unsupported categories and we\'ll add them.',
      },
      {
        heading: 'How do I change the screening thresholds?',
        body: 'Open Settings, Screening Policy. Adjust pass/flag/fail score thresholds, DSCR, leverage, advance rate, and other criteria. Changes apply to your future screenings immediately. Saved deals keep their original verdict. Note: each user currently has their own settings. We\'re moving to admin-controlled, firm-wide policy with optional user "what-if" overlays soon.',
      },
      {
        heading: 'What does the risk score mean?',
        body: '75 or higher is strong, 55 to 74 is moderate, 35 to 54 is borderline, below 35 is weak. The composite combines leverage, coverage, liquidity, asset quality, and collateral metrics on a 0-100 scale. Configure the weighting under Settings, Screening Policy.',
      },
      {
        heading: 'How are the key metrics calculated?',
        body: 'DSCR (Debt Service Coverage Ratio) = EBITDA / Total Annual Debt Service. Higher is safer. Target 1.25x minimum, 1.50x+ ideal.\n\nLeverage = Total Debt / EBITDA. Lower is safer. Target below 3.5x, max 5.0x.\n\nFCCR (Fixed Charge Coverage Ratio) = (EBITDA − Maintenance Capex) / Annual Debt Service. We deliberately exclude taxes and dividends from fixed charges in v1 to keep the calc transparent. If you leave Maintenance Capex blank, we estimate at 3% of revenue. Target 1.0x minimum, 1.25x+ ideal.\n\nLiquidity = Cash on Hand + Other Available Liquidity (e.g., undrawn revolver). The "months of debt service coverage" subtitle divides total liquidity by monthly debt service. Target 6+ months.\n\nRevenue Growth = (Current Year Revenue − Prior Year Revenue) / Prior Year Revenue. The margin trend in the subtitle is the change in EBITDA-as-percent-of-revenue between the two years, in basis points.\n\nModule-specific metrics (LTV, Borrowing Base, DSO, Inventory Turnover, etc.) show their formula and threshold inline on each metric card.\n\nDSCR, Leverage, and several module-specific factors feed into the composite risk score. FCCR, Liquidity, and Revenue Growth are display-only in v1 and don\'t yet adjust the score.',
      },
      {
        heading: 'How do I export a screening memo?',
        body: 'After screening, click Export. You get a branded PDF with your firm logo at the top, plus the score, metrics, recommendation, and stress test results. Set logo, accent color, memo title, and footer text in Settings, Branding.',
      },
      {
        heading: 'How do I invite my team?',
        body: 'Settings, Team. Enter the email and role, then click Generate Invite. They get an email with a link to join your organization. If you skip the email field, copy the code and share it manually.',
      },
    ],
  },
  {
    id: 'new-deal',
    title: 'New Deal Screening',
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
        <polyline points="14 2 14 8 20 8" />
      </svg>
    ),
    content: [
      {
        heading: 'Asset classes',
        body: 'Select Equipment Finance, Accounts Receivable, or Inventory Finance at the top of the form. Borrower fields carry over when you switch.',
      },
      {
        heading: 'Company search',
        body: 'Type 2+ characters in Company Name to search your pipeline or the sample database. Selecting a match auto-fills borrower financials.',
      },
      {
        heading: 'Verdict',
        body: 'Every screening produces a PASS, FLAG, or FAIL verdict based on your screening policy thresholds. Configure these in Settings.',
      },
      {
        heading: 'Risk score',
        body: 'Composite score from 0 to 100 across 7 weighted factors. 75+ is strong, 55-74 moderate, 35-54 borderline, below 35 weak.',
      },
      {
        heading: 'Stress test',
        body: 'Runs four EBITDA decline scenarios (base, -10%, -20%, -30%) and shows how DSCR and leverage deteriorate. Use it to find the break-even point.',
      },
      {
        heading: 'Structure recommendations',
        body: 'Shows the screening rate build-up (SOFR + spreads), indicative rate range, and recommended enhancements based on the deal profile.',
      },
    ],
  },
  {
    id: 'interactive',
    title: 'Interactive Tools',
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <circle cx="12" cy="12" r="3" />
        <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-2.82 1.18V21a2 2 0 0 1-4 0v-.09a1.65 1.65 0 0 0-1.08-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 3 15.09V15a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1.51 1.08 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9" />
      </svg>
    ),
    content: [
      {
        heading: 'What-If scenarios',
        body: 'Adjust down payment, loan term, and EBITDA with sliders to see how the score changes in real time. Use it to test structure modifications before updating the form.',
      },
      {
        heading: 'Comparable deals',
        body: 'Finds the most similar historical deals by industry, size, and credit profile. Shows their actual outcomes to give you precedent data.',
      },
      {
        heading: 'Checklist',
        body: 'Generates deal-specific diligence questions based on the risk profile. Items are prioritized and adapt to the deal characteristics.',
      },
    ],
  },
  {
    id: 'historical',
    title: 'Historical Portfolio',
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
      </svg>
    ),
    content: [
      {
        heading: 'Model performance',
        body: 'Scores historical deals against the screening model and shows accuracy by outcome. Available under More > Model Performance.',
      },
      {
        heading: 'Batch screening',
        body: 'Upload a CSV to score up to 500 deals at once. Download a template from the Batch Screening tab.',
      },
    ],
  },
  {
    id: 'compare',
    title: 'Deal Comparison',
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <line x1="18" y1="20" x2="18" y2="10" />
        <line x1="12" y1="20" x2="12" y2="4" />
        <line x1="6" y1="20" x2="6" y2="14" />
      </svg>
    ),
    content: [
      {
        heading: 'Compare deals',
        body: 'Select two deals and compare them across all metrics with color-coded indicators. Available under More > Compare Deals.',
      },
    ],
  },
  {
    id: 'data',
    title: 'Saving & Exporting',
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" />
        <polyline points="17 21 17 13 7 13 7 21" />
        <polyline points="7 3 7 8 15 8" />
      </svg>
    ),
    content: [
      {
        heading: 'Pipeline',
        body: 'Track deals from screening through funded. Attach documents, add notes, and search across all stages.',
      },
      {
        heading: 'Dashboard',
        body: 'Live pipeline metrics: total deals, pipeline value, pass rate, score distribution, and recent activity.',
      },
      {
        heading: 'Exports',
        body: 'Download branded PDF memos or CSV files. Admins can customize memo branding in Settings.',
      },
      {
        heading: 'Document Attachments',
        body: 'Attach files to any pipeline deal. Supports PDF, Word, Excel, CSV, and images up to 25 MB. Files are stored securely and accessible to your team.',
      },
      {
        heading: 'Copy Summary',
        body: 'Copy a plain-text screening report to your clipboard for pasting into emails, credit memos, or deal tracking systems.',
      },
    ],
  },
];


export default function InfoGuide({ isOpen, onClose }) {
  const [activeSection, setActiveSection] = useState('overview');

  // Close on Escape
  useEffect(() => {
    if (!isOpen) return;
    function handleKey(e) {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [isOpen, onClose]);

  // Prevent body scroll when open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [isOpen]);

  if (!isOpen) return null;

  const currentSection = SECTIONS.find((s) => s.id === activeSection) || SECTIONS[0];

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm animate-fade-in"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative w-full max-w-4xl max-h-[85vh] mx-4 rounded-2xl border border-white/[0.08] overflow-hidden animate-fade-in-up"
        style={{ background: 'rgba(17, 17, 22, 0.97)' }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/[0.06]">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-gold-500/10 flex items-center justify-center">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" className="text-gold-400" strokeWidth="2">
                <circle cx="12" cy="12" r="10" />
                <path d="M12 16v-4M12 8h.01" />
              </svg>
            </div>
            <div>
              <h2 className="text-base font-bold text-white">Guide & Reference</h2>
              <p className="text-[11px] text-slate-500">Everything this tool does, and how to use it</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-500 hover:text-slate-300 hover:bg-white/[0.06] transition-all"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {/* Body */}
        <div className="flex" style={{ height: 'calc(85vh - 72px)' }}>
          {/* Sidebar nav */}
          <nav className="w-52 flex-shrink-0 border-r border-white/[0.06] py-3 overflow-y-auto">
            {SECTIONS.map((section) => (
              <button
                key={section.id}
                onClick={() => setActiveSection(section.id)}
                className={`w-full flex items-center gap-2.5 px-4 py-2.5 text-left transition-all ${
                  activeSection === section.id
                    ? 'bg-gold-500/10 text-gold-300 border-r-2 border-gold-400'
                    : 'text-slate-500 hover:text-slate-300 hover:bg-white/[0.03]'
                }`}
              >
                <span className={activeSection === section.id ? 'text-gold-400' : 'text-slate-600'}>
                  {section.icon}
                </span>
                <span className="text-[12px] font-semibold">{section.title}</span>
              </button>
            ))}
          </nav>

          {/* Content */}
          <div className="flex-1 overflow-y-auto px-8 py-6">
            <div className="flex items-center gap-3 mb-6">
              <span className="text-gold-400">{currentSection.icon}</span>
              <h3 className="text-lg font-bold text-white">{currentSection.title}</h3>
            </div>

            <div className="space-y-6">
              {currentSection.content.map((block, i) => (
                <div key={i}>
                  <h4 className="text-sm font-semibold text-slate-200 mb-2 flex items-center gap-2">
                    <span className="w-1 h-1 rounded-full bg-gold-400 flex-shrink-0" />
                    {block.heading}
                  </h4>
                  <p className="text-[13px] text-slate-400 leading-relaxed pl-3 whitespace-pre-line">
                    {block.body}
                  </p>
                </div>
              ))}
            </div>

            {/* Contact card */}
            <div className="mt-8 p-4 rounded-xl bg-gold-500/[0.06] border border-gold-500/20">
              <p className="text-[12px] font-semibold text-slate-200 mb-1">Need more help?</p>
              <p className="text-[11px] text-slate-400 mb-3">We read every message. Expect a reply within one business day.</p>
              <a
                href="mailto:team@gettranche.app?subject=Tranche%20support"
                className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-gold-500/15 hover:bg-gold-500/25 text-gold-300 text-[11px] font-semibold transition-colors"
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
                  <polyline points="22,6 12,13 2,6" />
                </svg>
                Email team@gettranche.app
              </a>
            </div>

            {/* Footer in content area */}
            <div className="mt-6 pt-4 border-t border-white/[0.04]">
              <p className="text-[10px] text-slate-600 italic">
                All screening outputs are preliminary and indicative. Not a credit decision. Final terms subject to full underwriting, credit committee approval, and documentation.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
