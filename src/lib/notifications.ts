import { supabase } from './supabase';

interface StageChangeParams {
  dealName: string;
  oldStage: string;
  newStage: string;
  orgId: string;
}

interface InviteEmailParams {
  inviteCode: string;
  email: string;
  role: string;
  orgId: string;
}

interface InviteResult {
  ok: boolean;
  reason?: string;
}

// Fire-and-forget notification for pipeline stage changes.
// Calls the /api/notify endpoint which emails team members.
// Fails silently — notifications should never block the UI.
export async function notifyStageChange({ dealName, oldStage, newStage, orgId }: StageChangeParams): Promise<void> {
  try {
    if (!supabase) return;
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.access_token) return;

    fetch('/api/notify', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({ type: 'stage_change', dealName, oldStage, newStage, orgId }),
    }).catch(() => {}); // fire and forget
  } catch {
    // Never block UI for notification failures
  }
}

// Send an invite email via /api/notify. Awaitable so callers can surface errors.
export async function sendInviteEmail({ inviteCode, email, role, orgId }: InviteEmailParams): Promise<InviteResult> {
  if (!supabase) return { ok: false, reason: 'no_supabase' };
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.access_token) return { ok: false, reason: 'no_session' };

  try {
    const res = await fetch('/api/notify', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({ type: 'invite', inviteCode, email, role, orgId }),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      return { ok: false, reason: body.error || `http_${res.status}` };
    }
    return { ok: true };
  } catch {
    return { ok: false, reason: 'network' };
  }
}
