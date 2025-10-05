import React, { useState, useCallback } from 'react';
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Modal,
} from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { 
  Search, 
  Users, 
  Plus,
  Calendar,
  ChevronRight,
  X
} from 'lucide-react-native';
import { useSession } from '@/hooks/use-session';
import { useRealtimeGroups } from '@/hooks/use-realtime-groups';
import { useGameStore } from '@/hooks/use-game-store';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { supabase } from '@/lib/supabase';

export default function GroupBrowserScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user } = useSession();
  const { setActiveGroupId } = useGameStore();
  const { refetch: refetchUserGroups } = useRealtimeGroups();
  
  const [searchQuery, setSearchQuery] = useState('');
  const [joinModal, setJoinModal] = useState(false);
  const [createModal, setCreateModal] = useState(false);
  const [selectedGroup, setSelectedGroup] = useState<any>(null);
  const [groupName, setGroupName] = useState('');
  const [groupDescription, setGroupDescription] = useState('');
  const [availableGroups, setAvailableGroups] = useState<any[]>([]);
  const [isJoining, setIsJoining] = useState(false);
  const [isCreating, setIsCreating] = useState(false);

  const fetchPublicGroups = useCallback(async () => {
    if (!user) {
      console.log('No user, skipping fetch');
      return;
    }
    try {
      console.log('🔍 Fetching public groups for user:', user.id);
      const { data: player, error: playerError } = await supabase
        .from('players')
        .select('id')
        .eq('auth_user_id', user.id)
        .single();

      if (playerError) {
        console.error('❌ Error fetching player:', playerError);
      }

      if (!player) {
        console.log('⚠️ No player found for user');
        setAvailableGroups([]);
        return;
      }

      console.log('✅ Found player:', player.id);

      const { data: groups, error } = await supabase
        .from('groups')
        .select('id, name, description, invite_code, is_public, created_at, admin_id')
        .eq('is_public', true);

      if (error) {
        console.error('❌ Error fetching groups:', error);
        return;
      }

      console.log('📊 Found', groups?.length || 0, 'public groups');

      const { data: userGroups } = await supabase
        .from('group_members')
        .select('group_id')
        .eq('player_id', player.id);

      const userGroupIds = new Set(userGroups?.map((g: any) => g.group_id) || []);
      console.log('👤 User is member of', userGroupIds.size, 'groups');
      const filteredGroups = (groups || []).filter((g: any) => !userGroupIds.has(g.id));
      console.log('🔍 Filtered to', filteredGroups.length, 'available groups');

      const groupsWithCounts = await Promise.all(
        filteredGroups.map(async (group: any) => {
          const { count } = await supabase
            .from('group_members')
            .select('*', { count: 'exact', head: true })
            .eq('group_id', group.id);
          
          return {
            id: group.id,
            name: group.name,
            description: group.description || '',
            inviteCode: group.invite_code,
            isPublic: group.is_public,
            memberCount: count || 0,
            createdAt: group.created_at,
          };
        })
      );

      console.log('✅ Setting', groupsWithCounts.length, 'groups with member counts');
      setAvailableGroups(groupsWithCounts);
    } catch (error) {
      console.error('❌ Error in fetchPublicGroups:', error);
    }
  }, [user]);

  React.useEffect(() => {
    if (user) {
      fetchPublicGroups();
    }
  }, [user, fetchPublicGroups]);

  if (!user) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <Stack.Screen options={{ title: 'Browse Groups' }} />
        <View style={styles.emptyContainer}>
          <Users size={64} color="#64748B" />
          <Text style={styles.emptyTitle}>Please login to browse groups</Text>
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


  
  const filteredGroups = availableGroups.filter((group: any) =>
    group.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    group.description.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleJoinGroup = (group: any) => {
    setSelectedGroup(group);
    setJoinModal(true);
  };

  const confirmJoinGroup = async () => {
    if (!selectedGroup || !user) return;

    setIsJoining(true);
    try {
      const { data: player } = await supabase
        .from('players')
        .select('id')
        .eq('auth_user_id', user.id)
        .single();

      if (!player) {
        alert('Player not found');
        return;
      }

      const { data: group, error: groupError } = await supabase
        .from('groups')
        .select('*')
        .eq('invite_code', selectedGroup.inviteCode.toUpperCase())
        .single();

      if (groupError || !group) {
        alert('Invalid invite code');
        return;
      }

      const { data: existingMember } = await supabase
        .from('group_members')
        .select('id')
        .eq('group_id', group.id)
        .eq('player_id', player.id)
        .maybeSingle();

      if (existingMember) {
        alert('You are already a member of this group');
        setJoinModal(false);
        setSelectedGroup(null);
        return;
      }

      const { data: existingRequest } = await supabase
        .from('pending_group_members')
        .select('id, status')
        .eq('group_id', group.id)
        .eq('player_id', player.id)
        .maybeSingle();

      if (existingRequest) {
        alert('You already have a pending request for this group');
        setJoinModal(false);
        setSelectedGroup(null);
        return;
      }

      const { data: playerData } = await supabase
        .from('players')
        .select('name')
        .eq('id', player.id)
        .single();

      const { error: requestError } = await supabase
        .from('pending_group_members')
        .insert({
          group_id: group.id,
          player_id: player.id,
          player_name: playerData?.name || 'Unknown',
          status: 'pending',
        });

      if (requestError) {
        console.error('Error creating join request:', requestError);
        alert('Failed to send join request');
        return;
      }

      setJoinModal(false);
      setSelectedGroup(null);
      alert('Join request sent! The group admin will review your request.');
      await fetchPublicGroups();
      router.back();
    } catch (error: any) {
      console.error('Error joining group:', error);
      alert(error?.message || 'Failed to join group');
    } finally {
      setIsJoining(false);
    }
  };

  const handleCreateGroup = async () => {
    if (!groupName.trim()) {
      alert('Please enter a group name');
      return;
    }
    
    if (!user) {
      alert('User not authenticated');
      return;
    }

    setIsCreating(true);
    try {
      const { data: player } = await supabase
        .from('players')
        .select('id')
        .eq('auth_user_id', user.id)
        .single();

      if (!player) {
        alert('Player not found');
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
        alert('Failed to create group');
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
        alert('Failed to add member to group');
        return;
      }

      await supabase
        .from('player_stats')
        .insert({
          player_id: player.id,
          group_id: group.id,
        });

      setCreateModal(false);
      setGroupName('');
      setGroupDescription('');
      console.log('✅ Group created:', group.name);
      alert(`Group created!\n\nInvite Code: ${group.invite_code}`);
      setActiveGroupId(group.id);
      await refetchUserGroups();
      await fetchPublicGroups();
      router.back();
    } catch (error: any) {
      console.error('Error creating group:', error);
      alert(error?.message || 'Failed to create group');
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <View style={styles.container}>
      <Stack.Screen 
        options={{ 
          title: 'Browse Groups',
          headerStyle: { backgroundColor: '#0F172A' },
          headerTintColor: '#fff',
        }} 
      />
      
      {/* Header Actions */}
      <View style={styles.header}>
        <View style={styles.searchContainer}>
          <Search size={20} color="#64748B" />
          <TextInput
            style={styles.searchInput}
            placeholder="Search groups..."
            placeholderTextColor="#64748B"
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
        </View>
        <TouchableOpacity
          style={styles.createButton}
          onPress={() => setCreateModal(true)}
        >
          <Plus size={20} color="#fff" />
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Available Groups */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>
            Available Groups ({filteredGroups.length})
          </Text>
          
          {filteredGroups.length === 0 ? (
            <View style={styles.emptyGroups}>
              <Users size={48} color="#64748B" />
              <Text style={styles.emptyGroupsTitle}>
                {searchQuery ? 'No groups found' : 'No available groups'}
              </Text>
              <Text style={styles.emptyGroupsText}>
                {searchQuery 
                  ? 'Try adjusting your search terms'
                  : 'Create a new group to get started'
                }
              </Text>
            </View>
          ) : (
            filteredGroups.map((group: any) => (
              <TouchableOpacity
                key={group.id}
                style={styles.groupCard}
                onPress={() => handleJoinGroup(group)}
              >
                <LinearGradient
                  colors={['#1E293B', '#334155']}
                  style={styles.groupGradient}
                >
                  <View style={styles.groupHeader}>
                    <View style={styles.groupInfo}>
                      <Text style={styles.groupName}>{group.name}</Text>
                      <Text style={styles.groupDescription}>
                        {group.description || 'No description'}
                      </Text>
                    </View>
                    <ChevronRight size={20} color="#64748B" />
                  </View>
                  
                  <View style={styles.groupStats}>
                    <View style={styles.statItem}>
                      <Users size={16} color="#0EA5E9" />
                      <Text style={styles.statText}>
                        {group.memberCount || 0} members
                      </Text>
                    </View>
                    <View style={styles.statItem}>
                      <Calendar size={16} color="#10B981" />
                      <Text style={styles.statText}>
                        Created {new Date(group.createdAt).toLocaleDateString()}
                      </Text>
                    </View>
                  </View>
                  
                  <View style={styles.groupFooter}>
                    <Text style={styles.inviteCode}>Code: {group.inviteCode}</Text>
                    <View style={styles.joinButton}>
                      <Text style={styles.joinButtonText}>Join Group</Text>
                    </View>
                  </View>
                </LinearGradient>
              </TouchableOpacity>
            ))
          )}
        </View>
      </ScrollView>

      {/* Join Group Modal */}
      <Modal
        visible={joinModal}
        transparent
        animationType="slide"
        onRequestClose={() => setJoinModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Join Group</Text>
              <TouchableOpacity
                style={styles.closeButton}
                onPress={() => setJoinModal(false)}
              >
                <X size={24} color="#64748B" />
              </TouchableOpacity>
            </View>
            
            {selectedGroup && (
              <>
                <View style={styles.groupPreview}>
                  <Text style={styles.previewName}>{selectedGroup.name}</Text>
                  <Text style={styles.previewDescription}>
                    {selectedGroup.description || 'No description'}
                  </Text>
                  <Text style={styles.previewStats}>
                    {selectedGroup.memberCount || 0} members
                  </Text>
                </View>
                
                <Text style={styles.confirmText}>
                  Send a join request to this group? The admin will review your request.
                </Text>
                
                <View style={styles.modalActions}>
                  <TouchableOpacity
                    style={styles.cancelButton}
                    onPress={() => setJoinModal(false)}
                  >
                    <Text style={styles.cancelButtonText}>Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.confirmButton}
                    onPress={confirmJoinGroup}
                    disabled={isJoining}
                  >
                    <Text style={styles.confirmButtonText}>
                      {isJoining ? 'Sending...' : 'Send Request'}
                    </Text>
                  </TouchableOpacity>
                </View>
              </>
            )}
          </View>
        </View>
      </Modal>

      {/* Create Group Modal */}
      <Modal
        visible={createModal}
        transparent
        animationType="slide"
        onRequestClose={() => setCreateModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Create New Group</Text>
              <TouchableOpacity
                style={styles.closeButton}
                onPress={() => setCreateModal(false)}
              >
                <X size={24} color="#64748B" />
              </TouchableOpacity>
            </View>
            
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
                  setCreateModal(false);
                  setGroupName('');
                  setGroupDescription('');
                }}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.confirmButton}
                onPress={handleCreateGroup}
                disabled={isCreating}
              >
                <Text style={styles.confirmButtonText}>
                  {isCreating ? 'Creating...' : 'Create'}
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
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    gap: 12,
  },
  searchContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1E293B',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  searchInput: {
    flex: 1,
    marginLeft: 12,
    fontSize: 16,
    color: '#fff',
  },
  createButton: {
    backgroundColor: '#0EA5E9',
    width: 48,
    height: 48,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    flex: 1,
  },
  section: {
    paddingHorizontal: 16,
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600' as const,
    color: '#fff',
    marginBottom: 16,
  },
  emptyGroups: {
    backgroundColor: '#1E293B',
    padding: 32,
    borderRadius: 16,
    alignItems: 'center',
  },
  emptyGroupsTitle: {
    fontSize: 18,
    fontWeight: '600' as const,
    color: '#fff',
    marginTop: 16,
  },
  emptyGroupsText: {
    fontSize: 14,
    color: '#64748B',
    marginTop: 8,
    textAlign: 'center',
  },
  groupCard: {
    marginBottom: 16,
    borderRadius: 16,
    overflow: 'hidden',
  },
  groupGradient: {
    padding: 20,
  },
  groupHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  groupInfo: {
    flex: 1,
  },
  groupName: {
    fontSize: 18,
    fontWeight: '600' as const,
    color: '#fff',
    marginBottom: 4,
  },
  groupDescription: {
    fontSize: 14,
    color: '#94A3B8',
    lineHeight: 20,
  },
  groupStats: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 16,
    marginBottom: 16,
  },
  statItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  statText: {
    fontSize: 12,
    color: '#94A3B8',
  },
  groupFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#334155',
  },
  inviteCode: {
    fontSize: 12,
    color: '#64748B',
    fontFamily: 'monospace',
  },
  joinButton: {
    backgroundColor: '#0EA5E9',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  joinButtonText: {
    fontSize: 12,
    fontWeight: '600' as const,
    color: '#fff',
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
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 24,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '600' as const,
    color: '#fff',
  },
  closeButton: {
    padding: 4,
  },
  groupPreview: {
    backgroundColor: '#0F172A',
    padding: 16,
    borderRadius: 12,
    marginBottom: 16,
  },
  previewName: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: '#fff',
    marginBottom: 4,
  },
  previewDescription: {
    fontSize: 14,
    color: '#94A3B8',
    marginBottom: 8,
  },
  previewStats: {
    fontSize: 12,
    color: '#64748B',
  },
  confirmText: {
    fontSize: 16,
    color: '#fff',
    textAlign: 'center',
    marginBottom: 24,
  },
  input: {
    backgroundColor: '#0F172A',
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    color: '#fff',
    marginBottom: 16,
  },
  textArea: {
    height: 80,
    textAlignVertical: 'top',
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
  confirmButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: '#0EA5E9',
    alignItems: 'center',
  },
  confirmButtonText: {
    fontSize: 16,
    color: '#fff',
    fontWeight: '600' as const,
  },
});