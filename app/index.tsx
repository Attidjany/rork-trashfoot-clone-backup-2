import 'react-native-url-polyfill/auto';
import React, { useEffect, useRef } from 'react';
import { View, ActivityIndicator, StyleSheet, Text } from 'react-native';
import { useRouter } from 'expo-router';
import { useGameStore } from '@/hooks/use-game-store';
import { trpc } from '@/lib/trpc';

export default function Index() {
  const router = useRouter();
  const { currentUser, isLoading, isHydrated } = useGameStore();
  const hasRedirected = useRef(false);
  
  // Test backend connection
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
    // Prevent multiple redirects
    if (hasRedirected.current) {
      return;
    }
    
    console.log('=== INDEX ROUTE CHECK ===');
    console.log('isHydrated:', isHydrated);
    console.log('isLoading:', isLoading);
    console.log('currentUser:', currentUser ? `${currentUser.name} (${currentUser.email})` : 'null');
    
    if (isHydrated && !isLoading) {
      hasRedirected.current = true;
      
      if (currentUser) {
        console.log('Index: User found, redirecting to home:', currentUser.name, currentUser.email);
        router.replace('/(tabs)/home');
      } else {
        console.log('Index: No user found, redirecting to auth');
        router.replace('/auth');
      }
    }
  }, [currentUser, isLoading, isHydrated, router]);

  console.log('Index render - isHydrated:', isHydrated, 'isLoading:', isLoading, 'currentUser:', !!currentUser);

  return (
    <View style={styles.container}>
      <ActivityIndicator size="large" color="#0EA5E9" />
      <Text style={styles.loadingText}>
        {!isHydrated ? 'Initializing...' : isLoading ? 'Loading...' : 'Redirecting...'}
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