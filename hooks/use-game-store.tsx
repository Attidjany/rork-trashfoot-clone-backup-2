import createContextHook from '@nkzw/create-context-hook'; 
import { useState, useMemo, useCallback, useEffect } from 'react';
import { Player, Group, Competition, Match, ChatMessage, PlayerStats, KnockoutBracket, TournamentRound } from '@/types/game';
import { supabase } from '@/lib/supabase';
import AsyncStorage from '@react-native-async-storage/async-storage';

const ACTIVE_GROUP_KEY = '@active_group_id';

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
  const [isLoading, setIsLoading] = useState(false);
  const [isHydrated, setIsHydrated] = useState(false);

  useEffect(() => {
    const loadActiveGroupId = async () => {
      try {
        const savedGroupId = await AsyncStorage.getItem(ACTIVE_GROUP_KEY);
        if (savedGroupId) {
          console.log('📦 Loaded active group ID from storage:', savedGroupId);
          setActiveGroupId(savedGroupId);
        }
      } catch (error) {
        console.error('Error loading active group ID:', error);
      } finally {
        setIsHydrated(true);
      }
    };
    loadActiveGroupId();
  }, []);

  useEffect(() => {
    if (!activeGroupId) {
      setMessages([]);
      return;
    }

    console.log('💬 Setting up chat realtime subscription for group:', activeGroupId);

    const loadMessages = async () => {
      const { data, error } = await supabase
        .from('chat_messages')
        .select('*')
        .eq('group_id', activeGroupId)
        .order('timestamp', { ascending: true });

      if (error) {
        console.error('Error loading messages:', error);
        return;
      }

      if (data) {
        const chatMessages: ChatMessage[] = data.map(msg => ({
          id: msg.id,
          groupId: msg.group_id,
          senderId: msg.sender_id,
          senderName: msg.sender_name,
          message: msg.message,
          timestamp: msg.timestamp,
          type: msg.type as 'text' | 'match_result' | 'youtube_link',
          metadata: msg.metadata || undefined,
        }));
        console.log('📥 Loaded', chatMessages.length, 'messages');
        setMessages(chatMessages);
      }
    };

    loadMessages();

    const channel = supabase
      .channel(`chat:${activeGroupId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'chat_messages',
          filter: `group_id=eq.${activeGroupId}`,
        },
        (payload) => {
          console.log('💬 New message received:', payload.new);
          const newMsg = payload.new as any;
          const chatMessage: ChatMessage = {
            id: newMsg.id,
            groupId: newMsg.group_id,
            senderId: newMsg.sender_id,
            senderName: newMsg.sender_name,
            message: newMsg.message,
            timestamp: newMsg.timestamp,
            type: newMsg.type as 'text' | 'match_result' | 'youtube_link',
            metadata: newMsg.metadata || undefined,
          };
          setMessages(prev => {
            if (prev.some(m => m.id === chatMessage.id)) {
              return prev;
            }
            return [...prev, chatMessage];
          });
        }
      )
      .subscribe((status) => {
        console.log('📡 Chat channel status:', status);
        if (status === 'SUBSCRIBED') {
          console.log('✅ Successfully subscribed to chat messages');
        } else if (status === 'CHANNEL_ERROR') {
          console.error('❌ Error subscribing to chat channel');
        } else if (status === 'TIMED_OUT') {
          console.error('⏱️ Chat channel subscription timed out');
        }
      });

    return () => {
      console.log('💬 Cleaning up chat subscription');
      supabase.removeChannel(channel);
    };
  }, [activeGroupId]);

  const persistActiveGroupId = useCallback(async (groupId: string | null) => {
    try {
      if (groupId) {
        await AsyncStorage.setItem(ACTIVE_GROUP_KEY, groupId);
        console.log('💾 Saved active group ID to storage:', groupId);
      } else {
        await AsyncStorage.removeItem(ACTIVE_GROUP_KEY);
        console.log('🗑️ Removed active group ID from storage');
      }
    } catch (error) {
      console.error('Error persisting active group ID:', error);
    }
  }, []);

  const setActiveGroupIdWithPersist = useCallback((groupId: string | null) => {
    setActiveGroupId(groupId);
    persistActiveGroupId(groupId);
  }, [persistActiveGroupId]);

  const activeGroup = useMemo(() => {
    return groups.find(g => g.id === activeGroupId) || null;
  }, [groups, activeGroupId]);

  // UPDATED: uses Supabase auth as source of truth; still updates local state
  const createGroup = useCallback(async (name: string, description: string) => {
    try {
      // Source of truth: Supabase session (works even if store user isn't hydrated yet)
      const { data: uData, error: uErr } = await supabase.auth.getUser();
      if (uErr) throw uErr;
      if (!uData?.user) {
        console.error('createGroup: no Supabase user');
        return null;
      }
      const adminId = uData.user.id;

      const inviteCode = generateInviteCode();

      // 1) Insert group
      const { data: group, error: groupError } = await supabase
        .from('groups')
        .insert({
          name,
          description,
          admin_id: adminId,          // IMPORTANT for RLS
          invite_code: inviteCode,    // IMPORTANT: use invite_code
          is_public: false,
        })
        .select()
        .single();

      if (groupError || !group) {
        console.error('Error creating group:', groupError);
        return null;
      }

      // 2) Insert membership (creator is admin)
const { error: memberError } = await supabase
  .from('group_members')
  .insert({
    group_id: group.id,
    player_id: adminId,
    is_admin: true,   // keep this; your schema has it
  });

// ignore duplicate membership if any
if (memberError && String((memberError as any).code) !== '23505') {
  console.error('Error adding member:', memberError);
  return null;
}

      // 3) (Optional) Create player stats row
      const { error: statsError } = await supabase
        .from('player_stats')
        .insert({
          player_id: adminId,
          group_id: group.id,
        });

      if (statsError) {
        console.error('Error creating stats:', statsError);
      }

      // Build local Group object (members list uses currentUser if available)
      const newGroup: Group = {
        id: group.id,
        name: group.name,
        description: group.description || '',
        adminId: group.admin_id,
        adminIds: [group.admin_id],
        members: currentUser ? [currentUser] : [], // fallback: empty if not hydrated yet
        createdAt: group.created_at,
        competitions: [],
        inviteCode: group.invite_code,
        isPublic: group.is_public,
        pendingMembers: [],
      };

      setGroups(prev => [...prev, newGroup]);
      setActiveGroupIdWithPersist(newGroup.id);
      return newGroup;
    } catch (error) {
      console.error('Error creating group:', error);
      return null;
    }
  }, [currentUser]);

  // UPDATED: hits Supabase (lookup by invite_code + insert into group_members)
  const joinGroup = useCallback(async (inviteCode: string) => {
    try {
      const code = (inviteCode || '').trim().toUpperCase();

      const { data: uData, error: uErr } = await supabase.auth.getUser();
      if (uErr) throw uErr;
      if (!uData?.user) {
        console.error('joinGroup: no Supabase user');
        return null;
      }
      const playerId = uData.user.id;

      // 1) Find the group by invite_code
      const { data: group, error: gErr } = await supabase
        .from('groups')
        .select('id, name, description, admin_id, invite_code, is_public, created_at')
        .eq('invite_code', code)
        .single();

      if (gErr || !group) {
        console.error('Error finding group:', gErr);
        return null;
      }

      // 2) Insert membership
const { error: gmErr } = await supabase
  .from('group_members')
  .insert({
    group_id: group.id,
    player_id: playerId,
    is_admin: false,  // regular member
  });

if (gmErr && String((gmErr as any).code) !== '23505') {
  console.error('Error joining group:', gmErr);
  return null;
}
      // 3) (Optional) Ensure stats row exists
      const { error: statsErr } = await supabase
        .from('player_stats')
        .insert({ player_id: playerId, group_id: group.id })
        .select()
        .single();

      // ignore unique violation if already exists
      if (statsErr && String((statsErr as any).code) !== '23505') {
        console.error('Error creating stats for member:', statsErr);
      }

      // 4) Reflect in local store (add/merge)
      const joined: Group = {
        id: group.id,
        name: group.name,
        description: group.description || '',
        adminId: group.admin_id,
        adminIds: [group.admin_id],
        members: currentUser ? [currentUser] : [], // we don't yet fetch other members here
        createdAt: group.created_at,
        competitions: [],
        inviteCode: group.invite_code,
        isPublic: group.is_public,
        pendingMembers: [],
      };

      setGroups(prev => {
        const exists = prev.some(g => g.id === joined.id);
        if (exists) {
          return prev.map(g => {
            if (g.id !== joined.id) return g;
            // add currentUser to members if not present
            if (currentUser && !g.members.some(m => m.id === currentUser.id)) {
              return { ...g, members: [...g.members, currentUser] };
            }
            return g;
            });
        }
        return [...prev, joined];
      });

      setActiveGroupIdWithPersist(joined.id);
      return joined;
    } catch (error) {
      console.error('Error joining group:', error);
      return null;
    }
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
      
      console.log('✅ Message sent successfully');
      return chatMessage;
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
      
      console.log('Setting current user:', user);
      setCurrentUser(user);
    }
    
    console.log('=== USER LOGIN COMPLETE ===');
  }, []);

  const updateProfile = useCallback(async (name: string, gamerHandle: string) => {
    if (!currentUser) {
      throw new Error('User not authenticated');
    }

    try {
      console.log('🔄 Updating profile:', { name, gamerHandle });

      const { data: uData, error: uErr } = await supabase.auth.getUser();
      if (uErr) throw uErr;
      if (!uData?.user) {
        throw new Error('User not authenticated');
      }

      const { data: player, error: playerFetchError } = await supabase
        .from('players')
        .select('id')
        .eq('auth_user_id', uData.user.id)
        .single();

      if (playerFetchError || !player) {
        throw new Error('Player not found');
      }

      const { data: existingHandle, error: checkError } = await supabase
        .from('players')
        .select('id')
        .eq('gamer_handle', gamerHandle)
        .neq('id', player.id)
        .maybeSingle();

      if (checkError) {
        console.error('Error checking handle:', checkError);
      }

      if (existingHandle) {
        throw new Error('This gamer handle is already taken. Please choose another one.');
      }

      const { data: updatedPlayer, error: updateError } = await supabase
        .from('players')
        .update({
          name,
          gamer_handle: gamerHandle,
        })
        .eq('id', player.id)
        .select()
        .single();

      if (updateError || !updatedPlayer) {
        console.error('Profile update error:', updateError);
        throw new Error(`Failed to update profile: ${updateError?.message || 'Unknown error'}`);
      }

      console.log('✅ Profile updated successfully:', updatedPlayer);

      setCurrentUser({
        ...currentUser,
        name: updatedPlayer.name,
        gamerHandle: updatedPlayer.gamer_handle,
      });

      return {
        success: true,
        player: {
          id: updatedPlayer.id,
          name: updatedPlayer.name,
          gamerHandle: updatedPlayer.gamer_handle,
          email: updatedPlayer.email,
        },
      };
    } catch (error: any) {
      console.error('❌ Profile update error:', error);
      throw error;
    }
  }, [currentUser]);

  const logout = useCallback(async () => {
    console.log('🔓 Logging out user...');
    try {
      console.log('🔄 Clearing local state...');
      setCurrentUser(null);
      setGroups([]);
      setActiveGroupId(null);
      setMessages([]);
      
      console.log('🔄 Removing persisted active group...');
      await persistActiveGroupId(null);
      
      console.log('🔄 Signing out from Supabase...');
      const { error } = await supabase.auth.signOut({ scope: 'local' });
      if (error) {
        console.error('❌ Supabase signOut error:', error);
      }
      
      console.log('✅ Logout successful - state cleared');
    } catch (error) {
      console.error('❌ Error during logout:', error);
      throw error;
    }
  }, [persistActiveGroupId]);

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
    isLoading,
    isHydrated,
    createGroup,
    joinGroup,
    createCompetition,
    createMatch,
    updateMatchResult,
    sendMessage,
    shareYoutubeLink,
    setActiveGroupId: setActiveGroupIdWithPersist,
    getPlayerStats,
    getHeadToHead,
    generateMatches,
    generateNextRoundMatches,
    deleteMatch,
    correctMatchScore,
    setLoggedInUser,
    updateProfile,
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
