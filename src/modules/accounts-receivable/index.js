// ============================================================
// Accounts Receivable Module — Barrel Export
// ============================================================

export const META = {
  key: 'accounts_receivable',
  name: 'Accounts Receivable',
  description: 'ABL facility screening for AR-backed revolving credit lines',
  icon: 'file-text',
};

// Re-export everything from constants and scoring
export * from './constants';
export * from './scoring';
export { FORM_SCHEMA } from './schema';
