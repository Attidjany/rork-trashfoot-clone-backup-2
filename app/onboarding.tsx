import React from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  Image,
  ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Zap } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useGameStore } from '@/hooks/use-game-store';

export default function OnboardingScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { createUser, isLoading, currentUser, isHydrated } = useGameStore();
  
  // Redirect to home if user is already logged in
  React.useEffect(() => {
    if (isHydrated && !isLoading) {
      if (currentUser) {
        console.log('User already logged in, redirecting to home:', currentUser.name, currentUser.email);
        router.replace('/(tabs)/home');
      } else {
        console.log('No user found, staying on onboarding');
      }
    }
  }, [isHydrated, isLoading, currentUser, router]);
  
  // Show loading while game store is initializing
  if (!isHydrated || isLoading) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <View style={styles.content}>
          <ActivityIndicator size="large" color="#0EA5E9" />
        </View>
      </View>
    );
  }
  
  // Don't render if user is logged in (will redirect)
  if (currentUser) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <View style={styles.content}>
          <ActivityIndicator size="large" color="#0EA5E9" />
        </View>
      </View>
    );
  }

  return (
    <LinearGradient
      colors={['#0F172A', '#1E293B']}
      style={[styles.container, { paddingTop: insets.top }]}
    >
      <KeyboardAvoidingView 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.content}
      >
        <View style={styles.header}>
          <View style={styles.logoContainer}>
            <View style={styles.logoBackground}>
              <Image 
                source={{ uri: 'https://pub-e001eb4506b145aa938b5d3badbff6a5.r2.dev/attachments/dkoszgl4rjlspyie5nwrv' }}
                style={styles.logoImage}
                resizeMode="contain"
              />
            </View>
          </View>
          
          <Text style={styles.title}>TrashFoot</Text>
          <Text style={styles.subtitle}>
            Track matches, compete with friends, and dominate the leaderboard
          </Text>
        </View>

        <View style={styles.features}>
          <View style={styles.feature}>
            <Zap size={20} color="#0EA5E9" />
            <Text style={styles.featureText}>Live match tracking</Text>
          </View>
          <View style={styles.feature}>
            <Zap size={20} color="#8B5CF6" />
            <Text style={styles.featureText}>Head-to-head statistics</Text>
          </View>
          <View style={styles.feature}>
            <Zap size={20} color="#10B981" />
            <Text style={styles.featureText}>Group competitions</Text>
          </View>
        </View>

        <View style={styles.form}>
          <TouchableOpacity
            style={styles.button}
            onPress={() => router.push('/auth?mode=login')}
          >
            <LinearGradient
              colors={['#0EA5E9', '#8B5CF6']}
              style={styles.buttonGradient}
            >
              <Text style={styles.buttonText}>Login</Text>
            </LinearGradient>
          </TouchableOpacity>
          
          <TouchableOpacity
            style={styles.quickButton}
            onPress={() => router.push('/auth?mode=signup')}
          >
            <Text style={styles.quickButtonText}>Sign Up</Text>
          </TouchableOpacity>
          
          <TouchableOpacity
            style={[styles.quickButton, { marginTop: 8 }]}
            onPress={() => {
              createUser('Demo User', 'demo_user');
              router.replace('/(tabs)/home');
            }}
          >
            <Text style={styles.quickButtonText}>Quick Demo</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    padding: 24,
  },
  header: {
    alignItems: 'center',
    marginBottom: 40,
  },
  logoContainer: {
    marginBottom: 24,
  },
  logoBackground: {
    width: 100,
    height: 100,
    borderRadius: 24,
    backgroundColor: '#0F172A',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  logoImage: {
    width: '100%',
    height: '100%',
  },
  title: {
    fontSize: 32,
    fontWeight: '700' as const,
    color: '#fff',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#64748B',
    textAlign: 'center',
    paddingHorizontal: 20,
  },
  features: {
    marginBottom: 40,
  },
  feature: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  featureText: {
    fontSize: 14,
    color: '#fff',
    marginLeft: 12,
  },
  form: {
    width: '100%',
  },
  inputLabel: {
    fontSize: 14,
    color: '#64748B',
    marginBottom: 8,
  },
  input: {
    backgroundColor: '#1E293B',
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    color: '#fff',
    marginBottom: 24,
  },
  button: {
    borderRadius: 12,
    overflow: 'hidden',
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  buttonGradient: {
    paddingVertical: 16,
    alignItems: 'center',
  },
  buttonText: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: '#fff',
  },
  quickButton: {
    marginTop: 16,
    paddingVertical: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#334155',
    borderRadius: 12,
  },
  quickButtonText: {
    fontSize: 16,
    fontWeight: '500' as const,
    color: '#64748B',
  },
});