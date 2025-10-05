import React, { useState, useMemo, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  ActivityIndicator,
  Modal,
  Platform,
} from 'react-native';
import { Stack, useRouter } from 'expo-router';
import {
  Users,
  Trophy,
  Target,
  Shield,
  Search,
  Crown,
  Trash2,
  RefreshCw,
  UserX,
  Edit2,
  CheckCircle,
  XCircle,
  UserCog,
  Database,
  TrendingUp,
  Eye,
} from 'lucide-react-native';
import { trpc } from '@/lib/trpc';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRealtimeSuperadmin } from '@/hooks/use-realtime-superadmin';

type TabType = 'overview' | 'groups' | 'players' | 'matches' | 'competitions' | 'requests';

const StatCard = ({ icon: Icon, title, value, subtitle, color = '#3B82F6' }: {
  icon: any;
  title: string;
  value: string | number;
  subtitle?: string;
  color?: string;
}) => (
  <View style={[styles.statCard, { borderLeftColor: color }]}>
    <View style={styles.statHeader}>
      <Icon size={24} color={color} />
      <Text style={styles.statTitle}>{title}</Text>
    </View>
    <Text style={styles.statValue}>{value}</Text>
    {subtitle && <Text style={styles.statSubtitle}>{subtitle}</Text>}
  </View>
);

export default function SuperAdminScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [activeTab, setActiveTab] = useState<TabType>('overview');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [correctScoreModal, setCorrectScoreModal] = useState<{ visible: boolean; matchId: string; homeScore: number; awayScore: number }>({
    visible: false,
    matchId: '',
    homeScore: 0,
    awayScore: 0,
  });

  const { lastUpdate } = useRealtimeSuperadmin();

  const statsQuery = trpc.superadmin.getPlatformStats.useQuery();
  const groupsQuery = trpc.superadmin.getAllGroups.useQuery();
  const playersQuery = trpc.superadmin.getAllPlayers.useQuery();
  const matchesQuery = trpc.superadmin.getAllMatches.useQuery();
  const competitionsQuery = trpc.superadmin.getAllCompetitions.useQuery();

  const refetchAll = useCallback(() => {
    console.log('🔄 Refetching all superadmin data');
    statsQuery.refetch();
    groupsQuery.refetch();
    playersQuery.refetch();
    matchesQuery.refetch();
    competitionsQuery.refetch();
  }, [statsQuery, groupsQuery, playersQuery, matchesQuery, competitionsQuery]);

  useEffect(() => {
    if (lastUpdate > 0) {
      console.log('🔄 Realtime update triggered');
      refetchAll();
    }
  }, [lastUpdate, refetchAll]);

  const deleteGroupMutation = trpc.superadmin.deleteGroup.useMutation();
  const removeUserMutation = trpc.superadmin.removeUserFromGroup.useMutation();
  const deleteMatchMutation = trpc.superadmin.deleteMatch.useMutation();
  const correctScoreMutation = trpc.superadmin.correctMatchScore.useMutation();
  const manageRequestMutation = trpc.superadmin.manageJoinRequest.useMutation();
  const deleteCompetitionMutation = trpc.superadmin.deleteCompetition.useMutation();
  const assignAdminMutation = trpc.superadmin.assignGroupAdmin.useMutation();
  const deletePlayerMutation = trpc.superadmin.deletePlayer.useMutation();

  const onRefresh = useCallback(async () => {
    await Promise.all([
      statsQuery.refetch(),
      groupsQuery.refetch(),
      playersQuery.refetch(),
      matchesQuery.refetch(),
      competitionsQuery.refetch(),
    ]);
  }, [statsQuery, groupsQuery, playersQuery, matchesQuery, competitionsQuery]);

  const handleDeleteGroup = (groupId: string, groupName: string) => {
    const confirmAction = () => {
      Alert.alert(
        'Delete Group',
        `Are you sure you want to delete "${groupName}"? This will delete all competitions, matches, and memberships.`,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Delete',
            style: 'destructive',
            onPress: async () => {
              try {
                await deleteGroupMutation.mutateAsync({ groupId });
                Alert.alert('Success', 'Group deleted successfully');
                await onRefresh();
              } catch (error) {
                Alert.alert('Error', error instanceof Error ? error.message : 'Failed to delete group');
              }
            }
          }
        ]
      );
    };

    if (Platform.OS === 'web') {
      if (window.confirm(`Are you sure you want to delete "${groupName}"? This will delete all competitions, matches, and memberships.`)) {
        deleteGroupMutation.mutateAsync({ groupId }).then(() => {
          alert('Group deleted successfully');
          onRefresh();
        }).catch((error) => {
          alert(error instanceof Error ? error.message : 'Failed to delete group');
        });
      }
    } else {
      confirmAction();
    }
  };

  const handleRemoveUser = (groupId: string, playerId: string, playerName: string, groupName: string) => {
    const confirmAction = () => {
      Alert.alert(
        'Remove User',
        `Remove ${playerName} from ${groupName}?`,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Remove',
            style: 'destructive',
            onPress: async () => {
              try {
                await removeUserMutation.mutateAsync({ groupId, playerId });
                Alert.alert('Success', 'User removed successfully');
                await onRefresh();
              } catch (error) {
                Alert.alert('Error', error instanceof Error ? error.message : 'Failed to remove user');
              }
            }
          }
        ]
      );
    };

    if (Platform.OS === 'web') {
      if (window.confirm(`Remove ${playerName} from ${groupName}?`)) {
        removeUserMutation.mutateAsync({ groupId, playerId }).then(() => {
          alert('User removed successfully');
          onRefresh();
        }).catch((error) => {
          alert(error instanceof Error ? error.message : 'Failed to remove user');
        });
      }
    } else {
      confirmAction();
    }
  };

  const handleDeleteMatch = (matchId: string) => {
    const confirmAction = () => {
      Alert.alert(
        'Delete Match',
        'Are you sure you want to delete this match?',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Delete',
            style: 'destructive',
            onPress: async () => {
              try {
                await deleteMatchMutation.mutateAsync({ matchId });
                Alert.alert('Success', 'Match deleted successfully');
                await onRefresh();
              } catch (error) {
                Alert.alert('Error', error instanceof Error ? error.message : 'Failed to delete match');
              }
            }
          }
        ]
      );
    };

    if (Platform.OS === 'web') {
      if (window.confirm('Are you sure you want to delete this match?')) {
        deleteMatchMutation.mutateAsync({ matchId }).then(() => {
          alert('Match deleted successfully');
          onRefresh();
        }).catch((error) => {
          alert(error instanceof Error ? error.message : 'Failed to delete match');
        });
      }
    } else {
      confirmAction();
    }
  };

  const handleCorrectScore = async () => {
    try {
      await correctScoreMutation.mutateAsync({
        matchId: correctScoreModal.matchId,
        homeScore: correctScoreModal.homeScore,
        awayScore: correctScoreModal.awayScore,
      });
      Alert.alert('Success', 'Score corrected successfully');
      setCorrectScoreModal({ visible: false, matchId: '', homeScore: 0, awayScore: 0 });
      await onRefresh();
    } catch (error) {
      Alert.alert('Error', error instanceof Error ? error.message : 'Failed to correct score');
    }
  };

  const handleManageRequest = async (requestId: string, action: 'approve' | 'reject') => {
    try {
      await manageRequestMutation.mutateAsync({ requestId, action });
      Alert.alert('Success', `Request ${action}d successfully`);
      await onRefresh();
    } catch (error) {
      Alert.alert('Error', error instanceof Error ? error.message : `Failed to ${action} request`);
    }
  };

  const handleDeleteCompetition = (competitionId: string, competitionName: string) => {
    const confirmAction = () => {
      Alert.alert(
        'Delete Competition',
        `Delete "${competitionName}"? This will delete all matches.`,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Delete',
            style: 'destructive',
            onPress: async () => {
              try {
                await deleteCompetitionMutation.mutateAsync({ competitionId });
                Alert.alert('Success', 'Competition deleted successfully');
                await onRefresh();
              } catch (error) {
                Alert.alert('Error', error instanceof Error ? error.message : 'Failed to delete competition');
              }
            }
          }
        ]
      );
    };

    if (Platform.OS === 'web') {
      if (window.confirm(`Delete "${competitionName}"? This will delete all matches.`)) {
        deleteCompetitionMutation.mutateAsync({ competitionId }).then(() => {
          alert('Competition deleted successfully');
          onRefresh();
        }).catch((error) => {
          alert(error instanceof Error ? error.message : 'Failed to delete competition');
        });
      }
    } else {
      confirmAction();
    }
  };

  const handleAssignAdmin = (groupId: string, playerId: string, playerName: string, groupName: string) => {
    const confirmAction = () => {
      Alert.alert(
        'Assign Admin',
        `Make ${playerName} admin of ${groupName}?`,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Assign',
            onPress: async () => {
              try {
                await assignAdminMutation.mutateAsync({ groupId, playerId });
                Alert.alert('Success', 'Admin assigned successfully');
                await onRefresh();
              } catch (error) {
                Alert.alert('Error', error instanceof Error ? error.message : 'Failed to assign admin');
              }
            }
          }
        ]
      );
    };

    if (Platform.OS === 'web') {
      if (window.confirm(`Make ${playerName} admin of ${groupName}?`)) {
        assignAdminMutation.mutateAsync({ groupId, playerId }).then(() => {
          alert('Admin assigned successfully');
          onRefresh();
        }).catch((error) => {
          alert(error instanceof Error ? error.message : 'Failed to assign admin');
        });
      }
    } else {
      confirmAction();
    }
  };

  const handleDeletePlayer = (playerId: string, playerName: string) => {
    const confirmAction = () => {
      Alert.alert(
        'Delete Player',
        `Delete ${playerName}? This will:\n• Delete their auth account\n• Remove them from all groups\n• Delete their stats\n• Orphan their matches (matches will remain but show as deleted player)`,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Delete',
            style: 'destructive',
            onPress: async () => {
              try {
                await deletePlayerMutation.mutateAsync({ playerId });
                Alert.alert('Success', 'Player deleted successfully');
                await onRefresh();
              } catch (error) {
                Alert.alert('Error', error instanceof Error ? error.message : 'Failed to delete player');
              }
            }
          }
        ]
      );
    };

    if (Platform.OS === 'web') {
      if (window.confirm(`Delete ${playerName}? This will delete their auth account, remove them from all groups, and delete their stats. Matches will remain but show as deleted player.`)) {
        deletePlayerMutation.mutateAsync({ playerId }).then(() => {
          alert('Player deleted successfully');
          onRefresh();
        }).catch((error) => {
          alert(error instanceof Error ? error.message : 'Failed to delete player');
        });
      }
    } else {
      confirmAction();
    }
  };

  const filteredGroups = useMemo(() => {
    if (!groupsQuery.data?.data) return [];
    if (!searchQuery) return groupsQuery.data.data;
    return groupsQuery.data.data.filter((group: any) =>
      group.name.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [groupsQuery.data, searchQuery]);

  const filteredPlayers = useMemo(() => {
    if (!playersQuery.data?.data) return [];
    if (!searchQuery) return playersQuery.data.data;
    return playersQuery.data.data.filter((player: any) =>
      player.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      player.email?.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [playersQuery.data, searchQuery]);

  const filteredMatches = useMemo(() => {
    if (!matchesQuery.data?.data) return [];
    if (!searchQuery) return matchesQuery.data.data;
    return matchesQuery.data.data.filter((match: any) =>
      match.home_player?.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      match.away_player?.name.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [matchesQuery.data, searchQuery]);

  const filteredCompetitions = useMemo(() => {
    if (!competitionsQuery.data?.data) return [];
    if (!searchQuery) return competitionsQuery.data.data;
    return competitionsQuery.data.data.filter((comp: any) =>
      comp.name.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [competitionsQuery.data, searchQuery]);

  const allPendingRequests = useMemo(() => {
    if (!groupsQuery.data?.data) return [];
    return groupsQuery.data.data.flatMap((group: any) =>
      (group.pending_members || []).map((req: any) => ({
        ...req,
        groupName: group.name,
        groupId: group.id,
      }))
    );
  }, [groupsQuery.data]);

  const tabs = [
    { id: 'overview' as const, label: 'Overview', icon: Eye },
    { id: 'groups' as const, label: 'Groups', icon: Users },
    { id: 'players' as const, label: 'Players', icon: Crown },
    { id: 'matches' as const, label: 'Matches', icon: Target },
    { id: 'competitions' as const, label: 'Competitions', icon: Trophy },
    { id: 'requests' as const, label: 'Requests', icon: UserCog },
  ];

  const renderOverview = () => {
    const stats = statsQuery.data?.data;
    
    console.log('📊 Stats Query:', {
      isLoading: statsQuery.isLoading,
      isError: statsQuery.isError,
      error: statsQuery.error,
      data: statsQuery.data,
    });
    
    if (statsQuery.isLoading) {
      return (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#3B82F6" />
          <Text style={styles.loadingText}>Loading statistics...</Text>
        </View>
      );
    }
    
    if (statsQuery.isError) {
      return (
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>Error: {statsQuery.error?.message || 'Failed to load stats'}</Text>
          <TouchableOpacity style={styles.refreshButton} onPress={() => statsQuery.refetch()}>
            <RefreshCw size={20} color="#3B82F6" />
            <Text style={styles.refreshButtonText}>Retry</Text>
          </TouchableOpacity>
        </View>
      );
    }

    return (
      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={styles.sectionTitle}>Platform Statistics</Text>
        <View style={styles.statsGrid}>
          <StatCard
            icon={Users}
            title="Total Players"
            value={stats?.totalPlayers || 0}
            subtitle="Registered users"
            color="#3B82F6"
          />
          <StatCard
            icon={Crown}
            title="Total Groups"
            value={stats?.totalGroups || 0}
            subtitle={`${stats?.activeGroups || 0} active`}
            color="#10B981"
          />
          <StatCard
            icon={Target}
            title="Total Matches"
            value={stats?.totalMatches || 0}
            subtitle={`${stats?.completedMatches || 0} completed`}
            color="#F59E0B"
          />
          <StatCard
            icon={Trophy}
            title="Competitions"
            value={stats?.totalCompetitions || 0}
            subtitle="All competitions"
            color="#8B5CF6"
          />
        </View>

        <View style={styles.statsGrid}>
          <StatCard
            icon={TrendingUp}
            title="Live Matches"
            value={stats?.liveMatches || 0}
            color="#EF4444"
          />
          <StatCard
            icon={Database}
            title="Pending Requests"
            value={allPendingRequests.length}
            color="#F59E0B"
          />
        </View>

        <TouchableOpacity style={styles.refreshButton} onPress={onRefresh}>
          <RefreshCw size={20} color="#3B82F6" />
          <Text style={styles.refreshButtonText}>Refresh All Data</Text>
        </TouchableOpacity>
      </ScrollView>
    );
  };

  const renderGroups = () => {
    if (groupsQuery.isLoading) {
      return (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#3B82F6" />
          <Text style={styles.loadingText}>Loading groups...</Text>
        </View>
      );
    }

    return (
      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.searchContainer}>
          <Search size={20} color="#6B7280" style={styles.searchIcon} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search groups..."
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholderTextColor="#9CA3AF"
          />
        </View>

        <Text style={styles.sectionTitle}>All Groups ({filteredGroups.length})</Text>
        {filteredGroups.map((group: any) => (
          <View key={group.id} style={styles.card}>
            <View style={styles.cardHeader}>
              <View style={{ flex: 1 }}>
                <Text style={styles.cardTitle}>{group.name}</Text>
                <Text style={styles.cardSubtitle}>{group.description}</Text>
                <Text style={styles.cardSubtitle}>
                  Admin: {group.admin?.name || 'Unknown'}
                </Text>
                <Text style={styles.cardSubtitle}>
                  Members: {group.members?.length || 0} | Competitions: {group.competitions?.length || 0}
                </Text>
              </View>
            </View>

            {group.members && group.members.length > 0 && (
              <View style={styles.membersList}>
                <Text style={styles.membersTitle}>Members:</Text>
                {group.members.map((member: any) => (
                  <View key={member.id} style={styles.memberRow}>
                    <Text style={styles.memberName}>{member.player?.name}</Text>
                    <View style={styles.memberActions}>
                      <TouchableOpacity
                        style={[styles.smallButton, styles.assignButton]}
                        onPress={() => handleAssignAdmin(group.id, member.player.id, member.player.name, group.name)}
                      >
                        <UserCog size={14} color="#fff" />
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[styles.smallButton, styles.removeButton]}
                        onPress={() => handleRemoveUser(group.id, member.player.id, member.player.name, group.name)}
                      >
                        <UserX size={14} color="#fff" />
                      </TouchableOpacity>
                    </View>
                  </View>
                ))}
              </View>
            )}

            <View style={styles.adminActions}>
              <TouchableOpacity
                style={[styles.adminButton, styles.deleteButton]}
                onPress={() => handleDeleteGroup(group.id, group.name)}
              >
                <Trash2 size={14} color="#fff" />
                <Text style={styles.adminButtonText}>Delete Group</Text>
              </TouchableOpacity>
            </View>
          </View>
        ))}
      </ScrollView>
    );
  };

  const renderPlayers = () => {
    if (playersQuery.isLoading) {
      return (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#3B82F6" />
          <Text style={styles.loadingText}>Loading players...</Text>
        </View>
      );
    }

    return (
      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.searchContainer}>
          <Search size={20} color="#6B7280" style={styles.searchIcon} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search players..."
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholderTextColor="#9CA3AF"
          />
        </View>

        <Text style={styles.sectionTitle}>All Players ({filteredPlayers.length})</Text>
        {filteredPlayers.map((player: any) => (
          <View key={player.id} style={styles.card}>
            <View style={styles.cardHeader}>
              <View style={{ flex: 1 }}>
                <Text style={styles.cardTitle}>{player.name}</Text>
                <Text style={styles.cardSubtitle}>{player.email}</Text>
                <Text style={styles.cardSubtitle}>@{player.gamer_handle}</Text>
                <Text style={styles.cardSubtitle}>
                  Groups: {player.group_memberships?.length || 0}
                </Text>
              </View>
            </View>

            <View style={styles.adminActions}>
              <TouchableOpacity
                style={[styles.adminButton, styles.deleteButton]}
                onPress={() => handleDeletePlayer(player.id, player.name)}
              >
                <Trash2 size={14} color="#fff" />
                <Text style={styles.adminButtonText}>Delete Player</Text>
              </TouchableOpacity>
            </View>
          </View>
        ))}
      </ScrollView>
    );
  };

  const renderMatches = () => {
    if (matchesQuery.isLoading) {
      return (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#3B82F6" />
          <Text style={styles.loadingText}>Loading matches...</Text>
        </View>
      );
    }

    return (
      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.searchContainer}>
          <Search size={20} color="#6B7280" style={styles.searchIcon} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search matches..."
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholderTextColor="#9CA3AF"
          />
        </View>

        <Text style={styles.sectionTitle}>All Matches ({filteredMatches.length})</Text>
        {filteredMatches.map((match: any) => (
          <View key={match.id} style={styles.card}>
            <View style={styles.cardHeader}>
              <View style={{ flex: 1 }}>
                <Text style={styles.cardTitle}>
                  {match.home_player?.name || 'Unknown'} vs {match.away_player?.name || 'Unknown'}
                </Text>
                <Text style={styles.cardSubtitle}>
                  {match.competition?.group?.name} • {match.competition?.name}
                </Text>
                <Text style={styles.cardSubtitle}>
                  Status: {match.status}
                </Text>
                {match.status === 'completed' && (
                  <Text style={styles.scoreText}>
                    Score: {match.home_score} - {match.away_score}
                  </Text>
                )}
              </View>
            </View>

            <View style={styles.adminActions}>
              {match.status === 'completed' && (
                <TouchableOpacity
                  style={[styles.adminButton, styles.editButton]}
                  onPress={() => setCorrectScoreModal({
                    visible: true,
                    matchId: match.id,
                    homeScore: match.home_score || 0,
                    awayScore: match.away_score || 0,
                  })}
                >
                  <Edit2 size={14} color="#fff" />
                  <Text style={styles.adminButtonText}>Correct Score</Text>
                </TouchableOpacity>
              )}
              <TouchableOpacity
                style={[styles.adminButton, styles.deleteButton]}
                onPress={() => handleDeleteMatch(match.id)}
              >
                <Trash2 size={14} color="#fff" />
                <Text style={styles.adminButtonText}>Delete</Text>
              </TouchableOpacity>
            </View>
          </View>
        ))}
      </ScrollView>
    );
  };

  const renderCompetitions = () => {
    if (competitionsQuery.isLoading) {
      return (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#3B82F6" />
          <Text style={styles.loadingText}>Loading competitions...</Text>
        </View>
      );
    }

    return (
      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.searchContainer}>
          <Search size={20} color="#6B7280" style={styles.searchIcon} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search competitions..."
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholderTextColor="#9CA3AF"
          />
        </View>

        <Text style={styles.sectionTitle}>All Competitions ({filteredCompetitions.length})</Text>
        {filteredCompetitions.map((comp: any) => (
          <View key={comp.id} style={styles.card}>
            <View style={styles.cardHeader}>
              <View style={{ flex: 1 }}>
                <Text style={styles.cardTitle}>{comp.name}</Text>
                <Text style={styles.cardSubtitle}>
                  {comp.group?.name} • {comp.type} • {comp.status}
                </Text>
                <Text style={styles.cardSubtitle}>
                  Matches: {comp.matches?.length || 0} | Participants: {comp.participants?.length || 0}
                </Text>
              </View>
            </View>

            <View style={styles.adminActions}>
              <TouchableOpacity
                style={[styles.adminButton, styles.deleteButton]}
                onPress={() => handleDeleteCompetition(comp.id, comp.name)}
              >
                <Trash2 size={14} color="#fff" />
                <Text style={styles.adminButtonText}>Delete Competition</Text>
              </TouchableOpacity>
            </View>
          </View>
        ))}
      </ScrollView>
    );
  };

  const renderRequests = () => {
    return (
      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={styles.sectionTitle}>Pending Join Requests ({allPendingRequests.length})</Text>
        {allPendingRequests.length === 0 ? (
          <View style={styles.emptyState}>
            <UserCog size={48} color="#9CA3AF" />
            <Text style={styles.emptyStateText}>No pending requests</Text>
          </View>
        ) : (
          allPendingRequests.map((request: any) => (
            <View key={request.id} style={styles.card}>
              <View style={styles.cardHeader}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.cardTitle}>{request.player_name}</Text>
                  <Text style={styles.cardSubtitle}>
                    Wants to join: {request.groupName}
                  </Text>
                  <Text style={styles.cardSubtitle}>
                    Requested: {new Date(request.requested_at).toLocaleString()}
                  </Text>
                </View>
              </View>

              <View style={styles.adminActions}>
                <TouchableOpacity
                  style={[styles.adminButton, styles.approveButton]}
                  onPress={() => handleManageRequest(request.id, 'approve')}
                >
                  <CheckCircle size={14} color="#fff" />
                  <Text style={styles.adminButtonText}>Approve</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.adminButton, styles.rejectButton]}
                  onPress={() => handleManageRequest(request.id, 'reject')}
                >
                  <XCircle size={14} color="#fff" />
                  <Text style={styles.adminButtonText}>Reject</Text>
                </TouchableOpacity>
              </View>
            </View>
          ))
        )}
      </ScrollView>
    );
  };

  const renderContent = () => {
    switch (activeTab) {
      case 'overview': return renderOverview();
      case 'groups': return renderGroups();
      case 'players': return renderPlayers();
      case 'matches': return renderMatches();
      case 'competitions': return renderCompetitions();
      case 'requests': return renderRequests();
      default: return renderOverview();
    }
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <Stack.Screen
        options={{
          title: 'Super Admin',
          headerStyle: { backgroundColor: '#1F2937' },
          headerTintColor: '#FFFFFF',
          headerTitleStyle: { fontWeight: 'bold' as const },
          headerLeft: () => (
            <TouchableOpacity onPress={() => router.back()} style={{ marginLeft: 16 }}>
              <Text style={{ color: '#fff', fontSize: 16 }}>Back</Text>
            </TouchableOpacity>
          ),
        }}
      />

      <View style={styles.header}>
        <Shield size={32} color="#F59E0B" />
        <Text style={styles.headerTitle}>Super Admin Dashboard</Text>
      </View>

      <View style={styles.tabBar}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <View style={styles.tabContainer}>
            {tabs.map(tab => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;

              return (
                <TouchableOpacity
                  key={tab.id}
                  style={[styles.tab, isActive && styles.activeTab]}
                  onPress={() => {
                    setActiveTab(tab.id);
                    setSearchQuery('');
                  }}
                >
                  <Icon size={20} color={isActive ? '#3B82F6' : '#6B7280'} />
                  <Text style={[styles.tabText, isActive && styles.activeTabText]}>
                    {tab.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </ScrollView>
      </View>

      {renderContent()}

      <Modal
        visible={correctScoreModal.visible}
        transparent
        animationType="slide"
        onRequestClose={() => setCorrectScoreModal({ visible: false, matchId: '', homeScore: 0, awayScore: 0 })}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Correct Match Score</Text>

            <View style={styles.scoreInputRow}>
              <View style={styles.scoreInputContainer}>
                <Text style={styles.scoreLabel}>Home Score</Text>
                <TextInput
                  style={styles.scoreInput}
                  value={String(correctScoreModal.homeScore)}
                  onChangeText={(text) => setCorrectScoreModal(prev => ({ ...prev, homeScore: parseInt(text) || 0 }))}
                  keyboardType="numeric"
                  placeholderTextColor="#64748B"
                />
              </View>

              <Text style={styles.scoreSeparator}>-</Text>

              <View style={styles.scoreInputContainer}>
                <Text style={styles.scoreLabel}>Away Score</Text>
                <TextInput
                  style={styles.scoreInput}
                  value={String(correctScoreModal.awayScore)}
                  onChangeText={(text) => setCorrectScoreModal(prev => ({ ...prev, awayScore: parseInt(text) || 0 }))}
                  keyboardType="numeric"
                  placeholderTextColor="#64748B"
                />
              </View>
            </View>

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.cancelButton}
                onPress={() => setCorrectScoreModal({ visible: false, matchId: '', homeScore: 0, awayScore: 0 })}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.submitButton}
                onPress={handleCorrectScore}
              >
                <Text style={styles.submitButtonText}>Save</Text>
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
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#1E293B',
    gap: 12,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700' as const,
    color: '#fff',
  },
  tabBar: {
    backgroundColor: '#1E293B',
    borderBottomWidth: 1,
    borderBottomColor: '#334155',
    paddingVertical: 8,
  },
  tabContainer: {
    flexDirection: 'row',
    paddingHorizontal: 16,
  },
  tab: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    marginRight: 8,
    borderRadius: 8,
    backgroundColor: '#0F172A',
  },
  activeTab: {
    backgroundColor: '#334155',
  },
  tabText: {
    marginLeft: 8,
    fontSize: 14,
    fontWeight: '500' as const,
    color: '#6B7280',
  },
  activeTabText: {
    color: '#3B82F6',
  },
  content: {
    flex: 1,
    padding: 16,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  loadingText: {
    fontSize: 16,
    color: '#64748B',
    marginTop: 16,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '700' as const,
    color: '#fff',
    marginBottom: 16,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 24,
    gap: 12,
  },
  statCard: {
    flex: 1,
    minWidth: '47%',
    backgroundColor: '#1E293B',
    padding: 16,
    borderRadius: 12,
    borderLeftWidth: 4,
  },
  statHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  statTitle: {
    marginLeft: 8,
    fontSize: 14,
    fontWeight: '500' as const,
    color: '#64748B',
  },
  statValue: {
    fontSize: 24,
    fontWeight: '700' as const,
    color: '#fff',
    marginBottom: 4,
  },
  statSubtitle: {
    fontSize: 12,
    color: '#64748B',
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1E293B',
    borderRadius: 8,
    paddingHorizontal: 12,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#334155',
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    paddingVertical: 12,
    fontSize: 16,
    color: '#fff',
  },
  card: {
    backgroundColor: '#1E293B',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '700' as const,
    color: '#fff',
    marginBottom: 4,
  },
  cardSubtitle: {
    fontSize: 14,
    color: '#64748B',
    marginBottom: 2,
  },
  scoreText: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: '#3B82F6',
    marginTop: 4,
  },
  membersList: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#334155',
  },
  membersTitle: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: '#64748B',
    marginBottom: 8,
  },
  memberRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 6,
  },
  memberName: {
    fontSize: 14,
    color: '#fff',
    flex: 1,
  },
  memberActions: {
    flexDirection: 'row',
    gap: 8,
  },
  smallButton: {
    padding: 6,
    borderRadius: 6,
  },
  assignButton: {
    backgroundColor: '#3B82F6',
  },
  removeButton: {
    backgroundColor: '#EF4444',
  },
  adminActions: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#334155',
  },
  adminButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    gap: 6,
  },
  deleteButton: {
    backgroundColor: '#7C2D12',
  },
  editButton: {
    backgroundColor: '#3B82F6',
  },
  approveButton: {
    backgroundColor: '#10B981',
  },
  rejectButton: {
    backgroundColor: '#EF4444',
  },
  adminButtonText: {
    fontSize: 12,
    fontWeight: '600' as const,
    color: '#fff',
  },
  refreshButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#1E293B',
    borderRadius: 8,
    padding: 12,
    marginTop: 16,
    borderWidth: 1,
    borderColor: '#3B82F6',
  },
  refreshButtonText: {
    marginLeft: 8,
    fontSize: 14,
    fontWeight: '600' as const,
    color: '#3B82F6',
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 48,
    paddingHorizontal: 24,
    backgroundColor: '#1E293B',
    borderRadius: 12,
    marginBottom: 16,
  },
  emptyStateText: {
    fontSize: 18,
    fontWeight: '600' as const,
    color: '#64748B',
    marginTop: 16,
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
  scoreInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
    gap: 16,
  },
  scoreInputContainer: {
    flex: 1,
  },
  scoreLabel: {
    fontSize: 14,
    color: '#64748B',
    marginBottom: 8,
    textAlign: 'center',
  },
  scoreInput: {
    backgroundColor: '#0F172A',
    borderRadius: 12,
    padding: 16,
    fontSize: 24,
    fontWeight: '700' as const,
    color: '#fff',
    textAlign: 'center',
    borderWidth: 1,
    borderColor: '#334155',
  },
  scoreSeparator: {
    fontSize: 32,
    fontWeight: '700' as const,
    color: '#64748B',
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
    backgroundColor: '#3B82F6',
    alignItems: 'center',
  },
  submitButtonText: {
    fontSize: 16,
    color: '#fff',
    fontWeight: '600' as const,
  },
});
