// ============================================================
// Inventory Finance Module — Barrel Export
// ============================================================

export const META = {
  key: 'inventory_finance',
  name: 'Inventory Finance',
  description: 'ABL screening for inventory-backed revolving credit facilities',
  icon: 'package',
};

// Re-export everything from constants and scoring
export * from './constants';
export * from './scoring';
export { FORM_SCHEMA } from './schema';
