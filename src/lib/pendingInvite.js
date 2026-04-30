// Captures an invite code from the URL and stashes it in localStorage so
// it survives the signup -> email-verification redirect chain (which can
// open a fresh browser context where sessionStorage is empty).

const KEY = 'pending_invite_code';

export function captureFromUrl() {
  if (typeof window === 'undefined') return;
  try {
    const params = new URLSearchParams(window.location.search);
    const code = params.get('invite');
    if (code) {
      window.localStorage.setItem(KEY, code.trim().toUpperCase());
    }
  } catch (e) {
    // localStorage can throw if disabled — silently ignore
  }
}

export function consumePendingInvite() {
  if (typeof window === 'undefined') return null;
  try {
    const code = window.localStorage.getItem(KEY);
    if (code) window.localStorage.removeItem(KEY);
    return code;
  } catch (e) {
    return null;
  }
}

export function peekPendingInvite() {
  if (typeof window === 'undefined') return null;
  try {
    return window.localStorage.getItem(KEY);
  } catch (e) {
    return null;
  }
}
