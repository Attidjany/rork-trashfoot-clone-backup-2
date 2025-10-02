import React, { useState } from 'react';
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
import { Mail, Lock, Eye, EyeOff, Gamepad2 } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { supabase } from '@/lib/supabase';
import { trpc } from '@/lib/trpc';
import { useGameStore } from '@/hooks/use-game-store';

type AuthMode = 'login' | 'signup';

export default function AuthScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { setLoggedInUser } = useGameStore();

  const [mode, setMode] = useState<AuthMode>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const loginMutation = trpc.auth.login.useMutation();

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
        });
        
        if (error) throw error;

        if (data.session) {
          const { data: playerData } = await supabase
            .from('players')
            .select('*')
            .eq('auth_user_id', data.user!.id)
            .single();

          if (playerData && !playerData.name) {
            router.replace({
              pathname: '/complete-profile',
              params: { playerId: playerData.id },
            });
          } else if (playerData) {
            const player = {
              id: playerData.id,
              name: playerData.name,
              gamerHandle: playerData.gamer_handle,
              email: playerData.email,
              role: playerData.role as 'player' | 'admin' | 'super_admin',
              status: playerData.status as 'active' | 'suspended' | 'banned',
              joinedAt: playerData.joined_at,
              stats: {
                played: 0,
                wins: 0,
                draws: 0,
                losses: 0,
                goalsFor: 0,
                goalsAgainst: 0,
                cleanSheets: 0,
                points: 0,
                winRate: 0,
                form: [],
                leaguesWon: 0,
                knockoutsWon: 0,
              },
            };
            setLoggedInUser(player);
            router.replace('/(tabs)/home');
          }
        } else {
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
          const { data: playerData } = await supabase
            .from('players')
            .select('*')
            .eq('auth_user_id', data.user.id)
            .single();

          if (playerData && !playerData.name) {
            router.replace({
              pathname: '/complete-profile',
              params: { playerId: playerData.id },
            });
          } else if (playerData) {
            const loginResult = await loginMutation.mutateAsync({
              email: email.trim(),
              password: password.trim(),
            });

            if (loginResult.user && loginResult.gameData) {
              setLoggedInUser(loginResult.user, loginResult.gameData);
              router.replace('/(tabs)/home');
            }
          }
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
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.authButtonText}>
                    {mode === 'login' ? 'Login' : 'Create Account'}
                  </Text>
                )}
              </TouchableOpacity>

              {mode === 'signup' && (
                <Text style={styles.infoText}>
                  After signing up, you&apos;ll receive a confirmation email. Click the link to verify your account.
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
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#0EA5E9',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  logoText: { fontSize: 24, fontWeight: '700' as const, color: '#fff' },
  tagline: { fontSize: 15, color: '#94A3B8', textAlign: 'center' },
  formContainer: { width: '100%', maxWidth: 400, alignSelf: 'center' },
  modeSelector: {
    flexDirection: 'row',
    backgroundColor: '#1E293B',
    borderRadius: 12,
    padding: 4,
    marginBottom: 24,
  },
  modeButton: { flex: 1, paddingVertical: 12, alignItems: 'center', borderRadius: 8 },
  activeModeButton: { backgroundColor: '#0EA5E9' },
  modeText: { fontSize: 16, fontWeight: '500' as const, color: '#64748B' },
  activeModeText: { color: '#fff' },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1E293B',
    borderRadius: 12,
    marginBottom: 16,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: '#334155',
  },
  inputIcon: { marginRight: 12 },
  input: { flex: 1, paddingVertical: 16, fontSize: 16, color: '#fff' },
  eyeButton: { padding: 4 },
  authButton: {
    backgroundColor: '#0EA5E9',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 8,
  },
  authButtonDisabled: { opacity: 0.6 },
  authButtonText: { fontSize: 16, fontWeight: '600' as const, color: '#fff' },
  infoText: {
    fontSize: 13,
    color: '#64748B',
    textAlign: 'center',
    marginTop: 16,
    lineHeight: 18,
    paddingHorizontal: 8,
  },
});
