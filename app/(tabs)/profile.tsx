import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Modal,
  Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import {
  User,
  Users,
  Plus,
  LogOut,
  Settings,
  ChevronRight,
  Search,
  Edit2,
  CheckCircle,
  XCircle,
  Loader,
} from 'lucide-react-native';
import { useGameStore } from '@/hooks/use-game-store';
import { LinearGradient } from 'expo-linear-gradient';
import { AchievementBadges } from '@/components/AchievementBadges';
import { trpc } from '@/lib/trpc';
import { useSession } from '@/hooks/use-session';
import { useRealtimeGroups } from '@/hooks/use-realtime-groups';
import { supabase } from '@/lib/supabase';

export default function ProfileScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const {
    currentUser,
    setLoggedInUser,
    setActiveGroupId,
    activeGroupId,
    logout: logoutFromStore,
  } = useGameStore();

  const { user, loading } = useSession();
  const signedIn = !!user;
  
  const { groups, isLoading: groupsLoading } = useRealtimeGroups(user?.id);
  const activeGroup = groups.find(g => g.id === activeGroupId) || groups[0] || null;

  const [createGroupModal, setCreateGroupModal] = useState(false);
  const [joinGroupModal, setJoinGroupModal] = useState(false);
  const [editProfileModal, setEditProfileModal] = useState(false);
  const [groupName, setGroupName] = useState('');
  const [groupDescription, setGroupDescription] = useState('');
  const [groupCode, setGroupCode] = useState('');
  const [editName, setEditName] = useState('');
  const [editGamerHandle, setEditGamerHandle] = useState('');
  const [handleAvailable, setHandleAvailable] = useState<boolean | null>(null);
  const [handleSuggestions, setHandleSuggestions] = useState<string[]>([]);
  const [checkingHandle, setCheckingHandle] = useState(false);

  const checkHandleMutation = trpc.auth.checkGamerHandle.useMutation();
  const updateProfileMutation = trpc.auth.updateProfile.useMutation();
  const joinGroupMutation = trpc.groups.join.useMutation();

  const currentPlayer = activeGroup?.members.find(m => m.email === user?.email);
  
  const fallbackName =
    currentPlayer?.name ??
    currentUser?.name ??
    (user?.email ? user.email.split('@')[0] : 'Player');
  const fallbackHandle = currentPlayer?.gamerHandle ?? currentUser?.gamerHandle ?? fallbackName;

  const stats = currentPlayer?.stats ?? currentUser?.stats ?? {
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
  };

  const joinedAt =
    currentPlayer?.joinedAt ??
    currentUser?.joinedAt ??
    (user?.created_at ? user.created_at : new Date().toISOString());

  useEffect(() => {
    if (editProfileModal) {
      setEditName(currentPlayer?.name ?? fallbackName);
      setEditGamerHandle(currentPlayer?.gamerHandle ?? fallbackHandle);
    }
  }, [editProfileModal, currentPlayer, fallbackName, fallbackHandle]);

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

  if (loading || groupsLoading) {
    return (
      <View style={[styles.emptyContainer, { paddingTop: insets.top }]}>
        <User size={64} color="#64748B" />
        <Text style={styles.emptyTitle}>Loading…</Text>
      </View>
    );
  }

  if (!signedIn) {
    return (
      <View style={[styles.emptyContainer, { paddingTop: insets.top }]}>
        <User size={64} color="#64748B" />
        <Text style={styles.emptyTitle}>Not Logged In</Text>
        <TouchableOpacity
          style={styles.primaryButton}
          onPress={() => router.replace('/auth')}
        >
          <Text style={styles.primaryButtonText}>Go to Login</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const handleCreateGroup = async () => {
    if (!groupName.trim()) {
      Alert.alert('Error', 'Please enter a group name');
      return;
    }
    
    if (!user) {
      Alert.alert('Error', 'User not authenticated');
      return;
    }

    try {
      console.log('🔄 Creating group:', groupName);
      
      const { data: player } = await supabase
        .from('players')
        .select('id')
        .eq('auth_user_id', user.id)
        .single();

      if (!player) {
        Alert.alert('Error', 'Player not found');
        return;
      }

      const inviteCode = Math.random().toString(36).substr(2, 8).toUpperCase();

      const { data: group, error: groupError } = await supabase
        .from('groups')
        .insert({
          name: groupName.trim(),
          description: groupDescription.trim() || '',
          admin_id: player.id,
          invite_code: inviteCode,
          is_public: true,
        })
        .select()
        .single();

      if (groupError || !group) {
        console.error('Error creating group:', groupError);
        Alert.alert('Error', 'Failed to create group');
        return;
      }

      const { error: memberError } = await supabase
        .from('group_members')
        .insert({
          group_id: group.id,
          player_id: player.id,
          is_admin: true,
        });

      if (memberError) {
        console.error('Error adding member:', memberError);
        Alert.alert('Error', 'Failed to add member to group');
        return;
      }

      await supabase
        .from('player_stats')
        .insert({
          player_id: player.id,
          group_id: group.id,
        });

      console.log('✅ Group created:', group.name);
      Alert.alert('Success', `Group "${group.name}" created!\n\nInvite Code: ${group.invite_code}`);
      setCreateGroupModal(false);
      setGroupName('');
      setGroupDescription('');
      setActiveGroupId(group.id);
    } catch (error: any) {
      console.error('❌ Error creating group:', error);
      Alert.alert('Error', error?.message || 'Failed to create group');
    }
  };

  const handleJoinGroup = async () => {
    if (!groupCode.trim()) {
      Alert.alert('Error', 'Please enter a group code');
      return;
    }

    try {
      console.log('🔄 Joining group with code:', groupCode.trim().toUpperCase());
      const result = await joinGroupMutation.mutateAsync({
        inviteCode: groupCode.trim().toUpperCase(),
      });

      console.log('✅ Join group result:', result);

      if (result.success) {
        if (result.alreadyMember) {
          Alert.alert('Already a Member', `You are already a member of "${result.group.name}"`);
        } else {
          Alert.alert('Success', `Successfully joined "${result.group.name}"!`);
        }
        setJoinGroupModal(false);
        setGroupCode('');
        console.log('🔄 Setting active group ID:', result.group.id);
        setActiveGroupId(result.group.id);
      }
    } catch (error: any) {
      console.error('❌ Error joining group:', error);
      Alert.alert('Error', error?.message || 'Failed to join group');
    }
  };

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

    try {
      console.log('🔄 Updating profile...');
      const result = await updateProfileMutation.mutateAsync({
        name: editName.trim(),
        gamerHandle: editGamerHandle.trim(),
      });

      console.log('✅ Profile update result:', result);

      if (result.success && result.player) {
        if (currentUser) {
          const updatedPlayer = {
            ...currentUser,
            name: result.player.name,
            gamerHandle: result.player.gamerHandle,
            email: result.player.email,
          };
          console.log('🔄 Updating game store with new player data:', updatedPlayer);
          setLoggedInUser(updatedPlayer);
        }
        
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
    }
  };

  const handleLogout = async () => {
    Alert.alert(
      'Logout',
      'Are you sure you want to logout?',
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Logout',
          style: 'destructive',
          onPress: async () => {
            try {
              console.log('🔓 Logging out...');
              
              const { error } = await supabase.auth.signOut();
              if (error) {
                console.error('❌ Supabase signOut error:', error);
                throw error;
              }
              
              await logoutFromStore();
              console.log('✅ Logged out successfully');
              
              setTimeout(() => {
                router.replace('/auth');
              }, 100);
            } catch (e: any) {
              console.error('❌ Logout error:', e);
              Alert.alert('Logout error', e?.message ?? String(e));
            }
          },
        },
      ]
    );
  };

  return (
    <ScrollView style={[styles.container, { paddingTop: insets.top }]}>
      <LinearGradient
        colors={['#0EA5E9', '#8B5CF6']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.profileHeader}
      >
        <View style={styles.avatarContainer}>
          <User size={48} color="#fff" />
        </View>

        <View style={styles.profileNameContainer}>
          <Text style={styles.userName}>@{currentPlayer?.gamerHandle ?? fallbackHandle}</Text>
          <Text style={styles.userFullName}>{currentPlayer?.name ?? fallbackName}</Text>

          <Text style={{ color: 'rgba(255,255,255,0.8)', marginTop: 6 }}>
            {user?.email ? `Signed in as ${user.email}` : 'Signed in'}
          </Text>

          <TouchableOpacity
            style={styles.editProfileButton}
            onPress={() => setEditProfileModal(true)}
          >
            <Edit2 size={14} color="#fff" />
            <Text style={styles.editProfileText}>Edit Profile</Text>
          </TouchableOpacity>
        </View>

        <AchievementBadges
          leaguesWon={stats.leaguesWon}
          knockoutsWon={stats.knockoutsWon}
          size="large"
          style={styles.profileBadges}
        />
        <Text style={styles.joinDate}>
          Member since {new Date(joinedAt).toLocaleDateString()}
        </Text>
      </LinearGradient>

      <View style={styles.statsCard}>
        <Text style={styles.sectionTitle}>Overall Statistics</Text>
        <View style={styles.statsGrid}>
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{stats.played}</Text>
            <Text style={styles.statLabel}>Matches</Text>
          </View>
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{stats.wins}</Text>
            <Text style={styles.statLabel}>Wins</Text>
          </View>
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{stats.goalsFor}</Text>
            <Text style={styles.statLabel}>Goals</Text>
          </View>
          <View style={styles.statItem}>
            <Text style={styles.statValue}>
              {stats.played > 0 ? Math.round(stats.winRate) : 0}%
            </Text>
            <Text style={styles.statLabel}>Win Rate</Text>
          </View>
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{stats.leaguesWon}</Text>
            <Text style={styles.statLabel}>Leagues</Text>
          </View>
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{stats.knockoutsWon}</Text>
            <Text style={styles.statLabel}>Cups</Text>
          </View>
        </View>
      </View>

      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>My Groups</Text>
          <View style={styles.groupActions}>
            <TouchableOpacity
              style={styles.actionButton}
              onPress={() => router.push('/group-browser')}
            >
              <Search size={16} color="#0EA5E9" />
              <Text style={styles.actionText}>Browse</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.actionButton}
              onPress={() => setJoinGroupModal(true)}
            >
              <Users size={16} color="#0EA5E9" />
              <Text style={styles.actionText}>Join</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.actionButton}
              onPress={() => setCreateGroupModal(true)}
            >
              <Plus size={16} color="#0EA5E9" />
              <Text style={styles.actionText}>Create</Text>
            </TouchableOpacity>
          </View>
        </View>

        {groupsLoading ? (
          <View style={styles.emptyGroups}>
            <Text style={styles.emptyGroupsText}>Loading groups...</Text>
          </View>
        ) : groups.length === 0 ? (
          <View style={styles.emptyGroups}>
            <Text style={styles.emptyGroupsText}>
              You haven&apos;t joined any groups yet
            </Text>
          </View>
        ) : (
          groups.map((group) => {
            const isActive = group.id === activeGroupId;
            return (
              <TouchableOpacity
                key={group.id}
                style={[
                  styles.groupCard,
                  isActive && styles.activeGroupCard
                ]}
                onPress={() => {
                  setActiveGroupId(group.id);
                  router.push(`/group-details?groupId=${group.id}`);
                }}
              >
                <View style={styles.groupInfo}>
                  <View style={styles.groupNameRow}>
                    <Text style={styles.groupName}>{group.name}</Text>
                    {isActive && (
                      <View style={styles.activeBadge}>
                        <Text style={styles.activeBadgeText}>Active</Text>
                      </View>
                    )}
                  </View>
                  <Text style={styles.groupDescription}>
                    {group.description || 'No description'}
                  </Text>
                  {group.adminId === currentPlayer?.id && (
                    <Text style={styles.adminBadgeText}>Admin</Text>
                  )}
                </View>
                <ChevronRight size={20} color="#64748B" />
              </TouchableOpacity>
            );
          })
        )}
      </View>

      <View style={styles.section}>
        <TouchableOpacity
          style={styles.settingsButton}
          onPress={() => router.push('/settings')}
        >
          <Settings size={20} color="#64748B" />
          <Text style={styles.settingsText}>Settings</Text>
          <ChevronRight size={20} color="#64748B" />
        </TouchableOpacity>

        <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
          <LogOut size={20} color="#EF4444" />
          <Text style={styles.logoutText}>Logout</Text>
        </TouchableOpacity>
      </View>

      <Modal
        visible={createGroupModal}
        transparent
        animationType="slide"
        onRequestClose={() => setCreateGroupModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Create New Group</Text>

            <TextInput
              style={styles.input}
              value={groupName}
              onChangeText={setGroupName}
              placeholder="Group Name"
              placeholderTextColor="#64748B"
            />

            <TextInput
              style={[styles.input, styles.textArea]}
              value={groupDescription}
              onChangeText={setGroupDescription}
              placeholder="Description (optional)"
              placeholderTextColor="#64748B"
              multiline
              numberOfLines={3}
            />

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.cancelButton}
                onPress={() => {
                  setCreateGroupModal(false);
                  setGroupName('');
                  setGroupDescription('');
                }}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={styles.submitButton} 
                onPress={handleCreateGroup}
              >
                <Text style={styles.submitButtonText}>Create</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <Modal
        visible={joinGroupModal}
        transparent
        animationType="slide"
        onRequestClose={() => setJoinGroupModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Join Group</Text>

            <TextInput
              style={styles.input}
              value={groupCode}
              onChangeText={setGroupCode}
              placeholder="Enter Group Code (e.g., TRASHLEGS)"
              placeholderTextColor="#64748B"
              autoCapitalize="characters"
              maxLength={8}
            />

            <View style={styles.infoBox}>
              <Text style={styles.infoText}>
                💡 Ask your group admin for the invite code. Example codes: TRASHLEGS, ROOKIES1
              </Text>
            </View>

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.cancelButton}
                onPress={() => {
                  setJoinGroupModal(false);
                  setGroupCode('');
                }}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={styles.submitButton} 
                onPress={handleJoinGroup}
                disabled={joinGroupMutation.isPending}
              >
                <Text style={styles.submitButtonText}>
                  {joinGroupMutation.isPending ? 'Joining...' : 'Join'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

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
                disabled={updateProfileMutation.isPending}
              >
                <Text style={styles.submitButtonText}>
                  {updateProfileMutation.isPending ? 'Saving...' : 'Save'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0F172A' },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#0F172A',
  },
  emptyTitle: {
    fontSize: 24,
    fontWeight: '600' as const,
    color: '#fff',
    marginTop: 16,
  },
  primaryButton: {
    backgroundColor: '#0EA5E9',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
    marginTop: 24,
  },
  primaryButtonText: { color: '#fff', fontSize: 16, fontWeight: '600' as const },
  profileHeader: { padding: 24, alignItems: 'center' },
  profileNameContainer: { alignItems: 'center' },
  editProfileButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    marginTop: 8,
  },
  editProfileText: { fontSize: 12, color: '#fff', fontWeight: '500' as const },
  avatarContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  userName: { fontSize: 20, fontWeight: '700' as const, color: '#fff', marginBottom: 4 },
  userFullName: { fontSize: 14, color: 'rgba(255, 255, 255, 0.7)', marginBottom: 8 },
  joinDate: { fontSize: 14, color: 'rgba(255, 255, 255, 0.8)' },
  profileBadges: { marginBottom: 8 },
  statsCard: {
    backgroundColor: '#1E293B',
    margin: 16,
    padding: 16,
    borderRadius: 12,
  },
  statsGrid: { flexDirection: 'row', justifyContent: 'space-around', marginTop: 16 },
  statItem: { alignItems: 'center' },
  statValue: { fontSize: 24, fontWeight: '700' as const, color: '#fff' },
  statLabel: { fontSize: 12, color: '#64748B', marginTop: 4 },
  section: { paddingHorizontal: 16, marginBottom: 24 },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionTitle: { fontSize: 18, fontWeight: '600' as const, color: '#fff' },
  groupActions: { flexDirection: 'row', gap: 8 },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#1E293B',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  actionText: { fontSize: 12, color: '#0EA5E9', fontWeight: '500' as const },
  emptyGroups: {
    backgroundColor: '#1E293B',
    padding: 24,
    borderRadius: 12,
    alignItems: 'center',
  },
  emptyGroupsText: { fontSize: 14, color: '#64748B' },
  groupCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1E293B',
    padding: 16,
    borderRadius: 12,
    marginBottom: 8,
  },
  activeGroupCard: {
    borderWidth: 2,
    borderColor: '#0EA5E9',
    backgroundColor: '#1E3A52',
  },
  groupNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  activeBadge: {
    backgroundColor: '#0EA5E9',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
  },
  activeBadgeText: {
    fontSize: 10,
    fontWeight: '600' as const,
    color: '#fff',
  },
  groupInfo: { flex: 1 },
  groupName: { fontSize: 16, fontWeight: '600' as const, color: '#fff', marginBottom: 4 },
  groupDescription: { fontSize: 12, color: '#64748B' },
  adminBadgeText: { fontSize: 10, color: '#0EA5E9', marginTop: 4, fontWeight: '600' as const },
  settingsButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1E293B',
    padding: 16,
    borderRadius: 12,
    marginBottom: 8,
  },
  settingsText: { flex: 1, fontSize: 16, color: '#fff', marginLeft: 12 },
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1E293B',
    padding: 16,
    borderRadius: 12,
  },
  logoutText: {
    flex: 1,
    fontSize: 16,
    color: '#EF4444',
    marginLeft: 12,
    fontWeight: '500' as const,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    justifyContent: 'center',
    padding: 20,
  },
  modalContent: { backgroundColor: '#1E293B', borderRadius: 16, padding: 24 },
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
  textArea: { height: 80, textAlignVertical: 'top' },
  modalActions: { flexDirection: 'row', gap: 12 },
  cancelButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: '#334155',
    alignItems: 'center',
  },
  cancelButtonText: { fontSize: 16, color: '#fff', fontWeight: '500' as const },
  submitButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: '#0EA5E9',
    alignItems: 'center',
  },
  submitButtonText: { fontSize: 16, color: '#fff', fontWeight: '600' as const },
  infoBox: {
    backgroundColor: 'rgba(14, 165, 233, 0.1)',
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(14, 165, 233, 0.3)',
    marginBottom: 16,
  },
  infoText: { fontSize: 12, color: '#0EA5E9', lineHeight: 16 },
  inputError: { borderColor: '#EF4444' },
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
  handleInput: { flex: 1, paddingVertical: 16, fontSize: 16, color: '#fff' },
  suggestionsContainer: { marginBottom: 16 },
  suggestionsTitle: { fontSize: 14, color: '#64748B', marginBottom: 8 },
  suggestionsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  suggestionChip: {
    backgroundColor: '#0F172A',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#334155',
  },
  suggestionText: { fontSize: 14, color: '#0EA5E9' },
});
