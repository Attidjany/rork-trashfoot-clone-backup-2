import React, { useState, useMemo } from 'react';
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  TouchableOpacity,
  Modal,
  TextInput,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams, Stack } from 'expo-router';
import { ArrowLeft, Trophy, Users, Calendar, CheckCircle, Youtube } from 'lucide-react-native';
import { useGameStore } from '@/hooks/use-game-store';
import { useRealtimeGroups } from '@/hooks/use-realtime-groups';
import { useSession } from '@/hooks/use-session';
import { Match, Competition, Player } from '@/types/game';
import { supabase } from '@/lib/supabase';

interface BracketMatch {
  id: string;
  homePlayer: Player | null;
  awayPlayer: Player | null;
  match: Match | null;
  round: number;
  position: number;
  winner?: Player | null;
}

export default function TournamentBracketScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams();
  const { user } = useSession();
  const { groups, isLoading: groupsLoading } = useRealtimeGroups();
  const { activeGroupId } = useGameStore();
  
  const activeGroup = groups.find(g => g.id === activeGroupId) || groups[0] || null;
  
  const [resultModal, setResultModal] = useState(false);
  const [youtubeModal, setYoutubeModal] = useState(false);
  const [selectedMatch, setSelectedMatch] = useState<Match | null>(null);
  const [homeScore, setHomeScore] = useState('');
  const [awayScore, setAwayScore] = useState('');
  const [youtubeLink, setYoutubeLink] = useState('');
  const [goLiveWithoutLink, setGoLiveWithoutLink] = useState(false);

  const tournament = useMemo(() => {
    if (!activeGroup || !id) return null;
    return activeGroup.competitions.find(c => c.id === id && c.type === 'tournament');
  }, [activeGroup, id]);

  const bracketData = useMemo(() => {
    if (!tournament || !activeGroup) return null;

    const participants = tournament.participants.map(pid => 
      activeGroup.members.find(m => m.id === pid)
    ).filter(Boolean) as Player[];

    const matches = tournament.matches;
    const totalRounds = Math.ceil(Math.log2(participants.length));
    const brackets: BracketMatch[][] = [];

    // Initialize bracket structure
    for (let round = 0; round < totalRounds; round++) {
      const matchesInRound = Math.pow(2, totalRounds - round - 1);
      brackets[round] = [];
      
      for (let position = 0; position < matchesInRound; position++) {
        brackets[round][position] = {
          id: `${round}-${position}`,
          homePlayer: null,
          awayPlayer: null,
          match: null,
          round,
          position,
          winner: null,
        };
      }
    }

    // Fill first round with participants
    if (brackets[0]) {
      for (let i = 0; i < participants.length && i < brackets[0].length * 2; i += 2) {
        const bracketIndex = Math.floor(i / 2);
        if (brackets[0][bracketIndex]) {
          brackets[0][bracketIndex].homePlayer = participants[i] || null;
          brackets[0][bracketIndex].awayPlayer = participants[i + 1] || null;
        }
      }
    }

    // Map matches to bracket positions
    matches.forEach(match => {
      const homePlayer = activeGroup.members.find(m => m.id === match.homePlayerId);
      const awayPlayer = activeGroup.members.find(m => m.id === match.awayPlayerId);
      
      // Find the bracket position for this match
      for (let round = 0; round < brackets.length; round++) {
        for (let pos = 0; pos < brackets[round].length; pos++) {
          const bracket = brackets[round][pos];
          if (bracket.homePlayer?.id === homePlayer?.id && 
              bracket.awayPlayer?.id === awayPlayer?.id) {
            bracket.match = match;
            
            // Set winner if match is completed
            if (match.status === 'completed' && match.homeScore !== undefined && match.awayScore !== undefined) {
              if (match.homeScore > match.awayScore) {
                bracket.winner = homePlayer || null;
              } else if (match.awayScore > match.homeScore) {
                bracket.winner = awayPlayer || null;
              }
              
              // Advance winner to next round
              if (bracket.winner && round < brackets.length - 1) {
                const nextRoundPos = Math.floor(pos / 2);
                const nextBracket = brackets[round + 1][nextRoundPos];
                if (nextBracket) {
                  if (pos % 2 === 0) {
                    nextBracket.homePlayer = bracket.winner;
                  } else {
                    nextBracket.awayPlayer = bracket.winner;
                  }
                }
              }
            }
            break;
          }
        }
      }
    });

    return { brackets, totalRounds, participants };
  }, [tournament, activeGroup]);

  const handleSubmitResult = async () => {
    if (!selectedMatch || homeScore === '' || awayScore === '') return;
    
    const homeScoreNum = parseInt(homeScore);
    const awayScoreNum = parseInt(awayScore);
    
    if (isNaN(homeScoreNum) || isNaN(awayScoreNum) || homeScoreNum < 0 || awayScoreNum < 0) {
      return;
    }
    
    try {
      const { error } = await supabase
        .from('matches')
        .update({
          home_score: homeScoreNum,
          away_score: awayScoreNum,
          status: 'completed',
          completed_at: new Date().toISOString(),
        })
        .eq('id', selectedMatch.id);
      
      if (error) {
        console.error('Error updating match:', error);
        return;
      }
      
      setResultModal(false);
      setSelectedMatch(null);
      setHomeScore('');
      setAwayScore('');
    } catch (error) {
      console.error('Error submitting result:', error);
    }
  };

  const handleShareYoutube = async () => {
    if (!selectedMatch) return;
    
    const link = goLiveWithoutLink ? '' : youtubeLink;
    if (!goLiveWithoutLink && !youtubeLink) return;
    
    try {
      const { error } = await supabase
        .from('matches')
        .update({
          youtube_link: link,
          status: 'live',
        })
        .eq('id', selectedMatch.id);
      
      if (error) {
        console.error('Error sharing YouTube link:', error);
        return;
      }
      
      setYoutubeModal(false);
      setSelectedMatch(null);
      setYoutubeLink('');
      setGoLiveWithoutLink(false);
    } catch (error) {
      console.error('Error sharing YouTube link:', error);
    }
  };

  const getRoundName = (round: number, totalRounds: number) => {
    if (round === totalRounds - 1) return 'Final';
    if (round === totalRounds - 2) return 'Semi-Final';
    if (round === totalRounds - 3) return 'Quarter-Final';
    return `Round ${round + 1}`;
  };

  const renderBracketMatch = (bracket: BracketMatch, roundIndex: number) => {
    const { homePlayer, awayPlayer, match, winner } = bracket;
    const isCompleted = match?.status === 'completed';
    const isLive = match?.status === 'live';
    const canPlay = homePlayer && awayPlayer && !isCompleted;

    return (
      <View key={bracket.id} style={styles.bracketMatch}>
        <View style={styles.matchPlayers}>
          <View style={[
            styles.playerSlot,
            winner?.id === homePlayer?.id && styles.winnerSlot
          ]}>
            <Text style={[
              styles.playerName,
              !homePlayer && styles.emptySlot,
              winner?.id === homePlayer?.id && styles.winnerText
            ]}>
              {homePlayer?.name || 'TBD'}
            </Text>
            {isCompleted && match && (
              <Text style={styles.score}>{match.homeScore}</Text>
            )}
          </View>
          
          <View style={styles.matchDivider}>
            {isLive && <View style={styles.liveDot} />}
          </View>
          
          <View style={[
            styles.playerSlot,
            winner?.id === awayPlayer?.id && styles.winnerSlot
          ]}>
            <Text style={[
              styles.playerName,
              !awayPlayer && styles.emptySlot,
              winner?.id === awayPlayer?.id && styles.winnerText
            ]}>
              {awayPlayer?.name || 'TBD'}
            </Text>
            {isCompleted && match && (
              <Text style={styles.score}>{match.awayScore}</Text>
            )}
          </View>
        </View>

        {canPlay && match && (
          <View style={styles.matchActions}>
            {match.status === 'scheduled' && (
              <>
                <TouchableOpacity
                  style={styles.actionButton}
                  onPress={() => {
                    setSelectedMatch(match);
                    setYoutubeModal(true);
                  }}
                >
                  <Youtube size={12} color="#0EA5E9" />
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.actionButton}
                  onPress={() => {
                    setSelectedMatch(match);
                    setResultModal(true);
                  }}
                >
                  <CheckCircle size={12} color="#10B981" />
                </TouchableOpacity>
              </>
            )}
            {match.status === 'live' && (
              <TouchableOpacity
                style={styles.actionButton}
                onPress={() => {
                  setSelectedMatch(match);
                  setResultModal(true);
                }}
              >
                <CheckCircle size={12} color="#10B981" />
              </TouchableOpacity>
            )}
          </View>
        )}
      </View>
    );
  };

  if (groupsLoading) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <Stack.Screen options={{ headerShown: false }} />
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <ArrowLeft size={24} color="#fff" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Loading...</Text>
        </View>
      </View>
    );
  }
  
  if (!tournament || !bracketData) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <Stack.Screen options={{ headerShown: false }} />
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <ArrowLeft size={24} color="#fff" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Tournament Not Found</Text>
        </View>
      </View>
    );
  }

  const { brackets, totalRounds, participants } = bracketData;

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <Stack.Screen options={{ headerShown: false }} />
      
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <ArrowLeft size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{tournament.name}</Text>
      </View>

      {/* Tournament Info */}
      <View style={styles.tournamentInfo}>
        <View style={styles.infoItem}>
          <Trophy size={16} color="#8B5CF6" />
          <Text style={styles.infoText}>Knockout Tournament</Text>
        </View>
        <View style={styles.infoItem}>
          <Users size={16} color="#64748B" />
          <Text style={styles.infoText}>{participants.length} Players</Text>
        </View>
        <View style={styles.infoItem}>
          <Calendar size={16} color="#64748B" />
          <Text style={styles.infoText}>
            {new Date(tournament.startDate).toLocaleDateString()}
          </Text>
        </View>
      </View>

      {/* Bracket */}
      <ScrollView 
        horizontal 
        showsHorizontalScrollIndicator={false}
        style={styles.bracketContainer}
        contentContainerStyle={styles.bracketContent}
      >
        {brackets.map((roundBrackets, roundIndex) => (
          <View key={roundIndex} style={styles.round}>
            <Text style={styles.roundTitle}>
              {getRoundName(roundIndex, totalRounds)}
            </Text>
            <View style={styles.roundMatches}>
              {roundBrackets.map((bracket) => renderBracketMatch(bracket, roundIndex))}
            </View>
          </View>
        ))}
      </ScrollView>

      {/* Result Modal */}
      <Modal
        visible={resultModal}
        transparent
        animationType="slide"
        onRequestClose={() => setResultModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Match Result</Text>
            
            <View style={styles.scoreInputContainer}>
              <View style={styles.scoreInputSection}>
                <Text style={styles.scoreLabel}>
                  {activeGroup?.members.find(m => m.id === selectedMatch?.homePlayerId)?.name}
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
                  {activeGroup?.members.find(m => m.id === selectedMatch?.awayPlayerId)?.name}
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
                style={styles.submitButton}
                onPress={handleSubmitResult}
              >
                <Text style={styles.submitButtonText}>Submit</Text>
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
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#1E293B',
  },
  backButton: {
    marginRight: 16,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '600' as const,
    color: '#fff',
    flex: 1,
  },
  tournamentInfo: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingVertical: 16,
    paddingHorizontal: 16,
    backgroundColor: '#1E293B',
    marginBottom: 16,
  },
  infoItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  infoText: {
    fontSize: 14,
    color: '#64748B',
  },
  bracketContainer: {
    flex: 1,
  },
  bracketContent: {
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  round: {
    marginRight: 32,
    minWidth: 200,
  },
  roundTitle: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: '#fff',
    textAlign: 'center',
    marginBottom: 16,
    paddingVertical: 8,
    backgroundColor: '#1E293B',
    borderRadius: 8,
  },
  roundMatches: {
    gap: 24,
  },
  bracketMatch: {
    backgroundColor: '#1E293B',
    borderRadius: 12,
    padding: 12,
    minHeight: 80,
    justifyContent: 'center',
  },
  matchPlayers: {
    gap: 8,
  },
  playerSlot: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: '#0F172A',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#334155',
  },
  winnerSlot: {
    borderColor: '#10B981',
    backgroundColor: 'rgba(16, 185, 129, 0.1)',
  },
  playerName: {
    fontSize: 14,
    color: '#fff',
    fontWeight: '500' as const,
    flex: 1,
  },
  emptySlot: {
    color: '#64748B',
    fontStyle: 'italic',
  },
  winnerText: {
    color: '#10B981',
    fontWeight: '600' as const,
  },
  score: {
    fontSize: 16,
    fontWeight: '700' as const,
    color: '#fff',
    marginLeft: 8,
  },
  matchDivider: {
    height: 2,
    backgroundColor: '#334155',
    alignItems: 'center',
    justifyContent: 'center',
  },
  liveDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#EF4444',
  },
  matchActions: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 8,
    justifyContent: 'center',
  },
  actionButton: {
    padding: 8,
    borderRadius: 6,
    backgroundColor: '#334155',
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