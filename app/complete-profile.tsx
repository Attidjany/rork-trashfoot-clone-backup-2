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
import { Stack, useRouter, useLocalSearchParams } from 'expo-router';
import { User, Gamepad2 } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { trpc } from '@/lib/trpc';
import { useGameStore } from '@/hooks/use-game-store';

export default function CompleteProfileScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ playerId: string }>();
  const { setLoggedInUser } = useGameStore();

  const [name, setName] = useState('');
  const [gamerHandle, setGamerHandle] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const updateProfileMutation = trpc.auth.updateProfile.useMutation();
  const checkHandleMutation = trpc.auth.checkGamerHandle.useMutation();

  async function handleComplete() {
    if (!name.trim()) {
      Alert.alert('Error', 'Please enter your name');
      return;
    }
    if (!gamerHandle.trim()) {
      Alert.alert('Error', 'Please enter your gamer handle');
      return;
    }
    if (gamerHandle.length < 3) {
      Alert.alert('Error', 'Gamer handle must be at least 3 characters');
      return;
    }
    if (gamerHandle.length > 20) {
      Alert.alert('Error', 'Gamer handle must be less than 20 characters');
      return;
    }

    setIsLoading(true);
    try {
      const handleCheck = await checkHandleMutation.mutateAsync({
        gamerHandle: gamerHandle.trim(),
      });

      if (!handleCheck.available) {
        Alert.alert('Error', 'This gamer handle is already taken. Please choose another one.');
        setIsLoading(false);
        return;
      }

      const result = await updateProfileMutation.mutateAsync({
        userId: params.playerId,
        name: name.trim(),
        gamerHandle: gamerHandle.trim(),
      });

      if (result.success && result.player) {
        const player = {
          id: result.player.id,
          name: result.player.name,
          gamerHandle: result.player.gamerHandle,
          email: result.player.email,
          role: 'player' as const,
          status: 'active' as const,
          joinedAt: new Date().toISOString(),
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
    } catch (err: any) {
      const msg = err?.message || 'Failed to update profile. Please try again.';
      Alert.alert('Error', msg);
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
                <Text style={styles.logoText}>Complete Your Profile</Text>
              </View>
              <Text style={styles.tagline}>
                Choose your name and gamer handle to get started
              </Text>
            </View>

            <View style={styles.formContainer}>
              <View style={styles.inputContainer}>
                <User size={20} color="#64748B" style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  placeholder="Your Name"
                  placeholderTextColor="#64748B"
                  value={name}
                  onChangeText={setName}
                  autoCapitalize="words"
                  autoCorrect={false}
                />
              </View>

              <View style={styles.inputContainer}>
                <Gamepad2 size={20} color="#64748B" style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  placeholder="Gamer Handle"
                  placeholderTextColor="#64748B"
                  value={gamerHandle}
                  onChangeText={setGamerHandle}
                  autoCapitalize="none"
                  autoCorrect={false}
                />
              </View>

              <Text style={styles.helperText}>
                Your gamer handle will be visible to other players. Choose wisely!
              </Text>

              <TouchableOpacity
                style={[styles.completeButton, isLoading && styles.completeButtonDisabled]}
                onPress={handleComplete}
                disabled={isLoading}
              >
                {isLoading ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.completeButtonText}>Complete Profile</Text>
                )}
              </TouchableOpacity>
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
  tagline: { fontSize: 15, color: '#94A3B8', textAlign: 'center', paddingHorizontal: 32 },
  formContainer: { width: '100%', maxWidth: 400, alignSelf: 'center' },
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
  helperText: {
    fontSize: 13,
    color: '#64748B',
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 18,
  },
  completeButton: {
    backgroundColor: '#0EA5E9',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
  },
  completeButtonDisabled: { opacity: 0.6 },
  completeButtonText: { fontSize: 16, fontWeight: '600' as const, color: '#fff' },
});
