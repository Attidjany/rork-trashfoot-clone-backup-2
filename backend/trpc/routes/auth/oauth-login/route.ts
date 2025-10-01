import { z } from "zod";
import { publicProcedure } from "@/backend/trpc/create-context";
import { supabaseAdmin } from "@/backend/lib/supabase-server";
import { Player, Group, ChatMessage, Competition } from "@/types/game";

async function fetchUserGroups(playerId: string): Promise<Group[]> {
  const { data: groupMemberships } = await supabaseAdmin
    .from('group_members')
    .select('group_id')
    .eq('player_id', playerId);
  
  if (!groupMemberships || groupMemberships.length === 0) {
    return [];
  }
  
  const groupIds = groupMemberships.map(gm => gm.group_id);
  
  const { data: groups } = await supabaseAdmin
    .from('groups')
    .select('*')
    .in('id', groupIds);
  
  if (!groups) return [];
  
  const fullGroups: Group[] = [];
  
  for (const group of groups) {
    const { data: members } = await supabaseAdmin
      .from('group_members')
      .select('player_id, is_admin, players(*)')
      .eq('group_id', group.id);
    
    const { data: competitions } = await supabaseAdmin
      .from('competitions')
      .select('*')
      .eq('group_id', group.id);
    
    const competitionsWithMatches: Competition[] = [];
    
    if (competitions) {
      for (const comp of competitions) {
        const { data: matches } = await supabaseAdmin
          .from('matches')
          .select('*')
          .eq('competition_id', comp.id);
        
        const { data: participants } = await supabaseAdmin
          .from('competition_participants')
          .select('player_id')
          .eq('competition_id', comp.id);
        
        competitionsWithMatches.push({
          id: comp.id,
          groupId: comp.group_id,
          name: comp.name,
          type: comp.type as 'league' | 'tournament' | 'friendly',
          status: comp.status as 'upcoming' | 'active' | 'completed',
          startDate: comp.start_date,
          endDate: comp.end_date || undefined,
          participants: participants?.map(p => p.player_id) || [],
          matches: matches?.map(m => ({
            id: m.id,
            competitionId: m.competition_id,
            homePlayerId: m.home_player_id,
            awayPlayerId: m.away_player_id,
            homeScore: m.home_score,
            awayScore: m.away_score,
            status: m.status as 'scheduled' | 'live' | 'completed',
            scheduledTime: m.scheduled_time,
            youtubeLink: m.youtube_link || undefined,
            completedAt: m.completed_at || undefined,
          })) || [],
          tournamentType: comp.tournament_type as 'knockout' | 'group_stage' | 'mixed' | undefined,
          leagueFormat: comp.league_format as 'single' | 'double' | undefined,
          friendlyType: comp.friendly_type as 'best_of' | 'first_to' | undefined,
          friendlyTarget: comp.friendly_target || undefined,
          knockoutMinPlayers: comp.knockout_min_players || undefined,
          maxParticipants: comp.max_participants || undefined,
          minParticipants: comp.min_participants || undefined,
          teamRestrictions: comp.team_restrictions || undefined,
          badge: comp.badge || undefined,
          bracket: comp.bracket || undefined,
        });
      }
    }
    
    const { data: adminIds } = await supabaseAdmin
      .from('group_members')
      .select('player_id')
      .eq('group_id', group.id)
      .eq('is_admin', true);
    
    const playerMembers: Player[] = [];
    if (members) {
      for (const member of members) {
        const playerData = member.players as any;
        const { data: stats } = await supabaseAdmin
          .from('player_stats')
          .select('*')
          .eq('player_id', playerData.id)
          .eq('group_id', group.id)
          .single();
        
        playerMembers.push({
          id: playerData.id,
          name: playerData.name,
          gamerHandle: playerData.gamer_handle,
          email: playerData.email,
          avatar: playerData.avatar || undefined,
          role: playerData.role as 'player' | 'admin' | 'super_admin',
          status: playerData.status as 'active' | 'suspended' | 'banned',
          suspendedUntil: playerData.suspended_until || undefined,
          joinedAt: playerData.joined_at,
          stats: stats ? {
            played: stats.played,
            wins: stats.wins,
            draws: stats.draws,
            losses: stats.losses,
            goalsFor: stats.goals_for,
            goalsAgainst: stats.goals_against,
            cleanSheets: stats.clean_sheets,
            points: stats.points,
            winRate: parseFloat(stats.win_rate),
            form: stats.form || [],
            leaguesWon: stats.leagues_won,
            knockoutsWon: stats.knockouts_won,
          } : {
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
        });
      }
    }
    
    fullGroups.push({
      id: group.id,
      name: group.name,
      description: group.description || '',
      adminId: group.admin_id,
      adminIds: adminIds?.map(a => a.player_id) || [group.admin_id],
      members: playerMembers,
      createdAt: group.created_at,
      coverImage: group.cover_image || undefined,
      competitions: competitionsWithMatches,
      inviteCode: group.invite_code,
      isPublic: group.is_public,
      pendingMembers: [],
    });
  }
  
  return fullGroups;
}

async function fetchGroupMessages(groupIds: string[]): Promise<ChatMessage[]> {
  if (groupIds.length === 0) return [];
  
  const { data: messages } = await supabaseAdmin
    .from('chat_messages')
    .select('*')
    .in('group_id', groupIds)
    .order('timestamp', { ascending: true });
  
  if (!messages) return [];
  
  return messages.map(m => ({
    id: m.id,
    groupId: m.group_id,
    senderId: m.sender_id,
    senderName: m.sender_name,
    message: m.message,
    timestamp: m.timestamp,
    type: m.type as 'text' | 'match_result' | 'youtube_link',
    metadata: m.metadata || undefined,
  }));
}

export const oauthLoginProcedure = publicProcedure
  .input(
    z.object({
      authUserId: z.string(),
      email: z.string().email(),
      name: z.string().optional(),
    })
  )
  .mutation(async ({ input }) => {
    try {
      console.log('=== OAUTH LOGIN ATTEMPT ===');
      console.log('Auth User ID:', input.authUserId);
      console.log('Email:', input.email);
      
      let player = await supabaseAdmin
        .from('players')
        .select('*')
        .eq('auth_user_id', input.authUserId)
        .single();
      
      if (!player.data) {
        console.log('Player not found, creating new profile...');
        
        const gamerHandle = input.email.split('@')[0] + '_' + Math.random().toString(36).substring(2, 6);
        
        const { data: newPlayer, error: createError } = await supabaseAdmin
          .from('players')
          .insert({
            auth_user_id: input.authUserId,
            name: input.name || input.email.split('@')[0],
            gamer_handle: gamerHandle,
            email: input.email,
            role: 'player',
            status: 'active',
          })
          .select()
          .single();
        
        if (createError || !newPlayer) {
          console.error('Failed to create player:', createError);
          throw new Error('Failed to create player profile');
        }
        
        await supabaseAdmin
          .from('player_stats')
          .insert({
            player_id: newPlayer.id,
            group_id: null,
          });
        
        player.data = newPlayer;
      }
      
      const playerData = player.data;
      
      const { data: globalStats } = await supabaseAdmin
        .from('player_stats')
        .select('*')
        .eq('player_id', playerData.id)
        .is('group_id', null)
        .single();
      
      const user: Player = {
        id: playerData.id,
        name: playerData.name,
        gamerHandle: playerData.gamer_handle,
        email: playerData.email,
        avatar: playerData.avatar || undefined,
        role: playerData.role as 'player' | 'admin' | 'super_admin',
        status: playerData.status as 'active' | 'suspended' | 'banned',
        suspendedUntil: playerData.suspended_until || undefined,
        joinedAt: playerData.joined_at,
        stats: globalStats ? {
          played: globalStats.played,
          wins: globalStats.wins,
          draws: globalStats.draws,
          losses: globalStats.losses,
          goalsFor: globalStats.goals_for,
          goalsAgainst: globalStats.goals_against,
          cleanSheets: globalStats.clean_sheets,
          points: globalStats.points,
          winRate: parseFloat(globalStats.win_rate),
          form: globalStats.form || [],
          leaguesWon: globalStats.leagues_won,
          knockoutsWon: globalStats.knockouts_won,
        } : {
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
      
      const groups = await fetchUserGroups(playerData.id);
      const groupIds = groups.map(g => g.id);
      const messages = await fetchGroupMessages(groupIds);
      
      const gameData = {
        currentUser: user,
        groups,
        activeGroupId: groups.length > 0 ? groups[0].id : '',
        messages,
      };
      
      console.log('=== OAUTH LOGIN SUCCESS ===');
      console.log('User:', user.name, '(' + user.email + ')');
      
      return {
        user,
        gameData,
        message: "Login successful!",
      };
    } catch (error) {
      console.error('OAuth login error:', error);
      const errorMessage = error instanceof Error ? error.message : 'OAuth login failed';
      throw new Error(errorMessage);
    }
  });
