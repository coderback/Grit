import axios from 'axios';
import { supabase } from './supabase';
import { DEMO_MODE } from './demo/mode';
import { demoAdapter } from './demo/backend';

export const api = axios.create({
  baseURL: process.env.EXPO_PUBLIC_API_URL,
  timeout: 15000,
  headers: { 'Content-Type': 'application/json' },
  ...(DEMO_MODE ? { adapter: demoAdapter } : {}),
});

// Attach the current Supabase JWT to every request
api.interceptors.request.use(async (config) => {
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (session?.access_token) {
    config.headers.Authorization = `Bearer ${session.access_token}`;
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
