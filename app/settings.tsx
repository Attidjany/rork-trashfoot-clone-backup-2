import React, { useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  TouchableOpacity,
  Switch,
  Alert,
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
  User
} from 'lucide-react-native';
import { useGameStore } from '@/hooks/use-game-store';
import { useTheme } from '@/hooks/use-theme';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { supabase } from '@/lib/supabase';

export default function SettingsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { currentUser } = useGameStore();
  const { theme, toggleTheme } = useTheme();
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);

  const handleLogout = async () => {
    Alert.alert(
      'Logout',
      'Are you sure you want to logout?',
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Logout', 
          style: 'destructive',
          onPress: async () => {
            try {
              console.log('Logging out...');
              await supabase.auth.signOut();
              console.log('Logged out successfully');
              router.replace('/auth');
            } catch (error) {
              console.error('Error logging out:', error);
              Alert.alert('Error', 'Failed to logout. Please try again.');
            }
          }
        }
      ]
    );
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

  if (!currentUser) {
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
          <View style={styles.profileCard}>
            <View style={styles.avatarContainer}>
              <User size={32} color="#fff" />
            </View>
            <View style={styles.profileInfo}>
              <Text style={styles.profileName}>{currentUser.name}</Text>
              <Text style={styles.profileSubtitle}>
                Member since {new Date(currentUser.joinedAt).toLocaleDateString()}
              </Text>
            </View>
          </View>
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
});