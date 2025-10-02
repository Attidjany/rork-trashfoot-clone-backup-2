// components/SupaHealth.tsx
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { Text, View } from 'react-native';

export default function SupaHealth() {
  const [status, setStatus] = useState<string>('checking...');

  useEffect(() => {
    (async () => {
      try {
        // Replace 'groups' with any table that is PUBLICLY readable
        const { error } = await supabase.from('groups').select('id').limit(1);
        if (error) {
          setStatus(`Auth/RLS error: ${error.message}`);
          return;
        }
        setStatus('OK: can read data');
      } catch (e: any) {
        setStatus(`Network/env error: ${e?.message ?? String(e)}`);
      }
    })();
  }, []);

  return (
    <View style={{ padding: 12 }}>
      <Text>{status}</Text>
    </View>
  );
}
