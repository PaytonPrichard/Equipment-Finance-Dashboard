import { supabase } from './supabase';
import { isDemoMode } from './demoMode';
import type { AuditAction, AuditEntityType } from '../types';

// Fire-and-forget audit logging — never block the UI
export function logAudit(
  userId: string,
  orgId: string,
  action: AuditAction,
  entityType: AuditEntityType,
  entityId: string,
  oldValues: unknown,
  newValues: unknown,
  metadata?: Record<string, unknown>,
): void {
  if (isDemoMode()) return;
  if (!supabase) return;
  supabase.from('audit_log').insert({
    user_id: userId,
    org_id: orgId,
    action,
    entity_type: entityType,
    entity_id: entityId,
    old_values: oldValues,
    new_values: newValues,
    metadata: metadata || {},
  }).then(({ error }) => {
    if (error) console.warn('Audit log failed:', error.message);
  });
}

export interface AuditLogRow {
  id: string;
  user_id: string;
  org_id: string;
  action: AuditAction;
  entity_type: AuditEntityType;
  entity_id: string;
  old_values: Record<string, unknown> | null;
  new_values: Record<string, unknown> | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
  profiles?: { full_name: string | null; email: string | null } | null;
}

/**
 * History for one entity, newest first. RLS scopes this to the caller's org,
 * so no org filter is passed here.
 *
 * Demo mode has no audit table. It returns empty rather than erroring, so the
 * activity section renders as "no recorded changes" instead of failing.
 */
export async function fetchAuditLog({
  entityType,
  entityId,
  limit = 20,
}: {
  entityType: AuditEntityType;
  entityId: string;
  limit?: number;
}): Promise<{ data: AuditLogRow[]; error: unknown }> {
  if (isDemoMode()) return { data: [], error: null };
  if (!supabase) return { data: [], error: null };

  const { data, error } = await supabase
    .from('audit_log')
    .select('*, profiles(full_name, email)')
    .eq('entity_type', entityType)
    .eq('entity_id', entityId)
    .order('created_at', { ascending: false })
    .limit(limit);

  return { data: (data as AuditLogRow[]) || [], error };
}
