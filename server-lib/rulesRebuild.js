// ============================================================
// Bulk rebuild with the firm's current treatment rules.
//
// Admin only (the caller checks). Touches deals in Screening and Under
// Review whose saved rules differ from the firm's rules today. Approved and
// Funded deals keep the rules they were decided under; they can still be
// rebuilt one at a time from the New Deal form.
//
// The admin's action is the confirmation for the changed treatment rows.
// Each deal is rebuilt, validated and rescored on the server, and gets one
// audit row naming the admin. A deal that fails is skipped and listed, and
// stays on its old rules.
//
// Dependencies are passed in so the flow can be tested without Supabase.
// ============================================================

const REBUILD_STAGES = ['Screening', 'Under Review'];

async function findOutOfDate({ db, orgId, orgRules, dealRulesOutOfDate }) {
  const { data, error } = await db
    .from('pipeline_deals')
    .select('id, name, stage, inputs, score, asset_class, updated_at')
    .eq('org_id', orgId)
    .in('stage', REBUILD_STAGES);
  if (error) return { error: 'Could not load deals' };
  const deals = [];
  for (const d of data || []) {
    if (d.inputs?.financials && await dealRulesOutOfDate(d.inputs, orgRules)) deals.push(d);
  }
  return { deals };
}

/**
 * dryRun: returns { count, deals: [{ id, name, stage }] } for the
 * confirmation dialog. Otherwise rebuilds and returns
 * { rebuilt: [{ id, name, oldScore, newScore, changed }], skipped: [{ id, name, reason }] }.
 */
async function runRulesRebuild({ db, orgId, userId, adminName, dryRun, now, deps }) {
  const { rebuildDealRules, dealRulesOutOfDate, recomputeScore, validateInputs, writeAuditLog, dispatchWebhooks } = deps;

  const { data: org } = await db.from('organizations').select('org_settings').eq('id', orgId).single();
  const orgRules = org?.org_settings?.treatmentRules;

  const found = await findOutOfDate({ db, orgId, orgRules, dealRulesOutOfDate });
  if (found.error) return { status: 500, body: { error: found.error } };

  if (dryRun) {
    return { status: 200, body: { count: found.deals.length, deals: found.deals.map(({ id, name, stage }) => ({ id, name, stage })) } };
  }

  const at = now || new Date().toISOString();
  const rebuilt = [];
  const skipped = [];
  const skip = (d, reason) => skipped.push({ id: d.id, name: d.name, reason });

  for (const d of found.deals) {
    const r = await rebuildDealRules(d.inputs, orgRules, adminName, at);
    if (r.error) { skip(d, r.error); continue; }
    if (r.pending > 0) {
      skip(d, `${r.pending} judgment${r.pending === 1 ? '' : 's'} still to confirm. Rebuild it from the deal.`);
      continue;
    }

    const assetClass = d.asset_class || 'equipment_finance';
    const validation = validateInputs(assetClass, r.inputs);
    if (!validation.valid) {
      skip(d, `Does not pass validation under the new rules: ${(validation.errors || []).join(' ')}`.trim());
      continue;
    }
    const { score, error: scoreError } = await recomputeScore(assetClass, r.inputs);
    if (scoreError) { skip(d, 'Could not score under the new rules.'); continue; }

    // Write only if nobody saved the deal since it was read here. Otherwise
    // an analyst's edit would be lost.
    let q = db.from('pipeline_deals').update({ inputs: r.inputs, score, updated_at: at }).eq('id', d.id).eq('org_id', orgId);
    q = d.updated_at ? q.eq('updated_at', d.updated_at) : q.is('updated_at', null);
    const { data: updated, error: updateError } = await q.select('id, name, stage, score');
    if (updateError) { skip(d, 'Could not save the deal.'); continue; }
    if (!updated || !updated.length) { skip(d, 'Edited by someone else during the rebuild. Run it again.'); continue; }

    await writeAuditLog({
      userId,
      orgId,
      action: 'rebuild_rules',
      dealId: d.id,
      oldValues: { inputs: d.inputs, score: d.score },
      newValues: { inputs: r.inputs, score, rulesChange: r.rulesChange, bulk: true, by: adminName },
    });
    if (score !== d.score) {
      await dispatchWebhooks(orgId, 'deal.scored', { id: d.id, name: d.name, stage: d.stage, score });
    }
    rebuilt.push({ id: d.id, name: d.name, oldScore: d.score, newScore: score, changed: r.changed });
  }

  return { status: 200, body: { rebuilt, skipped } };
}

module.exports = { runRulesRebuild, REBUILD_STAGES };
