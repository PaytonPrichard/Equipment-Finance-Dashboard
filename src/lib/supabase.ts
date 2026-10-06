import { createClient, SupabaseClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.REACT_APP_SUPABASE_URL;
const supabaseAnonKey = process.env.REACT_APP_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn('Supabase credentials not found. Running in offline mode.');
}

// Demo mode must never see a real login. A signed-in user who opens
// ?demo=1 shares this origin's storage, so a default client picked up their
// session and any query without a demo guard ran as them: the demo's Audit
// Log showed the real org's history. In demo the client gets its own empty
// storage key and keeps nothing, so it is always anonymous and RLS returns
// nothing real. Read from the URL directly, like isDemoMode, to keep this
// module free of the demo data imports.
function demoRequested(): boolean {
  try {
    return new URLSearchParams(window.location.search).get('demo') === '1';
  } catch {
    return false;
  }
}

export const supabase: SupabaseClient | null = supabaseUrl && supabaseAnonKey
  ? createClient(
      supabaseUrl,
      supabaseAnonKey,
      demoRequested()
        ? {
            auth: {
              storageKey: 'tranche-demo-auth',
              persistSession: false,
              autoRefreshToken: false,
              detectSessionInUrl: false,
            },
          }
        : undefined,
    )
  : null;
