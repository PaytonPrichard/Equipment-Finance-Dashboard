// Bundle entry for the real-deals harness. Same module code the app and
// server use; run.js bundles this with esbuild so .ts imports resolve.
export * as equipmentFinance from '../../src/modules/equipment-finance/scoring.ts';
export { DEFAULT_SOFR } from '../../src/modules/equipment-finance/constants.ts';
export { evaluateScreening, DEFAULT_CRITERIA } from '../../src/lib/screeningCriteria.ts';
export { computeCashFlowAnalysis } from '../../src/utils/cashFlowMetrics.ts';
