import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Alert,
} from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { 
  Mail, 
  Lock, 
  User, 
  Eye, 
  EyeOff,
  Gamepad2,
  CheckCircle,
  XCircle,
  Loader
} from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useGameStore } from '@/hooks/use-game-store';
import { LinearGradient } from 'expo-linear-gradient';
import { trpc } from '@/lib/trpc';

type AuthMode = 'login' | 'signup';

export default function AuthScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { setLoggedInUser } = useGameStore();
  
  const [mode, setMode] = useState<AuthMode>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [gamerHandle, setGamerHandle] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [handleAvailable, setHandleAvailable] = useState<boolean | null>(null);
  const [handleSuggestions, setHandleSuggestions] = useState<string[]>([]);
  const [checkingHandle, setCheckingHandle] = useState(false);
  
  const loginMutation = trpc.auth.login.useMutation();
  const registerMutation = trpc.auth.register.useMutation();
  


  // Check gamer handle availability with debounce
  useEffect(() => {
    if (mode === 'signup' && gamerHandle.length >= 3) {
      const timeoutId = setTimeout(async () => {
        setCheckingHandle(true);
        try {
          // For now, simulate handle checking
          const takenHandles = ['striker_alex', 'goal_machine', 'football_king', 'super_admin'];
          const isAvailable = !takenHandles.includes(gamerHandle.toLowerCase());
          setHandleAvailable(isAvailable);
          setHandleSuggestions(isAvailable ? [] : [
            `${gamerHandle}1`,
            `${gamerHandle}_pro`,
            `${gamerHandle}2024`,
          ]);
        } catch (error) {
          console.error('Error checking handle:', error);
        } finally {
          setCheckingHandle(false);
        }
      }, 500);
      
      return () => clearTimeout(timeoutId);
    } else {
      setHandleAvailable(null);
      setHandleSuggestions([]);
    }
  }, [gamerHandle, mode]);

  const handleAuth = async () => {
    if (!email.trim()) {
      Alert.alert('Error', 'Please enter your email');
      return;
    }
    if (!password.trim()) {
      Alert.alert('Error', 'Please enter your password');
      return;
    }

    if (mode === 'signup') {
      if (!name.trim()) {
        Alert.alert('Error', 'Please enter your name');
        return;
      }
      if (!gamerHandle.trim()) {
        Alert.alert('Error', 'Please enter a gamer handle');
        return;
      }
      if (handleAvailable === false) {
        Alert.alert('Error', 'Gamer handle is not available');
        return;
      }
    }

    setIsLoading(true);
    console.log('=== AUTH ATTEMPT ===');
    console.log('Mode:', mode);
    console.log('Email:', email.trim());

    try {
      if (mode === 'signup') {
        const result = await registerMutation.mutateAsync({
          name: name.trim(),
          gamerHandle: gamerHandle.trim(),
          email: email.trim(),
          password: password.trim(),
        });
        
        console.log('Signup successful:', result.user.name);
        setLoggedInUser(result.user);
        console.log('Signup successful, navigating to home');
        router.replace('/(tabs)/home');
      } else {
        console.log('Attempting backend login...');
        
        const result = await loginMutation.mutateAsync({
          email: email.trim(),
          password: password.trim(),
        });
        
        console.log('=== LOGIN BACKEND SUCCESS ===');
        console.log('User:', result.user.name);
        console.log('Role:', result.user.role);
        console.log('Has game data:', !!result.gameData);
        console.log('Groups count:', result.gameData?.groups?.length || 0);
        
        if (result.gameData) {
          console.log('Setting logged in user with game data');
          setLoggedInUser(result.user, result.gameData);
        } else {
          console.log('Setting logged in user without game data');
          setLoggedInUser(result.user);
        }
        
        console.log('State set successfully, navigating to home...');
        router.replace('/(tabs)/home');
      }
    } catch (error: any) {
      console.error('=== AUTH ERROR ===');
      console.error('Error type:', typeof error);
      console.error('Error:', error);
      console.error('Error message:', error?.message);
      console.error('Error data:', error?.data);
      console.error('Error shape:', error?.shape);
      
      let errorMessage = 'Authentication failed. Please try again.';
      
      // Handle tRPC errors
      if (error?.shape?.message) {
        errorMessage = error.shape.message;
      } else if (error?.message) {
        errorMessage = error.message;
      } else if (typeof error === 'string') {
        errorMessage = error;
      } else if (error?.data?.message) {
        errorMessage = error.data.message;
      } else {
        errorMessage = 'Authentication failed. Please try again.';
      }
      
      console.error('Final error message:', errorMessage);
      Alert.alert('Authentication Failed', errorMessage);
    } finally {
      setIsLoading(false);
    }
  };



  return (
    <View style={styles.container}>
      <Stack.Screen 
        options={{ 
          headerShown: false,
        }} 
      />
      
      <LinearGradient
        colors={['#0F172A', '#1E293B']}
        style={[styles.gradient, { paddingTop: insets.top }]}
      >
        <ScrollView 
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* Logo Section */}
          <View style={styles.logoSection}>
            <View style={styles.logoContainer}>
              <View style={styles.logoIcon}>
                <Gamepad2 size={32} color="#fff" />
              </View>
              <Text style={styles.logoText}>TrashFoot</Text>
            </View>
            <Text style={styles.tagline}>Track Your Football Matches</Text>
          </View>

          {/* Auth Form */}
          <View style={styles.formContainer}>
            <View style={styles.modeSelector}>
              <TouchableOpacity
                style={[styles.modeButton, mode === 'login' && styles.activeModeButton]}
                onPress={() => setMode('login')}
              >
                <Text style={[styles.modeText, mode === 'login' && styles.activeModeText]}>
                  Login
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modeButton, mode === 'signup' && styles.activeModeButton]}
                onPress={() => setMode('signup')}
              >
                <Text style={[styles.modeText, mode === 'signup' && styles.activeModeText]}>
                  Sign Up
                </Text>
              </TouchableOpacity>
            </View>

            {mode === 'signup' && (
              <>
                <View style={styles.inputContainer}>
                  <User size={20} color="#64748B" style={styles.inputIcon} />
                  <TextInput
                    style={styles.input}
                    placeholder="Full Name"
                    placeholderTextColor="#64748B"
                    value={name}
                    onChangeText={setName}
                    autoCapitalize="words"
                  />
                </View>
                
                <View style={[styles.inputContainer, handleAvailable === false && styles.inputError]}>
                  <Gamepad2 size={20} color="#64748B" style={styles.inputIcon} />
                  <TextInput
                    style={styles.input}
                    placeholder="Gamer Handle (e.g., striker_alex)"
                    placeholderTextColor="#64748B"
                    value={gamerHandle}
                    onChangeText={setGamerHandle}
                    autoCapitalize="none"
                    autoCorrect={false}
                  />
                  {checkingHandle && <Loader size={20} color="#64748B" />}
                  {!checkingHandle && handleAvailable === true && <CheckCircle size={20} color="#10B981" />}
                  {!checkingHandle && handleAvailable === false && <XCircle size={20} color="#EF4444" />}
                </View>
                
                {handleAvailable === false && handleSuggestions.length > 0 && (
                  <View style={styles.suggestionsContainer}>
                    <Text style={styles.suggestionsTitle}>Suggestions:</Text>
                    <View style={styles.suggestionsRow}>
                      {handleSuggestions.map((suggestion, index) => (
                        <TouchableOpacity
                          key={index}
                          style={styles.suggestionChip}
                          onPress={() => setGamerHandle(suggestion)}
                        >
                          <Text style={styles.suggestionText}>{suggestion}</Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </View>
                )}
              </>
            )}

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
                {showPassword ? (
                  <EyeOff size={20} color="#64748B" />
                ) : (
                  <Eye size={20} color="#64748B" />
                )}
              </TouchableOpacity>
            </View>

            <TouchableOpacity
              style={[styles.authButton, isLoading && styles.authButtonDisabled]}
              onPress={handleAuth}
              disabled={isLoading}
            >
              <Text style={styles.authButtonText}>
                {isLoading ? 'Please wait...' : mode === 'login' ? 'Login' : 'Create Account'}
              </Text>
            </TouchableOpacity>

          </View>
        </ScrollView>
      </LinearGradient>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  gradient: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: 24,
  },
  logoSection: {
    alignItems: 'center',
    marginBottom: 48,
  },
  logoContainer: {
    alignItems: 'center',
    marginBottom: 16,
  },
  logoIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#0EA5E9',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  logoText: {
    fontSize: 24,
    fontWeight: '700' as const,
    color: '#fff',
  },
  tagline: {
    fontSize: 16,
    color: '#64748B',
    textAlign: 'center',
  },
  formContainer: {
    width: '100%',
    maxWidth: 400,
    alignSelf: 'center',
  },
  modeSelector: {
    flexDirection: 'row',
    backgroundColor: '#1E293B',
    borderRadius: 12,
    padding: 4,
    marginBottom: 24,
  },
  modeButton: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    borderRadius: 8,
  },
  activeModeButton: {
    backgroundColor: '#0EA5E9',
  },
  modeText: {
    fontSize: 16,
    fontWeight: '500' as const,
    color: '#64748B',
  },
  activeModeText: {
    color: '#fff',
  },
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
  inputIcon: {
    marginRight: 12,
  },
  input: {
    flex: 1,
    paddingVertical: 16,
    fontSize: 16,
    color: '#fff',
  },
  eyeButton: {
    padding: 4,
  },
  authButton: {
    backgroundColor: '#0EA5E9',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 8,
  },
  authButtonDisabled: {
    opacity: 0.6,
  },
  authButtonText: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: '#fff',
  },
  forgotPassword: {
    alignItems: 'center',
    marginTop: 16,
  },
  forgotPasswordText: {
    fontSize: 14,
    color: '#0EA5E9',
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 32,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#334155',
  },
  dividerText: {
    fontSize: 14,
    color: '#64748B',
    marginHorizontal: 16,
  },
  socialButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  socialButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#1E293B',
    borderRadius: 12,
    paddingVertical: 16,
    borderWidth: 1,
    borderColor: '#334155',
  },
  socialButtonText: {
    fontSize: 16,
    fontWeight: '500' as const,
    color: '#fff',
    marginLeft: 8,
  },
  guestButton: {
    alignItems: 'center',
    marginTop: 24,
    paddingVertical: 16,
  },
  guestButtonText: {
    fontSize: 16,
    color: '#64748B',
    textDecorationLine: 'underline',
  },
  inputError: {
    borderColor: '#EF4444',
  },
  suggestionsContainer: {
    marginBottom: 16,
  },
  suggestionsTitle: {
    fontSize: 14,
    color: '#64748B',
    marginBottom: 8,
  },
  suggestionsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  suggestionChip: {
    backgroundColor: '#1E293B',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#334155',
  },
  suggestionText: {
    fontSize: 14,
    color: '#0EA5E9',
  },
  demoCredentials: {
    marginTop: 24,
    padding: 16,
    backgroundColor: '#1E293B',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#334155',
  },
  demoTitle: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: '#0EA5E9',
    marginBottom: 12,
  },
  demoAccount: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: '#0F172A',
    borderRadius: 8,
    marginBottom: 8,
  },
  demoAccountText: {
    fontSize: 14,
    fontWeight: '500' as const,
    color: '#fff',
    marginBottom: 2,
  },
  demoCredText: {
    fontSize: 12,
    color: '#64748B',
  },
  loginMethodSelector: {
    flexDirection: 'row',
    backgroundColor: '#1E293B',
    borderRadius: 12,
    padding: 4,
    marginBottom: 16,
    gap: 4,
  },
  methodButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: 8,
    gap: 6,
  },
  activeMethodButton: {
    backgroundColor: '#0EA5E9',
  },
  methodText: {
    fontSize: 14,
    fontWeight: '500' as const,
    color: '#64748B',
  },
  activeMethodText: {
    color: '#fff',
  },
  phoneIcon: {
    fontSize: 20,
    marginRight: 12,
  },
});