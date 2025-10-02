// app/debug/groups.tsx
import { useEffect, useState } from 'react';
import { View, Text } from 'react-native';
import { supabase } from '@/lib/supabase';

type Group = {
  id: string;
  name: string | null;
  invite_code: string | null;
  is_public: boolean | null;
  created_at: string | null;
};

export default function DebugGroups() {
  const [rows, setRows] = useState<Group[] | null>(null);
  const [status, setStatus] = useState('Loading...');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      setStatus('Loading...');
      setError(null);
      const { data, error } = await supabase
        .from('groups')
        .select('id, name, invite_code, is_public, created_at')
        .order('created_at', { ascending: false })
        .limit(20);

      if (error) {
        setError(error.message);
        setStatus('Error');
        return;
      }
      setRows(data ?? []);
      setStatus('OK');
    })();
  }, []);

  return (
    <View style={{ padding: 16, gap: 8 }}>
      <Text style={{ fontSize: 18, fontWeight: '600' }}>Groups (latest 20)</Text>
      <Text>Status: {status}</Text>
      {error ? <Text style={{ color: 'red' }}>Error: {error}</Text> : null}
      {rows?.map((g) => (
        <View key={g.id} style={{ paddingVertical: 8, borderBottomWidth: 1, borderColor: '#444' }}>
          <Text>ID: {g.id}</Text>
          <Text>Name: {g.name ?? '—'}</Text>
          <Text>Invite Code: {g.invite_code ?? '—'}</Text>
          <Text>Public: {String(!!g.is_public)}</Text>
          <Text>Created: {g.created_at ?? '—'}</Text>
        </View>
      ))}
      {rows && rows.length === 0 ? <Text>No groups found.</Text> : null}
    </View>
  );
}
