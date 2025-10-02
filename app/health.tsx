// app/health.tsx
import { useEffect, useState } from 'react';
import { View, Text } from 'react-native';
import { supabase } from '@/lib/supabase';

export default function Health() {
  const [status, setStatus] = useState('Checking connection...');
  const [details, setDetails] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        // Change 'groups' to any table you know exists & is readable
        const { error } = await supabase.from('groups').select('id').limit(1);
        if (error) {
          setStatus('Auth/RLS error (Supabase responded)');
          setDetails(error.message);
          return;
        }
        setStatus('OK ✅ Connected and can read data');
      } catch (e: any) {
        setStatus('Network/ENV error ❌');
        setDetails(e?.message ?? String(e));
      }
    })();
  }, []);

  return (
    <View style={{ padding: 16 }}>
      <Text style={{ fontSize: 18, fontWeight: '600' }}>{status}</Text>
      {details ? <Text style={{ marginTop: 8 }}>{details}</Text> : null}
    </View>
  );
}
