import React, { useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { Stack } from 'expo-router';
import { CheckCircle, XCircle, AlertCircle, Loader } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

type TestResult = {
  name: string;
  status: 'pending' | 'running' | 'success' | 'error';
  message?: string;
  details?: string;
};

export default function AuthTestScreen() {
  const insets = useSafeAreaInsets();
  const [tests, setTests] = useState<TestResult[]>([
    { name: 'Backend Health Check', status: 'pending' },
    { name: 'Supabase Connection', status: 'pending' },
    { name: 'tRPC Connection', status: 'pending' },
    { name: 'Check Handle Endpoint', status: 'pending' },
  ]);
  const [isRunning, setIsRunning] = useState(false);

  const updateTest = (index: number, updates: Partial<TestResult>) => {
    setTests(prev => prev.map((test, i) => i === index ? { ...test, ...updates } : test));
  };

  const runTests = async () => {
    setIsRunning(true);
    
    updateTest(0, { status: 'running' });
    try {
      const response = await fetch('https://trashfoot.vercel.app/api/', {
        method: 'GET',
      });
      
      const contentType = response.headers.get('content-type');
      
      if (response.ok && contentType?.includes('application/json')) {
        const data = await response.json();
        updateTest(0, { 
          status: 'success', 
          message: data.message || 'Backend is healthy',
          details: `Status: ${response.status}, Content-Type: ${contentType}`
        });
      } else {
        updateTest(0, { 
          status: 'error', 
          message: 'Backend returned non-JSON response',
          details: `Status: ${response.status}, Content-Type: ${contentType}`
        });
      }
    } catch (error: any) {
      updateTest(0, { 
        status: 'error', 
        message: 'Failed to connect to backend',
        details: error.message
      });
    }

    updateTest(1, { status: 'running' });
    try {
      const response = await fetch('https://trashfoot.vercel.app/api/trpc/example.hi', {
        method: 'GET',
      });
      
      if (response.ok) {
        const data = await response.json();
        updateTest(1, { 
          status: 'success', 
          message: 'Supabase connection working',
          details: JSON.stringify(data).substring(0, 100)
        });
      } else {
        updateTest(1, { 
          status: 'error', 
          message: 'Supabase connection failed',
          details: `Status: ${response.status}`
        });
      }
    } catch (error: any) {
      updateTest(1, { 
        status: 'error', 
        message: 'Failed to test Supabase',
        details: error.message
      });
    }

    updateTest(2, { status: 'running' });
    try {
      const response = await fetch('https://trashfoot.vercel.app/api/trpc/auth.checkGamerHandle', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          gamerHandle: 'test_handle_' + Date.now(),
        }),
      });
      
      if (response.ok) {
        const data = await response.json();
        updateTest(2, { 
          status: 'success', 
          message: 'tRPC connection working',
          details: JSON.stringify(data).substring(0, 100)
        });
      } else {
        const text = await response.text();
        updateTest(2, { 
          status: 'error', 
          message: 'tRPC connection failed',
          details: `Status: ${response.status}, Response: ${text.substring(0, 100)}`
        });
      }
    } catch (error: any) {
      updateTest(2, { 
        status: 'error', 
        message: 'Failed to test tRPC',
        details: error.message
      });
    }

    updateTest(3, { status: 'running' });
    try {
      const testHandle = 'test_' + Date.now();
      const response = await fetch('https://trashfoot.vercel.app/api/trpc/auth.checkGamerHandle', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          '0': {
            json: {
              gamerHandle: testHandle,
            },
          },
        }),
      });
      
      if (response.ok) {
        const data = await response.json();
        updateTest(3, { 
          status: 'success', 
          message: 'Check handle endpoint working',
          details: JSON.stringify(data).substring(0, 100)
        });
      } else {
        const text = await response.text();
        updateTest(3, { 
          status: 'error', 
          message: 'Check handle endpoint failed',
          details: `Status: ${response.status}, Response: ${text.substring(0, 100)}`
        });
      }
    } catch (error: any) {
      updateTest(3, { 
        status: 'error', 
        message: 'Failed to test check handle',
        details: error.message
      });
    }

    setIsRunning(false);
  };

  const getStatusIcon = (status: TestResult['status']) => {
    switch (status) {
      case 'pending':
        return <AlertCircle size={24} color="#64748B" />;
      case 'running':
        return <Loader size={24} color="#0EA5E9" />;
      case 'success':
        return <CheckCircle size={24} color="#10B981" />;
      case 'error':
        return <XCircle size={24} color="#EF4444" />;
    }
  };

  const getStatusColor = (status: TestResult['status']) => {
    switch (status) {
      case 'pending':
        return '#64748B';
      case 'running':
        return '#0EA5E9';
      case 'success':
        return '#10B981';
      case 'error':
        return '#EF4444';
    }
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <Stack.Screen 
        options={{ 
          headerShown: true,
          title: 'Auth System Test',
          headerStyle: {
            backgroundColor: '#0F172A',
          },
          headerTintColor: '#fff',
        }} 
      />
      
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <Text style={styles.title}>Authentication System Test</Text>
          <Text style={styles.subtitle}>
            Run these tests to verify your auth setup is working correctly
          </Text>
        </View>

        <View style={styles.testsContainer}>
          {tests.map((test, index) => (
            <View key={index} style={styles.testCard}>
              <View style={styles.testHeader}>
                {getStatusIcon(test.status)}
                <View style={styles.testInfo}>
                  <Text style={styles.testName}>{test.name}</Text>
                  <Text style={[styles.testStatus, { color: getStatusColor(test.status) }]}>
                    {test.status.toUpperCase()}
                  </Text>
                </View>
              </View>
              
              {test.message && (
                <Text style={styles.testMessage}>{test.message}</Text>
              )}
              
              {test.details && (
                <View style={styles.detailsContainer}>
                  <Text style={styles.detailsLabel}>Details:</Text>
                  <Text style={styles.detailsText}>{test.details}</Text>
                </View>
              )}
            </View>
          ))}
        </View>

        <TouchableOpacity
          style={[styles.runButton, isRunning && styles.runButtonDisabled]}
          onPress={runTests}
          disabled={isRunning}
        >
          {isRunning ? (
            <>
              <ActivityIndicator color="#fff" style={styles.buttonLoader} />
              <Text style={styles.runButtonText}>Running Tests...</Text>
            </>
          ) : (
            <Text style={styles.runButtonText}>Run All Tests</Text>
          )}
        </TouchableOpacity>

        <View style={styles.infoBox}>
          <Text style={styles.infoTitle}>What to do next:</Text>
          <Text style={styles.infoText}>
            1. If all tests pass ✅, your backend is ready!
          </Text>
          <Text style={styles.infoText}>
            2. Configure Supabase email settings (see AUTH_SETUP_GUIDE.md)
          </Text>
          <Text style={styles.infoText}>
            3. Try registering a new account at /auth
          </Text>
          <Text style={styles.infoText}>
            4. Check your email for confirmation link
          </Text>
          <Text style={styles.infoText}>
            5. Login with your credentials
          </Text>
        </View>

        <View style={styles.linksContainer}>
          <Text style={styles.linksTitle}>Quick Links:</Text>
          <Text style={styles.linkText}>
            • Supabase Dashboard: https://supabase.com/dashboard
          </Text>
          <Text style={styles.linkText}>
            • Vercel Dashboard: https://vercel.com/dashboard
          </Text>
          <Text style={styles.linkText}>
            • Auth Page: https://trashfoot.vercel.app/auth
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0F172A',
  },
  scrollView: {
    flex: 1,
  },
  content: {
    padding: 20,
  },
  header: {
    marginBottom: 24,
  },
  title: {
    fontSize: 24,
    fontWeight: '700' as const,
    color: '#fff',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    color: '#94A3B8',
    lineHeight: 20,
  },
  testsContainer: {
    marginBottom: 24,
  },
  testCard: {
    backgroundColor: '#1E293B',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#334155',
  },
  testHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  testInfo: {
    flex: 1,
    marginLeft: 12,
  },
  testName: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: '#fff',
    marginBottom: 4,
  },
  testStatus: {
    fontSize: 12,
    fontWeight: '600' as const,
  },
  testMessage: {
    fontSize: 14,
    color: '#94A3B8',
    marginTop: 8,
  },
  detailsContainer: {
    marginTop: 12,
    padding: 12,
    backgroundColor: '#0F172A',
    borderRadius: 8,
  },
  detailsLabel: {
    fontSize: 12,
    fontWeight: '600' as const,
    color: '#64748B',
    marginBottom: 4,
  },
  detailsText: {
    fontSize: 12,
    color: '#94A3B8',
    fontFamily: 'monospace',
  },
  runButton: {
    backgroundColor: '#0EA5E9',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    marginBottom: 24,
  },
  runButtonDisabled: {
    opacity: 0.6,
  },
  buttonLoader: {
    marginRight: 8,
  },
  runButtonText: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: '#fff',
  },
  infoBox: {
    backgroundColor: '#1E293B',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#334155',
  },
  infoTitle: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: '#fff',
    marginBottom: 12,
  },
  infoText: {
    fontSize: 14,
    color: '#94A3B8',
    marginBottom: 8,
    lineHeight: 20,
  },
  linksContainer: {
    backgroundColor: '#1E293B',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#334155',
  },
  linksTitle: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: '#fff',
    marginBottom: 12,
  },
  linkText: {
    fontSize: 12,
    color: '#0EA5E9',
    marginBottom: 8,
    lineHeight: 18,
  },
});
