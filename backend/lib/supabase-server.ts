import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://ckrusxwmrselsvepveet.supabase.co';
const supabaseServiceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNrcnVzeHdtcnNlbHN2ZXB2ZWV0Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1OTI1NzQ4NiwiZXhwIjoyMDc0ODMzNDg2fQ.-jHlZXE94XtQCPsgOG4txY76Z5ZAmA02iLzpE81NxCg';

export const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});
