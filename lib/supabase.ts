// lib/supabase.ts
import { createClient } from '@supabase/supabase-js';

const url = (process.env.EXPO_PUBLIC_SUPABASE_URL || '').replace(/\/$/, '');
const anon = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || '';

if (!url || !anon) {
  // This will show up in Vercel logs if envs are missing/misnamed
  console.warn('Supabase env missing: EXPO_PUBLIC_SUPABASE_URL or EXPO_PUBLIC_SUPABASE_ANON_KEY');
}

export const supabase = createClient(url, anon, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: false,
  },
});
