// Synthetic pipeline deals shown in demo mode (?demo=1).
// Scores are computed at module load time using the real scoring function so
// what shows on the kanban card matches what you see if you open the deal.

import { calculateMetrics, calculateRiskScore } from '../modules/equipment-finance/scoring';

const DEMO_ORG_ID = 'demo-org';
const DEMO_USER_ID = 'demo-user';
const SOFR_FALLBACK = 0.0425;

const DEAL_DEFS = [
  {
    name: 'Midwest Precision Machining',
    stage: 'Screening',
    daysAgo: 1,
    notes: 'Referred by First National. Owner has 18 yrs in industry. Awaiting last 2 yrs of audited financials.',
    inputs: {
      companyName: 'Midwest Precision Machining Inc.',
      yearsInBusiness: 18, annualRevenue: 42000000, ebitda: 7500000,
      totalExistingDebt: 12000000, industrySector: 'Manufacturing', creditRating: 'Strong',
      equipmentType: 'Heavy Machinery', equipmentCondition: 'New',
      equipmentCost: 3500000, downPayment: 525000, financingType: 'EFA',
      usefulLife: 10, loanTerm: 60, essentialUse: true,
    },
  },
  {
    name: 'Iron Mountain Aggregates',
    stage: 'Screening',
    daysAgo: 1,
    notes: 'Crushing operation in Western PA. High leverage, but essential equipment.',
    inputs: {
      companyName: 'Iron Mountain Aggregates LLC',
      yearsInBusiness: 11, annualRevenue: 28000000, ebitda: 4200000,
      totalExistingDebt: 18000000, industrySector: 'Mining', creditRating: 'Adequate',
      equipmentType: 'Heavy Machinery', equipmentCondition: 'Used',
      equipmentCost: 6500000, downPayment: 650000, financingType: 'EFA',
      usefulLife: 12, loanTerm: 72, essentialUse: true,
    },
  },
  {
    name: 'Northern Star Construction',
    stage: 'Screening',
    daysAgo: 2,
    notes: 'Crane purchase for downtown high-rise project. Need to validate backlog claims.',
    inputs: {
      companyName: 'Northern Star Construction Co.',
      yearsInBusiness: 7, annualRevenue: 56000000, ebitda: 6800000,
      totalExistingDebt: 24000000, industrySector: 'Construction', creditRating: 'Adequate',
      equipmentType: 'Construction Equipment', equipmentCondition: 'New',
      equipmentCost: 5500000, downPayment: 550000, financingType: 'EFA',
      usefulLife: 12, loanTerm: 72, essentialUse: true,
    },
  },
  {
    name: 'Skyway Charter Aviation',
    stage: 'Screening',
    daysAgo: 3,
    notes: 'Used Citation jet for executive charter. Thin EBITDA, weak credit.',
    inputs: {
      companyName: 'Skyway Charter Aviation LLC',
      yearsInBusiness: 4, annualRevenue: 38000000, ebitda: 3200000,
      totalExistingDebt: 28000000, industrySector: 'Aviation', creditRating: 'Weak',
      equipmentType: 'Aircraft/Helicopters', equipmentCondition: 'Used',
      equipmentCost: 9500000, downPayment: 0, financingType: 'FMV',
      usefulLife: 15, loanTerm: 84, essentialUse: false,
    },
  },
  {
    name: 'Bayfront Container Lines',
    stage: 'Screening',
    daysAgo: 4,
    notes: 'Chassis fleet expansion. Port volume tied to retail import cycle.',
    inputs: {
      companyName: 'Bayfront Container Lines Inc.',
      yearsInBusiness: 9, annualRevenue: 47000000, ebitda: 5100000,
      totalExistingDebt: 19000000, industrySector: 'Transportation/Logistics', creditRating: 'Adequate',
      equipmentType: 'Vehicles/Fleet', equipmentCondition: 'New',
      equipmentCost: 3300000, downPayment: 330000, financingType: 'TRAC',
      usefulLife: 8, loanTerm: 60, essentialUse: true,
    },
  },
  {
    name: 'Apex Logistics Group',
    stage: 'Under Review',
    daysAgo: 6,
    notes: 'Memo drafted. Committee meets Tuesday. Strong DSCR and on-time payment history.',
    inputs: {
      companyName: 'Apex Logistics Group LLC',
      yearsInBusiness: 14, annualRevenue: 88000000, ebitda: 13500000,
      totalExistingDebt: 32000000, industrySector: 'Transportation/Logistics', creditRating: 'Strong',
      equipmentType: 'Vehicles/Fleet', equipmentCondition: 'New',
      equipmentCost: 4200000, downPayment: 420000, financingType: 'TRAC',
      usefulLife: 7, loanTerm: 60, essentialUse: true,
    },
  },
  {
    name: 'Cascade Forestry',
    stage: 'Under Review',
    daysAgo: 8,
    notes: 'Skidder + harvester package. Industry softness flagged in memo.',
    inputs: {
      companyName: 'Cascade Forestry LLC',
      yearsInBusiness: 22, annualRevenue: 19000000, ebitda: 2700000,
      totalExistingDebt: 8500000, industrySector: 'Other', creditRating: 'Adequate',
      equipmentType: 'Heavy Machinery', equipmentCondition: 'Used',
      equipmentCost: 2200000, downPayment: 220000, financingType: 'EFA',
      usefulLife: 10, loanTerm: 60, essentialUse: true,
    },
  },
  {
    name: 'Phoenix Energy Services',
    stage: 'Under Review',
    daysAgo: 9,
    notes: 'Frac pump replacement. Permian basin exposure but contracted revenue.',
    inputs: {
      companyName: 'Phoenix Energy Services Corp.',
      yearsInBusiness: 16, annualRevenue: 105000000, ebitda: 18000000,
      totalExistingDebt: 42000000, industrySector: 'Energy', creditRating: 'Strong',
      equipmentType: 'Energy/Power Generation', equipmentCondition: 'New',
      equipmentCost: 3100000, downPayment: 310000, financingType: 'EFA',
      usefulLife: 12, loanTerm: 60, essentialUse: true,
    },
  },
  {
    name: 'Triton Drilling Services',
    stage: 'Under Review',
    daysAgo: 12,
    notes: 'High leverage. Rig count down YoY. Pricing pressure flagged.',
    inputs: {
      companyName: 'Triton Drilling Services Inc.',
      yearsInBusiness: 6, annualRevenue: 41000000, ebitda: 4100000,
      totalExistingDebt: 31000000, industrySector: 'Energy', creditRating: 'Weak',
      equipmentType: 'Energy/Power Generation', equipmentCondition: 'Used',
      equipmentCost: 4800000, downPayment: 0, financingType: 'EFA',
      usefulLife: 10, loanTerm: 84, essentialUse: true,
    },
  },
  {
    name: 'Crestview Hospital Network',
    stage: 'Approved',
    daysAgo: 18,
    notes: 'Approved 5/12. Documentation in legal review. Closing target end of month.',
    inputs: {
      companyName: 'Crestview Hospital Network',
      yearsInBusiness: 28, annualRevenue: 240000000, ebitda: 36000000,
      totalExistingDebt: 78000000, industrySector: 'Healthcare', creditRating: 'Strong',
      equipmentType: 'Medical Equipment', equipmentCondition: 'New',
      equipmentCost: 2800000, downPayment: 0, financingType: 'FMV',
      usefulLife: 10, loanTerm: 60, essentialUse: true,
    },
  },
  {
    name: 'Continental Rail Leasing',
    stage: 'Approved',
    daysAgo: 22,
    notes: 'Approved with covenant tightening. Final terms with railcar manufacturer.',
    inputs: {
      companyName: 'Continental Rail Leasing Inc.',
      yearsInBusiness: 19, annualRevenue: 165000000, ebitda: 28000000,
      totalExistingDebt: 62000000, industrySector: 'Rail', creditRating: 'Strong',
      equipmentType: 'Rail Cars', equipmentCondition: 'New',
      equipmentCost: 11000000, downPayment: 1100000, financingType: 'EFA',
      usefulLife: 30, loanTerm: 120, essentialUse: true,
    },
  },
  {
    name: 'Heartland Foods Manufacturing',
    stage: 'Funded',
    daysAgo: 35,
    notes: 'Funded 3/24. First payment received on time. Performing as expected.',
    inputs: {
      companyName: 'Heartland Foods Manufacturing Co.',
      yearsInBusiness: 31, annualRevenue: 72000000, ebitda: 11500000,
      totalExistingDebt: 22000000, industrySector: 'Manufacturing', creditRating: 'Strong',
      equipmentType: 'Heavy Machinery', equipmentCondition: 'New',
      equipmentCost: 1800000, downPayment: 270000, financingType: 'EFA',
      usefulLife: 15, loanTerm: 84, essentialUse: true,
    },
  },
  {
    name: 'Summit IT Solutions',
    stage: 'Funded',
    daysAgo: 45,
    notes: 'Funded 3/14. Server refresh complete. Three months of payments on time.',
    inputs: {
      companyName: 'Summit IT Solutions LLC',
      yearsInBusiness: 12, annualRevenue: 24000000, ebitda: 4400000,
      totalExistingDebt: 6000000, industrySector: 'Other', creditRating: 'Strong',
      equipmentType: 'IT/Data Center', equipmentCondition: 'New',
      equipmentCost: 950000, downPayment: 95000, financingType: 'FMV',
      usefulLife: 5, loanTerm: 36, essentialUse: true,
    },
  },
  {
    name: 'Coastal Marine Transit',
    stage: 'Declined',
    daysAgo: 14,
    notes: 'Declined 4/14. Inadequate DSCR coverage. High concentration with single charterer.',
    inputs: {
      companyName: 'Coastal Marine Transit Co.',
      yearsInBusiness: 5, annualRevenue: 22000000, ebitda: 1900000,
      totalExistingDebt: 16000000, industrySector: 'Marine', creditRating: 'Weak',
      equipmentType: 'Marine Vessels', equipmentCondition: 'Used',
      equipmentCost: 7200000, downPayment: 0, financingType: 'EFA',
      usefulLife: 18, loanTerm: 84, essentialUse: true,
    },
  },
  {
    name: 'Greenfield AgriTech',
    stage: 'Declined',
    daysAgo: 28,
    notes: 'Declined 3/31. Two consecutive years of EBITDA decline. Weather-dependent revenue.',
    inputs: {
      companyName: 'Greenfield AgriTech LLC',
      yearsInBusiness: 9, annualRevenue: 14000000, ebitda: 1100000,
      totalExistingDebt: 9500000, industrySector: 'Agriculture', creditRating: 'Weak',
      equipmentType: 'Heavy Machinery', equipmentCondition: 'Used',
      equipmentCost: 1400000, downPayment: 0, financingType: 'EFA',
      usefulLife: 12, loanTerm: 84, essentialUse: true,
    },
  },
];

function buildDeal(def, index) {
  const metrics = calculateMetrics(def.inputs, SOFR_FALLBACK);
  const rs = calculateRiskScore(def.inputs, metrics);
  const updatedAt = new Date(Date.now() - def.daysAgo * 86400000).toISOString();
  return {
    id: `demo-${index + 1}`,
    org_id: DEMO_ORG_ID,
    user_id: DEMO_USER_ID,
    name: def.name,
    stage: def.stage,
    inputs: def.inputs,
    score: rs.composite,
    notes: def.notes || '',
    created_at: updatedAt,
    updated_at: updatedAt,
  };
}

// Build once at module load. Returned arrays are fresh copies so the in-memory
// store can mutate them without trashing the source.
const DEMO_DEALS = DEAL_DEFS.map(buildDeal);

export function getInitialDemoPipeline() {
  return DEMO_DEALS.map((d) => ({ ...d }));
}

export const DEMO_PROFILE = {
  id: DEMO_USER_ID,
  email: 'demo@gettranche.app',
  full_name: 'Demo Analyst',
  role: 'admin',
  org_id: DEMO_ORG_ID,
  organizations: {
    name: 'Demo Capital Partners',
    branding: { primaryColor: '#D4A843', logoUrl: null },
    org_settings: {},
  },
};

export const DEMO_USER = {
  id: DEMO_USER_ID,
  email: 'demo@gettranche.app',
  email_confirmed_at: new Date().toISOString(),
  user_metadata: { full_name: 'Demo Analyst' },
};
