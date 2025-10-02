import { createClient } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

const supabaseUrl = 'https://ckrusxwmrselsvepveet.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNrcnVzeHdtcnNlbHN2ZXB2ZWV0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTkyNTc0ODYsImV4cCI6MjA3NDgzMzQ4Nn0.X7zS930LCKvZxMQu0UViQv0O9_3fPwKeV7Qsts0RR2c';

const supabaseClient = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: Platform.OS === 'web' ? undefined : AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});

export { supabaseClient };
