import React, { useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  TouchableOpacity,
  Modal,
  TextInput,
} from 'react-native';
import { Stack, useRouter, useLocalSearchParams } from 'expo-router';
import { 
  Users, 
  Trophy, 
  Plus, 
  Calendar,
  Target,
  Crown,
  Settings,
  ChevronRight,
  Play,
  Clock,
  CheckCircle,
  User
} from 'lucide-react-native';
import { useGameStore } from '@/hooks/use-game-store';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { AchievementBadges } from '@/components/AchievementBadges';

export default function GroupDetailsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { groupId } = useLocalSearchParams<{ groupId: string }>();
  
  const { 
    groups, 
    currentUser, 
    createCompetition, 
    generateMatches,
    updateMatchResult,
    shareYoutubeLink,
    deleteMatch,
    correctMatchScore
  } = useGameStore();
  
  const [activeTab, setActiveTab] = useState<'overview' | 'matches' | 'members'>('overview');
  const [createCompModal, setCreateCompModal] = useState(false);
  const [compName, setCompName] = useState('');
  const [compType, setCompType] = useState<'league' | 'tournament' | 'friendly'>('league');
  const [selectedParticipants, setSelectedParticipants] = useState<string[]>([]);
  
  // League options
  const [leagueFormat, setLeagueFormat] = useState<'single' | 'double'>('single');
  
  // Friendly options
  const [friendlyType, setFriendlyType] = useState<'best_of' | 'first_to'>('best_of');
  const [friendlyTarget, setFriendlyTarget] = useState('3');
  
  // Tournament options
  const [tournamentType, setTournamentType] = useState<'knockout'>('knockout');
  const [correctScoreModal, setCorrectScoreModal] = useState(false);
  const [selectedMatch, setSelectedMatch] = useState<any>(null);
  const [newHomeScore, setNewHomeScore] = useState('');
  const [newAwayScore, setNewAwayScore] = useState('');

  const group = groups.find(g => g.id === groupId);
  const isAdmin = (group?.adminIds && group.adminIds.includes(currentUser?.id || '')) || 
                  group?.adminId === currentUser?.id || false;

  if (!group || !currentUser) {
    return (
      <View style={styles.container}>
        <Stack.Screen options={{ title: 'Group Not Found' }} />
        <View style={styles.emptyContainer}>
          <Users size={64} color="#64748B" />
          <Text style={styles.emptyTitle}>Group not found</Text>
          <TouchableOpacity 
            style={styles.primaryButton}
            onPress={() => router.back()}
          >
            <Text style={styles.primaryButtonText}>Go Back</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  const allMatches = group.competitions.flatMap(c => 
    c.matches.map(m => ({ ...m, competitionName: c.name, competitionType: c.type }))
  );

  const handleCreateCompetition = () => {
    if (!compName.trim()) {
      console.log('Error: Please enter a competition name');
      return;
    }
    
    // Validation based on competition type
    if (compType === 'friendly') {
      if (selectedParticipants.length !== 2) {
        console.log('Error: Friendly matches require exactly 2 players');
        return;
      }
    } else if (compType === 'tournament') {
      if (selectedParticipants.length < 4) {
        console.log('Error: Tournaments require at least 4 players');
        return;
      }
      if (selectedParticipants.length > 32) {
        console.log('Error: Tournaments support maximum 32 players');
        return;
      }
      // Check if it's a power of 2 for simple knockout
      const isPowerOf2 = (selectedParticipants.length & (selectedParticipants.length - 1)) === 0;
      if (!isPowerOf2) {
        console.log('Error: Tournament requires a power of 2 number of players (4, 8, 16, 32)');
        return;
      }
    } else {
      if (selectedParticipants.length < 2) {
        console.log('Error: Please select at least 2 players');
        return;
      }
    }

    const options: any = {};
    
    if (compType === 'league') {
      options.leagueFormat = leagueFormat;
    } else if (compType === 'friendly') {
      options.friendlyType = friendlyType;
      options.friendlyTarget = parseInt(friendlyTarget) || 3;
    } else if (compType === 'tournament') {
      options.tournamentType = tournamentType;
      options.knockoutMinPlayers = 4;
    }

    console.log('Creating competition with:', { name: compName.trim(), type: compType, selectedParticipants, options });
    
    const competition = createCompetition(compName.trim(), compType, selectedParticipants, options);
    
    if (competition) {
      console.log('Competition created successfully:', competition);
      // Auto-generate matches based on competition type
      generateMatches(competition.id);
      console.log(`Generated matches for ${compType} competition:`, competition.name);
    } else {
      console.log('Failed to create competition');
    }
    
    setCreateCompModal(false);
    setCompName('');
    setSelectedParticipants([]);
    setLeagueFormat('single');
    setFriendlyType('best_of');
    setFriendlyTarget('3');
    setTournamentType('knockout');
  };

  const toggleParticipant = (playerId: string) => {
    setSelectedParticipants(prev => 
      prev.includes(playerId) 
        ? prev.filter(id => id !== playerId)
        : [...prev, playerId]
    );
  };

  const renderOverview = () => (
    <ScrollView style={styles.tabContent} showsVerticalScrollIndicator={false}>
      {/* Group Header */}
      <LinearGradient
        colors={['#0EA5E9', '#8B5CF6']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.groupHeader}
      >
        <Text style={styles.groupName}>{group.name}</Text>
        <Text style={styles.groupDescription}>{group.description}</Text>
        <View style={styles.groupStats}>
          <View style={styles.statItem}>
            <Users size={20} color="rgba(255,255,255,0.8)" />
            <Text style={styles.statText}>{group.members.length} members</Text>
          </View>
          <View style={styles.statItem}>
            <Trophy size={20} color="rgba(255,255,255,0.8)" />
            <Text style={styles.statText}>{group.competitions.length} competitions</Text>
          </View>
        </View>
      </LinearGradient>

      {/* Invite Code */}
      {isAdmin && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Group Invite</Text>
          <View style={styles.inviteCard}>
            <View style={styles.inviteInfo}>
              <Text style={styles.inviteLabel}>Invite Code</Text>
              <Text style={styles.inviteCode}>{group.inviteCode}</Text>
              <Text style={styles.inviteSubtitle}>
                Share this code with players to join your group
              </Text>
            </View>
          </View>
        </View>
      )}

      {/* Quick Actions */}
      {isAdmin && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Admin Actions</Text>
          <TouchableOpacity
            style={styles.actionCard}
            onPress={() => setCreateCompModal(true)}
          >
            <Plus size={24} color="#0EA5E9" />
            <View style={styles.actionText}>
              <Text style={styles.actionTitle}>Create Competition</Text>
              <Text style={styles.actionSubtitle}>Start a new tournament or league</Text>
            </View>
            <ChevronRight size={20} color="#64748B" />
          </TouchableOpacity>
        </View>
      )}

      {/* Recent Activity */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Recent Matches</Text>
        {allMatches.slice(0, 3).map(match => {
          const homePlayer = group.members.find(m => m.id === match.homePlayerId);
          const awayPlayer = group.members.find(m => m.id === match.awayPlayerId);
          
          return (
            <View key={match.id} style={styles.matchCard}>
              <View style={styles.matchHeader}>
                <Text style={styles.matchTitle}>
                  {homePlayer?.name} vs {awayPlayer?.name}
                </Text>
                <View style={[
                  styles.statusBadge,
                  { backgroundColor: match.status === 'completed' ? '#10B981' : 
                                   match.status === 'live' ? '#EF4444' : '#6B7280' }
                ]}>
                  <Text style={styles.statusText}>{match.status.toUpperCase()}</Text>
                </View>
              </View>
              {match.status === 'completed' && (
                <Text style={styles.matchScore}>
                  {match.homeScore} - {match.awayScore}
                </Text>
              )}
              <Text style={styles.matchSubtitle}>{match.competitionName}</Text>
            </View>
          );
        })}
        
        {allMatches.length === 0 && (
          <View style={styles.emptyCard}>
            <Target size={48} color="#64748B" />
            <Text style={styles.emptyText}>No matches yet</Text>
          </View>
        )}
      </View>
    </ScrollView>
  );

  const renderMatches = () => (
    <ScrollView style={styles.tabContent} showsVerticalScrollIndicator={false}>
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>All Matches ({allMatches.length})</Text>
        {allMatches.map(match => {
          const homePlayer = group.members.find(m => m.id === match.homePlayerId);
          const awayPlayer = group.members.find(m => m.id === match.awayPlayerId);
          const canUpdateScore = isAdmin || 
            (match.homePlayerId === currentUser.id || match.awayPlayerId === currentUser.id);
          
          return (
            <View key={match.id} style={styles.matchCard}>
              <View style={styles.matchHeader}>
                <Text style={styles.matchTitle}>
                  {homePlayer?.name} vs {awayPlayer?.name}
                </Text>
                <View style={[
                  styles.statusBadge,
                  { backgroundColor: match.status === 'completed' ? '#10B981' : 
                                   match.status === 'live' ? '#EF4444' : '#6B7280' }
                ]}>
                  {match.status === 'live' && <Play size={12} color="#fff" />}
                  {match.status === 'completed' && <CheckCircle size={12} color="#fff" />}
                  {match.status === 'scheduled' && <Clock size={12} color="#fff" />}
                  <Text style={styles.statusText}>{match.status.toUpperCase()}</Text>
                </View>
              </View>
              
              {match.status === 'completed' && (
                <Text style={styles.matchScore}>
                  {match.homeScore} - {match.awayScore}
                </Text>
              )}
              
              <Text style={styles.matchSubtitle}>
                {match.competitionName} • {match.competitionType}
              </Text>
              
              <Text style={styles.matchDate}>
                {match.status === 'completed' && match.completedAt
                  ? `Completed ${new Date(match.completedAt).toLocaleString()}`
                  : `Scheduled ${new Date(match.scheduledTime).toLocaleString()}`
                }
              </Text>

              {match.youtubeLink && (
                <Text style={styles.youtubeLink}>🔴 Live: {match.youtubeLink}</Text>
              )}

              {canUpdateScore && match.status !== 'completed' && (
                <View style={styles.matchActions}>
                  <TouchableOpacity
                    style={styles.actionButton}
                    onPress={() => {
                      // In a real app, this would open a modal to input scores
                      const homeScore = Math.floor(Math.random() * 5);
                      const awayScore = Math.floor(Math.random() * 5);
                      updateMatchResult(match.id, homeScore, awayScore);
                    }}
                  >
                    <Text style={styles.actionButtonText}>Update Score</Text>
                  </TouchableOpacity>
                  
                  <TouchableOpacity
                    style={[styles.actionButton, styles.liveButton]}
                    onPress={() => {
                      // In a real app, this would open a modal to input YouTube link
                      const demoLink = 'https://youtube.com/watch?v=demo';
                      shareYoutubeLink(match.id, demoLink);
                    }}
                  >
                    <Text style={styles.actionButtonText}>Share Live Link</Text>
                  </TouchableOpacity>
                  
                  {(isAdmin || match.homePlayerId === currentUser.id || match.awayPlayerId === currentUser.id) && (
                    <TouchableOpacity
                      style={[styles.actionButton, styles.deleteButton]}
                      onPress={() => {
                        if (deleteMatch(match.id)) {
                          console.log('Match deleted successfully');
                        } else {
                          console.log('Failed to delete match');
                        }
                      }}
                    >
                      <Text style={styles.actionButtonText}>Delete</Text>
                    </TouchableOpacity>
                  )}
                </View>
              )}
              
              {isAdmin && match.status === 'completed' && (
                <View style={styles.matchActions}>
                  <TouchableOpacity
                    style={styles.actionButton}
                    onPress={() => {
                      setSelectedMatch(match);
                      setNewHomeScore(match.homeScore?.toString() || '');
                      setNewAwayScore(match.awayScore?.toString() || '');
                      setCorrectScoreModal(true);
                    }}
                  >
                    <Text style={styles.actionButtonText}>Correct Score</Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>
          );
        })}
        
        {allMatches.length === 0 && (
          <View style={styles.emptyCard}>
            <Target size={48} color="#64748B" />
            <Text style={styles.emptyText}>No matches scheduled</Text>
            {isAdmin && (
              <Text style={styles.emptySubtext}>Create a competition to start scheduling matches</Text>
            )}
          </View>
        )}
      </View>
    </ScrollView>
  );

  const renderMembers = () => (
    <ScrollView style={styles.tabContent} showsVerticalScrollIndicator={false}>
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Members ({group.members.length})</Text>
        {group.members.map(member => (
          <View key={member.id} style={styles.memberCard}>
            <View style={styles.memberInfo}>
              <View style={styles.memberAvatar}>
                <User size={24} color="#fff" />
              </View>
              <View style={styles.memberDetails}>
                <View style={styles.memberHeader}>
                  <Text style={styles.memberName}>{member.name}</Text>
                  <View style={styles.memberBadges}>
                    <AchievementBadges 
                      leaguesWon={member.stats.leaguesWon}
                      knockoutsWon={member.stats.knockoutsWon}
                      size="small"
                    />
                    {member.id === group.adminId && (
                      <View style={styles.adminBadge}>
                        <Crown size={12} color="#F59E0B" />
                        <Text style={styles.adminText}>Admin</Text>
                      </View>
                    )}
                  </View>
                </View>
                <Text style={styles.memberStats}>
                  {member.stats.played} matches • {member.stats.wins}W {member.stats.draws}D {member.stats.losses}L
                </Text>
                <Text style={styles.memberJoined}>
                  Joined {new Date(member.joinedAt).toLocaleDateString()}
                </Text>
              </View>
            </View>
            <Text style={styles.winRate}>{Math.round(member.stats.winRate)}%</Text>
          </View>
        ))}
      </View>
    </ScrollView>
  );

  const renderContent = () => {
    switch (activeTab) {
      case 'overview': return renderOverview();
      case 'matches': return renderMatches();
      case 'members': return renderMembers();
      default: return renderOverview();
    }
  };

  return (
    <View style={styles.container}>
      <Stack.Screen 
        options={{ 
          title: group.name,
          headerStyle: { backgroundColor: '#0F172A' },
          headerTintColor: '#fff',
          headerRight: () => isAdmin ? (
            <TouchableOpacity onPress={() => console.log('Group settings')}>
              <Settings size={24} color="#fff" />
            </TouchableOpacity>
          ) : null,
        }} 
      />
      
      {/* Tab Bar */}
      <View style={styles.tabBar}>
        {[
          { id: 'overview' as const, label: 'Overview', icon: Target },
          { id: 'matches' as const, label: 'Matches', icon: Trophy },
          { id: 'members' as const, label: 'Members', icon: Users },
        ].map(tab => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          
          return (
            <TouchableOpacity
              key={tab.id}
              style={[styles.tab, isActive && styles.activeTab]}
              onPress={() => setActiveTab(tab.id)}
            >
              <Icon size={20} color={isActive ? '#0EA5E9' : '#64748B'} />
              <Text style={[styles.tabText, isActive && styles.activeTabText]}>
                {tab.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {renderContent()}

      {/* Create Competition Modal */}
      <Modal
        visible={createCompModal}
        transparent
        animationType="slide"
        onRequestClose={() => setCreateCompModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Create Competition</Text>
            
            <TextInput
              style={styles.input}
              value={compName}
              onChangeText={setCompName}
              placeholder="Competition Name"
              placeholderTextColor="#64748B"
            />

            <View style={styles.typeSelector}>
              {(['league', 'tournament', 'friendly'] as const).map(type => (
                <TouchableOpacity
                  key={type}
                  style={[styles.typeButton, compType === type && styles.activeTypeButton]}
                  onPress={() => setCompType(type)}
                >
                  <Text style={[styles.typeText, compType === type && styles.activeTypeText]}>
                    {type.charAt(0).toUpperCase() + type.slice(1)}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Competition-specific options */}
            {compType === 'league' && (
              <View style={styles.optionGroup}>
                <Text style={styles.optionTitle}>League Format</Text>
                <View style={styles.typeSelector}>
                  <TouchableOpacity
                    style={[styles.typeButton, leagueFormat === 'single' && styles.activeTypeButton]}
                    onPress={() => setLeagueFormat('single')}
                  >
                    <Text style={[styles.typeText, leagueFormat === 'single' && styles.activeTypeText]}>
                      Single Round
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.typeButton, leagueFormat === 'double' && styles.activeTypeButton]}
                    onPress={() => setLeagueFormat('double')}
                  >
                    <Text style={[styles.typeText, leagueFormat === 'double' && styles.activeTypeText]}>
                      Home & Away
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}
            
            {compType === 'friendly' && (
              <>
                <View style={styles.optionGroup}>
                  <Text style={styles.optionTitle}>Friendly Type</Text>
                  <View style={styles.typeSelector}>
                    <TouchableOpacity
                      style={[styles.typeButton, friendlyType === 'best_of' && styles.activeTypeButton]}
                      onPress={() => setFriendlyType('best_of')}
                    >
                      <Text style={[styles.typeText, friendlyType === 'best_of' && styles.activeTypeText]}>
                        Best of X
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.typeButton, friendlyType === 'first_to' && styles.activeTypeButton]}
                      onPress={() => setFriendlyType('first_to')}
                    >
                      <Text style={[styles.typeText, friendlyType === 'first_to' && styles.activeTypeText]}>
                        First to X
                      </Text>
                    </TouchableOpacity>
                  </View>
                </View>
                <View style={styles.optionGroup}>
                  <Text style={styles.optionTitle}>
                    {friendlyType === 'best_of' ? 'Number of Matches' : 'Wins Required'}
                  </Text>
                  <TextInput
                    style={styles.input}
                    value={friendlyTarget}
                    onChangeText={setFriendlyTarget}
                    placeholder="3"
                    placeholderTextColor="#64748B"
                    keyboardType="numeric"
                    maxLength={2}
                  />
                </View>
              </>
            )}
            
            {compType === 'tournament' && (
              <View style={styles.optionGroup}>
                <Text style={styles.optionTitle}>Tournament Format</Text>
                <View style={styles.infoBox}>
                  <Text style={styles.infoText}>
                    🏆 Knockout tournament: Single elimination format. Requires 4, 8, 16, or 32 players.
                  </Text>
                </View>
              </View>
            )}
            
            {/* Match count preview */}
            {selectedParticipants.length >= 2 && (
              <View style={styles.infoBox}>
                <Text style={styles.infoText}>
                  {compType === 'league' && leagueFormat === 'single' && 
                    `This will create ${(selectedParticipants.length * (selectedParticipants.length - 1)) / 2} matches`}
                  {compType === 'league' && leagueFormat === 'double' && 
                    `This will create ${selectedParticipants.length * (selectedParticipants.length - 1)} matches (home & away)`}
                  {compType === 'friendly' && selectedParticipants.length === 2 && 
                    `This will create ${parseInt(friendlyTarget) || 1} ${friendlyType === 'best_of' ? 'matches' : 'matches (first to ' + (parseInt(friendlyTarget) || 1) + ' wins)'}`}
                  {compType === 'tournament' && selectedParticipants.length >= 4 && 
                    `This will create a ${selectedParticipants.length}-player knockout tournament`}
                </Text>
              </View>
            )}

            <Text style={styles.participantsTitle}>
              Select Participants ({selectedParticipants.length} selected)
              {compType === 'friendly' && ' - Need exactly 2'}
              {compType === 'tournament' && ' - Need 4, 8, 16, or 32'}
              {compType === 'league' && ' - Need at least 2'}
            </Text>
            <ScrollView style={styles.participantsList} showsVerticalScrollIndicator={false}>
              {group.members.map(member => (
                <TouchableOpacity
                  key={member.id}
                  style={[
                    styles.participantItem,
                    selectedParticipants.includes(member.id) && styles.selectedParticipant
                  ]}
                  onPress={() => toggleParticipant(member.id)}
                >
                  <Text style={[
                    styles.participantName,
                    selectedParticipants.includes(member.id) && styles.selectedParticipantName
                  ]}>
                    {member.name}
                  </Text>
                  {selectedParticipants.includes(member.id) && (
                    <CheckCircle size={20} color="#0EA5E9" />
                  )}
                </TouchableOpacity>
              ))}
            </ScrollView>
            
            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.cancelButton}
                onPress={() => {
                  setCreateCompModal(false);
                  setCompName('');
                  setSelectedParticipants([]);
                  setLeagueFormat('single');
                  setFriendlyType('best_of');
                  setFriendlyTarget('3');
                  setTournamentType('knockout');
                }}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.submitButton}
                onPress={handleCreateCompetition}
              >
                <Text style={styles.submitButtonText}>Create</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Correct Score Modal */}
      <Modal
        visible={correctScoreModal}
        transparent
        animationType="slide"
        onRequestClose={() => setCorrectScoreModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Correct Match Score</Text>
            
            <View style={styles.scoreInputContainer}>
              <View style={styles.scoreInputSection}>
                <Text style={styles.scoreLabel}>
                  {group?.members.find(m => m.id === selectedMatch?.homePlayerId)?.name}
                </Text>
                <TextInput
                  style={styles.scoreInput}
                  value={newHomeScore}
                  onChangeText={setNewHomeScore}
                  keyboardType="numeric"
                  placeholder="0"
                  placeholderTextColor="#64748B"
                />
              </View>
              
              <Text style={styles.scoreSeparator}>-</Text>
              
              <View style={styles.scoreInputSection}>
                <Text style={styles.scoreLabel}>
                  {group?.members.find(m => m.id === selectedMatch?.awayPlayerId)?.name}
                </Text>
                <TextInput
                  style={styles.scoreInput}
                  value={newAwayScore}
                  onChangeText={setNewAwayScore}
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
                  setCorrectScoreModal(false);
                  setSelectedMatch(null);
                  setNewHomeScore('');
                  setNewAwayScore('');
                }}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.submitButton}
                onPress={() => {
                  if (selectedMatch && newHomeScore && newAwayScore) {
                    if (correctMatchScore(selectedMatch.id, parseInt(newHomeScore), parseInt(newAwayScore))) {
                      console.log('Score corrected successfully');
                    } else {
                      console.log('Failed to correct score');
                    }
                    setCorrectScoreModal(false);
                    setSelectedMatch(null);
                    setNewHomeScore('');
                    setNewAwayScore('');
                  }
                }}
              >
                <Text style={styles.submitButtonText}>Update</Text>
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
  primaryButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600' as const,
  },
  tabBar: {
    flexDirection: 'row',
    backgroundColor: '#1E293B',
    borderBottomWidth: 1,
    borderBottomColor: '#334155',
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    gap: 8,
  },
  activeTab: {
    borderBottomWidth: 2,
    borderBottomColor: '#0EA5E9',
  },
  tabText: {
    fontSize: 14,
    fontWeight: '500' as const,
    color: '#64748B',
  },
  activeTabText: {
    color: '#0EA5E9',
  },
  tabContent: {
    flex: 1,
  },
  groupHeader: {
    padding: 24,
    alignItems: 'center',
  },
  groupName: {
    fontSize: 28,
    fontWeight: '700' as const,
    color: '#fff',
    marginBottom: 8,
    textAlign: 'center',
  },
  groupDescription: {
    fontSize: 16,
    color: 'rgba(255, 255, 255, 0.8)',
    textAlign: 'center',
    marginBottom: 24,
  },
  groupStats: {
    flexDirection: 'row',
    gap: 32,
  },
  statItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  statText: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.8)',
    fontWeight: '500' as const,
  },
  section: {
    padding: 16,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '600' as const,
    color: '#fff',
    marginBottom: 16,
  },
  actionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1E293B',
    padding: 16,
    borderRadius: 12,
    marginBottom: 8,
  },
  actionText: {
    flex: 1,
    marginLeft: 16,
  },
  actionTitle: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: '#fff',
    marginBottom: 4,
  },
  actionSubtitle: {
    fontSize: 14,
    color: '#64748B',
  },
  matchCard: {
    backgroundColor: '#1E293B',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
  },
  matchHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  matchTitle: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: '#fff',
    flex: 1,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 4,
  },
  statusText: {
    fontSize: 10,
    fontWeight: '600' as const,
    color: '#fff',
  },
  matchScore: {
    fontSize: 24,
    fontWeight: '700' as const,
    color: '#0EA5E9',
    textAlign: 'center',
    marginVertical: 8,
  },
  matchSubtitle: {
    fontSize: 14,
    color: '#64748B',
    marginBottom: 4,
  },
  matchDate: {
    fontSize: 12,
    color: '#64748B',
  },
  youtubeLink: {
    fontSize: 12,
    color: '#EF4444',
    marginTop: 8,
  },
  matchActions: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 12,
  },
  actionButton: {
    flex: 1,
    backgroundColor: '#0EA5E9',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  liveButton: {
    backgroundColor: '#EF4444',
  },
  deleteButton: {
    backgroundColor: '#DC2626',
  },
  actionButtonText: {
    fontSize: 12,
    fontWeight: '600' as const,
    color: '#fff',
  },
  emptyCard: {
    backgroundColor: '#1E293B',
    padding: 32,
    borderRadius: 12,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 16,
    color: '#64748B',
    marginTop: 16,
    textAlign: 'center',
  },
  emptySubtext: {
    fontSize: 14,
    color: '#64748B',
    marginTop: 8,
    textAlign: 'center',
  },
  memberCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1E293B',
    padding: 16,
    borderRadius: 12,
    marginBottom: 8,
  },
  memberInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  memberAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#0EA5E9',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  memberDetails: {
    flex: 1,
  },
  memberHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  memberBadges: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  memberName: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: '#fff',
    flex: 1,
  },
  adminBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(245, 158, 11, 0.2)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    gap: 4,
  },
  adminText: {
    fontSize: 10,
    fontWeight: '600' as const,
    color: '#F59E0B',
  },
  memberStats: {
    fontSize: 12,
    color: '#64748B',
    marginBottom: 2,
  },
  memberJoined: {
    fontSize: 11,
    color: '#64748B',
  },
  winRate: {
    fontSize: 18,
    fontWeight: '700' as const,
    color: '#0EA5E9',
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
    maxHeight: '80%',
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
  typeSelector: {
    flexDirection: 'row',
    marginBottom: 24,
    gap: 8,
  },
  typeButton: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    backgroundColor: '#334155',
    alignItems: 'center',
  },
  activeTypeButton: {
    backgroundColor: '#0EA5E9',
  },
  typeText: {
    fontSize: 14,
    fontWeight: '500' as const,
    color: '#64748B',
  },
  activeTypeText: {
    color: '#fff',
  },
  participantsTitle: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: '#fff',
    marginBottom: 12,
  },
  participantsList: {
    maxHeight: 200,
    marginBottom: 24,
  },
  participantItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 12,
    borderRadius: 8,
    backgroundColor: '#334155',
    marginBottom: 8,
  },
  selectedParticipant: {
    backgroundColor: '#0EA5E9',
  },
  participantName: {
    fontSize: 14,
    color: '#fff',
  },
  selectedParticipantName: {
    fontWeight: '600' as const,
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
  optionGroup: {
    marginBottom: 16,
  },
  optionTitle: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: '#fff',
    marginBottom: 8,
  },
  infoBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(14, 165, 233, 0.1)',
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(14, 165, 233, 0.3)',
  },
  infoText: {
    fontSize: 12,
    color: '#0EA5E9',
    flex: 1,
  },
  inviteCard: {
    backgroundColor: '#1E293B',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#0EA5E9',
  },
  inviteInfo: {
    alignItems: 'center',
  },
  inviteLabel: {
    fontSize: 14,
    color: '#64748B',
    marginBottom: 8,
  },
  inviteCode: {
    fontSize: 24,
    fontWeight: '700' as const,
    color: '#0EA5E9',
    letterSpacing: 2,
    marginBottom: 8,
  },
  inviteSubtitle: {
    fontSize: 12,
    color: '#64748B',
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
    textAlign: 'center',
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
});