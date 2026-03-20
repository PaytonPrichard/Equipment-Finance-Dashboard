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
        heading: 'What is this tool?',
        body: 'The Equipment Finance Deal Screening Tool is a preliminary assessment platform for equipment lending and leasing transactions. It helps originators and credit analysts quickly evaluate whether a deal is worth advancing to full underwriting — before investing significant time and resources.',
      },
      {
        heading: 'What it does',
        body: 'Enter borrower financials and equipment details, and the tool instantly calculates key credit metrics, assigns a composite risk score (0–100), runs stress tests, generates assessment commentary, and suggests deal structure and enhancements.',
      },
      {
        heading: 'What it does NOT do',
        body: 'This is a screening tool, not a credit decision engine. It does not replace underwriting, credit committee review, or formal documentation. All outputs are preliminary and indicative only.',
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
        heading: 'Borrower Profile',
        body: 'Enter the borrower\'s company name, years in business, annual revenue, EBITDA, existing debt, industry, and credit rating. The Company Name field has a searchable database — type 2+ characters to see matches and auto-populate financials. You can also enter "Actual Annual DS" if you have the borrower\'s real debt service figure; otherwise the tool estimates it at 8% of total debt.',
      },
      {
        heading: 'Equipment & Deal',
        body: 'Specify the equipment type, condition (New/Used), cost, and optional down payment. Choose a financing structure: EFA (borrower owns, fully amortizing), FMV Lease (return option, lower payments), or TRAC Lease (guaranteed residual, vehicles/rail only). Set the useful life and loan term in months. The Essential-Use toggle indicates whether the equipment is critical to the borrower\'s operations — this affects risk scoring.',
      },
      {
        heading: 'Quick Start Examples',
        body: 'The toolbar at the top offers 5 pre-built example deals spanning the credit spectrum — from a strong healthcare deal to a weak startup. Use these to see how the tool responds to different profiles, or as a starting point for your own analysis.',
      },
      {
        heading: 'Executive Summary',
        body: 'The first section in the results is a compact executive summary with 3–4 key takeaways about the deal: the overall verdict, primary strength, key risk area, and the most important financial observation (e.g., DSCR cushion, margin quality, or equity position). Each takeaway is color-coded by type (positive, neutral, caution, negative) so the most critical points are immediately visible.',
      },
      {
        heading: 'EBITDA Margin & Debt Yield',
        body: 'Displayed below the company name as contextual financial health indicators. EBITDA Margin (EBITDA / Revenue) shows operating profitability — margins below 10% indicate thin cushion. Debt Yield (EBITDA / Net Financed) measures how quickly the asset could "pay for itself" — higher is better.',
      },
      {
        heading: 'Risk Score Gauge',
        body: 'The circular gauge shows the composite risk score from 0 to 100. The scoring model uses linear interpolation within breakpoint ranges for each factor, producing granular scores that reflect small changes in inputs. Scoring bands: 75+ (Strong/Green) — recommend advancing. 55–74 (Moderate/Yellow) — pursue with mitigants. 35–54 (Borderline/Orange) — additional diligence needed. Below 35 (Weak/Red) — likely does not meet thresholds.',
      },
      {
        heading: 'Risk Factor Radar',
        body: 'The radar chart breaks down the score into 7 weighted factors: DSCR (25%), Leverage (20%), Industry Risk (15%), Essentiality (10%), Equipment/LTV (10%), Years in Business (10%), and Term Coverage (10%). Each factor is scored using continuous interpolation between breakpoints, so the chart shows exactly which factors are driving the score up or down — and by how much.',
      },
      {
        heading: 'Key Metrics Cards',
        body: 'Five metric cards show the core credit ratios with color-coded health indicators:\n\n• DSCR — Earnings / Total Debt Service. Minimum 1.25x, target 1.50x+.\n• Leverage — Total Debt / EBITDA. Target below 3.5x, maximum 5.0x.\n• LTV — Loan-to-Value. Net financed amount vs. equipment value. Target below 85%.\n• Term / Life — What percentage of the equipment\'s useful life the loan term covers. Target below 60%.\n• Revenue Concentration — Equipment cost as a % of annual revenue. Target below 15%.',
      },
      {
        heading: 'Debt Service Summary',
        body: 'Shows the screening rate, net financed amount, monthly payment, and annual debt service (new + existing). If you provided actual debt service it\'s labeled accordingly; otherwise you\'ll see the estimated figure. For FMV and TRAC structures, the residual value is displayed here.',
      },
      {
        heading: 'Amortization Schedule',
        body: 'A collapsible yearly payment breakdown showing how each year\'s payment splits between principal and interest. Includes total cost of financing, total interest, and a visual bar showing the principal-to-interest ratio shifting over time. Useful for understanding total financing cost and how quickly equity builds in the equipment.',
      },
      {
        heading: 'Sensitivity Analysis (Stress Test)',
        body: 'Runs four EBITDA decline scenarios — Base Case, -10%, -20%, and -30% — while holding debt service constant. Shows how DSCR, leverage, and the overall score deteriorate under stress. The bar chart highlights the 1.0x DSCR threshold (inability to service debt). This helps you understand how much cushion exists before the deal breaks.',
      },
      {
        heading: 'Screening Result & Assessment Notes',
        body: 'The recommendation section provides the categorical result (Strong / Moderate / Borderline / Weak) along with the detail recommendation. Below that, 5 preliminary assessment notes give specific commentary on DSCR adequacy, leverage position, industry dynamics, collateral coverage, financing structure, and other relevant factors.',
      },
      {
        heading: 'Suggested Deal Structure',
        body: 'Provides the screening rate built up from components (SOFR + base spread + credit adjustment + industry adjustment), an indicative rate range (+/- 50 bps), the recommended structure type with rationale, and any recommended enhancements (guarantees, collateral, payment sweeps, term adjustments). A deal sizing alert appears if the equipment cost is disproportionately large relative to EBITDA.',
      },
      {
        heading: 'Input Validation Warnings',
        body: 'The input form now checks for suspicious or inconsistent data and displays inline warnings. Examples: EBITDA exceeding revenue, down payment exceeding equipment cost, loan term exceeding useful life, unusually high EBITDA margins, or extreme leverage ratios. These catch data entry errors before they propagate into misleading screening results.',
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
        heading: 'What-If Scenarios',
        body: 'An expandable panel with interactive sliders that let you adjust three key parameters — down payment, loan term, and EBITDA — and instantly see how the risk score and metrics change. The panel shows a side-by-side comparison of your current score vs. the adjusted score, with color-coded metric deltas (green = improved, red = worsened). Use this to quickly test questions like "What if we required 15% down?" or "What happens if we shorten the term to 60 months?"',
      },
      {
        heading: 'Comparable Historical Deals',
        body: 'Automatically identifies the most similar deals from your portfolio history based on industry, equipment type, deal size, credit rating, and revenue scale. Each comparable shows its actual outcome (Performing, Paid Off, Watchlist, or Defaulted), its risk score relative to your current deal, and key metrics. A summary banner tells you whether similar deals have generally performed well or poorly — giving you real precedent data to inform your decision.',
      },
      {
        heading: 'Due Diligence Checklist',
        body: 'A dynamic, deal-specific checklist of probing questions and information requests generated from the deal\'s risk profile. Items are prioritized (Required / High / Medium / Low) and categorized (Financial, Collateral, Credit, Operational, Structure). Each item has an expandable "Why this matters" rationale. You can check items off as you gather information, with a progress bar tracking completion. The checklist adapts to the deal — a highly leveraged borrower generates debt schedule requests; used equipment triggers appraisal requirements; young companies prompt personal financial statement requests.',
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
        heading: 'Portfolio Analytics',
        body: 'Shows aggregate performance metrics across all historical deals. A bar chart displays the average risk score by outcome status (Performing, Paid Off, Watchlist, Defaulted) — validating whether the scoring model correctly separates good deals from bad. A confusion matrix shows true positives, true negatives, false positives, and false negatives, along with the model\'s overall accuracy percentage.',
      },
      {
        heading: 'Historical Deals Table',
        body: 'A searchable, filterable table of all past deals scored against the current screening model. Each row shows the deal\'s key parameters, computed risk score, and actual outcome. You can filter by outcome status and expand individual deals to see full details. This is useful for backtesting and validating the model against real-world results.',
      },
      {
        heading: 'CSV Import',
        body: 'Upload a CSV file of deals to score them in bulk against the screening model. The importer supports flexible column mapping (e.g., "company" maps to Company Name, "revenue" maps to Annual Revenue). A template CSV can be downloaded from the import dialog. Imported deals appear alongside the built-in historical deals in the portfolio view.',
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
        heading: 'Side-by-Side Comparison',
        body: 'Select any two deals — from the example deals, your saved deals, or historical portfolio — and compare them across 11+ metrics. Each metric row highlights which deal is "better" using color coding. This is useful for evaluating competing opportunities, comparing a current deal against a historical benchmark, or assessing how different borrower profiles stack up.',
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
        heading: 'Save Deals',
        body: 'Once you\'ve filled in a valid deal, use the Save button in the toolbar to store it in your browser\'s local storage with a custom name. Saved deals persist across sessions and can be reloaded from the dropdown at any time. They\'re also available in the Compare tab for benchmarking.',
      },
      {
        heading: 'Copy Summary',
        body: 'The "Copy Summary" button generates a plain-text screening report and copies it to your clipboard. The report includes all deal parameters, key metrics, assessment notes, and stress test results — formatted for pasting into emails, credit memos, or deal tracking systems.',
      },
      {
        heading: 'Print Report',
        body: 'The "Print Report" button opens a clean, print-formatted version of the screening summary in a new window. Use your browser\'s print dialog to save as PDF or send to a printer.',
      },
    ],
  },
  {
    id: 'concepts',
    title: 'Key Concepts',
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" />
        <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" />
      </svg>
    ),
    content: [
      {
        heading: 'DSCR (Debt Service Coverage Ratio)',
        body: 'EBITDA divided by total annual debt service (existing + new). Measures whether the borrower generates enough cash flow to service all debt obligations. A DSCR of 1.0x means exact break-even; below 1.0x means the borrower cannot cover payments from operations. Industry standard minimum is 1.25x; target is 1.50x or higher.',
      },
      {
        heading: 'Leverage (Debt / EBITDA)',
        body: 'Total debt (existing + new financing) divided by EBITDA. Measures how many years of cash flow it would take to repay all debt. Lower is better. Below 2.0x is excellent; 2.0–3.5x is healthy; 3.5–5.0x is elevated; above 5.0x is highly leveraged and typically requires strong mitigants.',
      },
      {
        heading: 'LTV (Loan-to-Value)',
        body: 'Net financed amount (after down payment) divided by equipment value. Used equipment is discounted 15% from purchase price for valuation. An LTV above 100% means the loan exceeds the collateral value — significant risk. Target is below 85%. Down payments directly reduce LTV.',
      },
      {
        heading: 'Term / Useful Life Coverage',
        body: 'Loan term as a percentage of the equipment\'s economic useful life. If you\'re financing equipment for 80% of its life, there\'s little residual value cushion if the borrower defaults near maturity. Target is below 60%; above 80% is a concern.',
      },
      {
        heading: 'Revenue Concentration',
        body: 'Equipment cost as a percentage of the borrower\'s annual revenue. A high ratio means the single equipment purchase is very large relative to the borrower\'s overall operations — concentrating risk. Below 15% is ideal; above 25% warrants additional scrutiny.',
      },
      {
        heading: 'EFA (Equipment Finance Agreement)',
        body: 'A secured loan where the borrower takes ownership of the equipment. Payments are fully amortizing (no residual/balloon). This is the most common structure and the simplest from a risk perspective — the lender has a first-priority lien on the equipment.',
      },
      {
        heading: 'FMV Lease (Fair Market Value)',
        body: 'An operating lease where the lessee has the option to purchase the equipment at fair market value at term end, return it, or renew the lease. Monthly payments are lower because a residual value is assumed. The lessor bears residual value risk — if the equipment can\'t be remarketed at the assumed value, there\'s a loss.',
      },
      {
        heading: 'TRAC Lease (Terminal Rental Adjustment Clause)',
        body: 'A lease structure used primarily for vehicles and fleet assets. The lessee guarantees a residual value at term end. If the equipment sells for more or less than the guaranteed amount, a rental adjustment is made. This shifts residual risk to the lessee while still providing lower periodic payments than an EFA.',
      },
      {
        heading: 'Essential-Use Doctrine',
        body: 'Under the essential-use doctrine, equipment that is critical to a borrower\'s core operations (e.g., revenue-generating machinery) is less likely to be rejected or abandoned in bankruptcy. This strengthens the lender\'s recovery position and is reflected in a higher risk score.',
      },
      {
        heading: 'Screening Rate',
        body: 'The all-in interest rate used for preliminary payment calculations. Built from: current SOFR (base rate) + a base credit spread (200 bps) + credit quality adjustment (-75 to +200 bps) + industry risk adjustment (-25 to +75 bps). This is indicative -- final pricing is determined in underwriting.',
      },
    ],
  },
  {
    id: 'tips',
    title: 'Tips & Best Practices',
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M12 2L2 7l10 5 10-5-10-5z" />
        <path d="M2 17l10 5 10-5" />
        <path d="M2 12l10 5 10-5" />
      </svg>
    ),
    content: [
      {
        heading: 'Start with the company search',
        body: 'If the borrower is in the company database, type their name into the Company Name field and select the match. This auto-populates revenue, EBITDA, existing debt, industry, and credit rating in one click, saving time and reducing data entry errors. You can always override any auto-filled value afterward.',
      },
      {
        heading: 'Use actual debt service when you have it',
        body: 'By default the tool estimates existing debt service at 8% of total outstanding debt. This is a rough blended rate and can over- or understate actual obligations significantly. If you have the borrower\'s real annual debt service figure, enter it in the "Actual Annual DS" field. This will give you a more accurate DSCR, which is the most heavily weighted factor in the scoring model.',
      },
      {
        heading: 'Check the input warnings before interpreting results',
        body: 'The form displays inline warnings when something looks inconsistent, like EBITDA exceeding revenue, a loan term longer than useful life, or unusually high margins. If you see a warning, verify the data before drawing conclusions from the screening. A bad input will produce a misleading score.',
      },
      {
        heading: 'Read the executive summary first',
        body: 'The executive summary at the top of the results is designed to give you the 3-4 most important things about the deal in plain language. Start there, then drill into the specific sections below for detail. This mirrors how a credit committee reads a memo: lead with the conclusion, then support it.',
      },
      {
        heading: 'Use the stress test to find the break-even point',
        body: 'The stress test shows what happens to DSCR as EBITDA declines. The key question is: at what point does the borrower fall below 1.0x DSCR (unable to service debt from operations)? If the deal breaks at just a 10% decline, the cushion is thin. If it survives a 30% decline, the deal has meaningful resilience. Use this to frame the risk narrative.',
      },
      {
        heading: 'Try the What-If sliders before changing the form',
        body: 'Instead of editing the main form to test "what if we require 15% down?" or "what if we shorten the term?", use the What-If Scenarios panel. It lets you adjust down payment, term, and EBITDA with sliders and see the score change instantly, without losing your current inputs. Once you find a structure that works, you can go back and update the form.',
      },
      {
        heading: 'Look at comparable deals for precedent',
        body: 'The Comparable Historical Deals section automatically finds the most similar past deals and shows their actual outcomes. If 3 out of 4 similar deals are performing well, that is a positive data point. If similar deals have defaulted, pay attention to what went wrong. This is the closest thing to backtesting your current deal against real history.',
      },
      {
        heading: 'Work through the due diligence checklist',
        body: 'The checklist generates deal-specific questions based on the risk profile. Before presenting a deal to credit committee or advancing to underwriting, work through the checklist items. Check them off as you gather information. The "Why this matters" dropdown on each item explains the reasoning, which can help you prioritize what to request first.',
      },
      {
        heading: 'Save your work before experimenting',
        body: 'Use the Save button in the toolbar to store a deal before making changes. This lets you freely experiment with different structures or assumptions and reload the original if needed. Saved deals are also available in the Compare tab for side-by-side analysis.',
      },
      {
        heading: 'Export for your credit file',
        body: 'The Copy Summary button generates a plain-text screening report that includes all metrics, assessment notes, stress test results, and suggested enhancements. Paste it directly into an email, credit memo, or deal tracking system. The Print Report button opens a clean, print-ready version you can save as a PDF.',
      },
      {
        heading: 'Compare deals to calibrate your judgment',
        body: 'The Compare tab lets you put any two deals side by side with color-coded "better" indicators on each metric. Use this to compare a current opportunity against a past deal you know well, or to evaluate two competing opportunities. Over time this helps build intuition for what separates a 70-score deal from an 85.',
      },
      {
        heading: 'Remember: screening is not underwriting',
        body: 'This tool is designed for the front end of the pipeline, to quickly evaluate whether a deal is worth spending time on. It uses simplified assumptions (blended debt service rate, standard residual values, industry-level risk tiers). Deals that screen well still need full underwriting. Deals that screen poorly may still be viable with the right structure. Use the score as a starting point for the conversation, not the final word.',
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

            {/* Footer in content area */}
            <div className="mt-10 pt-4 border-t border-white/[0.04]">
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
