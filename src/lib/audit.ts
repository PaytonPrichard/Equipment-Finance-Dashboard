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
