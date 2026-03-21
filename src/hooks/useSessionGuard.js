import { useEffect, useRef } from 'react';

const SESSION_KEY = 'efd_active_session';
const HEARTBEAT_INTERVAL = 30000; // 30 seconds

/**
 * Enforces single-session for the current user.
 *
 * On mount, generates a unique session ID and writes it to localStorage.
 * Other tabs detect the change via the 'storage' event and compare session IDs.
 * If their session ID doesn't match, they call onSessionConflict (sign out).
 *
 * This works across tabs in the same browser. For cross-device enforcement,
 * use a Supabase-backed session table (future enhancement).
 *
 * @param {string} userId - Current user ID
 * @param {boolean} enforce - Whether to enforce (e.g., only for Analyst tier)
 * @param {Function} onSessionConflict - Called when another session takes over
 */
export function useSessionGuard(userId, enforce, onSessionConflict) {
  const sessionIdRef = useRef(null);

  useEffect(() => {
    if (!enforce || !userId) return;

    // Generate a unique session ID for this tab
    const sessionId = `${userId}_${Date.now()}_${Math.random().toString(36).slice(2)}`;
    sessionIdRef.current = sessionId;

    // Claim the session
    try {
      localStorage.setItem(SESSION_KEY, sessionId);
    } catch (e) { /* ignore */ }

    // Listen for other tabs claiming the session
    const handleStorage = (e) => {
      if (e.key === SESSION_KEY && e.newValue && e.newValue !== sessionIdRef.current) {
        // Another tab has taken over — this session is no longer active
        if (onSessionConflict) {
          onSessionConflict();
        }
      }
    };

    window.addEventListener('storage', handleStorage);

    // Periodic heartbeat to re-assert this session
    const interval = setInterval(() => {
      try {
        const current = localStorage.getItem(SESSION_KEY);
        if (current !== sessionIdRef.current) {
          // Session was taken over while we weren't looking
          if (onSessionConflict) {
            onSessionConflict();
          }
        }
      } catch (e) { /* ignore */ }
    }, HEARTBEAT_INTERVAL);

    return () => {
      window.removeEventListener('storage', handleStorage);
      clearInterval(interval);
      // Clean up on unmount only if we still own the session
      try {
        if (localStorage.getItem(SESSION_KEY) === sessionIdRef.current) {
          localStorage.removeItem(SESSION_KEY);
        }
      } catch (e) { /* ignore */ }
    };
  }, [userId, enforce, onSessionConflict]);
}
