import createContextHook from '@nkzw/create-context-hook';
import { useState, useMemo, useCallback, useEffect } from 'react';
import { Player, Group, Competition, Match, ChatMessage, PlayerStats, KnockoutBracket, TournamentRound } from '@/types/game';
import { supabase } from '@/lib/supabase';
import { useRealtimeGroups } from './use-realtime-groups';

function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).substr(2);
}

function generateInviteCode(): string {
  return Math.random().toString(36).substr(2, 8).toUpperCase();
}

function calculatePlayerStats(playerId: string, matches: Match[]): PlayerStats {
  const playerMatches = matches.filter(
    m => (m.homePlayerId === playerId || m.awayPlayerId === playerId) && m.status === 'completed'
  );

  let wins = 0;
  let draws = 0;
  let losses = 0;
  let goalsFor = 0;
  let goalsAgainst = 0;
  let cleanSheets = 0;
  const form: ('W' | 'D' | 'L')[] = [];

  playerMatches.forEach(match => {
    const isHome = match.homePlayerId === playerId;
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
  const winRate = played > 0 ? (wins / played) * 100 : 0;

  return {
    played,
    wins,
    draws,
    losses,
    goalsFor,
    goalsAgainst,
    cleanSheets,
    points,
    winRate,
    form: form.slice(0, 5),
    leaguesWon: 0,
    knockoutsWon: 0,
  };
}

export const [GameProvider, useGameStore] = createContextHook(() => {
  const [currentUser, setCurrentUser] = useState<Player | null>(null);
  const [activeGroupId, setActiveGroupId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [authUserId, setAuthUserId] = useState<string | undefined>(undefined);
  
  const { groups, isLoading, error } = useRealtimeGroups(authUserId);

  useEffect(() => {    
    const getAuthUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        setAuthUserId(user.id);
      }
    };
    getAuthUser();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        setAuthUserId(session.user.id);
      } else {
        setAuthUserId(undefined);
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const activeGroup = useMemo(() => {
    return groups.find(g => g.id === activeGroupId) || null;
  }, [groups, activeGroupId]);

  const createGroup = useCallback(async (name: string, description: string) => {
    if (!currentUser) return null;

    try {
      const inviteCode = generateInviteCode();
      
      const { data: group, error: groupError } = await supabase
        .from('groups')
        .insert({
          name,
          description,
          admin_id: currentUser.id,
          invite_code: inviteCode,
          is_public: false,
        })
        .select()
        .single();
      
      if (groupError || !group) {
        console.error('Error creating group:', groupError);
        return null;
      }
      
      const { error: memberError } = await supabase
        .from('group_members')
        .insert({
          group_id: group.id,
          player_id: currentUser.id,
          is_admin: true,
        });
      
      if (memberError) {
        console.error('Error adding member:', memberError);
        return null;
      }
      
      const { error: statsError } = await supabase
        .from('player_stats')
        .insert({
          player_id: currentUser.id,
          group_id: group.id,
        });
      
      if (statsError) {
        console.error('Error creating stats:', statsError);
      }
      
      const newGroup: Group = {
        id: group.id,
        name: group.name,
        description: group.description || '',
        adminId: group.admin_id,
        adminIds: [group.admin_id],
        members: [currentUser],
        createdAt: group.created_at,
        competitions: [],
        inviteCode: group.invite_code,
        isPublic: group.is_public,
        pendingMembers: [],
      };

      setActiveGroupId(newGroup.id);
      return newGroup;
    } catch (error) {
      console.error('Error creating group:', error);
      return null;
    }
  }, [currentUser]);

  const joinGroup = useCallback(async (inviteCode: string) => {
    if (!currentUser) return null;

    try {
      const { data: group, error: groupError } = await supabase
        .from('groups')
        .select('*')
        .eq('invite_code', inviteCode.toUpperCase())
        .single();

      if (groupError || !group) {
        console.error('Error finding group:', groupError);
        return null;
      }

      const { data: existingMember } = await supabase
        .from('group_members')
        .select('id')
        .eq('group_id', group.id)
        .eq('player_id', currentUser.id)
        .single();

      if (existingMember) {
        setActiveGroupId(group.id);
        return group;
      }

      const { error: memberError } = await supabase
        .from('group_members')
        .insert({
          group_id: group.id,
          player_id: currentUser.id,
          is_admin: false,
        });

      if (memberError) {
        console.error('Error joining group:', memberError);
        return null;
      }

      const { error: statsError } = await supabase
        .from('player_stats')
        .insert({
          player_id: currentUser.id,
          group_id: group.id,
        });

      if (statsError) {
        console.error('Error creating stats:', statsError);
      }

      setActiveGroupId(group.id);
      return group;
    } catch (error) {
      console.error('Error joining group:', error);
      return null;
    }
  }, [currentUser]);

  const createCompetition = useCallback(async (
    name: string,
    type: Competition['type'],
    participantIds: string[],
    options?: {
      leagueFormat?: 'single' | 'double';
      friendlyType?: 'best_of' | 'first_to';
      friendlyTarget?: number;
      tournamentType?: 'knockout' | 'group_stage' | 'mixed';
      knockoutMinPlayers?: number;
    }
  ) => {
    if (!activeGroupId) return null;

    try {
      const { data: competition, error } = await supabase
        .from('competitions')
        .insert({
          group_id: activeGroupId,
          name,
          type,
          status: 'upcoming',
          start_date: new Date().toISOString(),
          participants: participantIds,
          league_format: options?.leagueFormat,
          friendly_type: options?.friendlyType,
          friendly_target: options?.friendlyTarget,
          tournament_type: options?.tournamentType,
          knockout_min_players: options?.knockoutMinPlayers,
        })
        .select()
        .single();

      if (error || !competition) {
        console.error('Error creating competition:', error);
        return null;
      }

      return competition;
    } catch (error) {
      console.error('Error creating competition:', error);
      return null;
    }
  }, [activeGroupId]);

  const createMatch = useCallback(async (
    competitionId: string,
    homePlayerId: string,
    awayPlayerId: string,
    scheduledTime: string
  ) => {
    try {
      const { data: match, error } = await supabase
        .from('matches')
        .insert({
          competition_id: competitionId,
          home_player_id: homePlayerId,
          away_player_id: awayPlayerId,
          status: 'scheduled',
          scheduled_time: scheduledTime,
        })
        .select()
        .single();

      if (error || !match) {
        console.error('Error creating match:', error);
        return null;
      }

      return match;
    } catch (error) {
      console.error('Error creating match:', error);
      return null;
    }
  }, []);

  const sendMessage = useCallback(async (
    message: string,
    type: ChatMessage['type'] = 'text',
    metadata?: ChatMessage['metadata']
  ) => {
    if (!currentUser || !activeGroupId) return;

    try {
      const { data: chatMessage, error } = await supabase
        .from('chat_messages')
        .insert({
          group_id: activeGroupId,
          sender_id: currentUser.id,
          sender_name: currentUser.gamerHandle,
          message,
          type,
          metadata,
          timestamp: new Date().toISOString(),
        })
        .select()
        .single();
      
      if (error || !chatMessage) {
        console.error('Error sending message:', error);
        return;
      }
      
      const newMessage: ChatMessage = {
        id: chatMessage.id,
        groupId: chatMessage.group_id,
        senderId: chatMessage.sender_id,
        senderName: chatMessage.sender_name,
        message: chatMessage.message,
        timestamp: chatMessage.timestamp,
        type: chatMessage.type as 'text' | 'match_result' | 'youtube_link',
        metadata: chatMessage.metadata || undefined,
      };

      setMessages(prev => [...prev, newMessage]);
      return newMessage;
    } catch (error) {
      console.error('Error sending message:', error);
    }
  }, [currentUser, activeGroupId]);

  const updateMatchResult = useCallback(async (
    matchId: string,
    homeScore: number,
    awayScore: number
  ) => {
    try {
      const { error } = await supabase
        .from('matches')
        .update({
          home_score: homeScore,
          away_score: awayScore,
          status: 'completed',
          completed_at: new Date().toISOString(),
        })
        .eq('id', matchId);

      if (error) {
        console.error('Error updating match:', error);
        return;
      }

      const match = groups
        .flatMap(g => g.competitions)
        .flatMap(c => c.matches)
        .find(m => m.id === matchId);

      if (match && currentUser) {
        const homePlayer = activeGroup?.members.find(m => m.id === match.homePlayerId);
        const awayPlayer = activeGroup?.members.find(m => m.id === match.awayPlayerId);
        
        await sendMessage(
          `Match Result: ${homePlayer?.name} ${homeScore} - ${awayScore} ${awayPlayer?.name}`,
          'match_result',
          { matchId }
        );
      }
    } catch (error) {
      console.error('Error updating match result:', error);
    }
  }, [groups, currentUser, activeGroup, sendMessage]);

  const shareYoutubeLink = useCallback(async (matchId: string, youtubeLink: string) => {
    try {
      const { error } = await supabase
        .from('matches')
        .update({
          youtube_link: youtubeLink,
          status: 'live',
        })
        .eq('id', matchId);

      if (error) {
        console.error('Error updating match with YouTube link:', error);
        return;
      }

      if (currentUser) {
        await sendMessage(
          `🔴 Live now: ${youtubeLink}`,
          'youtube_link',
          { matchId, youtubeLink }
        );
      }
    } catch (error) {
      console.error('Error sharing YouTube link:', error);
    }
  }, [currentUser, sendMessage]);

  const getGroupMessages = useCallback((groupId: string) => {
    return messages.filter(m => m.groupId === groupId);
  }, [messages]);

  const getPlayerStats = useCallback((playerId: string) => {
    if (!activeGroup) return null;
    const allMatches = activeGroup.competitions.flatMap(c => c.matches);
    return calculatePlayerStats(playerId, allMatches);
  }, [activeGroup]);

  const getHeadToHead = useCallback((player1Id: string, player2Id: string) => {
    if (!activeGroup) return null;
    
    const allMatches = activeGroup.competitions.flatMap(c => c.matches);
    const h2hMatches = allMatches.filter(m => 
      m.status === 'completed' &&
      ((m.homePlayerId === player1Id && m.awayPlayerId === player2Id) ||
       (m.homePlayerId === player2Id && m.awayPlayerId === player1Id))
    );

    let player1Wins = 0;
    let player2Wins = 0;
    let draws = 0;
    let totalGoals = 0;

    h2hMatches.forEach(match => {
      const p1IsHome = match.homePlayerId === player1Id;
      const p1Score = p1IsHome ? match.homeScore! : match.awayScore!;
      const p2Score = p1IsHome ? match.awayScore! : match.homeScore!;
      
      totalGoals += p1Score + p2Score;
      
      if (p1Score > p2Score) player1Wins++;
      else if (p2Score > p1Score) player2Wins++;
      else draws++;
    });

    return {
      player1Id,
      player2Id,
      player1Wins,
      player2Wins,
      draws,
      totalGoals,
      matches: h2hMatches,
    };
  }, [activeGroup]);

  const deleteMatch = useCallback(async (matchId: string) => {
    if (!currentUser || !activeGroup) return false;
    
    const match = activeGroup.competitions
      .flatMap(c => c.matches)
      .find(m => m.id === matchId);
    
    if (!match) return false;
    
    const isAdmin = activeGroup.adminIds?.includes(currentUser.id) || activeGroup.adminId === currentUser.id;
    const isPlayer = match.homePlayerId === currentUser.id || match.awayPlayerId === currentUser.id;
    
    if (!isAdmin && !isPlayer) return false;
    
    if (match.status === 'completed') return false;
    
    try {
      const { error } = await supabase
        .from('matches')
        .delete()
        .eq('id', matchId);

      if (error) {
        console.error('Error deleting match:', error);
        return false;
      }

      return true;
    } catch (error) {
      console.error('Error deleting match:', error);
      return false;
    }
  }, [currentUser, activeGroup]);

  const correctMatchScore = useCallback(async (
    matchId: string,
    homeScore: number,
    awayScore: number
  ) => {
    if (!currentUser || !activeGroup) return false;
    
    const isAdmin = activeGroup.adminIds?.includes(currentUser.id) || activeGroup.adminId === currentUser.id;
    if (!isAdmin) return false;
    
    try {
      const { error } = await supabase
        .from('matches')
        .update({
          home_score: homeScore,
          away_score: awayScore,
        })
        .eq('id', matchId)
        .eq('status', 'completed');

      if (error) {
        console.error('Error correcting match score:', error);
        return false;
      }

      return true;
    } catch (error) {
      console.error('Error correcting match score:', error);
      return false;
    }
  }, [currentUser, activeGroup]);

  const setLoggedInUser = useCallback((user: Player | null, gameData?: { currentUser: Player; groups: Group[]; activeGroupId: string; messages: ChatMessage[] }) => {
    if (!user) {
      console.log('=== CLEARING USER ===');
      setCurrentUser(null);
      return;
    }
    
    console.log('=== SETTING LOGGED IN USER ===');
    console.log('User:', user.name, user.email, user.role);
    console.log('Game data provided:', !!gameData);
    
    if (gameData && gameData.activeGroupId) {
      console.log('Setting active group ID:', gameData.activeGroupId);
      setActiveGroupId(gameData.activeGroupId);
    }
    
    if (gameData && gameData.messages) {
      console.log('Setting messages:', gameData.messages?.length || 0);
      setMessages(gameData.messages || []);
    }
    
    console.log('Setting current user:', user.name);
    setCurrentUser(user);
    
    console.log('=== USER LOGIN COMPLETE ===');
  }, []);

  const logout = useCallback(async () => {
    console.log('Logging out user...');
    try {
      await supabase.auth.signOut();
      
      setCurrentUser(null);
      setActiveGroupId(null);
      setMessages([]);
      setAuthUserId(undefined);
      
      console.log('Logout successful');
    } catch (error) {
      console.error('Error during logout:', error);
    }
  }, []);

  const getRoundName = (round: number, totalRounds: number): string => {
    if (round === totalRounds - 1) return 'Final';
    if (round === totalRounds - 2) return 'Semi-Final';
    if (round === totalRounds - 3) return 'Quarter-Final';
    return `Round ${round + 1}`;
  };

  const generateNextRoundMatches = useCallback((competitionId: string, completedRound: number) => {
    console.log('Generating next round matches for competition:', competitionId, 'after round:', completedRound);
    
    const group = groups.find(g => g.competitions.some(c => c.id === competitionId));
    if (!group) {
      console.log('Group not found for competition');
      return;
    }

    const competition = group.competitions.find(c => c.id === competitionId);
    if (!competition || !competition.bracket) {
      console.log('Competition or bracket not found');
      return;
    }

      const bracket = competition.bracket;
      const currentRoundMatches = bracket.rounds[completedRound]?.matches || [];
      const winners: string[] = [];
      
      currentRoundMatches.forEach(matchId => {
        const match = competition.matches.find(m => m.id === matchId);
        if (match && match.status === 'completed' && match.homeScore !== undefined && match.awayScore !== undefined) {
          if (match.homeScore > match.awayScore) {
            winners.push(match.homePlayerId);
          } else if (match.awayScore > match.homeScore) {
            winners.push(match.awayPlayerId);
          }
        }
      });
      
      console.log('Winners from round', completedRound, ':', winners);
      
      const expectedWinners = Math.pow(2, bracket.totalRounds - completedRound - 1);
      if (winners.length < expectedWinners) {
        console.log('Not enough winners yet. Expected:', expectedWinners, 'Got:', winners.length);
        return group;
      }
      
      const nextRound = completedRound + 1;
      if (nextRound >= bracket.totalRounds) {
        console.log('Tournament completed!');
        return group;
      }
      
      const nextRoundMatches: Match[] = [];
      for (let i = 0; i < winners.length; i += 2) {
        if (i + 1 < winners.length) {
          const match: Match = {
            id: generateId(),
            competitionId,
            homePlayerId: winners[i],
            awayPlayerId: winners[i + 1],
            status: 'scheduled',
            scheduledTime: new Date(Date.now() + (i + 1) * 86400000).toISOString(),
          };
          nextRoundMatches.push(match);
        }
      }
      
      console.log('Generated', nextRoundMatches.length, 'matches for round', nextRound);
      
      console.log('Note: Tournament bracket progression needs to be implemented with Supabase');
  }, [groups]);

  const generateMatches = useCallback((competitionId: string) => {
    console.log('Generating matches for competition:', competitionId);
    
    const group = groups.find(g => g.competitions.some(c => c.id === competitionId));
    if (!group) {
      console.log('Group not found for competition');
      return;
    }

    const competition = group.competitions.find(c => c.id === competitionId);
    if (!competition) {
      console.log('Competition not found:', competitionId);
      return;
    }

      const matches: Match[] = [];
      const participants = competition.participants;
      console.log('Participants:', participants);
      console.log('Competition type:', competition.type);

      if (competition.type === 'league') {
        for (let i = 0; i < participants.length; i++) {
          for (let j = i + 1; j < participants.length; j++) {
            const homePlayerId = participants[i];
            const awayPlayerId = participants[j];
            
            matches.push({
              id: generateId(),
              competitionId,
              homePlayerId,
              awayPlayerId,
              status: 'scheduled',
              scheduledTime: new Date(Date.now() + matches.length * 86400000).toISOString(),
            });

            if (competition.leagueFormat === 'double') {
              matches.push({
                id: generateId(),
                competitionId,
                homePlayerId: awayPlayerId,
                awayPlayerId: homePlayerId,
                status: 'scheduled',
                scheduledTime: new Date(Date.now() + matches.length * 86400000).toISOString(),
              });
            }
          }
        }
      } else if (competition.type === 'friendly' && participants.length === 2) {
        const matchCount = competition.friendlyTarget || 1;
        for (let i = 0; i < matchCount; i++) {
          matches.push({
            id: generateId(),
            competitionId,
            homePlayerId: participants[0],
            awayPlayerId: participants[1],
            status: 'scheduled',
            scheduledTime: new Date(Date.now() + i * 86400000).toISOString(),
          });
        }
      } else if (competition.type === 'tournament' && competition.tournamentType === 'knockout') {
        const playerCount = participants.length;
        if (playerCount >= 4) {
          for (let i = 0; i < playerCount; i += 2) {
            if (i + 1 < playerCount) {
              const match: Match = {
                id: generateId(),
                competitionId,
                homePlayerId: participants[i],
                awayPlayerId: participants[i + 1],
                status: 'scheduled',
                scheduledTime: new Date(Date.now() + matches.length * 86400000).toISOString(),
              };
              matches.push(match);
            }
          }
          
          const totalRounds = Math.ceil(Math.log2(playerCount));
          const rounds: TournamentRound[] = [];
          
          for (let round = 0; round < totalRounds; round++) {
            const roundMatches = round === 0 ? matches.map(m => m.id) : [];
            
            rounds.push({
              id: generateId(),
              name: getRoundName(round, totalRounds),
              roundNumber: round,
              matches: roundMatches,
              status: round === 0 ? 'active' : 'upcoming',
              isGenerated: round === 0,
            });
          }
          
          const bracket: KnockoutBracket = {
            id: generateId(),
            competitionId,
            totalRounds,
            currentRound: 0,
            rounds,
            participants,
            winners: {},
          };
          
          competition.bracket = bracket;
          competition.rounds = rounds;
        }
      }

      console.log('Generated matches:', matches.length);
      console.log('Note: Match generation needs to be saved to Supabase');
  }, [groups]);

  return {
    currentUser,
    groups,
    activeGroup,
    activeGroupId,
    messages: getGroupMessages(activeGroupId || ''),
    isLoading,
    createGroup,
    joinGroup,
    createCompetition,
    createMatch,
    updateMatchResult,
    sendMessage,
    shareYoutubeLink,
    setActiveGroupId,
    getPlayerStats,
    getHeadToHead,
    generateMatches,
    generateNextRoundMatches,
    deleteMatch,
    correctMatchScore,
    setLoggedInUser,
    logout,
  };
});

export function useActiveGroup() {
  const { activeGroup } = useGameStore();
  return activeGroup;
}

export function useCurrentUser() {
  const { currentUser } = useGameStore();
  return currentUser;
}

export function useGroupMessages() {
  const { messages } = useGameStore();
  return messages;
}
