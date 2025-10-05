import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  TouchableOpacity,
  Switch,
  Alert,
  TextInput,
  Modal,
  Platform,
} from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { 
  Bell, 
  Shield, 
  Moon, 
  Globe, 
  HelpCircle, 
  Info, 
  ChevronRight,
  Trash2,
  LogOut,
  User,
  Edit2,
  CheckCircle,
  XCircle,
  Loader
} from 'lucide-react-native';
import { useGameStore } from '@/hooks/use-game-store';
import { useTheme } from '@/hooks/use-theme';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { supabase } from '@/lib/supabase';
import { trpc } from '@/lib/trpc';
import { useSession } from '@/hooks/use-session';
import { useRealtimeGroups } from '@/hooks/use-realtime-groups';

export default function SettingsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { currentUser, updateProfile, activeGroupId } = useGameStore();
  const { theme, toggleTheme } = useTheme();
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const [editProfileModal, setEditProfileModal] = useState(false);
  const [editName, setEditName] = useState('');
  const [editGamerHandle, setEditGamerHandle] = useState('');
  const [handleAvailable, setHandleAvailable] = useState<boolean | null>(null);
  const [handleSuggestions, setHandleSuggestions] = useState<string[]>([]);
  const [checkingHandle, setCheckingHandle] = useState(false);
  const [isUpdatingProfile, setIsUpdatingProfile] = useState(false);
  
  const { user } = useSession();
  const { groups, refetch: refetchGroups } = useRealtimeGroups();
  const checkHandleMutation = trpc.auth.checkGamerHandle.useMutation();
  
  const activeGroup = groups.find(g => g.id === activeGroupId) || groups[0] || null;
  const currentPlayer = activeGroup?.members.find(m => m.email === user?.email);

  useEffect(() => {
    if (editProfileModal) {
      const fallbackName = currentPlayer?.name ?? currentUser?.name ?? (user?.email ? user.email.split('@')[0] : 'Player');
      const fallbackHandle = currentPlayer?.gamerHandle ?? currentUser?.gamerHandle ?? fallbackName;
      setEditName(currentPlayer?.name ?? fallbackName);
      setEditGamerHandle(currentPlayer?.gamerHandle ?? fallbackHandle);
    }
  }, [editProfileModal, currentPlayer, currentUser, user]);

  useEffect(() => {
    const baseline = currentPlayer?.gamerHandle ?? currentUser?.gamerHandle ?? '';
    if (editProfileModal && editGamerHandle.length >= 3 && editGamerHandle !== baseline) {
      const timeoutId = setTimeout(async () => {
        setCheckingHandle(true);
        try {
          const result = await checkHandleMutation.mutateAsync({
            gamerHandle: editGamerHandle.trim(),
          });
          setHandleAvailable(result.available);
          setHandleSuggestions(result.available ? [] : result.suggestions || []);
        } catch (error) {
          console.error('Error checking handle:', error);
          setHandleAvailable(null);
          setHandleSuggestions([]);
        } finally {
          setCheckingHandle(false);
        }
      }, 500);
      return () => clearTimeout(timeoutId);
    } else {
      setHandleAvailable(null);
      setHandleSuggestions([]);
    }
  }, [editGamerHandle, editProfileModal, currentPlayer, currentUser, checkHandleMutation]);

  const handleUpdateProfile = async () => {
    if (!editName.trim()) {
      Alert.alert('Error', 'Please enter your name');
      return;
    }
    if (!editGamerHandle.trim()) {
      Alert.alert('Error', 'Please enter a gamer handle');
      return;
    }
    const baseline = currentPlayer?.gamerHandle ?? currentUser?.gamerHandle ?? '';
    if (editGamerHandle !== baseline && handleAvailable === false) {
      Alert.alert('Error', 'Gamer handle is not available');
      return;
    }

    setIsUpdatingProfile(true);
    try {
      console.log('🔄 Updating profile...');
      const result = await updateProfile(editName.trim(), editGamerHandle.trim());

      console.log('✅ Profile update result:', result);

      if (result.success) {
        console.log('🔄 Refetching groups to get updated player data...');
        await refetchGroups();
        
        Alert.alert('Success', 'Profile updated successfully!');
        setEditProfileModal(false);
        setEditName('');
        setEditGamerHandle('');
        setHandleAvailable(null);
        setHandleSuggestions([]);
      }
    } catch (error: any) {
      console.error('❌ Profile update error:', error);
      Alert.alert('Error', error?.message || 'Failed to update profile');
    } finally {
      setIsUpdatingProfile(false);
    }
  };

  const handleLogout = () => {
    const performLogout = async () => {
      try {
        console.log('Logging out...');
        await supabase.auth.signOut();
        console.log('Logged out successfully');
        router.replace('/auth');
      } catch (error) {
        console.error('Error logging out:', error);
        Alert.alert('Error', 'Failed to logout. Please try again.');
      }
    };

    if (Platform.OS === 'web') {
      if (window.confirm('Are you sure you want to logout?')) {
        performLogout();
      }
    } else {
      Alert.alert(
        'Logout',
        'Are you sure you want to logout?',
        [
          { text: 'Cancel', style: 'cancel' },
          { 
            text: 'Logout', 
            style: 'destructive',
            onPress: performLogout
          }
        ]
      );
    }
  };

  const handleDeleteAccount = () => {
    Alert.alert(
      'Delete Account',
      'This action cannot be undone. All your data will be permanently deleted.',
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Delete', 
          style: 'destructive',
          onPress: async () => {
            try {
              console.log('Deleting account...');
              await supabase.auth.signOut();
              Alert.alert('Account Deleted', 'Your account has been deleted.');
              router.replace('/auth');
            } catch (error) {
              console.error('Error deleting account:', error);
              Alert.alert('Error', 'Failed to delete account. Please try again.');
            }
          }
        }
      ]
    );
  };

  const SettingItem = ({ 
    icon: Icon, 
    title, 
    subtitle, 
    onPress, 
    rightElement,
    color = '#fff'
  }: {
    icon: any;
    title: string;
    subtitle?: string;
    onPress?: () => void;
    rightElement?: React.ReactNode;
    color?: string;
  }) => (
    <TouchableOpacity 
      style={styles.settingItem} 
      onPress={onPress}
      disabled={!onPress}
    >
      <View style={styles.settingLeft}>
        <Icon size={24} color={color} />
        <View style={styles.settingText}>
          <Text style={[styles.settingTitle, { color }]}>{title}</Text>
          {subtitle && <Text style={styles.settingSubtitle}>{subtitle}</Text>}
        </View>
      </View>
      {rightElement || (onPress && <ChevronRight size={20} color="#64748B" />)}
    </TouchableOpacity>
  );

  if (!user) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <Stack.Screen options={{ title: 'Settings' }} />
        <View style={styles.emptyContainer}>
          <User size={64} color="#64748B" />
          <Text style={styles.emptyTitle}>Please login to access settings</Text>
          <TouchableOpacity 
            style={styles.primaryButton}
            onPress={() => router.replace('/auth')}
          >
            <Text style={styles.primaryButtonText}>Login</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  const displayName = currentPlayer?.name ?? currentUser?.name ?? (user?.email ? user.email.split('@')[0] : 'Player');
  const displayHandle = currentPlayer?.gamerHandle ?? currentUser?.gamerHandle ?? displayName;

  return (
    <View style={styles.container}>
      <Stack.Screen 
        options={{ 
          title: 'Settings',
          headerStyle: { backgroundColor: '#0F172A' },
          headerTintColor: '#fff',
        }} 
      />
      
      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Profile Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Profile</Text>
          <TouchableOpacity 
            style={styles.profileCard}
            onPress={() => setEditProfileModal(true)}
          >
            <View style={styles.avatarContainer}>
              <User size={32} color="#fff" />
            </View>
            <View style={styles.profileInfo}>
              <Text style={styles.profileName}>{displayName}</Text>
              <Text style={styles.profileSubtitle}>
                @{displayHandle}
              </Text>
            </View>
            <Edit2 size={20} color="#0EA5E9" />
          </TouchableOpacity>
        </View>

        {/* Preferences */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Preferences</Text>
          <View style={styles.settingsGroup}>
            <SettingItem
              icon={Bell}
              title="Notifications"
              subtitle="Match updates and group activity"
              rightElement={
                <Switch
                  value={notificationsEnabled}
                  onValueChange={setNotificationsEnabled}
                  trackColor={{ false: '#374151', true: '#0EA5E9' }}
                  thumbColor={notificationsEnabled ? '#fff' : '#9CA3AF'}
                />
              }
            />
            <SettingItem
              icon={Moon}
              title="Dark Mode"
              subtitle="App appearance"
              rightElement={
                <Switch
                  value={theme === 'dark'}
                  onValueChange={toggleTheme}
                  trackColor={{ false: '#374151', true: '#0EA5E9' }}
                  thumbColor={theme === 'dark' ? '#fff' : '#9CA3AF'}
                />
              }
            />
            <SettingItem
              icon={Globe}
              title="Language"
              subtitle="English"
              onPress={() => Alert.alert('Coming Soon', 'Language settings will be available in a future update.')}
            />
          </View>
        </View>

        {/* Privacy & Security */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Privacy & Security</Text>
          <View style={styles.settingsGroup}>
            <SettingItem
              icon={Shield}
              title="Privacy Policy"
              onPress={() => Alert.alert('Privacy Policy', 'Privacy policy content would be displayed here.')}
            />
            <SettingItem
              icon={Shield}
              title="Terms of Service"
              onPress={() => Alert.alert('Terms of Service', 'Terms of service content would be displayed here.')}
            />
          </View>
        </View>

        {/* Support */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Support</Text>
          <View style={styles.settingsGroup}>
            <SettingItem
              icon={HelpCircle}
              title="Help Center"
              onPress={() => Alert.alert('Help Center', 'Help documentation would be available here.')}
            />
            <SettingItem
              icon={Info}
              title="About"
              subtitle="Version 1.0.0"
              onPress={() => Alert.alert('About TrashFoot', 'A competition tracking app for football players.\n\nVersion 1.0.0\nBuilt with React Native & Expo')}
            />
          </View>
        </View>

        {/* Admin Access */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Administration</Text>
          <View style={styles.settingsGroup}>
            <SettingItem
              icon={Shield}
              title="Super Admin Login"
              subtitle="Platform administration access"
              onPress={() => router.push('/super-admin-login')}
              color="#F59E0B"
            />
          </View>
        </View>

        {/* Danger Zone */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Account</Text>
          <View style={styles.settingsGroup}>
            <SettingItem
              icon={LogOut}
              title="Logout"
              onPress={handleLogout}
              color="#F59E0B"
            />
            <SettingItem
              icon={Trash2}
              title="Delete Account"
              subtitle="Permanently delete your account and data"
              onPress={handleDeleteAccount}
              color="#EF4444"
            />
          </View>
        </View>
      </ScrollView>

      {/* Edit Profile Modal */}
      <Modal
        visible={editProfileModal}
        transparent
        animationType="slide"
        onRequestClose={() => setEditProfileModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Edit Profile</Text>

            <TextInput
              style={styles.input}
              value={editName}
              onChangeText={setEditName}
              placeholder="Full Name"
              placeholderTextColor="#64748B"
              autoCapitalize="words"
            />

            <View
              style={[
                styles.handleInputContainer,
                handleAvailable === false && styles.inputError,
              ]}
            >
              <TextInput
                style={styles.handleInput}
                value={editGamerHandle}
                onChangeText={setEditGamerHandle}
                placeholder="Gamer Handle"
                placeholderTextColor="#64748B"
                autoCapitalize="none"
                autoCorrect={false}
              />
              {checkingHandle && <Loader size={20} color="#64748B" />}
              {!checkingHandle &&
                editGamerHandle !== (currentPlayer?.gamerHandle ?? currentUser?.gamerHandle ?? '') &&
                handleAvailable === true && <CheckCircle size={20} color="#10B981" />}
              {!checkingHandle &&
                editGamerHandle !== (currentPlayer?.gamerHandle ?? currentUser?.gamerHandle ?? '') &&
                handleAvailable === false && <XCircle size={20} color="#EF4444" />}
            </View>

            {handleAvailable === false && handleSuggestions.length > 0 && (
              <View style={styles.suggestionsContainer}>
                <Text style={styles.suggestionsTitle}>Suggestions:</Text>
                <View style={styles.suggestionsRow}>
                  {handleSuggestions.map((suggestion, index) => (
                    <TouchableOpacity
                      key={index}
                      style={styles.suggestionChip}
                      onPress={() => setEditGamerHandle(suggestion)}
                    >
                      <Text style={styles.suggestionText}>{suggestion}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            )}

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.cancelButton}
                onPress={() => {
                  setEditProfileModal(false);
                  setEditName('');
                  setEditGamerHandle('');
                }}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.submitButton}
                onPress={handleUpdateProfile}
                disabled={isUpdatingProfile}
              >
                <Text style={styles.submitButtonText}>
                  {isUpdatingProfile ? 'Saving...' : 'Save'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0F172A',
  },
  content: {
    flex: 1,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600' as const,
    color: '#fff',
    marginTop: 16,
    textAlign: 'center',
  },
  primaryButton: {
    backgroundColor: '#0EA5E9',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
    marginTop: 24,
  },
  primaryButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600' as const,
  },
  section: {
    marginBottom: 32,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600' as const,
    color: '#fff',
    marginBottom: 16,
    paddingHorizontal: 16,
  },
  profileCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1E293B',
    marginHorizontal: 16,
    padding: 16,
    borderRadius: 12,
    gap: 12,
  },
  avatarContainer: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#0EA5E9',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  profileInfo: {
    flex: 1,
  },
  profileName: {
    fontSize: 18,
    fontWeight: '600' as const,
    color: '#fff',
    marginBottom: 4,
  },
  profileSubtitle: {
    fontSize: 14,
    color: '#64748B',
  },
  settingsGroup: {
    backgroundColor: '#1E293B',
    marginHorizontal: 16,
    borderRadius: 12,
    overflow: 'hidden',
  },
  settingItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#334155',
  },
  settingLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  settingText: {
    marginLeft: 16,
    flex: 1,
  },
  settingTitle: {
    fontSize: 16,
    fontWeight: '500' as const,
    color: '#fff',
    marginBottom: 2,
  },
  settingSubtitle: {
    fontSize: 14,
    color: '#64748B',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    justifyContent: 'center',
    padding: 20,
  },
  modalContent: {
    backgroundColor: '#1E293B',
    borderRadius: 16,
    padding: 24,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '600' as const,
    color: '#fff',
    marginBottom: 24,
    textAlign: 'center',
  },
  input: {
    backgroundColor: '#0F172A',
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    color: '#fff',
    marginBottom: 16,
  },
  handleInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0F172A',
    borderRadius: 12,
    paddingHorizontal: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#334155',
  },
  handleInput: {
    flex: 1,
    paddingVertical: 16,
    fontSize: 16,
    color: '#fff',
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
    backgroundColor: '#0F172A',
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
  modalActions: {
    flexDirection: 'row',
    gap: 12,
  },
  cancelButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: '#334155',
    alignItems: 'center',
  },
  cancelButtonText: {
    fontSize: 16,
    color: '#fff',
    fontWeight: '500' as const,
  },
  submitButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: '#0EA5E9',
    alignItems: 'center',
  },
  submitButtonText: {
    fontSize: 16,
    color: '#fff',
    fontWeight: '600' as const,
  },
});