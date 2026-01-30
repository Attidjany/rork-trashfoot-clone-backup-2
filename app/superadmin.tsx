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
import { Stack } from 'expo-router';
import {
  Users,
  Trophy,
  Target,
  Shield,
  Search,
  Crown,
  Trash2,
  UserX,
  Edit2,
  CheckCircle,
  XCircle,
  UserCog,
  Database,
  TrendingUp,
  Eye,
  LogOut,
  RotateCcw,
} from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { supabase } from '@/lib/supabase';

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
  const insets = useSafeAreaInsets();
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [email, setEmail] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [loginError, setLoginError] = useState<string>('');

  const [activeTab, setActiveTab] = useState<TabType>('overview');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [correctScoreModal, setCorrectScoreModal] = useState<{ visible: boolean; matchId: string; homeScore: number; awayScore: number }>({
    visible: false,
    matchId: '',
    homeScore: 0,
    awayScore: 0,
  });

  const [stats, setStats] = useState<any>({
    totalPlayers: 0,
    totalGroups: 0,
    activeGroups: 0,
    totalMatches: 0,
    completedMatches: 0,
    totalCompetitions: 0,
    liveMatches: 0,
  });
  const [groups, setGroups] = useState<any[]>([]);
  const [players, setPlayers] = useState<any[]>([]);
  const [matches, setMatches] = useState<any[]>([]);
  const [competitions, setCompetitions] = useState<any[]>([]);
  const [joinRequests, setJoinRequests] = useState<any[]>([]);

  const [dataLoading, setDataLoading] = useState<boolean>(false);

  useEffect(() => {
    checkAuth();
  }, []);

  const loadAllData = useCallback(async () => {
    setDataLoading(true);
    try {
      await Promise.all([
        loadStats(),
        loadGroups(),
        loadPlayers(),
        loadMatches(),
        loadCompetitions(),
        loadJoinRequests(),
      ]);
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setDataLoading(false);
    }
  }, []);

  const setupRealtimeSubscriptions = useCallback(() => {
    const groupsChannel = supabase
      .channel('superadmin-groups')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'groups' }, (payload) => {
        console.log('🔄 Groups table changed:', payload.eventType, payload);
        loadGroups();
        loadStats();
      })
      .subscribe();

    const playersChannel = supabase
      .channel('superadmin-players')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'players' }, () => {
        loadPlayers();
        loadStats();
      })
      .subscribe();

    const matchesChannel = supabase
      .channel('superadmin-matches')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'matches' }, () => {
        loadMatches();
        loadStats();
      })
      .subscribe();

    const competitionsChannel = supabase
      .channel('superadmin-competitions')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'competitions' }, () => {
        loadCompetitions();
        loadStats();
      })
      .subscribe();

    const joinRequestsChannel = supabase
      .channel('superadmin-join-requests')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'join_requests' }, () => {
        loadJoinRequests();
      })
      .subscribe();

    const membersChannel = supabase
      .channel('superadmin-members')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'group_members' }, () => {
        loadGroups();
      })
      .subscribe();

    return () => {
      groupsChannel.unsubscribe();
      playersChannel.unsubscribe();
      matchesChannel.unsubscribe();
      competitionsChannel.unsubscribe();
      joinRequestsChannel.unsubscribe();
      membersChannel.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (isAuthenticated) {
      loadAllData();
      const unsubscribe = setupRealtimeSubscriptions();
      return unsubscribe;
    }
  }, [isAuthenticated, loadAllData, setupRealtimeSubscriptions]);

  const checkAuth = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (session?.user) {
        const { data: player } = await supabase
          .from('players')
          .select('role')
          .eq('email', session.user.email)
          .single();

        if (player?.role === 'super_admin') {
          setIsAuthenticated(true);
        }
      }
    } catch (error) {
      console.error('Auth check error:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleLogin = async () => {
    setLoginError('');
    setIsLoading(true);

    try {
      const { error: authError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (authError) throw authError;

      const { data: player, error: playerError } = await supabase
        .from('players')
        .select('role')
        .eq('email', email)
        .single();

      if (playerError) throw playerError;

      if (player?.role !== 'super_admin') {
        await supabase.auth.signOut();
        throw new Error('Access denied. Super admin privileges required.');
      }

      setIsAuthenticated(true);
    } catch (error: any) {
      setLoginError(error.message || 'Login failed');
    } finally {
      setIsLoading(false);
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setIsAuthenticated(false);
    setEmail('');
    setPassword('');
  };

  const loadStats = async () => {
    try {
      const [playersRes, groupsRes, matchesRes, competitionsRes] = await Promise.all([
        supabase.from('players').select('id', { count: 'exact', head: true }),
        supabase.from('groups').select('id', { count: 'exact', head: true }),
        supabase.from('matches').select('id, status', { count: 'exact' }),
        supabase.from('competitions').select('id', { count: 'exact', head: true }),
      ]);

      const completedMatches = matchesRes.data?.filter(m => m.status === 'completed').length || 0;
      const liveMatches = matchesRes.data?.filter(m => m.status === 'live').length || 0;

      setStats({
        totalPlayers: playersRes.count || 0,
        totalGroups: groupsRes.count || 0,
        activeGroups: groupsRes.count || 0,
        totalMatches: matchesRes.count || 0,
        completedMatches,
        totalCompetitions: competitionsRes.count || 0,
        liveMatches,
      });
    } catch (error) {
      console.error('Error loading stats:', error);
    }
  };

  const loadGroups = async () => {
    try {
      const { data, error } = await supabase
        .from('groups')
        .select(`
          id,
          name,
          description,
          admin_id,
          admin:players!groups_admin_id_fkey(name),
          members:group_members(
            id,
            player:players(id, name)
          ),
          competitions(id)
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setGroups(data || []);
    } catch (error) {
      console.error('Error loading groups:', error);
    }
  };

  const loadPlayers = async () => {
    try {
      const { data, error } = await supabase
        .from('players')
        .select(`
          id,
          name,
          email,
          gamer_handle,
          role,
          group_memberships:group_members(id)
        `)
        .order('joined_at', { ascending: false });

      if (error) throw error;
      setPlayers(data || []);
    } catch (error) {
      console.error('Error loading players:', error);
    }
  };

  const loadMatches = async () => {
    try {
      const { data, error } = await supabase
        .from('matches')
        .select(`
          id,
          status,
          home_score,
          away_score,
          deleted_at,
          home_player:players!matches_home_player_id_fkey(name),
          away_player:players!matches_away_player_id_fkey(name),
          competition:competitions(
            name,
            group:groups(name)
          )
        `)
        .order('created_at', { ascending: false })
        .limit(100);

      if (error) throw error;
      setMatches(data || []);
    } catch (error) {
      console.error('Error loading matches:', error);
    }
  };

  const loadCompetitions = async () => {
    try {
      console.log('🔍 Loading competitions...');
      
      const { data: competitionsData, error: competitionsError } = await supabase
        .from('competitions')
        .select('*')
        .order('created_at', { ascending: false });

      if (competitionsError) {
        console.error('❌ Competitions query error:', competitionsError);
        throw competitionsError;
      }

      console.log('✅ Competitions loaded:', competitionsData?.length || 0);

      const enrichedCompetitions = await Promise.all(
        (competitionsData || []).map(async (comp) => {
          const [groupRes, matchesRes, participantsRes] = await Promise.all([
            supabase.from('groups').select('name').eq('id', comp.group_id).single(),
            supabase.from('matches').select('id').eq('competition_id', comp.id),
            supabase.from('competition_participants').select('id').eq('competition_id', comp.id),
          ]);

          return {
            ...comp,
            group: groupRes.data,
            matches: matchesRes.data || [],
            participants: participantsRes.data || [],
          };
        })
      );

      console.log('✅ Enriched competitions:', enrichedCompetitions.length);
      setCompetitions(enrichedCompetitions);
    } catch (error) {
      console.error('❌ Error loading competitions:', error);
    }
  };

  const loadJoinRequests = async () => {
    try {
      const { data, error } = await supabase
        .from('join_requests')
        .select(`
          id,
          player_id,
          player_name,
          group_id,
          requested_at,
          group:groups(name)
        `)
        .eq('status', 'pending')
        .order('requested_at', { ascending: false });

      if (error) throw error;

      const formattedRequests = (data || []).map(req => ({
        id: req.id,
        player_id: req.player_id,
        player_name: req.player_name,
        group_id: req.group_id,
        groupName: (req.group as any)?.name || 'Unknown',
        requested_at: req.requested_at,
      }));

      setJoinRequests(formattedRequests);
    } catch (error) {
      console.error('Error loading join requests:', error);
    }
  };

  const handleDeleteGroup = async (groupId: string, groupName: string) => {
    const confirmed = Platform.OS === 'web'
      ? window.confirm(`Are you sure you want to delete "${groupName}"? This will delete all competitions, matches, and memberships.`)
      : await new Promise(resolve => {
          Alert.alert(
            'Delete Group',
            `Are you sure you want to delete "${groupName}"? This will delete all competitions, matches, and memberships.`,
            [
              { text: 'Cancel', style: 'cancel', onPress: () => resolve(false) },
              { text: 'Delete', style: 'destructive', onPress: () => resolve(true) }
            ]
          );
        });

    if (!confirmed) return;

    try {
      const { error } = await supabase.from('groups').delete().eq('id', groupId);
      if (error) throw error;

      if (Platform.OS === 'web') {
        alert('Group deleted successfully');
      } else {
        Alert.alert('Success', 'Group deleted successfully');
      }
    } catch (error: any) {
      if (Platform.OS === 'web') {
        alert(error.message || 'Failed to delete group');
      } else {
        Alert.alert('Error', error.message || 'Failed to delete group');
      }
    }
  };

  const handleRemoveUser = async (groupId: string, playerId: string, playerName: string, groupName: string) => {
    const confirmed = Platform.OS === 'web'
      ? window.confirm(`Remove ${playerName} from ${groupName}?`)
      : await new Promise(resolve => {
          Alert.alert(
            'Remove User',
            `Remove ${playerName} from ${groupName}?`,
            [
              { text: 'Cancel', style: 'cancel', onPress: () => resolve(false) },
              { text: 'Remove', style: 'destructive', onPress: () => resolve(true) }
            ]
          );
        });

    if (!confirmed) return;

    try {
      const { error } = await supabase
        .from('group_members')
        .delete()
        .eq('group_id', groupId)
        .eq('player_id', playerId);

      if (error) throw error;

      if (Platform.OS === 'web') {
        alert('User removed successfully');
      } else {
        Alert.alert('Success', 'User removed successfully');
      }
    } catch (error: any) {
      if (Platform.OS === 'web') {
        alert(error.message || 'Failed to remove user');
      } else {
        Alert.alert('Error', error.message || 'Failed to remove user');
      }
    }
  };

  const handleDeleteMatch = async (matchId: string) => {
    const confirmed = Platform.OS === 'web'
      ? window.confirm('Are you sure you want to delete this match? It can be restored within 7 days.')
      : await new Promise(resolve => {
          Alert.alert(
            'Delete Match',
            'Are you sure you want to delete this match? It can be restored within 7 days.',
            [
              { text: 'Cancel', style: 'cancel', onPress: () => resolve(false) },
              { text: 'Delete', style: 'destructive', onPress: () => resolve(true) }
            ]
          );
        });

    if (!confirmed) return;

    try {
      const { error } = await supabase.from('matches').update({ 
        deleted_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }).eq('id', matchId);
      if (error) throw error;

      await loadMatches();

      if (Platform.OS === 'web') {
        alert('Match deleted successfully. Can be restored within 7 days.');
      } else {
        Alert.alert('Success', 'Match deleted successfully. Can be restored within 7 days.');
      }
    } catch (error: any) {
      if (Platform.OS === 'web') {
        alert(error.message || 'Failed to delete match');
      } else {
        Alert.alert('Error', error.message || 'Failed to delete match');
      }
    }
  };

  const handleRestoreMatch = async (matchId: string, deletedAt: string) => {
    const deletedDate = new Date(deletedAt);
    const daysSinceDeleted = (Date.now() - deletedDate.getTime()) / (1000 * 60 * 60 * 24);
    
    if (daysSinceDeleted > 7) {
      if (Platform.OS === 'web') {
        alert('Cannot restore: Match was deleted more than 7 days ago');
      } else {
        Alert.alert('Error', 'Cannot restore: Match was deleted more than 7 days ago');
      }
      return;
    }

    const confirmed = Platform.OS === 'web'
      ? window.confirm('Restore this match?')
      : await new Promise(resolve => {
          Alert.alert(
            'Restore Match',
            'Are you sure you want to restore this match?',
            [
              { text: 'Cancel', style: 'cancel', onPress: () => resolve(false) },
              { text: 'Restore', onPress: () => resolve(true) }
            ]
          );
        });

    if (!confirmed) return;

    try {
      const { error } = await supabase.from('matches').update({ 
        status: 'scheduled',
        deleted_at: null,
        updated_at: new Date().toISOString()
      }).eq('id', matchId);
      if (error) throw error;

      await loadMatches();

      if (Platform.OS === 'web') {
        alert('Match restored successfully');
      } else {
        Alert.alert('Success', 'Match restored successfully');
      }
    } catch (error: any) {
      if (Platform.OS === 'web') {
        alert(error.message || 'Failed to restore match');
      } else {
        Alert.alert('Error', error.message || 'Failed to restore match');
      }
    }
  };

  const handleCorrectScore = async () => {
    try {
      const { error } = await supabase
        .from('matches')
        .update({
          home_score: correctScoreModal.homeScore,
          away_score: correctScoreModal.awayScore,
          status: 'completed',
          completed_at: new Date().toISOString(),
        })
        .eq('id', correctScoreModal.matchId);

      if (error) throw error;

      setCorrectScoreModal({ visible: false, matchId: '', homeScore: 0, awayScore: 0 });

      if (Platform.OS === 'web') {
        alert('Score corrected successfully');
      } else {
        Alert.alert('Success', 'Score corrected successfully');
      }
    } catch (error: any) {
      if (Platform.OS === 'web') {
        alert(error.message || 'Failed to correct score');
      } else {
        Alert.alert('Error', error.message || 'Failed to correct score');
      }
    }
  };

  const handleManageRequest = async (requestId: string, action: 'approve' | 'reject') => {
    try {
      const request = joinRequests.find(r => r.id === requestId);
      if (!request) return;

      if (action === 'approve') {
        const { error: memberError } = await supabase
          .from('group_members')
          .insert({
            group_id: request.group_id,
            player_id: request.player_id,
          });

        if (memberError) throw memberError;
      }

      const { error: updateError } = await supabase
        .from('join_requests')
        .update({ status: action === 'approve' ? 'approved' : 'rejected' })
        .eq('id', requestId);

      if (updateError) throw updateError;

      if (Platform.OS === 'web') {
        alert(`Request ${action}d successfully`);
      } else {
        Alert.alert('Success', `Request ${action}d successfully`);
      }
    } catch (error: any) {
      if (Platform.OS === 'web') {
        alert(error.message || `Failed to ${action} request`);
      } else {
        Alert.alert('Error', error.message || `Failed to ${action} request`);
      }
    }
  };

  const handleDeleteCompetition = async (competitionId: string, competitionName: string) => {
    const confirmed = Platform.OS === 'web'
      ? window.confirm(`Delete "${competitionName}"? This will delete all matches.`)
      : await new Promise(resolve => {
          Alert.alert(
            'Delete Competition',
            `Delete "${competitionName}"? This will delete all matches.`,
            [
              { text: 'Cancel', style: 'cancel', onPress: () => resolve(false) },
              { text: 'Delete', style: 'destructive', onPress: () => resolve(true) }
            ]
          );
        });

    if (!confirmed) return;

    try {
      const { error } = await supabase.from('competitions').delete().eq('id', competitionId);
      if (error) throw error;

      if (Platform.OS === 'web') {
        alert('Competition deleted successfully');
      } else {
        Alert.alert('Success', 'Competition deleted successfully');
      }
    } catch (error: any) {
      if (Platform.OS === 'web') {
        alert(error.message || 'Failed to delete competition');
      } else {
        Alert.alert('Error', error.message || 'Failed to delete competition');
      }
    }
  };

  const handleAssignAdmin = async (groupId: string, playerId: string, playerName: string, groupName: string) => {
    const confirmed = Platform.OS === 'web'
      ? window.confirm(`Make ${playerName} admin of ${groupName}?`)
      : await new Promise(resolve => {
          Alert.alert(
            'Assign Admin',
            `Make ${playerName} admin of ${groupName}?`,
            [
              { text: 'Cancel', style: 'cancel', onPress: () => resolve(false) },
              { text: 'Assign', onPress: () => resolve(true) }
            ]
          );
        });

    if (!confirmed) return;

    try {
      const { error } = await supabase
        .from('groups')
        .update({ admin_id: playerId })
        .eq('id', groupId);

      if (error) throw error;

      if (Platform.OS === 'web') {
        alert('Admin assigned successfully');
      } else {
        Alert.alert('Success', 'Admin assigned successfully');
      }
    } catch (error: any) {
      if (Platform.OS === 'web') {
        alert(error.message || 'Failed to assign admin');
      } else {
        Alert.alert('Error', error.message || 'Failed to assign admin');
      }
    }
  };

  const handleDeletePlayer = async (playerId: string, playerName: string) => {
    const confirmed = Platform.OS === 'web'
      ? window.confirm(`Delete ${playerName}? This will delete their auth account, remove them from all groups, and delete their stats. Matches will remain but show as deleted player.`)
      : await new Promise(resolve => {
          Alert.alert(
            'Delete Player',
            `Delete ${playerName}? This will:\n• Delete their auth account\n• Remove them from all groups\n• Delete their stats\n• Orphan their matches (matches will remain but show as deleted player)`,
            [
              { text: 'Cancel', style: 'cancel', onPress: () => resolve(false) },
              { text: 'Delete', style: 'destructive', onPress: () => resolve(true) }
            ]
          );
        });

    if (!confirmed) return;

    try {
      const { error } = await supabase.from('players').delete().eq('id', playerId);
      if (error) throw error;

      if (Platform.OS === 'web') {
        alert('Player deleted successfully');
      } else {
        Alert.alert('Success', 'Player deleted successfully');
      }
    } catch (error: any) {
      if (Platform.OS === 'web') {
        alert(error.message || 'Failed to delete player');
      } else {
        Alert.alert('Error', error.message || 'Failed to delete player');
      }
    }
  };

  const getAdminName = (admin: any) => {
    if (!admin) return 'Unknown';
    if (Array.isArray(admin)) return admin[0]?.name || 'Unknown';
    return admin.name || 'Unknown';
  };

  const getPlayerInfo = (player: any) => {
    if (!player) return { id: '', name: 'Unknown' };
    if (Array.isArray(player)) return { id: player[0]?.id || '', name: player[0]?.name || 'Unknown' };
    return { id: player.id || '', name: player.name || 'Unknown' };
  };

  const getGroupName = (group: any) => {
    if (!group) return 'Unknown';
    if (Array.isArray(group)) return group[0]?.name || 'Unknown';
    return group.name || 'Unknown';
  };

  const getCompetitionInfo = (competition: any) => {
    if (!competition) return { name: 'Unknown', groupName: 'Unknown' };
    if (Array.isArray(competition)) {
      const comp = competition[0];
      return {
        name: comp?.name || 'Unknown',
        groupName: getGroupName(comp?.group)
      };
    }
    return {
      name: competition.name || 'Unknown',
      groupName: getGroupName(competition.group)
    };
  };

  const filteredGroups = useMemo(() => {
    if (!searchQuery) return groups;
    return groups.filter(group =>
      group.name.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [groups, searchQuery]);

  const filteredPlayers = useMemo(() => {
    if (!searchQuery) return players;
    return players.filter(player =>
      player.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      player.email?.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [players, searchQuery]);

  const filteredMatches = useMemo(() => {
    if (!searchQuery) return matches;
    return matches.filter(match => {
      const homeName = getPlayerInfo(match.home_player).name;
      const awayName = getPlayerInfo(match.away_player).name;
      return homeName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        awayName.toLowerCase().includes(searchQuery.toLowerCase());
    });
  }, [matches, searchQuery]);

  const filteredCompetitions = useMemo(() => {
    if (!searchQuery) return competitions;
    return competitions.filter(comp =>
      comp.name.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [competitions, searchQuery]);

  const tabs = [
    { id: 'overview' as const, label: 'Overview', icon: Eye },
    { id: 'groups' as const, label: 'Groups', icon: Users },
    { id: 'players' as const, label: 'Players', icon: Crown },
    { id: 'matches' as const, label: 'Matches', icon: Target },
    { id: 'competitions' as const, label: 'Competitions', icon: Trophy },
    { id: 'requests' as const, label: 'Requests', icon: UserCog },
  ];

  const renderOverview = () => (
    <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
      <Text style={styles.sectionTitle}>Platform Statistics</Text>
      <View style={styles.statsGrid}>
        <StatCard
          icon={Users}
          title="Total Players"
          value={stats.totalPlayers}
          subtitle="Registered users"
          color="#3B82F6"
        />
        <StatCard
          icon={Crown}
          title="Total Groups"
          value={stats.totalGroups}
          subtitle={`${stats.activeGroups} active`}
          color="#10B981"
        />
        <StatCard
          icon={Target}
          title="Total Matches"
          value={stats.totalMatches}
          subtitle={`${stats.completedMatches} completed`}
          color="#F59E0B"
        />
        <StatCard
          icon={Trophy}
          title="Competitions"
          value={stats.totalCompetitions}
          subtitle="All competitions"
          color="#8B5CF6"
        />
      </View>

      <View style={styles.statsGrid}>
        <StatCard
          icon={TrendingUp}
          title="Live Matches"
          value={stats.liveMatches}
          color="#EF4444"
        />
        <StatCard
          icon={Database}
          title="Pending Requests"
          value={joinRequests.length}
          color="#F59E0B"
        />
      </View>
    </ScrollView>
  );

  const renderGroups = () => (
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
      {filteredGroups.map((group) => (
        <View key={group.id} style={styles.card}>
          <View style={styles.cardHeader}>
            <View style={{ flex: 1 }}>
              <Text style={styles.cardTitle}>{group.name}</Text>
              <Text style={styles.cardSubtitle}>{group.description}</Text>
              <Text style={styles.cardSubtitle}>
                Admin: {getAdminName(group.admin)}
              </Text>
              <Text style={styles.cardSubtitle}>
                Members: {group.members?.length || 0} | Competitions: {group.competitions?.length || 0}
              </Text>
            </View>
          </View>

          {group.members && group.members.length > 0 && (
            <View style={styles.membersList}>
              <Text style={styles.membersTitle}>Members:</Text>
              {group.members.map((member: any) => {
                const playerInfo = getPlayerInfo(member.player);
                return (
                  <View key={member.id} style={styles.memberRow}>
                    <Text style={styles.memberName}>{playerInfo.name}</Text>
                    <View style={styles.memberActions}>
                      <TouchableOpacity
                        style={[styles.smallButton, styles.assignButton]}
                        onPress={() => handleAssignAdmin(group.id, playerInfo.id, playerInfo.name, group.name)}
                      >
                        <UserCog size={14} color="#fff" />
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[styles.smallButton, styles.removeButton]}
                        onPress={() => handleRemoveUser(group.id, playerInfo.id, playerInfo.name, group.name)}
                      >
                        <UserX size={14} color="#fff" />
                      </TouchableOpacity>
                    </View>
                  </View>
                );
              })}
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

  const renderPlayers = () => (
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
      {filteredPlayers.map((player) => (
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

  const renderMatches = () => (
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
      {filteredMatches.map((match) => {
        const homePlayer = getPlayerInfo(match.home_player);
        const awayPlayer = getPlayerInfo(match.away_player);
        const compInfo = getCompetitionInfo(match.competition);
        
        const isCompleted = match.status === 'completed';
        const homeWon = isCompleted && match.home_score! > match.away_score!;
        const awayWon = isCompleted && match.away_score! > match.home_score!;
        
        return (
          <View key={match.id} style={styles.card}>
            <View style={styles.cardHeader}>
              <View style={{ flex: 1 }}>
                <View style={styles.matchPlayersRow}>
                  <Text style={[styles.matchPlayerName, homeWon && styles.winnerText]}>
                    {homePlayer.name}
                  </Text>
                  <Text style={styles.matchVs}>vs</Text>
                  <Text style={[styles.matchPlayerName, awayWon && styles.winnerText]}>
                    {awayPlayer.name}
                  </Text>
                </View>
                <Text style={styles.cardSubtitle}>
                  {compInfo.groupName} • {compInfo.name}
                </Text>
                <View style={styles.statusRow}>
                  <Text style={styles.cardSubtitle}>
                    Status: {match.status}
                  </Text>
                  {match.status === 'deleted' && match.deleted_at && (
                    <Text style={styles.deletedInfo}>
                      ({Math.ceil((Date.now() - new Date(match.deleted_at).getTime()) / (1000 * 60 * 60 * 24))}d ago)
                    </Text>
                  )}
                </View>
                {match.status === 'completed' && (
                  <View style={styles.matchScoreRow}>
                    <Text style={[styles.matchScore, homeWon && styles.winnerScore]}>
                      {match.home_score}
                    </Text>
                    <Text style={styles.matchScoreSeparator}>-</Text>
                    <Text style={[styles.matchScore, awayWon && styles.winnerScore]}>
                      {match.away_score}
                    </Text>
                  </View>
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
              {match.deleted_at ? (
                <TouchableOpacity
                  style={[styles.adminButton, styles.restoreButton]}
                  onPress={() => handleRestoreMatch(match.id, match.deleted_at)}
                >
                  <RotateCcw size={14} color="#fff" />
                  <Text style={styles.adminButtonText}>Restore Match</Text>
                </TouchableOpacity>
              ) : (
                <TouchableOpacity
                  style={[styles.adminButton, styles.deleteButton]}
                  onPress={() => handleDeleteMatch(match.id)}
                >
                  <Trash2 size={14} color="#fff" />
                  <Text style={styles.adminButtonText}>Delete Match</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        );
      })}
    </ScrollView>
  );

  const renderCompetitions = () => (
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
      {filteredCompetitions.map((comp) => (
        <View key={comp.id} style={styles.card}>
          <View style={styles.cardHeader}>
            <View style={{ flex: 1 }}>
              <Text style={styles.cardTitle}>{comp.name}</Text>
              <Text style={styles.cardSubtitle}>
                {getGroupName(comp.group)} • {comp.type} • {comp.status}
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

  const renderRequests = () => (
    <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
      <Text style={styles.sectionTitle}>Pending Join Requests ({joinRequests.length})</Text>
      {joinRequests.length === 0 ? (
        <View style={styles.emptyState}>
          <UserCog size={48} color="#9CA3AF" />
          <Text style={styles.emptyStateText}>No pending requests</Text>
        </View>
      ) : (
        joinRequests.map((request) => (
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

  if (isLoading) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <Stack.Screen options={{ headerShown: false }} />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#3B82F6" />
          <Text style={styles.loadingText}>Loading...</Text>
        </View>
      </View>
    );
  }

  if (!isAuthenticated) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <Stack.Screen options={{ headerShown: false }} />
        <View style={styles.loginContainer}>
          <Shield size={64} color="#F59E0B" />
          <Text style={styles.loginTitle}>Super Admin Login</Text>
          <Text style={styles.loginSubtitle}>Enter your credentials to access the admin panel</Text>

          <TextInput
            style={styles.input}
            placeholder="Email"
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            keyboardType="email-address"
            placeholderTextColor="#64748B"
          />

          <TextInput
            style={styles.input}
            placeholder="Password"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            placeholderTextColor="#64748B"
          />

          {loginError ? <Text style={styles.errorText}>{loginError}</Text> : null}

          <TouchableOpacity
            style={styles.loginButton}
            onPress={handleLogin}
            disabled={isLoading}
          >
            {isLoading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.loginButtonText}>Login</Text>
            )}
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <Stack.Screen options={{ headerShown: false }} />

      <View style={styles.header}>
        <Shield size={32} color="#F59E0B" />
        <Text style={styles.headerTitle}>Super Admin Dashboard</Text>
        <TouchableOpacity onPress={handleLogout} style={styles.logoutButton}>
          <LogOut size={20} color="#EF4444" />
        </TouchableOpacity>
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

      {dataLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#3B82F6" />
          <Text style={styles.loadingText}>Loading data...</Text>
        </View>
      ) : (
        renderContent()
      )}

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
  loginContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  loginTitle: {
    fontSize: 28,
    fontWeight: '700' as const,
    color: '#fff',
    marginTop: 24,
    marginBottom: 8,
  },
  loginSubtitle: {
    fontSize: 16,
    color: '#64748B',
    marginBottom: 32,
    textAlign: 'center',
  },
  input: {
    width: '100%',
    maxWidth: 400,
    backgroundColor: '#1E293B',
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    color: '#fff',
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#334155',
  },
  loginButton: {
    width: '100%',
    maxWidth: 400,
    backgroundColor: '#3B82F6',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    marginTop: 8,
  },
  loginButtonText: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: '#fff',
  },
  errorText: {
    color: '#EF4444',
    fontSize: 14,
    marginBottom: 16,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#1E293B',
    gap: 12,
  },
  headerTitle: {
    flex: 1,
    fontSize: 20,
    fontWeight: '700' as const,
    color: '#fff',
  },
  logoutButton: {
    padding: 8,
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
  matchPlayersRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  matchPlayerName: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: '#fff',
  },
  matchVs: {
    fontSize: 14,
    color: '#64748B',
  },
  matchScoreRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 4,
  },
  matchScore: {
    fontSize: 20,
    fontWeight: '700' as const,
    color: '#fff',
  },
  matchScoreSeparator: {
    fontSize: 16,
    color: '#64748B',
  },
  winnerText: {
    color: '#10B981',
  },
  winnerScore: {
    color: '#10B981',
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
  restoreButton: {
    backgroundColor: '#10B981',
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  deletedInfo: {
    fontSize: 12,
    color: '#F59E0B',
    fontStyle: 'italic',
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
