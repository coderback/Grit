import type { SupabaseClient } from '@supabase/supabase-js';
import { DEMO_USER_ID } from './backend';

/** The parts of the Supabase client the app uses, with no network and no real account. */
const SIGNED_OUT_KEY = 'grit_demo_signed_out';

const session = {
  access_token: 'demo',
  refresh_token: 'demo',
  token_type: 'bearer',
  expires_in: 3600,
  user: { id: DEMO_USER_ID, email: 'alex@demo.invalid' },
};

const readSignedOut = () => {
  try { return sessionStorage.getItem(SIGNED_OUT_KEY) === '1'; } catch { return false; }
};
const writeSignedOut = (value: boolean) => {
  try {
    if (value) sessionStorage.setItem(SIGNED_OUT_KEY, '1');
    else sessionStorage.removeItem(SIGNED_OUT_KEY);
  } catch { /* storage blocked: state only lasts for this page */ }
};

let signedOut = readSignedOut();
const listeners = new Set<(event: string, s: unknown) => void>();
const current = () => (signedOut ? null : session);
const notify = (event: string) => listeners.forEach((l) => l(event, current()));

const channel = { on: () => channel, subscribe: () => channel };

const demoClient = {
  auth: {
    getSession: async () => ({ data: { session: current() }, error: null }),
    onAuthStateChange: (cb: (event: string, s: unknown) => void) => {
      listeners.add(cb);
      return { data: { subscription: { unsubscribe: () => listeners.delete(cb) } } };
    },
    signOut: async () => {
      signedOut = true;
      writeSignedOut(true);
      notify('SIGNED_OUT');
      return { error: null };
    },
  },
  channel: () => channel,
  removeChannel: async () => 'ok',
};

/** Enter the demo. Takes no credentials, so nobody is asked to type a password. */
export function enterDemo() {
  signedOut = false;
  writeSignedOut(false);
  notify('SIGNED_IN');
}

export const demoSupabase = demoClient as unknown as SupabaseClient;
