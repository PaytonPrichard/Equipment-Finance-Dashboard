// Captures an invite code from the URL and stashes it across the
// signup/email-verification redirect chain so OrgSetup can pre-fill it.

const KEY = 'pending_invite_code';

export function captureFromUrl() {
  if (typeof window === 'undefined') return;
  try {
    const params = new URLSearchParams(window.location.search);
    const code = params.get('invite');
    if (code) {
      window.sessionStorage.setItem(KEY, code.trim().toUpperCase());
    }
  } catch (e) {
    // sessionStorage can throw in private mode — silently ignore
  }
}

export function consumePendingInvite() {
  if (typeof window === 'undefined') return null;
  try {
    const code = window.sessionStorage.getItem(KEY);
    if (code) window.sessionStorage.removeItem(KEY);
    return code;
  } catch (e) {
    return null;
  }
}

export function peekPendingInvite() {
  if (typeof window === 'undefined') return null;
  try {
    return window.sessionStorage.getItem(KEY);
  } catch (e) {
    return null;
  }
}
