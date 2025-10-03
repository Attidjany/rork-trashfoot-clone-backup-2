import React, { useState, useMemo } from 'react';
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { Trophy, Target, Users, Table, ChevronDown, ChevronUp, Award } from 'lucide-react-native';
import { useGameStore } from '@/hooks/use-game-store';
import { LinearGradient } from 'expo-linear-gradient';
import { Player } from '@/types/game';
import { AchievementBadges } from '@/components/AchievementBadges';
import { useSession } from '@/hooks/use-session';
import { useRealtimeGroups } from '@/hooks/use-realtime-groups';

export default function StatsScreen() {
  const { user, loading: sessionLoading } = useSession();
  const { groups, isLoading: groupsLoading } = useRealtimeGroups(user?.id);
  const { activeGroupId, getHeadToHead } = useGameStore();
  
  const activeGroup = groups.find(g => g.id === activeGroupId) || groups[0] || null;
  const isLoading = sessionLoading || groupsLoading;
  const [selectedTab, setSelectedTab] = useState<'leaderboard' | 'h2h' | 'table' | 'leagues'>('leaderboard');
  const [selectedPlayers, setSelectedPlayers] = useState<string[]>([]);
  const [showFullTable, setShowFullTable] = useState<{ [key: string]: boolean }>({});

  const allMatches = useMemo(() => {
    if (!activeGroup) return [];
    return activeGroup.competitions.flatMap(c => c.matches);
  }, [activeGroup]);

  const completedMatchesCount = useMemo(() => {
    return allMatches.filter(m => m.status === 'completed').length;
  }, [allMatches]);

  const leagueStats = useMemo(() => {
    if (!activeGroup) return [];
    
    console.log('📊 Recalculating league stats, completed matches:', completedMatchesCount);
    
    return activeGroup.competitions
      .filter(comp => comp.type === 'league')
      .map(league => {
        const leagueMatches = league.matches.filter(m => m.status === 'completed');
        const leaguePlayerStats = activeGroup.members.map(player => {
          const playerMatches = leagueMatches.filter(
            m => m.homePlayerId === player.id || m.awayPlayerId === player.id
          );
          
          let wins = 0, draws = 0, losses = 0, goalsFor = 0, goalsAgainst = 0, cleanSheets = 0;
          const form: ('W' | 'D' | 'L')[] = [];
          
          playerMatches.forEach(match => {
            const isHome = match.homePlayerId === player.id;
            const playerScore = isHome ? match.homeScore! : match.awayScore!;
            const opponentScore = isHome ? match.awayScore! : match.homeScore!;
            
            goalsFor += playerScore;
            goalsAgainst += opponentScore;
            if (opponentScore === 0) cleanSheets++;
            
            if (playerScore > opponentScore) {
              wins++;
              form.unshift('W');
            } else if (playerScore === opponentScore) {
              draws++;
              form.unshift('D');
            } else {
              losses++;
              form.unshift('L');
            }
          });
          
          const played = wins + draws + losses;
          const points = wins * 3 + draws;
          
          return {
            ...player,
            leagueStats: {
              played,
              wins,
              draws,
              losses,
              goalsFor,
              goalsAgainst,
              cleanSheets,
              points,
              winRate: played > 0 ? (wins / played) * 100 : 0,
              form: form.slice(0, 5),
            }
          };
        }).filter(p => p.leagueStats.played > 0)
          .sort((a, b) => b.leagueStats.points - a.leagueStats.points);
        
        return {
          league,
          players: leaguePlayerStats,
        };
      });
  }, [activeGroup, completedMatchesCount]);

  if (isLoading) {
    return (
      <View style={styles.emptyContainer}>
        <ActivityIndicator size="large" color="#0EA5E9" />
      </View>
    );
  }

  if (!activeGroup) {
    return (
      <View style={styles.emptyContainer}>
        <Trophy size={64} color="#64748B" />
        <Text style={styles.emptyTitle}>No Active Group</Text>
        <Text style={styles.emptyText}>Join or create a group to view statistics</Text>
      </View>
    );
  }

  const sortedPlayers = [...activeGroup.members].sort((a, b) => b.stats.points - a.stats.points);
  
  const h2hData = selectedPlayers[0] && selectedPlayers[1] 
    ? getHeadToHead(selectedPlayers[0], selectedPlayers[1])
    : null;

  const renderPlayerCard = (player: Player, rank: number) => {
    const goalDiff = player.stats.goalsFor - player.stats.goalsAgainst;
    const isSelected = selectedPlayers.includes(player.id);

    return (
      <TouchableOpacity
        key={player.id}
        style={[styles.playerCard, isSelected && styles.selectedPlayerCard]}
        onPress={() => {
          if (selectedTab === 'h2h') {
            if (isSelected) {
              setSelectedPlayers(prev => prev.filter(id => id !== player.id));
            } else if (selectedPlayers.length < 2) {
              setSelectedPlayers(prev => [...prev, player.id]);
            } else {
              setSelectedPlayers([player.id]);
            }
          }
        }}
      >
        <View style={styles.rankBadge}>
          <Text style={[
            styles.rankText,
            rank === 1 && styles.goldRank,
            rank === 2 && styles.silverRank,
            rank === 3 && styles.bronzeRank,
          ]}>
            #{rank}
          </Text>
        </View>

        <View style={styles.playerInfo}>
          <View style={styles.playerNameContainer}>
            <Text style={styles.playerName}>@{player.gamerHandle}</Text>
            <AchievementBadges 
              leaguesWon={player.stats.leaguesWon}
              knockoutsWon={player.stats.knockoutsWon}
              size="small"
            />
          </View>
          <View style={styles.formContainer}>
            {player.stats.form.map((result, index) => (
              <View
                key={index}
                style={[
                  styles.formBadge,
                  result === 'W' && styles.winBadge,
                  result === 'D' && styles.drawBadge,
                  result === 'L' && styles.lossBadge,
                ]}
              >
                <Text style={styles.formText}>{result}</Text>
              </View>
            ))}
          </View>
        </View>

        <View style={styles.statsContainer}>
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{player.stats.points}</Text>
            <Text style={styles.statLabel}>PTS</Text>
          </View>
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{player.stats.played}</Text>
            <Text style={styles.statLabel}>P</Text>
          </View>
          <View style={styles.statItem}>
            <Text style={[styles.statValue, goalDiff > 0 && styles.positiveGD]}>
              {goalDiff > 0 ? '+' : ''}{goalDiff}
            </Text>
            <Text style={styles.statLabel}>GD</Text>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      {/* Tab Selector */}
      <View style={styles.tabContainer}>
        <TouchableOpacity
          style={[styles.tab, selectedTab === 'leaderboard' && styles.activeTab]}
          onPress={() => {
            setSelectedTab('leaderboard');
            setSelectedPlayers([]);
          }}
        >
          <Trophy size={16} color={selectedTab === 'leaderboard' ? '#fff' : '#64748B'} />
          <Text style={[styles.tabText, selectedTab === 'leaderboard' && styles.activeTabText]}>
            Leaderboard
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, selectedTab === 'table' && styles.activeTab]}
          onPress={() => {
            setSelectedTab('table');
            setSelectedPlayers([]);
          }}
        >
          <Table size={16} color={selectedTab === 'table' ? '#fff' : '#64748B'} />
          <Text style={[styles.tabText, selectedTab === 'table' && styles.activeTabText]}>
            General
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, selectedTab === 'leagues' && styles.activeTab]}
          onPress={() => {
            setSelectedTab('leagues');
            setSelectedPlayers([]);
          }}
        >
          <Award size={16} color={selectedTab === 'leagues' ? '#fff' : '#64748B'} />
          <Text style={[styles.tabText, selectedTab === 'leagues' && styles.activeTabText]}>
            Leagues
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, selectedTab === 'h2h' && styles.activeTab]}
          onPress={() => setSelectedTab('h2h')}
        >
          <Users size={16} color={selectedTab === 'h2h' ? '#fff' : '#64748B'} />
          <Text style={[styles.tabText, selectedTab === 'h2h' && styles.activeTabText]}>
            Head to Head
          </Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content}>
        {selectedTab === 'leaderboard' && (
          <>
            {/* Top 3 Podium */}
            {sortedPlayers.length >= 3 && (
              <View style={styles.podiumContainer}>
                <LinearGradient
                  colors={['#0EA5E9', '#8B5CF6']}
                  style={styles.podiumGradient}
                >
                  <View style={styles.podium}>
                    {/* Second Place */}
                    <View style={styles.podiumPlace}>
                      <View style={[styles.podiumBar, styles.silverBar]}>
                        <Text style={styles.podiumRank}>2</Text>
                      </View>
                      <Text style={styles.podiumName}>@{sortedPlayers[1].gamerHandle}</Text>
                      <AchievementBadges 
                        leaguesWon={sortedPlayers[1].stats.leaguesWon}
                        knockoutsWon={sortedPlayers[1].stats.knockoutsWon}
                        size="small"
                        style={styles.podiumBadges}
                      />
                      <Text style={styles.podiumPoints}>{sortedPlayers[1].stats.points} pts</Text>
                    </View>
                    
                    {/* First Place */}
                    <View style={styles.podiumPlace}>
                      <View style={[styles.podiumBar, styles.goldBar]}>
                        <Text style={styles.podiumRank}>1</Text>
                      </View>
                      <Text style={styles.podiumName}>@{sortedPlayers[0].gamerHandle}</Text>
                      <AchievementBadges 
                        leaguesWon={sortedPlayers[0].stats.leaguesWon}
                        knockoutsWon={sortedPlayers[0].stats.knockoutsWon}
                        size="small"
                        style={styles.podiumBadges}
                      />
                      <Text style={styles.podiumPoints}>{sortedPlayers[0].stats.points} pts</Text>
                    </View>
                    
                    {/* Third Place */}
                    <View style={styles.podiumPlace}>
                      <View style={[styles.podiumBar, styles.bronzeBar]}>
                        <Text style={styles.podiumRank}>3</Text>
                      </View>
                      <Text style={styles.podiumName}>@{sortedPlayers[2].gamerHandle}</Text>
                      <AchievementBadges 
                        leaguesWon={sortedPlayers[2].stats.leaguesWon}
                        knockoutsWon={sortedPlayers[2].stats.knockoutsWon}
                        size="small"
                        style={styles.podiumBadges}
                      />
                      <Text style={styles.podiumPoints}>{sortedPlayers[2].stats.points} pts</Text>
                    </View>
                  </View>
                </LinearGradient>
              </View>
            )}

            {/* Full Leaderboard */}
            <View style={styles.leaderboard}>
              {sortedPlayers.map((player, index) => {
                if (!player?.gamerHandle?.trim()) return null;
                return renderPlayerCard(player, index + 1);
              })}
            </View>
          </>
        )}

        {selectedTab === 'table' && (
          <View style={styles.tableContainer}>
            <View style={styles.tableHeaderContainer}>
              <Text style={styles.tableTitle}>General Table (All Matches)</Text>
              <Text style={styles.tableSubtitle}>Combined stats from all competitions</Text>
            </View>
            <View style={styles.tableHeader}>
              <Text style={[styles.tableHeaderText, styles.positionColumn]}>#</Text>
              <Text style={[styles.tableHeaderText, styles.playerColumn]}>Player</Text>
              <Text style={[styles.tableHeaderText, styles.statColumn]}>P</Text>
              <Text style={[styles.tableHeaderText, styles.statColumn]}>W</Text>
              <Text style={[styles.tableHeaderText, styles.statColumn]}>D</Text>
              <Text style={[styles.tableHeaderText, styles.statColumn]}>L</Text>
              <Text style={[styles.tableHeaderText, styles.statColumn]}>GF</Text>
              <Text style={[styles.tableHeaderText, styles.statColumn]}>GA</Text>
              <Text style={[styles.tableHeaderText, styles.statColumn]}>GD</Text>
              <Text style={[styles.tableHeaderText, styles.statColumn]}>PTS</Text>
            </View>
            
            {sortedPlayers.map((player, index) => {
              if (!player?.gamerHandle?.trim()) return null;
              const goalDiff = player.stats.goalsFor - player.stats.goalsAgainst;
              
              return (
                <View key={player.id} style={[
                  styles.tableRow,
                  index === 0 && styles.firstPlace,
                  index === 1 && styles.secondPlace,
                  index === 2 && styles.thirdPlace,
                ]}>
                  <Text style={[styles.tableCell, styles.positionColumn, 
                    index === 0 && styles.goldText,
                    index === 1 && styles.silverText,
                    index === 2 && styles.bronzeText,
                  ]}>{index + 1}</Text>
                  <View style={[styles.tableCell, styles.playerColumn]}>
                    <Text style={styles.playerTableName} numberOfLines={1}>
                      @{player.gamerHandle}
                    </Text>
                    <AchievementBadges 
                      leaguesWon={player.stats.leaguesWon}
                      knockoutsWon={player.stats.knockoutsWon}
                      size="small"
                    />
                  </View>
                  <Text style={[styles.tableCell, styles.statColumn]}>{player.stats.played}</Text>
                  <Text style={[styles.tableCell, styles.statColumn]}>{player.stats.wins}</Text>
                  <Text style={[styles.tableCell, styles.statColumn]}>{player.stats.draws}</Text>
                  <Text style={[styles.tableCell, styles.statColumn]}>{player.stats.losses}</Text>
                  <Text style={[styles.tableCell, styles.statColumn]}>{player.stats.goalsFor}</Text>
                  <Text style={[styles.tableCell, styles.statColumn]}>{player.stats.goalsAgainst}</Text>
                  <Text style={[styles.tableCell, styles.statColumn, goalDiff > 0 && styles.positiveGD]}>
                    {goalDiff > 0 ? '+' : ''}{goalDiff}
                  </Text>
                  <Text style={[styles.tableCell, styles.statColumn, styles.pointsText]}>
                    {player.stats.points}
                  </Text>
                </View>
              );
            })}
          </View>
        )}

        {selectedTab === 'leagues' && (
          <View style={styles.leaguesContainer}>
            {leagueStats.length === 0 ? (
              <View style={styles.emptyLeagues}>
                <Award size={64} color="#64748B" />
                <Text style={styles.emptyTitle}>No Leagues Found</Text>
                <Text style={styles.emptyText}>Create a league competition to see league tables</Text>
              </View>
            ) : (
              leagueStats.map(({ league, players }) => {
                const isExpanded = showFullTable[league.id] || false;
                const displayPlayers = isExpanded ? players : players.slice(0, 3);
                const isOngoing = league.status === 'active';
                
                return (
                  <View key={league.id} style={styles.leagueCard}>
                    <LinearGradient
                      colors={isOngoing ? ['#0EA5E9', '#8B5CF6'] : ['#1E293B', '#334155']}
                      style={styles.leagueHeader}
                    >
                      <View style={styles.leagueHeaderContent}>
                        <View style={styles.leagueTitleContainer}>
                          <Text style={styles.leagueTitle}>{league.name}</Text>
                          <View style={[
                            styles.statusBadge,
                            isOngoing ? styles.ongoingBadge : styles.finishedBadge
                          ]}>
                            <Text style={[
                              styles.statusText,
                              isOngoing ? styles.ongoingText : styles.finishedText
                            ]}>
                              {isOngoing ? 'ONGOING' : 'FINISHED'}
                            </Text>
                          </View>
                        </View>
                        <Text style={styles.leagueSubtitle}>
                          {players.length} players • {league.matches.filter(m => m.status === 'completed').length} matches played
                        </Text>
                      </View>
                    </LinearGradient>
                    
                    {/* Podium for top 3 */}
                    {players.length >= 3 && (
                      <View style={styles.miniPodiumContainer}>
                        <View style={styles.miniPodium}>
                          {/* Second Place */}
                          <View style={styles.miniPodiumPlace}>
                            <View style={[styles.miniPodiumBar, styles.silverBar]}>
                              <Text style={styles.miniPodiumRank}>2</Text>
                            </View>
                            <Text style={styles.miniPodiumName} numberOfLines={1}>
                              @{players[1]?.gamerHandle || 'N/A'}
                            </Text>
                            {players[1] && (
                              <AchievementBadges 
                                leaguesWon={players[1].stats.leaguesWon}
                                knockoutsWon={players[1].stats.knockoutsWon}
                                size="small"
                                style={styles.miniPodiumBadges}
                              />
                            )}
                            <Text style={styles.miniPodiumPoints}>{players[1]?.leagueStats.points || 0} pts</Text>
                          </View>
                          
                          {/* First Place */}
                          <View style={styles.miniPodiumPlace}>
                            <View style={[styles.miniPodiumBar, styles.goldBar]}>
                              <Text style={styles.miniPodiumRank}>1</Text>
                            </View>
                            <Text style={styles.miniPodiumName} numberOfLines={1}>
                              @{players[0]?.gamerHandle || 'N/A'}
                            </Text>
                            {players[0] && (
                              <AchievementBadges 
                                leaguesWon={players[0].stats.leaguesWon}
                                knockoutsWon={players[0].stats.knockoutsWon}
                                size="small"
                                style={styles.miniPodiumBadges}
                              />
                            )}
                            <Text style={styles.miniPodiumPoints}>{players[0]?.leagueStats.points || 0} pts</Text>
                          </View>
                          
                          {/* Third Place */}
                          <View style={styles.miniPodiumPlace}>
                            <View style={[styles.miniPodiumBar, styles.bronzeBar]}>
                              <Text style={styles.miniPodiumRank}>3</Text>
                            </View>
                            <Text style={styles.miniPodiumName} numberOfLines={1}>
                              @{players[2]?.gamerHandle || 'N/A'}
                            </Text>
                            {players[2] && (
                              <AchievementBadges 
                                leaguesWon={players[2].stats.leaguesWon}
                                knockoutsWon={players[2].stats.knockoutsWon}
                                size="small"
                                style={styles.miniPodiumBadges}
                              />
                            )}
                            <Text style={styles.miniPodiumPoints}>{players[2]?.leagueStats.points || 0} pts</Text>
                          </View>
                        </View>
                      </View>
                    )}
                    
                    {/* League Table */}
                    <View style={styles.leagueTable}>
                      <View style={styles.tableHeader}>
                        <Text style={[styles.tableHeaderText, styles.positionColumn]}>#</Text>
                        <Text style={[styles.tableHeaderText, styles.playerColumn]}>Player</Text>
                        <Text style={[styles.tableHeaderText, styles.statColumn]}>P</Text>
                        <Text style={[styles.tableHeaderText, styles.statColumn]}>W</Text>
                        <Text style={[styles.tableHeaderText, styles.statColumn]}>D</Text>
                        <Text style={[styles.tableHeaderText, styles.statColumn]}>L</Text>
                        <Text style={[styles.tableHeaderText, styles.statColumn]}>GD</Text>
                        <Text style={[styles.tableHeaderText, styles.statColumn]}>PTS</Text>
                      </View>
                      
                      {displayPlayers.map((player, index) => {
                        const goalDiff = player.leagueStats.goalsFor - player.leagueStats.goalsAgainst;
                        
                        return (
                          <View key={player.id} style={[
                            styles.tableRow,
                            index === 0 && styles.firstPlace,
                            index === 1 && styles.secondPlace,
                            index === 2 && styles.thirdPlace,
                          ]}>
                            <Text style={[styles.tableCell, styles.positionColumn, 
                              index === 0 && styles.goldText,
                              index === 1 && styles.silverText,
                              index === 2 && styles.bronzeText,
                            ]}>{index + 1}</Text>
                            <View style={[styles.tableCell, styles.playerColumn]}>
                              <Text style={styles.playerTableName} numberOfLines={1}>
                                @{player.gamerHandle}
                              </Text>
                              <AchievementBadges 
                                leaguesWon={player.stats.leaguesWon}
                                knockoutsWon={player.stats.knockoutsWon}
                                size="small"
                              />
                            </View>
                            <Text style={[styles.tableCell, styles.statColumn]}>{player.leagueStats.played}</Text>
                            <Text style={[styles.tableCell, styles.statColumn]}>{player.leagueStats.wins}</Text>
                            <Text style={[styles.tableCell, styles.statColumn]}>{player.leagueStats.draws}</Text>
                            <Text style={[styles.tableCell, styles.statColumn]}>{player.leagueStats.losses}</Text>
                            <Text style={[styles.tableCell, styles.statColumn, goalDiff > 0 && styles.positiveGD]}>
                              {goalDiff > 0 ? '+' : ''}{goalDiff}
                            </Text>
                            <Text style={[styles.tableCell, styles.statColumn, styles.pointsText]}>
                              {player.leagueStats.points}
                            </Text>
                          </View>
                        );
                      })}
                    </View>
                    
                    {/* Expand/Collapse Button */}
                    {players.length > 3 && (
                      <TouchableOpacity
                        style={styles.expandButton}
                        onPress={() => setShowFullTable(prev => ({
                          ...prev,
                          [league.id]: !prev[league.id]
                        }))}
                      >
                        {isExpanded ? (
                          <ChevronUp size={16} color="#0EA5E9" />
                        ) : (
                          <ChevronDown size={16} color="#0EA5E9" />
                        )}
                        <Text style={styles.expandButtonText}>
                          {isExpanded ? 'Show Less' : `Show All ${players.length} Players`}
                        </Text>
                      </TouchableOpacity>
                    )}
                  </View>
                );
              })
            )}
          </View>
        )}

        {selectedTab === 'h2h' && (
          <>
            <Text style={styles.h2hInstruction}>
              Select two players to compare their head-to-head record
            </Text>
            
            {/* Player Selection */}
            <View style={styles.playerList}>
              {sortedPlayers.map((player, index) => {
                if (!player?.gamerHandle?.trim()) return null;
                return renderPlayerCard(player, index + 1);
              })}
            </View>

            {/* H2H Stats */}
            {h2hData && selectedPlayers[0] && selectedPlayers[1] && (
              <View style={styles.h2hContainer}>
                <LinearGradient
                  colors={['#1E293B', '#334155']}
                  style={styles.h2hCard}
                >
                  <Text style={styles.h2hTitle}>Head to Head</Text>
                  
                  <View style={styles.h2hPlayers}>
                    <View style={styles.h2hPlayer}>
                      <Text style={styles.h2hPlayerName}>
                        @{activeGroup.members.find(m => m.id === selectedPlayers[0])?.gamerHandle || 'Unknown'}
                      </Text>
                      <Text style={styles.h2hWins}>{h2hData.player1Wins}</Text>
                      <Text style={styles.h2hWinsLabel}>Wins</Text>
                    </View>
                    
                    <View style={styles.h2hCenter}>
                      <Text style={styles.h2hDraws}>{h2hData.draws}</Text>
                      <Text style={styles.h2hDrawsLabel}>Draws</Text>
                    </View>
                    
                    <View style={styles.h2hPlayer}>
                      <Text style={styles.h2hPlayerName}>
                        @{activeGroup.members.find(m => m.id === selectedPlayers[1])?.gamerHandle || 'Unknown'}
                      </Text>
                      <Text style={styles.h2hWins}>{h2hData.player2Wins}</Text>
                      <Text style={styles.h2hWinsLabel}>Wins</Text>
                    </View>
                  </View>
                  
                  <View style={styles.h2hStats}>
                    <View style={styles.h2hStat}>
                      <Target size={16} color="#0EA5E9" />
                      <Text style={styles.h2hStatValue}>{h2hData.totalGoals}</Text>
                      <Text style={styles.h2hStatLabel}>Total Goals</Text>
                    </View>
                    <View style={styles.h2hStat}>
                      <Trophy size={16} color="#8B5CF6" />
                      <Text style={styles.h2hStatValue}>{h2hData.matches.length}</Text>
                      <Text style={styles.h2hStatLabel}>Matches Played</Text>
                    </View>
                  </View>
                </LinearGradient>
              </View>
            )}
          </>
        )}
      </ScrollView>
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
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: '#1E293B',
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
  content: {
    flex: 1,
  },
  podiumContainer: {
    padding: 16,
  },
  podiumGradient: {
    borderRadius: 16,
    padding: 20,
  },
  podium: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'flex-end',
  },
  podiumPlace: {
    alignItems: 'center',
    flex: 1,
  },
  podiumBar: {
    width: 60,
    justifyContent: 'center',
    alignItems: 'center',
    borderTopLeftRadius: 8,
    borderTopRightRadius: 8,
    marginBottom: 8,
  },
  goldBar: {
    height: 100,
    backgroundColor: '#FFD700',
  },
  silverBar: {
    height: 80,
    backgroundColor: '#C0C0C0',
  },
  bronzeBar: {
    height: 60,
    backgroundColor: '#CD7F32',
  },
  podiumRank: {
    fontSize: 24,
    fontWeight: '700' as const,
    color: '#0F172A',
  },
  podiumName: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: '#fff',
    marginBottom: 4,
  },
  podiumPoints: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.8)',
  },
  podiumBadges: {
    marginVertical: 2,
  },
  leaderboard: {
    padding: 16,
  },
  playerList: {
    padding: 16,
  },
  playerCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1E293B',
    borderRadius: 12,
    padding: 16,
    marginBottom: 8,
  },
  selectedPlayerCard: {
    borderWidth: 2,
    borderColor: '#0EA5E9',
  },
  rankBadge: {
    width: 40,
    alignItems: 'center',
  },
  rankText: {
    fontSize: 18,
    fontWeight: '700' as const,
    color: '#64748B',
  },
  goldRank: {
    color: '#FFD700',
  },
  silverRank: {
    color: '#C0C0C0',
  },
  bronzeRank: {
    color: '#CD7F32',
  },
  playerInfo: {
    flex: 1,
    marginLeft: 12,
  },
  playerNameContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  playerName: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: '#fff',
    flex: 1,
  },
  playerTableName: {
    fontSize: 12,
    color: '#fff',
    marginBottom: 2,
  },
  formContainer: {
    flexDirection: 'row',
    gap: 4,
  },
  formBadge: {
    width: 20,
    height: 20,
    borderRadius: 4,
    justifyContent: 'center',
    alignItems: 'center',
  },
  winBadge: {
    backgroundColor: '#10B981',
  },
  drawBadge: {
    backgroundColor: '#64748B',
  },
  lossBadge: {
    backgroundColor: '#EF4444',
  },
  formText: {
    fontSize: 10,
    fontWeight: '700' as const,
    color: '#fff',
  },
  statsContainer: {
    flexDirection: 'row',
    gap: 16,
  },
  statItem: {
    alignItems: 'center',
  },
  statValue: {
    fontSize: 16,
    fontWeight: '700' as const,
    color: '#fff',
  },
  positiveGD: {
    color: '#10B981',
  },
  statLabel: {
    fontSize: 10,
    color: '#64748B',
    marginTop: 2,
  },
  h2hInstruction: {
    fontSize: 14,
    color: '#64748B',
    textAlign: 'center',
    padding: 16,
  },
  h2hContainer: {
    padding: 16,
  },
  h2hCard: {
    borderRadius: 16,
    padding: 20,
  },
  h2hTitle: {
    fontSize: 18,
    fontWeight: '600' as const,
    color: '#fff',
    textAlign: 'center',
    marginBottom: 20,
  },
  h2hPlayers: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  h2hPlayer: {
    alignItems: 'center',
    flex: 1,
  },
  h2hPlayerName: {
    fontSize: 14,
    color: '#fff',
    marginBottom: 8,
  },
  h2hWins: {
    fontSize: 32,
    fontWeight: '700' as const,
    color: '#0EA5E9',
  },
  h2hWinsLabel: {
    fontSize: 12,
    color: '#64748B',
  },
  h2hCenter: {
    alignItems: 'center',
  },
  h2hDraws: {
    fontSize: 24,
    fontWeight: '700' as const,
    color: '#64748B',
  },
  h2hDrawsLabel: {
    fontSize: 12,
    color: '#64748B',
  },
  h2hStats: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingTop: 20,
    borderTopWidth: 1,
    borderTopColor: '#334155',
  },
  h2hStat: {
    alignItems: 'center',
  },
  h2hStatValue: {
    fontSize: 20,
    fontWeight: '700' as const,
    color: '#fff',
    marginVertical: 4,
  },
  h2hStatLabel: {
    fontSize: 12,
    color: '#64748B',
  },
  tableContainer: {
    margin: 16,
    backgroundColor: '#1E293B',
    borderRadius: 12,
    overflow: 'hidden',
  },
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: '#334155',
    paddingVertical: 12,
    paddingHorizontal: 8,
  },
  tableHeaderText: {
    fontSize: 12,
    fontWeight: '700' as const,
    color: '#fff',
    textAlign: 'center',
  },
  tableRow: {
    flexDirection: 'row',
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#334155',
  },
  firstPlace: {
    backgroundColor: 'rgba(255, 215, 0, 0.1)',
  },
  secondPlace: {
    backgroundColor: 'rgba(192, 192, 192, 0.1)',
  },
  thirdPlace: {
    backgroundColor: 'rgba(205, 127, 50, 0.1)',
  },
  tableCell: {
    fontSize: 12,
    color: '#fff',
    textAlign: 'center',
  },
  positionColumn: {
    width: 30,
  },
  playerColumn: {
    flex: 1,
    paddingLeft: 8,
    justifyContent: 'center',
  },
  statColumn: {
    width: 35,
  },
  goldText: {
    color: '#FFD700',
    fontWeight: '700' as const,
  },
  silverText: {
    color: '#C0C0C0',
    fontWeight: '700' as const,
  },
  bronzeText: {
    color: '#CD7F32',
    fontWeight: '700' as const,
  },
  pointsText: {
    fontWeight: '700' as const,
    color: '#0EA5E9',
  },
  tableHeaderContainer: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#334155',
  },
  tableTitle: {
    fontSize: 18,
    fontWeight: '600' as const,
    color: '#fff',
    marginBottom: 4,
  },
  tableSubtitle: {
    fontSize: 14,
    color: '#64748B',
  },
  leaguesContainer: {
    padding: 16,
  },
  emptyLeagues: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  leagueCard: {
    backgroundColor: '#1E293B',
    borderRadius: 16,
    marginBottom: 16,
    overflow: 'hidden',
  },
  leagueHeader: {
    padding: 16,
  },
  leagueHeaderContent: {
    gap: 8,
  },
  leagueTitleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  leagueTitle: {
    fontSize: 18,
    fontWeight: '600' as const,
    color: '#fff',
    flex: 1,
  },
  leagueSubtitle: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.8)',
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    marginLeft: 8,
  },
  ongoingBadge: {
    backgroundColor: 'rgba(16, 185, 129, 0.2)',
    borderWidth: 1,
    borderColor: '#10B981',
  },
  finishedBadge: {
    backgroundColor: 'rgba(100, 116, 139, 0.2)',
    borderWidth: 1,
    borderColor: '#64748B',
  },
  statusText: {
    fontSize: 10,
    fontWeight: '700' as const,
  },
  ongoingText: {
    color: '#10B981',
  },
  finishedText: {
    color: '#64748B',
  },
  miniPodiumContainer: {
    padding: 16,
    backgroundColor: '#0F172A',
  },
  miniPodium: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'flex-end',
  },
  miniPodiumPlace: {
    alignItems: 'center',
    flex: 1,
  },
  miniPodiumBar: {
    width: 40,
    justifyContent: 'center',
    alignItems: 'center',
    borderTopLeftRadius: 6,
    borderTopRightRadius: 6,
    marginBottom: 6,
  },
  miniPodiumRank: {
    fontSize: 16,
    fontWeight: '700' as const,
    color: '#0F172A',
  },
  miniPodiumName: {
    fontSize: 12,
    fontWeight: '600' as const,
    color: '#fff',
    marginBottom: 2,
    textAlign: 'center',
  },
  miniPodiumPoints: {
    fontSize: 10,
    color: 'rgba(255, 255, 255, 0.8)',
  },
  miniPodiumBadges: {
    marginVertical: 1,
  },
  leagueTable: {
    backgroundColor: '#1E293B',
  },
  expandButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 12,
    backgroundColor: '#0F172A',
    gap: 8,
  },
  expandButtonText: {
    fontSize: 14,
    color: '#0EA5E9',
    fontWeight: '500' as const,
  },
});