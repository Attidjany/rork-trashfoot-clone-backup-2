import React, { useEffect, useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Trophy, Users, Calendar, Crown } from 'lucide-react-native';
import { useGameStore } from '@/hooks/use-game-store';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function HomeScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [isMounted, setIsMounted] = useState(false);
  const { 
    currentUser, 
    activeGroup, 
    isLoading,
  } = useGameStore();

  useEffect(() => {
    setIsMounted(true);
  }, []);

  useEffect(() => {
    if (isMounted && !isLoading && !currentUser) {
      router.replace('/onboarding');
    }
  }, [currentUser, isLoading, router, isMounted]);

  if (!isMounted || isLoading) {
    return (
      <View style={[styles.loadingContainer, { paddingTop: insets.top }]}>
        <ActivityIndicator size="large" color="#0EA5E9" />
      </View>
    );
  }

  if (!activeGroup) {
    return (
      <View style={[styles.emptyContainer, { paddingTop: insets.top }]}>
        <Trophy size={64} color="#64748B" />
        <Text style={styles.emptyTitle}>No Active Group</Text>
        <Text style={styles.emptyText}>Create or join a group to start tracking matches</Text>
        <TouchableOpacity 
          style={styles.primaryButton}
          onPress={() => router.push('/profile')}
        >
          <Text style={styles.primaryButtonText}>Go to Profile</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const recentMatches = activeGroup.competitions
    .flatMap(c => c.matches)
    .filter(m => m.status === 'completed')
    .sort((a, b) => new Date(b.completedAt!).getTime() - new Date(a.completedAt!).getTime())
    .slice(0, 3);

  const upcomingMatches = activeGroup.competitions
    .flatMap(c => c.matches)
    .filter(m => m.status === 'scheduled')
    .sort((a, b) => new Date(a.scheduledTime).getTime() - new Date(b.scheduledTime).getTime())
    .slice(0, 3);

  const topPlayers = [...activeGroup.members]
    .sort((a, b) => b.stats.points - a.stats.points)
    .slice(0, 3);

  const activeCompetitions = activeGroup.competitions.filter(c => c.status === 'active').length;
  const totalMatches = activeGroup.competitions.flatMap(c => c.matches).length;

  return (
    <ScrollView style={[styles.container, { paddingTop: insets.top }]}>
      <LinearGradient
        colors={['#0EA5E9', '#8B5CF6']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.headerCard}
      >
        <View style={styles.headerContent}>
          <View>
            <Text style={styles.welcomeText}>Welcome back,</Text>
            <Text style={styles.userName}>{currentUser?.name}</Text>
          </View>
          <View style={styles.groupBadge}>
            <Users size={16} color="#fff" />
            <Text style={styles.groupName}>{activeGroup.name}</Text>
          </View>
        </View>
      </LinearGradient>

      <View style={styles.statsGrid}>
        <View style={styles.statCard}>
          <Trophy size={24} color="#0EA5E9" />
          <Text style={styles.statValue}>{activeCompetitions}</Text>
          <Text style={styles.statLabel}>Active Comps</Text>
        </View>
        <View style={styles.statCard}>
          <Calendar size={24} color="#8B5CF6" />
          <Text style={styles.statValue}>{totalMatches}</Text>
          <Text style={styles.statLabel}>Total Matches</Text>
        </View>
        <View style={styles.statCard}>
          <Users size={24} color="#10B981" />
          <Text style={styles.statValue}>{activeGroup.members.length}</Text>
          <Text style={styles.statLabel}>Players</Text>
        </View>
      </View>

      {topPlayers.length > 0 && (
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Top Players</Text>
            <TouchableOpacity onPress={() => router.push('/stats')}>
              <Text style={styles.seeAll}>See All</Text>
            </TouchableOpacity>
          </View>
          {topPlayers.map((player, index) => (
            <View key={player.id} style={styles.playerCard}>
              <View style={styles.playerRank}>
                {index === 0 ? (
                  <Crown size={20} color="#FFD700" />
                ) : (
                  <Text style={styles.rankNumber}>{index + 1}</Text>
                )}
              </View>
              <View style={styles.playerInfo}>
                <Text style={styles.playerName}>{player.name}</Text>
                <View style={styles.playerStats}>
                  <Text style={styles.playerStatText}>
                    {player.stats.played} played • {player.stats.wins}W {player.stats.draws}D {player.stats.losses}L
                  </Text>
                </View>
              </View>
              <View style={styles.playerPoints}>
                <Text style={styles.pointsValue}>{player.stats.points}</Text>
                <Text style={styles.pointsLabel}>pts</Text>
              </View>
            </View>
          ))}
        </View>
      )}

      {recentMatches.length > 0 && (
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Recent Matches</Text>
            <TouchableOpacity onPress={() => router.push('/matches')}>
              <Text style={styles.seeAll}>See All</Text>
            </TouchableOpacity>
          </View>
          {recentMatches.map(match => {
            const homePlayer = activeGroup.members.find(m => m.id === match.homePlayerId);
            const awayPlayer = activeGroup.members.find(m => m.id === match.awayPlayerId);
            return (
              <TouchableOpacity 
                key={match.id} 
                style={styles.matchCard}
                onPress={() => router.push(`/match-details?id=${match.id}`)}
              >
                <View style={styles.matchPlayers}>
                  <Text style={styles.matchPlayer}>{homePlayer?.name}</Text>
                  <View style={styles.matchScore}>
                    <Text style={styles.scoreText}>{match.homeScore}</Text>
                    <Text style={styles.scoreSeparator}>-</Text>
                    <Text style={styles.scoreText}>{match.awayScore}</Text>
                  </View>
                  <Text style={styles.matchPlayer}>{awayPlayer?.name}</Text>
                </View>
              </TouchableOpacity>
            );
          })}
        </View>
      )}

      {upcomingMatches.length > 0 && (
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Upcoming Matches</Text>
            <TouchableOpacity onPress={() => router.push('/matches')}>
              <Text style={styles.seeAll}>See All</Text>
            </TouchableOpacity>
          </View>
          {upcomingMatches.map(match => {
            const homePlayer = activeGroup.members.find(m => m.id === match.homePlayerId);
            const awayPlayer = activeGroup.members.find(m => m.id === match.awayPlayerId);
            return (
              <TouchableOpacity 
                key={match.id} 
                style={styles.matchCard}
                onPress={() => router.push(`/match-details?id=${match.id}`)}
              >
                <View style={styles.matchPlayers}>
                  <Text style={styles.matchPlayer}>{homePlayer?.name}</Text>
                  <View style={styles.matchTime}>
                    <Calendar size={14} color="#64748B" />
                    <Text style={styles.timeText}>
                      {Platform.OS === 'web' 
                        ? new Date(match.scheduledTime).toLocaleDateString('en-US', { 
                            month: 'short', 
                            day: 'numeric' 
                          })
                        : new Date(match.scheduledTime).toLocaleDateString()
                      }
                    </Text>
                  </View>
                  <Text style={styles.matchPlayer}>{awayPlayer?.name}</Text>
                </View>
              </TouchableOpacity>
            );
          })}
        </View>
      )}

      <View style={styles.bottomSpacing} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0F172A',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#0F172A',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#0F172A',
    padding: 20,
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
  headerCard: {
    margin: 16,
    padding: 20,
    borderRadius: 16,
  },
  headerContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  welcomeText: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.8)',
  },
  userName: {
    fontSize: 24,
    fontWeight: '700' as const,
    color: '#fff',
    marginTop: 4,
  },
  groupBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    gap: 6,
  },
  groupName: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600' as const,
  },
  statsGrid: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    gap: 12,
    marginBottom: 24,
  },
  statCard: {
    flex: 1,
    backgroundColor: '#1E293B',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  statValue: {
    fontSize: 24,
    fontWeight: '700' as const,
    color: '#fff',
    marginTop: 8,
  },
  statLabel: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 4,
  },
  section: {
    paddingHorizontal: 16,
    marginBottom: 24,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600' as const,
    color: '#fff',
  },
  seeAll: {
    fontSize: 14,
    color: '#0EA5E9',
  },
  playerCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1E293B',
    padding: 16,
    borderRadius: 12,
    marginBottom: 8,
  },
  playerRank: {
    width: 32,
    height: 32,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  rankNumber: {
    fontSize: 18,
    fontWeight: '700' as const,
    color: '#64748B',
  },
  playerInfo: {
    flex: 1,
  },
  playerName: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: '#fff',
  },
  playerStats: {
    flexDirection: 'row',
    marginTop: 4,
  },
  playerStatText: {
    fontSize: 12,
    color: '#64748B',
  },
  playerPoints: {
    alignItems: 'center',
  },
  pointsValue: {
    fontSize: 20,
    fontWeight: '700' as const,
    color: '#0EA5E9',
  },
  pointsLabel: {
    fontSize: 12,
    color: '#64748B',
  },
  matchCard: {
    backgroundColor: '#1E293B',
    padding: 16,
    borderRadius: 12,
    marginBottom: 8,
  },
  matchPlayers: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  matchPlayer: {
    fontSize: 14,
    color: '#fff',
    flex: 1,
  },
  matchScore: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  scoreText: {
    fontSize: 18,
    fontWeight: '700' as const,
    color: '#fff',
  },
  scoreSeparator: {
    fontSize: 16,
    color: '#64748B',
  },
  matchTime: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  timeText: {
    fontSize: 12,
    color: '#64748B',
  },
  bottomSpacing: {
    height: 20,
  },
});