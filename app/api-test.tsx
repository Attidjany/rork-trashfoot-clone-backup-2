import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { trpc } from '@/lib/trpc';

export default function ApiTestScreen() {
  const [apiStatus, setApiStatus] = useState<string>('Checking...');
  const [trpcStatus, setTrpcStatus] = useState<string>('Checking...');

  // Test basic API endpoint
  const testApi = async () => {
    try {
      const baseUrl = typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000';
      console.log('Testing API at:', `${baseUrl}/api/`);
      
      const response = await fetch(`${baseUrl}/api/`, {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
        },
      });
      
      console.log('API Response:', {
        ok: response.ok,
        status: response.status,
        contentType: response.headers.get('content-type')
      });
      
      if (response.ok) {
        const data = await response.json();
        setApiStatus(`✅ API Working: ${data.message}`);
      } else {
        const text = await response.text();
        setApiStatus(`❌ API Error: ${response.status} - ${text.substring(0, 100)}`);
      }
    } catch (error) {
      console.error('API Test Error:', error);
      setApiStatus(`❌ API Error: ${error}`);
    }
  };

  // Test tRPC endpoint
  const hiQuery = trpc.example.hi.useQuery(
    { name: 'Test User' },
    {
      retry: false,
    }
  );

  useEffect(() => {
    if (hiQuery.data) {
      setTrpcStatus(`✅ tRPC Working: ${hiQuery.data.message}`);
    } else if (hiQuery.error) {
      setTrpcStatus(`❌ tRPC Error: ${hiQuery.error.message}`);
    }
  }, [hiQuery.data, hiQuery.error]);

  useEffect(() => {
    testApi();
  }, []);

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView style={styles.scrollView}>
        <Text style={styles.title}>API Test Page</Text>
        
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Basic API Test</Text>
          <Text style={styles.status}>{apiStatus}</Text>
          <TouchableOpacity style={styles.button} onPress={testApi}>
            <Text style={styles.buttonText}>Test API Again</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>tRPC Test</Text>
          <Text style={styles.status}>{trpcStatus}</Text>
          <Text style={styles.info}>
            Loading: {hiQuery.isLoading ? 'Yes' : 'No'}
          </Text>
          <Text style={styles.info}>
            Error: {hiQuery.error ? hiQuery.error.message : 'None'}
          </Text>
          <TouchableOpacity style={styles.button} onPress={() => hiQuery.refetch()}>
            <Text style={styles.buttonText}>Test tRPC Again</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Debug Info</Text>
          <Text style={styles.info}>
            Current URL: {typeof window !== 'undefined' ? window.location.href : 'N/A'}
          </Text>
          <Text style={styles.info}>
            Base URL: {typeof window !== 'undefined' ? window.location.origin : 'N/A'}
          </Text>
          <Text style={styles.info}>
            tRPC URL: {typeof window !== 'undefined' ? `${window.location.origin}/api/trpc` : 'N/A'}
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  scrollView: {
    flex: 1,
    padding: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 20,
    textAlign: 'center',
  },
  section: {
    backgroundColor: 'white',
    padding: 15,
    marginBottom: 15,
    borderRadius: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 10,
  },
  status: {
    fontSize: 16,
    marginBottom: 10,
    padding: 10,
    backgroundColor: '#f0f0f0',
    borderRadius: 4,
  },
  info: {
    fontSize: 14,
    marginBottom: 5,
    color: '#666',
  },
  button: {
    backgroundColor: '#007AFF',
    padding: 12,
    borderRadius: 6,
    alignItems: 'center',
    marginTop: 10,
  },
  buttonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
});