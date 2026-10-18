import axios from 'axios';
import { supabase } from './supabase';
import { utcOffsetMinutes } from './date';

export const api = axios.create({
  baseURL: process.env.EXPO_PUBLIC_API_URL,
  timeout: 15000,
  headers: { 'Content-Type': 'application/json' },
});

/** Headers every backend request needs: auth plus the device's UTC offset. */
export async function authHeaders(): Promise<Record<string, string>> {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  const headers: Record<string, string> = {
    // Lets the backend work out "today" and week boundaries in local time
    'x-utc-offset': String(utcOffsetMinutes()),
  };
  if (session?.access_token) {
    headers.Authorization = `Bearer ${session.access_token}`;
  }
  return headers;
}

// Attach the current Supabase JWT and UTC offset to every request
api.interceptors.request.use(async (config) => {
  for (const [key, value] of Object.entries(await authHeaders())) {
    config.headers.set(key, value);
  }
  return config;
});

// On 401 — session is invalid, sign the user out (triggers onAuthStateChange)
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (error.response?.status === 401) {
      await supabase.auth.signOut();
    }
    return Promise.reject(error);
  },
);
