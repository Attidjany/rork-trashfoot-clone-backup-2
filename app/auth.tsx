// app/auth.tsx
import React, { useEffect, useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { Mail, Lock, Eye, EyeOff, Gamepad2, LogOut } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { supabase } from '@/lib/supabase';

type AuthMode = 'login' | 'signup';

export default function AuthScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [mode, setMode] = useState<AuthMode>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const [status, setStatus] = useState<string>('Not signed in');

  // Track session (immediate + subscription)
  useEffect(() => {
    let mounted = true;

    (async () => {
      const { data, error } = await supabase.auth.getSession();
      if (!mounted) return;
      if (error) {
        setStatus(`Auth state error: ${error.message}`);
        return;
      }
      if (data.session) {
        const u = data.session.user;
        setStatus(`Signed in as ${u.email ?? u.id}`);
      } else {
        setStatus('Not signed in');
      }
    })();

    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!mounted) return;
      if (session) {
        const u = session.user;
        setStatus(`Signed in as ${u.email ?? u.id}`);
      } else {
        setStatus('Not signed in');
      }
    });

    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  async function handleAuth() {
    if (!email.trim()) {
      Alert.alert('Error', 'Please enter your email');
      return;
    }
    if (!password.trim()) {
      Alert.alert('Error', 'Please enter your password');
      return;
    }
    if (mode === 'signup' && password.length < 6) {
      Alert.alert('Error', 'Password must be at least 6 characters');
      return;
    }

    setIsLoading(true);
    try {
      if (mode === 'signup') {
        const { data, error } = await supabase.auth.signUp({
          email: email.trim(),
          password: password.trim(),
          // If you later re-enable email confirmation in Supabase,
          // you can add: options: { emailRedirectTo: `${window.location.origin}/auth` }
        });
        if (error) throw error;

        if (data.session) {
          // Email confirmation OFF → session present → go to app
          router.replace('/(tabs)/home');
        } else {
          // Email confirmation ON → no session yet
          Alert.alert(
            'Check your email',
            'We sent a confirmation link. Click it, then come back to log in.'
          );
          setMode('login');
        }
      } else {
        const { data, error } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password: password.trim(),
        });
        if (error) throw error;

        if (data.session) {
          router.replace('/(tabs)/home');
        } else {
          Alert.alert('Login', 'Logged in, but no active session returned.');
        }
      }
    } catch (err: any) {
      const msg =
        err?.message ||
        err?.data?.message ||
        (typeof err === 'string' ? err : 'Authentication failed. Please try again.');
      Alert.alert(mode === 'login' ? 'Login Failed' : 'Signup Failed', msg);
    } finally {
      setIsLoading(false);
    }
  }

  async function handleSignOut() {
    setIsLoading(true);
    try {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
      setEmail('');
      setPassword('');
      setMode('login');
      Alert.alert('Signed out', 'You have been signed out.');
    } catch (err: any) {
      Alert.alert('Sign out error', err?.message ?? String(err));
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ headerShown: false }} />

      <LinearGradient
        colors={['#0F172A', '#1E293B']}
        style={[styles.gradient, { paddingTop: insets.top }]}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.keyboardView}
        >
          <ScrollView
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            <View style={styles.logoSection}>
              <View style={styles.logoContainer}>
                <View style={styles.logoIcon}>
                  <Gamepad2 size={32} color="#fff" />
                </View>
                <Text style={styles.logoText}>TrashFoot</Text>
              </View>
              <Text style={styles.tagline}>Track Your Football Matches</Text>
              <Text style={styles.statusText}>{status}</Text>
            </View>

            <View style={styles.formContainer}>
              <View style={styles.modeSelector}>
                <TouchableOpacity
                  style={[styles.modeButton, mode === 'login' && styles.activeModeButton]}
                  onPress={() => setMode('login')}
                  disabled={isLoading}
                >
                  <Text style={[styles.modeText, mode === 'login' && styles.activeModeText]}>
                    Login
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.modeButton, mode === 'signup' && styles.activeModeButton]}
                  onPress={() => setMode('signup')}
                  disabled={isLoading}
                >
                  <Text style={[styles.modeText, mode === 'signup' && styles.activeModeText]}>
                    Sign Up
                  </Text>
                </TouchableOpacity>
              </View>

              <View style={styles.inputContainer}>
                <Mail size={20} color="#64748B" style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  placeholder="Email"
                  placeholderTextColor="#64748B"
                  value={email}
                  onChangeText={setEmail}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoCorrect={false}
                />
              </View>

              <View style={styles.inputContainer}>
                <Lock size={20} color="#64748B" style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  placeholder="Password"
                  placeholderTextColor="#64748B"
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry={!showPassword}
                  autoCapitalize="none"
                />
                <TouchableOpacity
                  style={styles.eyeButton}
                  onPress={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? <EyeOff size={20} color="#64748B" /> : <Eye size={20} color="#64748B" />}
                </TouchableOpacity>
              </View>

              <TouchableOpacity
                style={[styles.authButton, isLoading && styles.authButtonDisabled]}
                onPress={handleAuth}
                disabled={isLoading}
              >
                {isLoading ? (
                  <ActivityIndicator />
                ) : (
                  <Text style={styles.authButtonText}>
                    {mode === 'login' ? 'Login' : 'Create Account'}
                  </Text>
                )}
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.signOutButton]}
                onPress={handleSignOut}
                disabled={isLoading}
              >
                <LogOut size={18} color="#94A3B8" />
                <Text style={styles.signOutText}>Sign out</Text>
              </TouchableOpacity>

              {mode === 'signup' && (
                <Text style={styles.infoText}>
                  If email confirmation is enabled in Supabase, you&apos;ll receive a confirmation email.
                  After confirming, return here and log in.
                </Text>
              )}
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </LinearGradient>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  gradient: { flex: 1 },
  keyboardView: { flex: 1 },
  scrollContent: { flexGrow: 1, justifyContent: 'center', padding: 24 },
  logoSection: { alignItems: 'center', marginBottom: 40 },
  logoContainer: { alignItems: 'center', marginBottom: 16 },
  logoIcon: {
    width: 80, height: 80, borderRadius: 40, backgroundColor: '#0EA5E9',
    justifyContent: 'center', alignItems: 'center', marginBottom: 12,
  },
  logoText: { fontSize: 24, fontWeight: '700' as const, color: '#fff' },
  tagline: { fontSize: 15, color: '#94A3B8', textAlign: 'center' },
  statusText: { marginTop: 8, fontSize: 12, color: '#94A3B8' },
  formContainer: { width: '100%', maxWidth: 400, alignSelf: 'center' },
  modeSelector: {
    flexDirection: 'row', backgroundColor: '#1E293B', borderRadius: 12, padding: 4, marginBottom: 24,
  },
  modeButton: { flex: 1, paddingVertical: 12, alignItems: 'center', borderRadius: 8 },
  activeModeButton: { backgroundColor: '#0EA5E9' },
  modeText: { fontSize: 16, fontWeight: '500' as const, color: '#64748B' },
  activeModeText: { color: '#fff' },
  inputContainer: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: '#1E293B',
    borderRadius: 12, marginBottom: 16, paddingHorizontal: 16, borderWidth: 1, borderColor: '#334155',
  },
  inputIcon: { marginRight: 12 },
  input: { flex: 1, paddingVertical: 16, fontSize: 16, color: '#fff' },
  eyeButton: { padding: 4 },
  authButton: { backgroundColor: '#0EA5E9', borderRadius: 12, paddingVertical: 16, alignItems: 'center', marginTop: 8 },
  authButtonDisabled: { opacity: 0.6 },
  authButtonText: { fontSize: 16, fontWeight: '600' as const, color: '#fff' },
  signOutButton: {
    alignSelf: 'center', flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 16,
    paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8, borderWidth: 1, borderColor: '#334155',
  },
  signOutText: { color: '#94A3B8', marginLeft: 6 },
  infoText: {
    fontSize: 13, color: '#64748B', textAlign: 'center', marginTop: 16, lineHeight: 18, paddingHorizontal: 8,
  },
});
