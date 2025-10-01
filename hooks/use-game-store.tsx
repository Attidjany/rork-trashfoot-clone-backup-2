import createContextHook from '@nkzw/create-context-hook';
import { useEffect, useState, useMemo, useCallback, useRef } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Player, Group, Competition, Match, ChatMessage, PlayerStats, KnockoutBracket, TournamentRound } from '@/types/game';
import { supabaseClient } from '@/lib/supabase';

const STORAGE_KEYS = {
  CURRENT_USER: 'trashfoot_current_user',
  GROUPS: 'trashfoot_groups',
  ACTIVE_GROUP: 'trashfoot_active_group',
  MESSAGES: 'trashfoot_messages',
};

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
  const [groups, setGroups] = useState<Group[]>([]);
  const [activeGroupId, setActiveGroupId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isHydrated, setIsHydrated] = useState(false);
  const isSavingRef = useRef(false);
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const loadData = async () => {
      try {
        console.log('=== GAME STORE INITIALIZATION ===');
        console.log('Loading data from AsyncStorage...');
        
        const timeoutPromise = new Promise((_, reject) => {
          setTimeout(() => reject(new Error('AsyncStorage timeout')), 5000);
        });
        
        const storagePromise = Promise.all([
          AsyncStorage.getItem(STORAGE_KEYS.CURRENT_USER),
          AsyncStorage.getItem(STORAGE_KEYS.GROUPS),
          AsyncStorage.getItem(STORAGE_KEYS.ACTIVE_GROUP),
          AsyncStorage.getItem(STORAGE_KEYS.MESSAGES),
        ]);
        
        const [userStr, groupsStr, activeGroupStr, messagesStr] = await Promise.race([
          storagePromise,
          timeoutPromise
        ]) as [string | null, string | null, string | null, string | null];

        console.log('Storage check - User:', !!userStr, 'Groups:', !!groupsStr, 'ActiveGroup:', !!activeGroupStr, 'Messages:', !!messagesStr);

        if (userStr && userStr !== 'null' && userStr.trim() !== '') {
          console.log('Found user data in storage, loading...');
          try {
            const parsedUser = JSON.parse(userStr);
            
            if (parsedUser && parsedUser.id && parsedUser.name && parsedUser.email) {
              console.log('Loaded valid user from storage:', parsedUser.name, parsedUser.email);
              
              if (groupsStr && groupsStr !== 'null' && groupsStr.trim() !== '') {
                try {
                  const parsedGroups = JSON.parse(groupsStr);
                  if (Array.isArray(parsedGroups)) {
                    console.log('Loaded groups from storage:', parsedGroups.length);
                    const migratedGroups = parsedGroups.map((group: Group) => ({
                      ...group,
                      adminIds: group.adminIds || (group.adminId ? [group.adminId] : []),
                    }));
                    setGroups(migratedGroups);
                  } else {
                    console.warn('Groups data is not an array, resetting');
                    setGroups([]);
                  }
                } catch (e) {
                  console.warn('Failed to parse groups data:', e);
                  setGroups([]);
                }
              } else {
                setGroups([]);
              }
              
              if (activeGroupStr && activeGroupStr !== 'null' && activeGroupStr.trim() !== '') {
                console.log('Loaded active group:', activeGroupStr);
                setActiveGroupId(activeGroupStr);
              } else {
                setActiveGroupId(null);
              }
              
              if (messagesStr && messagesStr !== 'null' && messagesStr.trim() !== '') {
                try {
                  const parsedMessages = JSON.parse(messagesStr);
                  if (Array.isArray(parsedMessages)) {
                    console.log('Loaded messages from storage:', parsedMessages.length);
                    setMessages(parsedMessages);
                  } else {
                    console.warn('Messages data is not an array, resetting');
                    setMessages([]);
                  }
                } catch (e) {
                  console.warn('Failed to parse messages data:', e);
                  setMessages([]);
                }
              } else {
                setMessages([]);
              }
              
              setCurrentUser(parsedUser);
            } else {
              console.warn('Invalid user data structure, clearing storage');
              throw new Error('Invalid user data');
            }
          } catch (e) {
            console.warn('Failed to parse user data, clearing storage:', e);
            try {
              await Promise.all([
                AsyncStorage.removeItem(STORAGE_KEYS.CURRENT_USER),
                AsyncStorage.removeItem(STORAGE_KEYS.GROUPS),
                AsyncStorage.removeItem(STORAGE_KEYS.ACTIVE_GROUP),
                AsyncStorage.removeItem(STORAGE_KEYS.MESSAGES),
              ]);
            } catch (clearError) {
              console.error('Failed to clear corrupted storage:', clearError);
            }
            setCurrentUser(null);
            setGroups([]);
            setActiveGroupId(null);
            setMessages([]);
          }
        } else {
          console.log('No user found in storage, user needs to login');
          setCurrentUser(null);
          setGroups([]);
          setActiveGroupId(null);
          setMessages([]);
        }
      } catch (error) {
        console.error('Error loading data:', error);
        setCurrentUser(null);
        setGroups([]);
        setActiveGroupId(null);
        setMessages([]);
      } finally {
        setIsLoading(false);
        setIsHydrated(true);
        console.log('=== GAME STORE INITIALIZED ===');
      }
    };

    loadData();
    
    return () => {
    };
  }, []);

  const saveData = useCallback(async () => {
    if (!currentUser || isSavingRef.current) {
      return;
    }
    
    isSavingRef.current = true;
    
    try {
      console.log('Saving data to AsyncStorage...', {
        user: currentUser?.name,
        groupsCount: groups.length,
        activeGroup: activeGroupId,
        messagesCount: messages.length
      });
      
      await Promise.all([
        AsyncStorage.setItem(STORAGE_KEYS.CURRENT_USER, JSON.stringify(currentUser)),
        AsyncStorage.setItem(STORAGE_KEYS.GROUPS, JSON.stringify(groups)),
        AsyncStorage.setItem(STORAGE_KEYS.ACTIVE_GROUP, activeGroupId || ''),
        AsyncStorage.setItem(STORAGE_KEYS.MESSAGES, JSON.stringify(messages)),
      ]);
      
      console.log('Data saved successfully');
    } catch (error) {
      console.error('Error saving data:', error);
    } finally {
      isSavingRef.current = false;
    }
  }, [currentUser, groups, activeGroupId, messages]);
  
  
  useEffect(() => {
    if (!isHydrated || isLoading || !currentUser || isSavingRef.current) {
      return;
    }
    
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }
    
    saveTimeoutRef.current = setTimeout(() => {
      if (!isSavingRef.current) {
        saveData();
      }
    }, 10000);
    
    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, [currentUser?.id, groups.length, activeGroupId, messages.length, isHydrated, isLoading, saveData]);

  const activeGroup = useMemo(() => {
    return groups.find(g => g.id === activeGroupId) || null;
  }, [groups, activeGroupId]);

  const createUser = useCallback((name: string, gamerHandle?: string, email?: string) => {
    const newUser: Player = {
      id: generateId(),
      name,
      gamerHandle: gamerHandle || name.toLowerCase().replace(/\s+/g, '_'),
      email,
      joinedAt: new Date().toISOString(),
      role: 'player',
      status: 'active',
      stats: {
        played: 0,
        wins: 0,
        draws: 0,
        losses: 0,
        goalsFor: 0,
        goalsAgainst: 0,
        cleanSheets: 0,
        points: 0,
        winRate: 0,
        form: [],
        leaguesWon: 0,
        knockoutsWon: 0,
      },
    };
    setCurrentUser(newUser);
    return newUser;
  }, []);

  const createGroup = useCallback(async (name: string, description: string) => {
    if (!currentUser) return null;

    try {
      const inviteCode = generateInviteCode();
      
      const { data: group, error: groupError } = await supabaseClient
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
      
      const { error: memberError } = await supabaseClient
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
      
      const { error: statsError } = await supabaseClient
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

      setGroups(prev => [...prev, newGroup]);
      setActiveGroupId(newGroup.id);
      return newGroup;
    } catch (error) {
      console.error('Error creating group:', error);
      return null;
    }
  }, [currentUser]);

  const joinGroup = useCallback((inviteCode: string) => {
    if (!currentUser) return null;

    const group = groups.find(g => g.inviteCode === inviteCode);
    if (!group) return null;

    if (group.members.find(m => m.id === currentUser.id)) {
      setActiveGroupId(group.id);
      return group;
    }

    setGroups(prev => prev.map(g => {
      if (g.id === group.id) {
        return {
          ...g,
          members: [...g.members, currentUser],
        };
      }
      return g;
    }));
    setActiveGroupId(group.id);
    return group;
  }, [currentUser, groups]);

  const createCompetition = useCallback((
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

    const newCompetition: Competition = {
      id: generateId(),
      groupId: activeGroupId,
      name,
      type,
      status: 'upcoming',
      startDate: new Date().toISOString(),
      participants: participantIds,
      matches: [],
      ...options,
    };

    setGroups(prev => prev.map(group => {
      if (group.id === activeGroupId) {
        return {
          ...group,
          competitions: [...group.competitions, newCompetition],
        };
      }
      return group;
    }));

    return newCompetition;
  }, [activeGroupId]);

  const createMatch = useCallback((
    competitionId: string,
    homePlayerId: string,
    awayPlayerId: string,
    scheduledTime: string
  ) => {
    const newMatch: Match = {
      id: generateId(),
      competitionId,
      homePlayerId,
      awayPlayerId,
      status: 'scheduled',
      scheduledTime,
    };

    setGroups(prev => prev.map(group => ({
      ...group,
      competitions: group.competitions.map(comp => {
        if (comp.id === competitionId) {
          return {
            ...comp,
            matches: [...comp.matches, newMatch],
            status: 'active' as const,
          };
        }
        return comp;
      }),
    })));

    return newMatch;
  }, []);

  const sendMessage = useCallback(async (
    message: string,
    type: ChatMessage['type'] = 'text',
    metadata?: ChatMessage['metadata']
  ) => {
    if (!currentUser || !activeGroupId) return;

    try {
      const { data: chatMessage, error } = await supabaseClient
        .from('chat_messages')
        .insert({
          group_id: activeGroupId,
          sender_id: currentUser.id,
          sender_name: currentUser.name,
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

  const updateMatchResult = useCallback((
    matchId: string,
    homeScore: number,
    awayScore: number
  ) => {
    setGroups(prev => prev.map(group => ({
      ...group,
      members: group.members.map(member => ({
        ...member,
        stats: calculatePlayerStats(
          member.id,
          group.competitions.flatMap(c => c.matches)
        ),
      })),
      competitions: group.competitions.map(comp => ({
        ...comp,
        matches: comp.matches.map(match => {
          if (match.id === matchId) {
            const updatedMatch = {
              ...match,
              homeScore,
              awayScore,
              status: 'completed' as const,
              completedAt: new Date().toISOString(),
            };
            
            const competition = comp;
            if (competition.type === 'tournament' && competition.tournamentType === 'knockout' && homeScore === awayScore) {
              const replayMatch: Match = {
                id: generateId(),
                competitionId: match.competitionId,
                homePlayerId: match.homePlayerId,
                awayPlayerId: match.awayPlayerId,
                status: 'scheduled',
                scheduledTime: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
              };
              comp.matches.push(replayMatch);
            }
            
            return updatedMatch;
          }
          return match;
        }),
      })),
    })));

    const match = groups
      .flatMap(g => g.competitions)
      .flatMap(c => c.matches)
      .find(m => m.id === matchId);

    if (match && currentUser) {
      const homePlayer = activeGroup?.members.find(m => m.id === match.homePlayerId);
      const awayPlayer = activeGroup?.members.find(m => m.id === match.awayPlayerId);
      
      sendMessage(
        `Match Result: ${homePlayer?.name} ${homeScore} - ${awayScore} ${awayPlayer?.name}`,
        'match_result',
        { matchId }
      );
      
      if (homeScore === awayScore) {
        const competition = activeGroup?.competitions.find(c => c.id === match.competitionId);
        if (competition?.type === 'tournament' && competition.tournamentType === 'knockout') {
          sendMessage(
            `⚽ Draw! A replay match has been automatically scheduled for tomorrow.`,
            'text'
          );
        }
      }
    }
  }, [groups, currentUser, activeGroup, sendMessage]);

  const shareYoutubeLink = useCallback((matchId: string, youtubeLink: string) => {
    setGroups(prev => prev.map(group => ({
      ...group,
      competitions: group.competitions.map(comp => ({
        ...comp,
        matches: comp.matches.map(match => {
          if (match.id === matchId) {
            return { ...match, youtubeLink, status: 'live' as const };
          }
          return match;
        }),
      })),
    })));

    if (currentUser) {
      const newMessage = {
        id: generateId(),
        groupId: activeGroupId!,
        senderId: currentUser.id,
        senderName: currentUser.name,
        message: `🔴 Live now: ${youtubeLink}`,
        timestamp: new Date().toISOString(),
        type: 'youtube_link' as const,
        metadata: { matchId, youtubeLink },
      };
      setMessages(prev => [...prev, newMessage]);
    }
  }, [currentUser, activeGroupId]);

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

  const deleteMatch = useCallback((matchId: string) => {
    if (!currentUser || !activeGroup) return false;
    
    const match = activeGroup.competitions
      .flatMap(c => c.matches)
      .find(m => m.id === matchId);
    
    if (!match) return false;
    
    const isAdmin = activeGroup.adminIds?.includes(currentUser.id) || activeGroup.adminId === currentUser.id;
    const isPlayer = match.homePlayerId === currentUser.id || match.awayPlayerId === currentUser.id;
    
    if (!isAdmin && !isPlayer) return false;
    
    if (match.status === 'completed') return false;
    
    setGroups(prev => prev.map(group => ({
      ...group,
      competitions: group.competitions.map(comp => ({
        ...comp,
        matches: comp.matches.filter(m => m.id !== matchId),
      })),
    })));
    
    return true;
  }, [currentUser, activeGroup]);

  const correctMatchScore = useCallback((
    matchId: string,
    homeScore: number,
    awayScore: number
  ) => {
    if (!currentUser || !activeGroup) return false;
    
    const isAdmin = activeGroup.adminIds?.includes(currentUser.id) || activeGroup.adminId === currentUser.id;
    if (!isAdmin) return false;
    
    setGroups(prev => prev.map(group => ({
      ...group,
      members: group.members.map(member => ({
        ...member,
        stats: calculatePlayerStats(
          member.id,
          group.competitions.flatMap(c => c.matches)
        ),
      })),
      competitions: group.competitions.map(comp => ({
        ...comp,
        matches: comp.matches.map(match => {
          if (match.id === matchId && match.status === 'completed') {
            return {
              ...match,
              homeScore,
              awayScore,
            };
          }
          return match;
        }),
      })),
    })));
    
    return true;
  }, [currentUser, activeGroup]);

  const setLoggedInUser = useCallback((user: Player, gameData?: { currentUser: Player; groups: Group[]; activeGroupId: string; messages: ChatMessage[] }) => {
    console.log('=== SETTING LOGGED IN USER ===');
    console.log('User:', user.name, user.email, user.role);
    console.log('Game data provided:', !!gameData);
    
    isSavingRef.current = true;
    
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
      saveTimeoutRef.current = null;
    }
    
    if (gameData && gameData.groups && gameData.groups.length > 0) {
      console.log('Loading game data with groups:', gameData.groups.length);
      console.log('Active group ID:', gameData.activeGroupId);
      console.log('Messages count:', gameData.messages?.length || 0);
      
      const currentUserFromData = gameData.currentUser || user;
      
      const updatedGroups = gameData.groups.map(group => ({
        ...group,
        adminIds: group.adminIds || (group.adminId ? [group.adminId] : []),
        members: group.members.map(member => 
          member.id === currentUserFromData.id ? currentUserFromData : member
        ),
      }));
      
      console.log('Setting groups:', updatedGroups.length);
      setGroups(updatedGroups);
      
      console.log('Setting active group ID:', gameData.activeGroupId);
      setActiveGroupId(gameData.activeGroupId || null);
      
      console.log('Setting messages:', gameData.messages?.length || 0);
      setMessages(gameData.messages || []);
      
      console.log('Setting current user:', currentUserFromData.name);
      setCurrentUser(currentUserFromData);
      
      console.log('Successfully loaded user data with', updatedGroups.length, 'groups');
    } else {
      console.log('No game data provided or empty groups, clearing existing data');
      setGroups([]);
      setActiveGroupId(null);
      setMessages([]);
      
      console.log('Setting current user:', user.name);
      setCurrentUser(user);
    }
    
    setTimeout(() => {
      isSavingRef.current = false;
      console.log('Login process complete, saving enabled');
    }, 500);
    
    console.log('=== USER LOGIN COMPLETE ===');
  }, []);

  const logout = useCallback(async () => {
    console.log('Logging out user...');
    try {
      await supabaseClient.auth.signOut();
      
      await Promise.all([
        AsyncStorage.removeItem(STORAGE_KEYS.CURRENT_USER),
        AsyncStorage.removeItem(STORAGE_KEYS.GROUPS),
        AsyncStorage.removeItem(STORAGE_KEYS.ACTIVE_GROUP),
        AsyncStorage.removeItem(STORAGE_KEYS.MESSAGES),
      ]);
      
      setCurrentUser(null);
      setGroups([]);
      setActiveGroupId(null);
      setMessages([]);
      
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
    
    setGroups(prev => prev.map(group => {
      const competition = group.competitions.find(c => c.id === competitionId);
      if (!competition || !competition.bracket) {
        return group;
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
      
      const updatedBracket = {
        ...bracket,
        currentRound: nextRound,
        rounds: bracket.rounds.map((round, index) => {
          if (index === nextRound) {
            return {
              ...round,
              matches: nextRoundMatches.map(m => m.id),
              status: 'active' as const,
              isGenerated: true,
            };
          }
          if (index === completedRound) {
            return {
              ...round,
              status: 'completed' as const,
            };
          }
          return round;
        }),
        winners: {
          ...bracket.winners,
          [bracket.rounds[completedRound].id]: winners,
        },
      };
      
      return {
        ...group,
        competitions: group.competitions.map(comp => {
          if (comp.id === competitionId) {
            return {
              ...comp,
              matches: [...comp.matches, ...nextRoundMatches],
              bracket: updatedBracket,
              rounds: updatedBracket.rounds,
            };
          }
          return comp;
        }),
      };
    }));
  }, []);

  const generateMatches = useCallback((competitionId: string) => {
    console.log('Generating matches for competition:', competitionId);
    
    setGroups(prev => prev.map(group => {
      const competition = group.competitions.find(c => c.id === competitionId);
      if (!competition) {
        console.log('Competition not found:', competitionId);
        return group;
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

      return {
        ...group,
        competitions: group.competitions.map(comp => {
          if (comp.id === competitionId) {
            return {
              ...comp,
              matches,
              status: 'active' as const,
            };
          }
          return comp;
        }),
      };
    }));
  }, []);

  return {
    currentUser,
    groups,
    activeGroup,
    activeGroupId,
    messages: getGroupMessages(activeGroupId || ''),
    isLoading: isLoading,
    isHydrated,
    createUser,
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
