import React, { useEffect, useRef } from 'react';
import { View, ActivityIndicator, StyleSheet, Text } from 'react-native';
import { useRouter } from 'expo-router';
import { useSession } from '@/hooks/use-session';
import { supabase } from '@/lib/supabase';
import { trpc } from '@/lib/trpc';

export default function Index() {
  const router = useRouter();
  const { user, loading } = useSession();
  const hasRedirected = useRef(false);
  
  const backendTest = trpc.example.hi.useQuery(
    { name: 'Test' },
    { 
      retry: 1,
      refetchOnWindowFocus: false,
    }
  );
  
  useEffect(() => {
    if (backendTest.data) {
      console.log('✅ Backend connection successful:', backendTest.data);
    } else if (backendTest.error) {
      console.log('❌ Backend connection failed:', backendTest.error.message);
    }
  }, [backendTest.data, backendTest.error]);

  useEffect(() => {
    if (hasRedirected.current || loading) {
      return;
    }
    
    console.log('=== INDEX ROUTE CHECK ===');
    console.log('loading:', loading);
    console.log('user:', user ? `${user.email}` : 'null');
    
    async function checkAndRedirect() {
      if (!user) {
        console.log('Index: No user found, redirecting to auth');
        hasRedirected.current = true;
        router.replace('/auth');
        return;
      }

      const { data: playerData } = await supabase
        .from('players')
        .select('id, name, gamer_handle')
        .eq('auth_user_id', user.id)
        .single();

      if (!playerData) {
        console.log('Index: Player profile not found, redirecting to auth');
        hasRedirected.current = true;
        router.replace('/auth');
        return;
      }

      if (!playerData.name) {
        console.log('Index: Profile incomplete, redirecting to complete-profile');
        hasRedirected.current = true;
        router.replace({
          pathname: '/complete-profile',
          params: { playerId: playerData.id },
        });
        return;
      }

      console.log('Index: User authenticated and profile complete, redirecting to home');
      hasRedirected.current = true;
      router.replace('/(tabs)/home');
    }

    checkAndRedirect();
  }, [user, loading, router]);

  console.log('Index render - loading:', loading, 'user:', !!user);

  return (
    <View style={styles.container}>
      <ActivityIndicator size="large" color="#0EA5E9" />
      <Text style={styles.loadingText}>
        {loading ? 'Loading...' : 'Redirecting...'}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#0F172A',
  },
  loadingText: {
    color: '#64748B',
    marginTop: 16,
    fontSize: 16,
  },
});
