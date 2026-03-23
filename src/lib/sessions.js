// ============================================================
// Cross-Device Session Management
//
// Tracks active sessions in Supabase. When a new session starts,
// old sessions for the same user are invalidated. The client
// periodically checks if its session is still valid.
// ============================================================

import { supabase } from './supabase';

const SESSION_KEY = 'efd_session_token';

function getSessionToken() {
  try {
    let token = localStorage.getItem(SESSION_KEY);
    if (!token) {
      token = `${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
      localStorage.setItem(SESSION_KEY, token);
    }
    return token;
  } catch {
    return `${Date.now()}_fallback`;
  }
}

/**
 * Register this device as the active session.
 * Removes all other sessions for this user.
 */
export async function registerSession(userId) {
  if (!supabase || !userId) return;

  const token = getSessionToken();
  const deviceInfo = navigator.userAgent?.slice(0, 100) || 'unknown';

  try {
    // Delete old sessions for this user
    await supabase
      .from('active_sessions')
      .delete()
      .eq('user_id', userId);

    // Insert new session
    await supabase
      .from('active_sessions')
      .insert({
        user_id: userId,
        session_token: token,
        device_info: deviceInfo,
      });
  } catch (err) {
    console.warn('Session registration failed:', err);
  }
}

/**
 * Check if this device's session is still the active one.
 * Returns true if valid, false if superseded by another device.
 */
export async function checkSession(userId) {
  if (!supabase || !userId) return true;

  const token = getSessionToken();

  try {
    const { data } = await supabase
      .from('active_sessions')
      .select('session_token')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (!data) return true; // No session record, allow
    return data.session_token === token;
  } catch {
    return true; // On error, don't kick the user out
  }
}

/**
 * Update last_seen timestamp for heartbeat.
 */
export async function heartbeatSession(userId) {
  if (!supabase || !userId) return;

  const token = getSessionToken();

  try {
    await supabase
      .from('active_sessions')
      .update({ last_seen: new Date().toISOString() })
      .eq('user_id', userId)
      .eq('session_token', token);
  } catch {
    // Silent fail
  }
}

/**
 * Remove this device's session on logout.
 */
export async function clearSession(userId) {
  if (!supabase || !userId) return;

  const token = getSessionToken();

  try {
    await supabase
      .from('active_sessions')
      .delete()
      .eq('user_id', userId)
      .eq('session_token', token);

    localStorage.removeItem(SESSION_KEY);
  } catch {
    // Silent fail
  }
}
