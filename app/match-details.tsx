import React from 'react';
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  TouchableOpacity,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Trophy, Youtube } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useGameStore } from '@/hooks/use-game-store';
import { useRealtimeGroups } from '@/hooks/use-realtime-groups';
import { useSession } from '@/hooks/use-session';
import { LinearGradient } from 'expo-linear-gradient';

export default function MatchDetailsScreen() {
  const { id } = useLocalSearchParams();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { activeGroupId } = useGameStore();
  const { user } = useSession();
  const { groups, isLoading } = useRealtimeGroups();

  const activeGroup = groups.find(g => g.id === activeGroupId) || groups[0] || null;

  const match = activeGroup?.competitions
    .flatMap(c => c.matches)
    .find(m => m.id === id);

  const competition = activeGroup?.competitions.find(c => c.id === match?.competitionId);
  const homePlayer = activeGroup?.members.find(m => m.id === match?.homePlayerId);
  const awayPlayer = activeGroup?.members.find(m => m.id === match?.awayPlayerId);

  if (isLoading) {
    return (
      <View style={[styles.errorContainer, { paddingTop: insets.top }]}>
        <Text style={styles.errorText}>Loading...</Text>
      </View>
    );
  }

  if (!match || !homePlayer || !awayPlayer) {
    return (
      <View style={[styles.errorContainer, { paddingTop: insets.top }]}>
        <Text style={styles.errorText}>Match not found</Text>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={styles.backLink}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <ScrollView style={[styles.container, { paddingTop: insets.top }]}>
      {/* Competition Badge */}
      <View style={styles.competitionSection}>
        <View style={styles.competitionBadge}>
          <Trophy size={16} color="#0EA5E9" />
          <Text style={styles.competitionName}>{competition?.name}</Text>
        </View>
        <Text style={styles.competitionType}>
          {competition?.type?.toUpperCase()}
        </Text>
      </View>

      {/* Match Score Card */}
      <LinearGradient
        colors={['#1E293B', '#334155']}
        style={styles.scoreCard}
      >
        <View style={styles.matchHeader}>
          <Text style={styles.matchStatus}>
            {match.status === 'completed' ? 'FULL TIME' : 
             match.status === 'live' ? 'LIVE' : 'UPCOMING'}
          </Text>
          {match.scheduledTime && (
            <Text style={styles.matchDate}>
              {new Date(match.scheduledTime).toLocaleDateString()}
            </Text>
          )}
        </View>

        <View style={styles.scoreSection}>
          <View style={[
            styles.team,
            match.status === 'completed' && match.homeScore! > match.awayScore! && styles.winnerTeam
          ]}>
            <Text style={[
              styles.teamName,
              match.status === 'completed' && match.homeScore! > match.awayScore! && styles.winnerName
            ]}>{homePlayer.name}</Text>
            {match.status === 'completed' && (
              <Text style={[
                styles.score,
                match.homeScore! > match.awayScore! && styles.winnerScore
              ]}>{match.homeScore}</Text>
            )}
          </View>

          <View style={styles.scoreSeparator}>
            {match.status === 'completed' ? (
              <Text style={styles.vs}>-</Text>
            ) : match.status === 'live' ? (
              <View style={styles.liveBadge}>
                <View style={styles.liveDot} />
              </View>
            ) : (
              <Text style={styles.vs}>VS</Text>
            )}
          </View>

          <View style={[
            styles.team,
            match.status === 'completed' && match.awayScore! > match.homeScore! && styles.winnerTeam
          ]}>
            <Text style={[
              styles.teamName,
              match.status === 'completed' && match.awayScore! > match.homeScore! && styles.winnerName
            ]}>{awayPlayer.name}</Text>
            {match.status === 'completed' && (
              <Text style={[
                styles.score,
                match.awayScore! > match.homeScore! && styles.winnerScore
              ]}>{match.awayScore}</Text>
            )}
          </View>
        </View>

        {match.youtubeLink && (
          <TouchableOpacity style={styles.youtubeButton}>
            <Youtube size={20} color="#FF0000" />
            <Text style={styles.youtubeText}>Watch on YouTube</Text>
          </TouchableOpacity>
        )}
      </LinearGradient>

      {/* Player Stats Comparison */}
      {match.status === 'completed' && (
        <View style={styles.statsComparison}>
          <Text style={styles.sectionTitle}>Match Statistics</Text>
          
          <View style={styles.statRow}>
            <Text style={styles.statLabel}>{homePlayer.name}</Text>
            <Text style={styles.statCenter}>Goals</Text>
            <Text style={styles.statLabel}>{awayPlayer.name}</Text>
          </View>
          
          <View style={styles.statBar}>
            <View style={[styles.statBarFill, { 
              flex: match.homeScore || 0,
              backgroundColor: '#0EA5E9',
            }]} />
            <Text style={styles.statBarValue}>{match.homeScore}</Text>
            <Text style={styles.statBarValue}>{match.awayScore}</Text>
            <View style={[styles.statBarFill, { 
              flex: match.awayScore || 0,
              backgroundColor: '#8B5CF6',
            }]} />
          </View>
        </View>
      )}

      {/* Head to Head History */}
      <View style={styles.h2hSection}>
        <Text style={styles.sectionTitle}>Recent Head to Head</Text>
        {activeGroup?.competitions
          .flatMap(c => c.matches)
          .filter(m => 
            m.status === 'completed' &&
            m.id !== match.id &&
            ((m.homePlayerId === homePlayer.id && m.awayPlayerId === awayPlayer.id) ||
             (m.homePlayerId === awayPlayer.id && m.awayPlayerId === homePlayer.id))
          )
          .slice(0, 5)
          .map(m => (
            <View key={m.id} style={styles.h2hMatch}>
              <Text style={styles.h2hDate}>
                {new Date(m.completedAt!).toLocaleDateString()}
              </Text>
              <View style={styles.h2hScore}>
                <Text style={styles.h2hPlayer}>
                  {activeGroup.members.find(p => p.id === m.homePlayerId)?.name}
                </Text>
                <Text style={styles.h2hResult}>
                  {m.homeScore} - {m.awayScore}
                </Text>
                <Text style={styles.h2hPlayer}>
                  {activeGroup.members.find(p => p.id === m.awayPlayerId)?.name}
                </Text>
              </View>
            </View>
          ))}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0F172A',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#0F172A',
  },
  errorText: {
    fontSize: 18,
    color: '#fff',
    marginBottom: 16,
  },
  backLink: {
    fontSize: 16,
    color: '#0EA5E9',
  },
  competitionSection: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
  },
  competitionBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  competitionName: {
    fontSize: 14,
    color: '#0EA5E9',
    fontWeight: '500' as const,
  },
  competitionType: {
    fontSize: 12,
    color: '#64748B',
    fontWeight: '600' as const,
  },
  scoreCard: {
    margin: 16,
    padding: 20,
    borderRadius: 16,
  },
  matchHeader: {
    alignItems: 'center',
    marginBottom: 20,
  },
  matchStatus: {
    fontSize: 12,
    fontWeight: '700' as const,
    color: '#0EA5E9',
    letterSpacing: 1,
  },
  matchDate: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 4,
  },
  scoreSection: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  team: {
    flex: 1,
    alignItems: 'center',
    padding: 12,
    borderRadius: 12,
  },
  winnerTeam: {
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
  },
  teamName: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: '#fff',
    marginBottom: 8,
  },
  winnerName: {
    color: '#10B981',
    fontWeight: '700' as const,
  },
  score: {
    fontSize: 36,
    fontWeight: '700' as const,
    color: '#fff',
  },
  winnerScore: {
    color: '#10B981',
  },
  scoreSeparator: {
    paddingHorizontal: 20,
  },
  vs: {
    fontSize: 16,
    color: '#64748B',
  },
  liveBadge: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#EF4444',
    justifyContent: 'center',
    alignItems: 'center',
  },
  liveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#fff',
  },
  youtubeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 20,
    paddingVertical: 10,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 8,
  },
  youtubeText: {
    fontSize: 14,
    color: '#fff',
    fontWeight: '500' as const,
  },
  statsComparison: {
    padding: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600' as const,
    color: '#fff',
    marginBottom: 16,
  },
  statRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  statLabel: {
    fontSize: 12,
    color: '#64748B',
    flex: 1,
  },
  statCenter: {
    fontSize: 12,
    color: '#64748B',
    textAlign: 'center',
  },
  statBar: {
    flexDirection: 'row',
    height: 32,
    backgroundColor: '#1E293B',
    borderRadius: 8,
    overflow: 'hidden',
    alignItems: 'center',
  },
  statBarFill: {
    height: '100%',
  },
  statBarValue: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: '#fff',
    paddingHorizontal: 12,
  },
  h2hSection: {
    padding: 16,
  },
  h2hMatch: {
    backgroundColor: '#1E293B',
    padding: 12,
    borderRadius: 8,
    marginBottom: 8,
  },
  h2hDate: {
    fontSize: 10,
    color: '#64748B',
    marginBottom: 4,
  },
  h2hScore: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  h2hPlayer: {
    fontSize: 12,
    color: '#fff',
    flex: 1,
  },
  h2hResult: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: '#fff',
    paddingHorizontal: 12,
  },
});