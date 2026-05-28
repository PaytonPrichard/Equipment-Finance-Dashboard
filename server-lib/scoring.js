// ============================================================
// Server-side score recomputation.
//
// Bridges CJS api/* to ESM src/modules/* via dynamic import().
// The loader map keys directly to import() with static specifiers,
// so Vercel's file tracer can statically resolve each path and
// bundle the module graph (format.ts + borrowerMetrics + constants).
//
// SOFR: we deliberately pass no sofr argument, so each module's
// DEFAULT_SOFR is used. The browser may use a live SOFR via
// useSofrRate; the server uses the calibrated default to keep
// the authoritative score deterministic for a given inputs payload.
// ============================================================

const MODULE_LOADERS = {
  equipment_finance: () => import('../src/modules/equipment-finance/scoring.js'),
  accounts_receivable: () => import('../src/modules/accounts-receivable/scoring.js'),
  inventory_finance: () => import('../src/modules/inventory-finance/scoring.js'),
};

const VALID_ASSET_CLASSES = Object.keys(MODULE_LOADERS);

async function recomputeScore(assetClass, inputs) {
  if (!MODULE_LOADERS[assetClass]) {
    return {
      score: null,
      error: `Unknown asset_class "${assetClass}". Valid: ${VALID_ASSET_CLASSES.join(', ')}`,
    };
  }
  if (!inputs || typeof inputs !== 'object') {
    return { score: null, error: 'inputs is required to compute a score' };
  }

  try {
    const mod = await MODULE_LOADERS[assetClass]();
    const metrics = mod.calculateMetrics(inputs);
    const risk = mod.calculateRiskScore(inputs, metrics);
    const score = risk && risk.composite;
    if (typeof score !== 'number' || !Number.isFinite(score)) {
      return { score: null, error: 'Scoring produced an invalid composite' };
    }
    return { score, error: null };
  } catch (err) {
    console.error('[scoring] recomputeScore error:', err);
    return { score: null, error: `Scoring failed: ${err.message}` };
  }
}

module.exports = { recomputeScore, VALID_ASSET_CLASSES };
