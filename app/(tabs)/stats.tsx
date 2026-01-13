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
import { useRealtimeGroups } from '@/hooks/use-realtime-groups';
import { LinearGradient } from 'expo-linear-gradient';
import { Player, Match } from '@/types/game';
import { AchievementBadges } from '@/components/AchievementBadges';

export default function StatsScreen() {
  const { activeGroupId } = useGameStore();
  const { groups, isLoading } = useRealtimeGroups();
  const activeGroup = groups.find(g => g.id === activeGroupId) || null;
  const [selectedTab, setSelectedTab] = useState<'leaderboard' | 'h2h' | 'table' | 'leagues'>('leaderboard');
  const [selectedPlayers, setSelectedPlayers] = useState<string[]>([]);
  const [showFullTable, setShowFullTable] = useState<{ [key: string]: boolean }>({});

  const allMatches = useMemo(() => {
    if (!activeGroup) return [];
    const matches = activeGroup.competitions.flatMap(c => c.matches);
    console.log('🔍 STATS DIAGNOSTIC: All matches', {
      totalMatches: matches.length,
      totalCompetitions: activeGroup.competitions.length,
      matchesPerCompetition: activeGroup.competitions.map(c => ({
        name: c.name.substring(0, 20),
        matchCount: c.matches.length,
        type: c.type,
      })),
    });
    return matches;
  }, [activeGroup]);

  const completedMatchesCount = useMemo(() => {
    const completed = allMatches.filter(m => m.status === 'completed').length;
    console.log('🔍 STATS DIAGNOSTIC: Completed matches count:', completed, '/ Total:', allMatches.length);
    return completed;
  }, [allMatches]);

  const leagueStats = useMemo(() => {
    if (!activeGroup) return [];
    
    console.log('📊 LEAGUE STATS DIAGNOSTIC - START:', {
      completedMatchesCount,
      totalCompetitions: activeGroup.competitions.length,
      leagueCompetitions: activeGroup.competitions.filter(c => c.type === 'league').length,
      timestamp: Date.now(),
    });
    
    const leagues = activeGroup.competitions
      .filter(comp => comp.type === 'league')
      .map(league => {
        const leagueMatches = league.matches.filter(m => m.status === 'completed');
        const hasCompletedMatches = leagueMatches.length > 0;
        
        const leagueParticipants = activeGroup.members.filter(member => 
          league.participants.includes(member.id)
        );
        
        const leaguePlayerStats = leagueParticipants.map(player => {
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
        }).sort((a, b) => {
          if (!hasCompletedMatches) {
            return a.gamerHandle.localeCompare(b.gamerHandle);
          }
          if (b.leagueStats.points !== a.leagueStats.points) {
            return b.leagueStats.points - a.leagueStats.points;
          }
          const aGD = a.leagueStats.goalsFor - a.leagueStats.goalsAgainst;
          const bGD = b.leagueStats.goalsFor - b.leagueStats.goalsAgainst;
          return bGD - aGD;
        });
        
        return {
          league,
          players: leaguePlayerStats,
          totalParticipants: league.participants.length,
          hasCompletedMatches,
        };
      });
    
    const sortedLeagues = leagues.sort((a, b) => {
      const aOngoing = a.league.status === 'active';
      const bOngoing = b.league.status === 'active';
      
      if (aOngoing && !bOngoing) return -1;
      if (!aOngoing && bOngoing) return 1;
      
      if (!aOngoing && !bOngoing) {
        const aDate = a.league.endDate || a.league.startDate;
        const bDate = b.league.endDate || b.league.startDate;
        return new Date(bDate).getTime() - new Date(aDate).getTime();
      }
      
      return new Date(b.league.startDate).getTime() - new Date(a.league.startDate).getTime();
    });

    console.log('📊 LEAGUE STATS DIAGNOSTIC - END:', {
      totalLeagues: sortedLeagues.length,
      leaguesWithData: sortedLeagues.map(l => ({
        name: l.league.name.substring(0, 20),
        participants: l.totalParticipants,
        playersWithStats: l.players.length,
        hasCompletedMatches: l.hasCompletedMatches,
      })),
    });

    return sortedLeagues;
  }, [activeGroup, completedMatchesCount]);

  const sortedPlayers = useMemo(() => {
    if (!activeGroup) return [];
    const filteredPlayers = [...activeGroup.members].filter(player => player.stats.played > 0);
    const sorted = filteredPlayers.sort((a, b) => {
      if (b.stats.points !== a.stats.points) {
        return b.stats.points - a.stats.points;
      }
      const aGD = a.stats.goalsFor - a.stats.goalsAgainst;
      const bGD = b.stats.goalsFor - b.stats.goalsAgainst;
      return bGD - aGD;
    });

    console.log('🔍 SORTED PLAYERS DIAGNOSTIC:', {
      totalMembers: activeGroup.members.length,
      playersWithMatches: filteredPlayers.length,
      topPlayers: sorted.slice(0, 3).map(p => ({
        handle: p.gamerHandle,
        played: p.stats.played,
        points: p.stats.points,
      })),
    });

    return sorted;
  }, [activeGroup]);

  const monthlyStats = useMemo(() => {
    if (!activeGroup) return [];
    
    const completedMatches = allMatches.filter(m => m.status === 'completed' && m.completedAt);
    
    console.log('📊 MONTHLY STATS DIAGNOSTIC:', {
      completedMatchesCount,
      completedMatchesWithDate: completedMatches.length,
      allMatchesTotal: allMatches.length,
      timestamp: Date.now(),
    });
    
    const monthlyData: { [key: string]: { month: string, year: number, matches: Match[] } } = {};
    
    completedMatches.forEach(match => {
      const completedDate = new Date(match.completedAt!);
      const monthKey = `${completedDate.getFullYear()}-${String(completedDate.getMonth() + 1).padStart(2, '0')}`;
      
      if (!monthlyData[monthKey]) {
        monthlyData[monthKey] = {
          month: completedDate.toLocaleString('default', { month: 'long' }),
          year: completedDate.getFullYear(),
          matches: [],
        };
      }
      
      monthlyData[monthKey].matches.push(match);
    });
    
    const sortedMonths = Object.keys(monthlyData).sort().reverse();
    
    return sortedMonths.map(monthKey => {
      const { month, year, matches } = monthlyData[monthKey];
      
      const monthlyPlayerStats = activeGroup.members.map(player => {
        const playerMatches = matches.filter(
          m => m.homePlayerId === player.id || m.awayPlayerId === player.id
        );
        
        let wins = 0, draws = 0, losses = 0, goalsFor = 0, goalsAgainst = 0;
        
        playerMatches.forEach(match => {
          const isHome = match.homePlayerId === player.id;
          const playerScore = isHome ? match.homeScore! : match.awayScore!;
          const opponentScore = isHome ? match.awayScore! : match.homeScore!;
          
          goalsFor += playerScore;
          goalsAgainst += opponentScore;
          
          if (playerScore > opponentScore) {
            wins++;
          } else if (playerScore === opponentScore) {
            draws++;
          } else {
            losses++;
          }
        });
        
        const played = wins + draws + losses;
        const points = wins * 3 + draws;
        
        return {
          ...player,
          monthlyStats: {
            played,
            wins,
            draws,
            losses,
            goalsFor,
            goalsAgainst,
            points,
          }
        };
      }).filter(p => p.monthlyStats.played > 0)
        .sort((a, b) => {
          if (b.monthlyStats.points !== a.monthlyStats.points) {
            return b.monthlyStats.points - a.monthlyStats.points;
          }
          const aGD = a.monthlyStats.goalsFor - a.monthlyStats.goalsAgainst;
          const bGD = b.monthlyStats.goalsFor - b.monthlyStats.goalsAgainst;
          return bGD - aGD;
        });
      
      const currentDate = new Date();
      const isCurrentMonth = currentDate.getFullYear() === year && 
                            currentDate.getMonth() === new Date(`${year}-${monthKey.split('-')[1]}-01`).getMonth();
      
      return {
        monthKey,
        month,
        year,
        players: monthlyPlayerStats,
        isCurrentMonth,
        totalMatches: matches.length,
      };
    });
  }, [activeGroup, completedMatchesCount, allMatches]);

  const h2hData = useMemo(() => {
    if (selectedPlayers.length === 2 && selectedPlayers[0] && selectedPlayers[1] && activeGroup) {
      console.log('🔍 Calculating H2H for players:', selectedPlayers[0], selectedPlayers[1]);
      
      const allMatches = activeGroup.competitions.flatMap(c => c.matches);
      const h2hMatches = allMatches.filter(m => 
        m.status === 'completed' &&
        ((m.homePlayerId === selectedPlayers[0] && m.awayPlayerId === selectedPlayers[1]) ||
         (m.homePlayerId === selectedPlayers[1] && m.awayPlayerId === selectedPlayers[0]))
      );

      let player1Wins = 0;
      let player2Wins = 0;
      let draws = 0;
      let totalGoals = 0;

      h2hMatches.forEach(match => {
        const p1IsHome = match.homePlayerId === selectedPlayers[0];
        const p1Score = p1IsHome ? match.homeScore! : match.awayScore!;
        const p2Score = p1IsHome ? match.awayScore! : match.homeScore!;
        
        totalGoals += p1Score + p2Score;
        
        if (p1Score > p2Score) player1Wins++;
        else if (p2Score > p1Score) player2Wins++;
        else draws++;
      });

      const result = {
        player1Id: selectedPlayers[0],
        player2Id: selectedPlayers[1],
        player1Wins,
        player2Wins,
        draws,
        totalGoals,
        matches: h2hMatches,
      };
      
      console.log('📊 H2H result:', result);
      if (result && result.matches.length > 0) {
        return result;
      }
    }
    return null;
  }, [selectedPlayers, activeGroup]);

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

  const calculateRank = (players: Player[], currentIndex: number): number => {
    if (currentIndex === 0) return 1;
    
    const currentPlayer = players[currentIndex];
    const previousPlayer = players[currentIndex - 1];
    
    const currentGD = currentPlayer.stats.goalsFor - currentPlayer.stats.goalsAgainst;
    const previousGD = previousPlayer.stats.goalsFor - previousPlayer.stats.goalsAgainst;
    
    if (currentPlayer.stats.points === previousPlayer.stats.points && currentGD === previousGD) {
      return calculateRank(players, currentIndex - 1);
    }
    
    return currentIndex + 1;
  };

  const renderPlayerCard = (player: Player, index: number, allPlayers: Player[]) => {
    const rank = calculateRank(allPlayers, index);
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
            {sortedPlayers.length >= 3 && sortedPlayers[0].stats.played > 0 && sortedPlayers[1].stats.played > 0 && sortedPlayers[2].stats.played > 0 && (
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
                return renderPlayerCard(player, index, sortedPlayers);
              })}
            </View>
          </>
        )}

        {selectedTab === 'table' && (
          <View style={styles.generalTabContainer}>
            {/* Overall Table */}
            <View style={styles.tableContainer}>
              <View style={styles.tableHeaderContainer}>
                <Text style={styles.tableTitle}>Overall Table</Text>
                <Text style={styles.tableSubtitle}>Combined stats from all competitions</Text>
              </View>
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
              
              {sortedPlayers.map((player, index) => {
                if (!player?.gamerHandle?.trim()) return null;
                const rank = calculateRank(sortedPlayers, index);
                const goalDiff = player.stats.goalsFor - player.stats.goalsAgainst;
                
                return (
                  <View key={player.id} style={[
                    styles.tableRow,
                    rank === 1 && styles.firstPlace,
                    rank === 2 && styles.secondPlace,
                    rank === 3 && styles.thirdPlace,
                  ]}>
                    <Text style={[styles.tableCell, styles.positionColumn, 
                      rank === 1 && styles.goldText,
                      rank === 2 && styles.silverText,
                      rank === 3 && styles.bronzeText,
                    ]}>{rank}</Text>
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

            {/* Monthly Tables */}
            {monthlyStats.length > 0 && (
              <View style={styles.monthlyTablesContainer}>
                <Text style={styles.monthlyTablesTitle}>Monthly Tables</Text>
                {monthlyStats.map(({ monthKey, month, year, players, isCurrentMonth, totalMatches }) => (
                  <View key={monthKey} style={styles.tableContainer}>
                    <View style={styles.tableHeaderContainer}>
                      <View style={styles.monthlyHeaderRow}>
                        <Text style={styles.tableTitle}>{month} {year}</Text>
                        {isCurrentMonth && (
                          <View style={styles.currentMonthBadge}>
                            <Text style={styles.currentMonthText}>CURRENT</Text>
                          </View>
                        )}
                      </View>
                      <Text style={styles.tableSubtitle}>{totalMatches} matches completed</Text>
                    </View>
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
                    
                    {players.map((player, index) => {
                      if (!player?.gamerHandle?.trim()) return null;
                      
                      const calculateMonthlyRank = (idx: number): number => {
                        if (idx === 0) return 1;
                        const current = players[idx];
                        const previous = players[idx - 1];
                        const currentGD = current.monthlyStats.goalsFor - current.monthlyStats.goalsAgainst;
                        const previousGD = previous.monthlyStats.goalsFor - previous.monthlyStats.goalsAgainst;
                        if (current.monthlyStats.points === previous.monthlyStats.points && currentGD === previousGD) {
                          return calculateMonthlyRank(idx - 1);
                        }
                        return idx + 1;
                      };
                      
                      const rank = calculateMonthlyRank(index);
                      const goalDiff = player.monthlyStats.goalsFor - player.monthlyStats.goalsAgainst;
                      
                      return (
                        <View key={player.id} style={[
                          styles.tableRow,
                          rank === 1 && styles.firstPlace,
                          rank === 2 && styles.secondPlace,
                          rank === 3 && styles.thirdPlace,
                        ]}>
                          <Text style={[styles.tableCell, styles.positionColumn, 
                            rank === 1 && styles.goldText,
                            rank === 2 && styles.silverText,
                            rank === 3 && styles.bronzeText,
                          ]}>{rank}</Text>
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
                          <Text style={[styles.tableCell, styles.statColumn]}>{player.monthlyStats.played}</Text>
                          <Text style={[styles.tableCell, styles.statColumn]}>{player.monthlyStats.wins}</Text>
                          <Text style={[styles.tableCell, styles.statColumn]}>{player.monthlyStats.draws}</Text>
                          <Text style={[styles.tableCell, styles.statColumn]}>{player.monthlyStats.losses}</Text>
                          <Text style={[styles.tableCell, styles.statColumn, goalDiff > 0 && styles.positiveGD]}>
                            {goalDiff > 0 ? '+' : ''}{goalDiff}
                          </Text>
                          <Text style={[styles.tableCell, styles.statColumn, styles.pointsText]}>
                            {player.monthlyStats.points}
                          </Text>
                        </View>
                      );
                    })}
                  </View>
                ))}
              </View>
            )}
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
              leagueStats.map(({ league, players, totalParticipants, hasCompletedMatches }) => {
                const isExpanded = showFullTable[league.id] || false;
                const filteredPlayers = hasCompletedMatches ? players.filter(p => p.leagueStats.played > 0) : players;
                const displayPlayers = isExpanded ? filteredPlayers : filteredPlayers.slice(0, 3);
                const isOngoing = league.status === 'active';
                const hasMatches = filteredPlayers.length > 0;
                
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
                          {players.length > 0 ? players.length : totalParticipants} participants • {league.matches.filter(m => m.status === 'completed').length}/{league.matches.length} matches played
                        </Text>
                      </View>
                    </LinearGradient>
                    
                    {/* Podium for top 3 */}
                    {hasCompletedMatches && hasMatches && players.length >= 3 && players[0].leagueStats.played > 0 && players[1].leagueStats.played > 0 && players[2].leagueStats.played > 0 && (
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
                    {hasMatches ? (
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
                        const calculateLeagueRank = (idx: number): number => {
                          if (idx === 0) return 1;
                          const current = filteredPlayers[idx];
                          const previous = filteredPlayers[idx - 1];
                          const currentGD = current.leagueStats.goalsFor - current.leagueStats.goalsAgainst;
                          const previousGD = previous.leagueStats.goalsFor - previous.leagueStats.goalsAgainst;
                          if (current.leagueStats.points === previous.leagueStats.points && currentGD === previousGD) {
                            return calculateLeagueRank(idx - 1);
                          }
                          return idx + 1;
                        };
                        
                        const actualIndex = filteredPlayers.findIndex(p => p.id === player.id);
                        const rank = calculateLeagueRank(actualIndex);
                        const goalDiff = player.leagueStats.goalsFor - player.leagueStats.goalsAgainst;
                        
                        return (
                          <View key={player.id} style={[
                            styles.tableRow,
                            rank === 1 && styles.firstPlace,
                            rank === 2 && styles.secondPlace,
                            rank === 3 && styles.thirdPlace,
                          ]}>
                            <Text style={[styles.tableCell, styles.positionColumn, 
                              rank === 1 && styles.goldText,
                              rank === 2 && styles.silverText,
                              rank === 3 && styles.bronzeText,
                            ]}>{rank}</Text>
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
                    ) : (
                      <View style={styles.noMatchesContainer}>
                        <Text style={styles.noMatchesText}>
                          No matches played yet in this league
                        </Text>
                        <Text style={styles.noMatchesSubtext}>
                          {totalParticipants} participants • {league.matches.length} matches scheduled
                        </Text>
                      </View>
                    )}
                    
                    {/* Expand/Collapse Button */}
                    {hasMatches && filteredPlayers.length > 3 && (
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
                          {isExpanded ? 'Show Less' : `Show All ${filteredPlayers.length} Players`}
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
              {activeGroup?.members.map((player, index) => {
                if (!player?.gamerHandle?.trim()) return null;
                return renderPlayerCard(player, index, activeGroup.members);
              })}
            </View>

            {/* H2H Stats */}
            {selectedPlayers.length === 2 && (
              <View style={styles.h2hContainer}>
                {h2hData ? (
                  <LinearGradient
                    colors={['#1E293B', '#334155']}
                    style={styles.h2hCard}
                  >
                    <Text style={styles.h2hTitle}>Head to Head</Text>
                    
                    <View style={styles.h2hPlayers}>
                      <View style={styles.h2hPlayer}>
                        <Text style={styles.h2hPlayerName}>
                          @{activeGroup?.members.find(m => m.id === selectedPlayers[0])?.gamerHandle || 'Unknown'}
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
                          @{activeGroup?.members.find(m => m.id === selectedPlayers[1])?.gamerHandle || 'Unknown'}
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
                ) : (
                  <View style={styles.emptyH2h}>
                    <Users size={48} color="#64748B" />
                    <Text style={styles.emptyH2hText}>No matches found between these players</Text>
                  </View>
                )}
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
  noMatchesContainer: {
    padding: 32,
    alignItems: 'center',
    backgroundColor: '#0F172A',
  },
  noMatchesText: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: '#fff',
    marginBottom: 8,
    textAlign: 'center',
  },
  noMatchesSubtext: {
    fontSize: 14,
    color: '#64748B',
    textAlign: 'center',
  },
  emptyH2h: {
    backgroundColor: '#1E293B',
    borderRadius: 16,
    padding: 40,
    alignItems: 'center',
  },
  emptyH2hText: {
    fontSize: 16,
    color: '#64748B',
    marginTop: 16,
    textAlign: 'center',
  },
  generalTabContainer: {
    paddingBottom: 16,
  },
  monthlyTablesContainer: {
    marginTop: 24,
    paddingHorizontal: 16,
  },
  monthlyTablesTitle: {
    fontSize: 20,
    fontWeight: '700' as const,
    color: '#fff',
    marginBottom: 16,
    paddingHorizontal: 0,
  },
  monthlyHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  currentMonthBadge: {
    backgroundColor: 'rgba(14, 165, 233, 0.2)',
    borderWidth: 1,
    borderColor: '#0EA5E9',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  currentMonthText: {
    fontSize: 10,
    fontWeight: '700' as const,
    color: '#0EA5E9',
  },
});