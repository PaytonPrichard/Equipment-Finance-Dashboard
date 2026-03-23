import { useEffect, useRef, useCallback } from 'react';
import { registerSession, checkSession, heartbeatSession, clearSession } from '../lib/sessions';

const HEARTBEAT_INTERVAL = 60000; // 60 seconds
const CHECK_INTERVAL = 30000; // 30 seconds

/**
 * Enforces single-session per user across devices.
 *
 * On mount: registers this device as the active session (invalidates others).
 * Periodically: checks if this session is still valid (another device may have taken over).
 * On conflict: calls onSessionConflict (typically signs out).
 *
 * @param {string} userId - Current user ID
 * @param {boolean} enforce - Whether to enforce (e.g., only for Analyst tier)
 * @param {Function} onSessionConflict - Called when another device takes over
 */
export function useSessionGuard(userId, enforce, onSessionConflict) {
  const conflictRef = useRef(onSessionConflict);
  conflictRef.current = onSessionConflict;

  const handleConflict = useCallback(() => {
    if (conflictRef.current) conflictRef.current();
  }, []);

  useEffect(() => {
    if (!enforce || !userId) return;

    // Register this device as the active session
    registerSession(userId);

    // Periodically check if our session is still valid
    const checkInterval = setInterval(async () => {
      const isValid = await checkSession(userId);
      if (!isValid) {
        handleConflict();
      }
    }, CHECK_INTERVAL);

    // Heartbeat to keep session alive
    const heartbeatInterval = setInterval(() => {
      heartbeatSession(userId);
    }, HEARTBEAT_INTERVAL);

    // Also check on tab focus (user switches back to this tab)
    const handleFocus = async () => {
      const isValid = await checkSession(userId);
      if (!isValid) {
        handleConflict();
      }
    };
    window.addEventListener('focus', handleFocus);

    return () => {
      clearInterval(checkInterval);
      clearInterval(heartbeatInterval);
      window.removeEventListener('focus', handleFocus);
    };
  }, [userId, enforce, handleConflict]);

  // Cleanup session on unmount (logout)
  useEffect(() => {
    return () => {
      if (enforce && userId) {
        clearSession(userId);
      }
    };
  }, [userId, enforce]);
}
