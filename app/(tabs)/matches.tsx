import React, { useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Modal,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Plus, Calendar, Trophy, Youtube, CheckCircle, Target, Timer } from 'lucide-react-native';
import { useGameStore } from '@/hooks/use-game-store';
import { LinearGradient } from 'expo-linear-gradient';
import { Match, Competition } from '@/types/game';
import { useSession } from '@/hooks/use-session';
import { useRealtimeGroups } from '@/hooks/use-realtime-groups';
import { supabase } from '@/lib/supabase';
import { getMatchCountdown } from '@/lib/countdown-utils';

export default function MatchesScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user, loading: sessionLoading } = useSession();
  const { groups, isLoading: groupsLoading, refetch: refetchGroups } = useRealtimeGroups();
  const { activeGroupId, shareYoutubeLink } = useGameStore();
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [currentPlayerId, setCurrentPlayerId] = React.useState<string | null>(null);
  
  const activeGroup = groups.find(g => g.id === activeGroupId) || groups[0] || null;
  const isLoading = sessionLoading || groupsLoading;

  React.useEffect(() => {
    const fetchCurrentPlayerId = async () => {
      if (!user?.id) return;
      const { data } = await supabase
        .from('players')
        .select('id')
        .eq('auth_user_id', user.id)
        .single();
      if (data) {
        setCurrentPlayerId(data.id);
      }
    };
    fetchCurrentPlayerId();
  }, [user?.id]);
  const [selectedTab, setSelectedTab] = useState<'upcoming' | 'live' | 'completed' | 'tournaments'>('upcoming');
  const [resultModal, setResultModal] = useState(false);
  const [youtubeModal, setYoutubeModal] = useState(false);
  const [selectedMatch, setSelectedMatch] = useState<Match | null>(null);
  const [homeScore, setHomeScore] = useState('');
  const [awayScore, setAwayScore] = useState('');
  const [youtubeLink, setYoutubeLink] = useState('');
  const [goLiveWithoutLink, setGoLiveWithoutLink] = useState(false);

  if (isLoading) {
    return (
      <View style={[styles.emptyContainer, { paddingTop: insets.top }]}>
        <ActivityIndicator size="large" color="#0EA5E9" />
      </View>
    );
  }

  if (!activeGroup) {
    return (
      <View style={[styles.emptyContainer, { paddingTop: insets.top }]}>
        <Trophy size={64} color="#64748B" />
        <Text style={styles.emptyTitle}>No Active Group</Text>
        <Text style={styles.emptyText}>Join or create a group to start tracking matches</Text>
      </View>
    );
  }

  const allMatches = activeGroup.competitions.flatMap(c => c.matches);
  const upcomingMatches = allMatches.filter(m => m.status === 'scheduled');
  const liveMatches = allMatches.filter(m => m.status === 'live');
  const completedMatches = allMatches.filter(m => m.status === 'completed')
    .sort((a, b) => new Date(b.completedAt!).getTime() - new Date(a.completedAt!).getTime());
  const knockoutTournaments = activeGroup.competitions.filter(c => c.type === 'tournament' && c.tournamentType === 'knockout');

  const handleSubmitResult = async () => {
    if (!selectedMatch || homeScore === '' || awayScore === '') {
      Alert.alert('Error', 'Please enter both scores');
      return;
    }
    
    const homeScoreNum = parseInt(homeScore);
    const awayScoreNum = parseInt(awayScore);
    
    if (isNaN(homeScoreNum) || isNaN(awayScoreNum) || homeScoreNum < 0 || awayScoreNum < 0) {
      Alert.alert('Error', 'Please enter valid scores');
      return;
    }
    
    if (!currentPlayerId) {
      Alert.alert('Error', 'Player not found');
      return;
    }
    
    const isGroupAdmin = activeGroup?.adminId === currentPlayerId;
    const isHomePlayer = selectedMatch.homePlayerId === currentPlayerId;
    const isAwayPlayer = selectedMatch.awayPlayerId === currentPlayerId;
    
    if (!isGroupAdmin && !isHomePlayer && !isAwayPlayer) {
      Alert.alert('Error', 'Only the two players involved in the match or the group admin can submit results');
      return;
    }
    
    setIsSubmitting(true);
    
    try {
      console.log('🎯 Submitting result:', { matchId: selectedMatch.id, homeScore: homeScoreNum, awayScore: awayScoreNum });
      
      const updateData: any = {
        home_score: homeScoreNum,
        away_score: awayScoreNum,
      };
      
      if (selectedMatch.status !== 'completed') {
        updateData.status = 'completed';
        updateData.completed_at = new Date().toISOString();
      }
      
      const { error } = await supabase
        .from('matches')
        .update(updateData)
        .eq('id', selectedMatch.id);
      
      if (error) {
        console.error('❌ Error updating match:', error);
        throw new Error(error.message);
      }
      
      console.log('✅ Match result submitted successfully');
      Alert.alert('Success', selectedMatch.status === 'completed' ? 'Score corrected successfully' : 'Match result submitted successfully');
      
      setResultModal(false);
      setSelectedMatch(null);
      setHomeScore('');
      setAwayScore('');
      
      await refetchGroups();
    } catch (error: any) {
      console.error('❌ Error submitting result:', error);
      Alert.alert('Error', error?.message || 'Failed to submit result');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteMatch = async (matchId: string) => {
    if (!currentPlayerId) {
      Alert.alert('Error', 'Player not found');
      return;
    }

    const isGroupAdmin = activeGroup?.adminId === currentPlayerId;
    if (!isGroupAdmin) {
      Alert.alert('Error', 'Only group admins can delete matches');
      return;
    }

    Alert.alert(
      'Delete Match',
      'Are you sure you want to delete this match?',
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              console.log('🔄 Deleting match from database:', matchId);
              const { error } = await supabase
                .from('matches')
                .delete()
                .eq('id', matchId);
              
              if (error) {
                console.error('❌ Error deleting match:', error);
                Alert.alert('Error', 'Failed to delete match');
                return;
              }
              
              console.log('✅ Match deleted successfully');
              Alert.alert('Success', 'Match deleted successfully');
              await refetchGroups();
            } catch (error: any) {
              console.error('❌ Error deleting match:', error);
              Alert.alert('Error', error?.message || 'Failed to delete match');
            }
          },
        },
      ]
    );
  };

  const handleShareYoutube = () => {
    if (!selectedMatch) return;
    
    if (goLiveWithoutLink) {
      // Go live without YouTube link
      shareYoutubeLink(selectedMatch.id, '');
    } else if (youtubeLink) {
      // Go live with YouTube link
      shareYoutubeLink(selectedMatch.id, youtubeLink);
    } else {
      return; // Need either link or checkbox
    }
    
    setYoutubeModal(false);
    setSelectedMatch(null);
    setYoutubeLink('');
    setGoLiveWithoutLink(false);
  };

  const renderTournament = (tournament: Competition) => {
    const tournamentMatches = tournament.matches;
    const completedMatches = tournamentMatches.filter((m: Match) => m.status === 'completed').length;
    const totalMatches = tournamentMatches.length;
    const isActive = tournament.status === 'active';
    const participants = tournament.participants.length;

    return (
      <TouchableOpacity
        key={tournament.id}
        style={styles.tournamentCard}
        onPress={() => router.push(`/tournament-bracket?id=${tournament.id}`)}
      >
        <View style={styles.tournamentHeader}>
          <View style={styles.tournamentBadge}>
            <Target size={16} color="#8B5CF6" />
            <Text style={styles.tournamentType}>KNOCKOUT</Text>
          </View>
          <View style={[styles.statusBadge, isActive ? styles.activeBadge : styles.upcomingBadge]}>
            <Text style={styles.statusText}>{tournament.status.toUpperCase()}</Text>
          </View>
        </View>
        
        <Text style={styles.tournamentName}>{tournament.name}</Text>
        
        <View style={styles.tournamentStats}>
          <View style={styles.statItem}>
            <Text style={styles.statLabel}>Participants</Text>
            <Text style={styles.statValue}>{participants}</Text>
          </View>
          <View style={styles.statItem}>
            <Text style={styles.statLabel}>Progress</Text>
            <Text style={styles.statValue}>{completedMatches}/{totalMatches}</Text>
          </View>
          <View style={styles.statItem}>
            <Text style={styles.statLabel}>Started</Text>
            <Text style={styles.statValue}>
              {new Date(tournament.startDate).toLocaleDateString()}
            </Text>
          </View>
        </View>
        
        {isActive && (
          <View style={styles.tournamentProgress}>
            <View style={styles.progressBar}>
              <View 
                style={[
                  styles.progressFill, 
                  { width: `${totalMatches > 0 ? (completedMatches / totalMatches) * 100 : 0}%` }
                ]} 
              />
            </View>
            <Text style={styles.progressText}>
              {totalMatches > 0 ? Math.round((completedMatches / totalMatches) * 100) : 0}% Complete
            </Text>
          </View>
        )}
      </TouchableOpacity>
    );
  };

  const renderMatch = (match: Match) => {
    const homePlayer = activeGroup.members.find(m => m.id === match.homePlayerId);
    const awayPlayer = activeGroup.members.find(m => m.id === match.awayPlayerId);
    const competition = activeGroup.competitions.find(c => c.id === match.competitionId);

    return (
      <TouchableOpacity
        key={match.id}
        style={styles.matchCard}
        onPress={() => router.push(`/match-details?id=${match.id}`)}
      >
        <View style={styles.competitionBadge}>
          <Trophy size={12} color="#0EA5E9" />
          <Text style={styles.competitionName}>{competition?.name}</Text>
        </View>
        
        <View style={styles.matchContent}>
          <View style={styles.playerSection}>
            <Text style={styles.playerName}>@{homePlayer?.gamerHandle}</Text>
            {match.status === 'completed' && (
              <Text style={styles.score}>{match.homeScore}</Text>
            )}
          </View>

          <View style={styles.matchCenter}>
            {match.status === 'completed' ? (
              <Text style={styles.vs}>-</Text>
            ) : match.status === 'live' ? (
              <View style={styles.liveBadge}>
                <View style={styles.liveDot} />
                <Text style={styles.liveText}>LIVE</Text>
              </View>
            ) : (
              <View style={[
                styles.countdownBadge,
                { backgroundColor: getMatchCountdown(match.scheduledTime).isUrgent ? 'rgba(239, 68, 68, 0.1)' : 'rgba(100, 116, 139, 0.1)' }
              ]}>
                <Timer size={14} color={getMatchCountdown(match.scheduledTime).color} />
                <Text style={[styles.countdownText, { color: getMatchCountdown(match.scheduledTime).color }]}>
                  {getMatchCountdown(match.scheduledTime).text}
                </Text>
              </View>
            )}
          </View>

          <View style={styles.playerSection}>
            {match.status === 'completed' && (
              <Text style={styles.score}>{match.awayScore}</Text>
            )}
            <Text style={styles.playerName}>@{awayPlayer?.gamerHandle}</Text>
          </View>
        </View>

        {match.status === 'scheduled' && (
          <View style={styles.matchActions}>
            {(currentPlayerId === match.homePlayerId || currentPlayerId === match.awayPlayerId) && (
              <>
                <TouchableOpacity
                  style={styles.actionButton}
                  onPress={(e) => {
                    e.stopPropagation();
                    setSelectedMatch(match);
                    setYoutubeModal(true);
                  }}
                >
                  <Youtube size={16} color="#0EA5E9" />
                  <Text style={styles.actionText}>Go Live</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.actionButton}
                  onPress={(e) => {
                    e.stopPropagation();
                    setSelectedMatch(match);
                    setResultModal(true);
                  }}
                >
                  <CheckCircle size={16} color="#10B981" />
                  <Text style={styles.actionText}>Add Result</Text>
                </TouchableOpacity>
              </>
            )}
            {activeGroup?.adminId === currentPlayerId && (
              <TouchableOpacity
                style={[styles.actionButton, styles.deleteButton]}
                onPress={(e) => {
                  e.stopPropagation();
                  console.log('🗑️ Delete button pressed for match:', match.id);
                  handleDeleteMatch(match.id);
                }}
              >
                <Text style={styles.actionText}>Delete</Text>
              </TouchableOpacity>
            )}
          </View>
        )}

        {match.status === 'live' && (
          <View style={styles.matchActions}>
            {match.youtubeLink && (
              <TouchableOpacity
                style={styles.actionButton}
                onPress={(e) => {
                  e.stopPropagation();
                  // Open YouTube link
                }}
              >
                <Youtube size={16} color="#FF0000" />
                <Text style={styles.actionText}>Watch</Text>
              </TouchableOpacity>
            )}
            {(currentPlayerId === match.homePlayerId || currentPlayerId === match.awayPlayerId) && (
              <TouchableOpacity
                style={styles.actionButton}
                onPress={(e) => {
                  e.stopPropagation();
                  setSelectedMatch(match);
                  setResultModal(true);
                }}
              >
                <CheckCircle size={16} color="#10B981" />
                <Text style={styles.actionText}>End Match</Text>
              </TouchableOpacity>
            )}
          </View>
        )}
        
        {match.status === 'completed' && activeGroup?.adminId === currentPlayerId && (
          <View style={styles.matchActions}>
            <TouchableOpacity
              style={styles.actionButton}
              onPress={(e) => {
                e.stopPropagation();
                setSelectedMatch(match);
                setHomeScore(match.homeScore?.toString() || '');
                setAwayScore(match.awayScore?.toString() || '');
                setResultModal(true);
              }}
            >
              <Text style={styles.actionText}>Correct Score</Text>
            </TouchableOpacity>
          </View>
        )}
      </TouchableOpacity>
    );
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Tab Selector */}
      <View style={styles.tabContainer}>
        <TouchableOpacity
          style={[styles.tab, selectedTab === 'upcoming' && styles.activeTab]}
          onPress={() => setSelectedTab('upcoming')}
        >
          <Text style={[styles.tabText, selectedTab === 'upcoming' && styles.activeTabText]}>
            Upcoming ({upcomingMatches.length})
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, selectedTab === 'live' && styles.activeTab]}
          onPress={() => setSelectedTab('live')}
        >
          <Text style={[styles.tabText, selectedTab === 'live' && styles.activeTabText]}>
            Live ({liveMatches.length})
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, selectedTab === 'completed' && styles.activeTab]}
          onPress={() => setSelectedTab('completed')}
        >
          <Text style={[styles.tabText, selectedTab === 'completed' && styles.activeTabText]}>
            Completed ({completedMatches.length})
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, selectedTab === 'tournaments' && styles.activeTab]}
          onPress={() => setSelectedTab('tournaments')}
        >
          <Text style={[styles.tabText, selectedTab === 'tournaments' && styles.activeTabText]}>
            Tournaments ({knockoutTournaments.length})
          </Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.matchList}>
        {selectedTab === 'upcoming' && upcomingMatches.map(renderMatch)}
        {selectedTab === 'live' && liveMatches.map(renderMatch)}
        {selectedTab === 'completed' && completedMatches.map(renderMatch)}
        {selectedTab === 'tournaments' && knockoutTournaments.map(renderTournament)}

        {((selectedTab === 'upcoming' && upcomingMatches.length === 0) ||
          (selectedTab === 'live' && liveMatches.length === 0) ||
          (selectedTab === 'completed' && completedMatches.length === 0) ||
          (selectedTab === 'tournaments' && knockoutTournaments.length === 0)) && (
          <View style={styles.emptyState}>
            <Calendar size={48} color="#64748B" />
            <Text style={styles.emptyStateText}>
              {selectedTab === 'tournaments' ? 'No knockout tournaments' : `No ${selectedTab} matches`}
            </Text>
          </View>
        )}
      </ScrollView>

      {/* Floating Action Button */}
      <TouchableOpacity
        style={styles.fab}
        onPress={() => router.push('/create-competition')}
      >
        <LinearGradient
          colors={['#0EA5E9', '#8B5CF6']}
          style={styles.fabGradient}
        >
          <Plus size={24} color="#fff" />
        </LinearGradient>
      </TouchableOpacity>

      {/* Result Modal */}
      <Modal
        visible={resultModal}
        transparent
        animationType="slide"
        onRequestClose={() => setResultModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>
              {selectedMatch?.status === 'completed' ? 'Correct Match Score' : 'Match Result'}
            </Text>
            
            <View style={styles.scoreInputContainer}>
              <View style={styles.scoreInputSection}>
                <Text style={styles.scoreLabel}>
                  @{activeGroup.members.find(m => m.id === selectedMatch?.homePlayerId)?.gamerHandle}
                </Text>
                <TextInput
                  style={styles.scoreInput}
                  value={homeScore}
                  onChangeText={setHomeScore}
                  keyboardType="numeric"
                  placeholder="0"
                  placeholderTextColor="#64748B"
                />
              </View>
              
              <Text style={styles.scoreSeparator}>-</Text>
              
              <View style={styles.scoreInputSection}>
                <Text style={styles.scoreLabel}>
                  @{activeGroup.members.find(m => m.id === selectedMatch?.awayPlayerId)?.gamerHandle}
                </Text>
                <TextInput
                  style={styles.scoreInput}
                  value={awayScore}
                  onChangeText={setAwayScore}
                  keyboardType="numeric"
                  placeholder="0"
                  placeholderTextColor="#64748B"
                />
              </View>
            </View>

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.cancelButton}
                onPress={() => {
                  setResultModal(false);
                  setSelectedMatch(null);
                  setHomeScore('');
                  setAwayScore('');
                }}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.submitButton, isSubmitting && styles.submitButtonDisabled]}
                onPress={handleSubmitResult}
                disabled={isSubmitting}
              >
                {isSubmitting ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={styles.submitButtonText}>
                    {selectedMatch?.status === 'completed' ? 'Update' : 'Submit'}
                  </Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* YouTube Modal */}
      <Modal
        visible={youtubeModal}
        transparent
        animationType="slide"
        onRequestClose={() => setYoutubeModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Share YouTube Link</Text>
            
            <TextInput
              style={styles.linkInput}
              value={youtubeLink}
              onChangeText={setYoutubeLink}
              placeholder="https://youtube.com/live/..."
              placeholderTextColor="#64748B"
              autoCapitalize="none"
              editable={!goLiveWithoutLink}
            />
            
            <TouchableOpacity
              style={styles.checkboxContainer}
              onPress={() => {
                setGoLiveWithoutLink(!goLiveWithoutLink);
                if (!goLiveWithoutLink) {
                  setYoutubeLink('');
                }
              }}
            >
              <View style={[styles.checkbox, goLiveWithoutLink && styles.checkboxChecked]}>
                {goLiveWithoutLink && <Text style={styles.checkmark}>✓</Text>}
              </View>
              <Text style={styles.checkboxLabel}>Go live without YouTube link</Text>
            </TouchableOpacity>

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.cancelButton}
                onPress={() => {
                  setYoutubeModal(false);
                  setSelectedMatch(null);
                  setYoutubeLink('');
                  setGoLiveWithoutLink(false);
                }}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.submitButton}
                onPress={handleShareYoutube}
              >
                <Text style={styles.submitButtonText}>Share</Text>
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
    backgroundColor: '#0F172A',
  },
  emptyTitle: {
    fontSize: 24,
    fontWeight: '600' as const,
    color: '#fff',
    marginTop: 16,
  },
  emptyText: {
    fontSize: 16,
    color: '#64748B',
    marginTop: 8,
  },
  tabContainer: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 8,
  },
  tab: {
    flex: 1,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: '#1E293B',
    alignItems: 'center',
  },
  activeTab: {
    backgroundColor: '#0EA5E9',
  },
  tabText: {
    fontSize: 14,
    color: '#64748B',
    fontWeight: '500' as const,
  },
  activeTabText: {
    color: '#fff',
  },
  matchList: {
    flex: 1,
    padding: 16,
  },
  matchCard: {
    backgroundColor: '#1E293B',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  competitionBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 12,
  },
  competitionName: {
    fontSize: 12,
    color: '#0EA5E9',
  },
  matchContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  playerSection: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  playerName: {
    fontSize: 16,
    color: '#fff',
    fontWeight: '500' as const,
  },
  score: {
    fontSize: 20,
    fontWeight: '700' as const,
    color: '#fff',
  },
  matchCenter: {
    paddingHorizontal: 16,
  },
  vs: {
    fontSize: 16,
    color: '#64748B',
  },
  liveBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#EF4444',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  liveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#fff',
  },
  liveText: {
    fontSize: 10,
    fontWeight: '700' as const,
    color: '#fff',
  },
  countdownContainer: {
    alignItems: 'center',
    gap: 4,
  },
  timeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  timeText: {
    fontSize: 12,
    color: '#64748B',
  },
  countdownBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
  },
  countdownText: {
    fontSize: 11,
    fontWeight: '600' as const,
  },
  matchActions: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#334155',
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: '#334155',
  },
  actionText: {
    fontSize: 12,
    color: '#fff',
    fontWeight: '500' as const,
  },
  deleteButton: {
    backgroundColor: '#DC2626',
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 48,
  },
  emptyStateText: {
    fontSize: 16,
    color: '#64748B',
    marginTop: 12,
  },
  fab: {
    position: 'absolute',
    bottom: 24,
    right: 24,
  },
  fabGradient: {
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
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
  scoreInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    marginBottom: 24,
  },
  scoreInputSection: {
    alignItems: 'center',
  },
  scoreLabel: {
    fontSize: 14,
    color: '#64748B',
    marginBottom: 8,
  },
  scoreInput: {
    width: 80,
    height: 60,
    backgroundColor: '#0F172A',
    borderRadius: 12,
    fontSize: 24,
    fontWeight: '700' as const,
    color: '#fff',
    textAlign: 'center',
  },
  scoreSeparator: {
    fontSize: 20,
    color: '#64748B',
  },
  linkInput: {
    backgroundColor: '#0F172A',
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    color: '#fff',
    marginBottom: 24,
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
  submitButtonDisabled: {
    opacity: 0.5,
  },
  checkboxContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 24,
    gap: 12,
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 4,
    borderWidth: 2,
    borderColor: '#64748B',
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxChecked: {
    backgroundColor: '#0EA5E9',
    borderColor: '#0EA5E9',
  },
  checkmark: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '700' as const,
  },
  checkboxLabel: {
    fontSize: 16,
    color: '#fff',
  },
  tournamentCard: {
    backgroundColor: '#1E293B',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderLeftWidth: 4,
    borderLeftColor: '#8B5CF6',
  },
  tournamentHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  tournamentBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#8B5CF6',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  tournamentType: {
    fontSize: 10,
    fontWeight: '700' as const,
    color: '#fff',
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  activeBadge: {
    backgroundColor: '#10B981',
  },
  upcomingBadge: {
    backgroundColor: '#F59E0B',
  },
  statusText: {
    fontSize: 10,
    fontWeight: '700' as const,
    color: '#fff',
  },
  tournamentName: {
    fontSize: 18,
    fontWeight: '600' as const,
    color: '#fff',
    marginBottom: 16,
  },
  tournamentStats: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  statItem: {
    alignItems: 'center',
  },
  statLabel: {
    fontSize: 12,
    color: '#64748B',
    marginBottom: 4,
  },
  statValue: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: '#fff',
  },
  tournamentProgress: {
    gap: 8,
  },
  progressBar: {
    height: 6,
    backgroundColor: '#334155',
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#8B5CF6',
    borderRadius: 3,
  },
  progressText: {
    fontSize: 12,
    color: '#64748B',
    textAlign: 'center',
  },
});