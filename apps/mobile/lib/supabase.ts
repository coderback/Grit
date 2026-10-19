import { Platform } from 'react-native';
import { createClient } from '@supabase/supabase-js';
import * as SecureStore from 'expo-secure-store';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!;

// SecureStore has a 2048-byte limit per key, so we chunk large values
const CHUNK_SIZE = 1900;

async function removeChunks(key: string): Promise<void> {
  const numChunks = await SecureStore.getItemAsync(`${key}_chunks`);
  if (!numChunks) return;
  for (let i = 0; i < parseInt(numChunks, 10); i++) {
    await SecureStore.deleteItemAsync(`${key}_${i}`);
  }
  await SecureStore.deleteItemAsync(`${key}_chunks`);
}

const ExpoSecureStoreAdapter = {
  getItem: async (key: string): Promise<string | null> => {
    const numChunks = await SecureStore.getItemAsync(`${key}_chunks`);
    if (!numChunks) return SecureStore.getItemAsync(key);
    const chunks: string[] = [];
    for (let i = 0; i < parseInt(numChunks, 10); i++) {
      const chunk = await SecureStore.getItemAsync(`${key}_${i}`);
      if (chunk == null) return null;
      chunks.push(chunk);
    }
    return chunks.join('');
  },
  setItem: async (key: string, value: string): Promise<void> => {
    // Clear any previous copy first, otherwise getItem keeps reading stale chunks
    await removeChunks(key);
    if (value.length <= CHUNK_SIZE) {
      await SecureStore.setItemAsync(key, value);
      return;
    }
    await SecureStore.deleteItemAsync(key);
    const numChunks = Math.ceil(value.length / CHUNK_SIZE);
    for (let i = 0; i < numChunks; i++) {
      await SecureStore.setItemAsync(`${key}_${i}`, value.slice(i * CHUNK_SIZE, (i + 1) * CHUNK_SIZE));
    }
    // Written last so a partial write is never read as a complete session
    await SecureStore.setItemAsync(`${key}_chunks`, String(numChunks));
  },
  removeItem: async (key: string): Promise<void> => {
    await removeChunks(key);
    await SecureStore.deleteItemAsync(key);
  },
};

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    // SecureStore has no web implementation; supabase-js defaults to localStorage there
    storage: Platform.OS === 'web' ? undefined : ExpoSecureStoreAdapter,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});
