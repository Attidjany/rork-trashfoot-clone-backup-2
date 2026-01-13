import { z } from "zod";
import { publicProcedure } from "../../../create-context";
import { supabaseAdmin } from "../../../../lib/supabase-server";

export const getAllGroupsProcedure = publicProcedure
  .query(async () => {
    try {
      console.log('=== GET ALL GROUPS (SUPERADMIN) ===');
      
      const { data: groups, error } = await supabaseAdmin
        .from('groups')
        .select(`
          *,
          admin:players!groups_admin_id_fkey(id, name, email, gamer_handle),
          members:group_members(
            id,
            player:players(id, name, email, gamer_handle)
          ),
          pending_members:pending_group_members(
            id,
            player_id,
            player_name,
            status,
            requested_at
          ),
          competitions(
            id,
            name,
            type,
            status,
            matches!inner(id, status)
          )
        `)
        .order('created_at', { ascending: false });
      
      if (error) {
        console.error('Error fetching groups:', error);
        throw new Error('Failed to fetch groups');
      }
      
      return {
        success: true,
        data: groups || []
      };
    } catch (error) {
      console.error('Get all groups error:', error);
      throw new Error(error instanceof Error ? error.message : 'Failed to get groups');
    }
  });

export const deleteGroupProcedure = publicProcedure
  .input(
    z.object({
      groupId: z.string(),
    })
  )
  .mutation(async ({ input }) => {
    try {
      console.log('=== DELETE GROUP (SUPERADMIN) ===');
      console.log('Group ID:', input.groupId);
      
      const { error } = await supabaseAdmin
        .from('groups')
        .delete()
        .eq('id', input.groupId);
      
      if (error) {
        throw new Error('Failed to delete group');
      }
      
      console.log('Successfully deleted group');
      
      return {
        success: true,
        message: 'Group deleted successfully'
      };
    } catch (error) {
      console.error('Delete group error:', error);
      throw new Error(error instanceof Error ? error.message : 'Failed to delete group');
    }
  });

export const removeUserFromGroupProcedure = publicProcedure
  .input(
    z.object({
      groupId: z.string(),
      playerId: z.string(),
    })
  )
  .mutation(async ({ input }) => {
    try {
      console.log('=== REMOVE USER FROM GROUP (SUPERADMIN) ===');
      console.log('Group ID:', input.groupId, 'Player ID:', input.playerId);
      
      const { error } = await supabaseAdmin
        .from('group_members')
        .delete()
        .eq('group_id', input.groupId)
        .eq('player_id', input.playerId);
      
      if (error) {
        throw new Error('Failed to remove user from group');
      }
      
      console.log('Successfully removed user from group');
      
      return {
        success: true,
        message: 'User removed from group successfully'
      };
    } catch (error) {
      console.error('Remove user from group error:', error);
      throw new Error(error instanceof Error ? error.message : 'Failed to remove user from group');
    }
  });

export const deleteMatchProcedure = publicProcedure
  .input(
    z.object({
      matchId: z.string(),
    })
  )
  .mutation(async ({ input }) => {
    try {
      console.log('=== DELETE MATCH (SUPERADMIN) ===');
      console.log('Match ID:', input.matchId);
      
      const { error } = await supabaseAdmin
        .from('matches')
        .update({ deleted_at: new Date().toISOString() })
        .eq('id', input.matchId);
      
      if (error) {
        throw new Error('Failed to soft delete match');
      }
      
      console.log('Successfully soft deleted match');
      
      return {
        success: true,
        message: 'Match deleted successfully'
      };
    } catch (error) {
      console.error('Delete match error:', error);
      throw new Error(error instanceof Error ? error.message : 'Failed to delete match');
    }
  });

export const correctMatchScoreProcedure = publicProcedure
  .input(
    z.object({
      matchId: z.string(),
      homeScore: z.number(),
      awayScore: z.number(),
    })
  )
  .mutation(async ({ input }) => {
    try {
      console.log('=== CORRECT MATCH SCORE (SUPERADMIN) ===');
      console.log('Match ID:', input.matchId, 'Score:', input.homeScore, '-', input.awayScore);
      
      const { error } = await supabaseAdmin
        .from('matches')
        .update({
          home_score: input.homeScore,
          away_score: input.awayScore,
        })
        .eq('id', input.matchId);
      
      if (error) {
        throw new Error('Failed to correct match score');
      }
      
      console.log('Successfully corrected match score');
      
      return {
        success: true,
        message: 'Match score corrected successfully'
      };
    } catch (error) {
      console.error('Correct match score error:', error);
      throw new Error(error instanceof Error ? error.message : 'Failed to correct match score');
    }
  });

export const manageJoinRequestProcedure = publicProcedure
  .input(
    z.object({
      requestId: z.string(),
      action: z.enum(['approve', 'reject']),
    })
  )
  .mutation(async ({ input }) => {
    try {
      console.log('=== MANAGE JOIN REQUEST (SUPERADMIN) ===');
      console.log('Request ID:', input.requestId, 'Action:', input.action);
      
      const { data: request, error: fetchError } = await supabaseAdmin
        .from('pending_group_members')
        .select('*')
        .eq('id', input.requestId)
        .single();
      
      if (fetchError || !request) {
        throw new Error('Join request not found');
      }
      
      if (input.action === 'approve') {
        const { error: insertError } = await supabaseAdmin
          .from('group_members')
          .insert({
            group_id: request.group_id,
            player_id: request.player_id,
            is_admin: false,
          });
        
        if (insertError) {
          throw new Error('Failed to add member to group');
        }
      }
      
      const { error: deleteError } = await supabaseAdmin
        .from('pending_group_members')
        .delete()
        .eq('id', input.requestId);
      
      if (deleteError) {
        throw new Error('Failed to remove join request');
      }
      
      console.log('Successfully managed join request');
      
      return {
        success: true,
        message: `Join request ${input.action}d successfully`
      };
    } catch (error) {
      console.error('Manage join request error:', error);
      throw new Error(error instanceof Error ? error.message : 'Failed to manage join request');
    }
  });

export const deleteCompetitionProcedure = publicProcedure
  .input(
    z.object({
      competitionId: z.string(),
    })
  )
  .mutation(async ({ input }) => {
    try {
      console.log('=== DELETE COMPETITION (SUPERADMIN) ===');
      console.log('Competition ID:', input.competitionId);
      
      const { error } = await supabaseAdmin
        .from('competitions')
        .delete()
        .eq('id', input.competitionId);
      
      if (error) {
        throw new Error('Failed to delete competition');
      }
      
      console.log('Successfully deleted competition');
      
      return {
        success: true,
        message: 'Competition deleted successfully'
      };
    } catch (error) {
      console.error('Delete competition error:', error);
      throw new Error(error instanceof Error ? error.message : 'Failed to delete competition');
    }
  });

export const assignGroupAdminProcedure = publicProcedure
  .input(
    z.object({
      groupId: z.string(),
      playerId: z.string(),
    })
  )
  .mutation(async ({ input }) => {
    try {
      console.log('=== ASSIGN GROUP ADMIN (SUPERADMIN) ===');
      console.log('Group ID:', input.groupId, 'Player ID:', input.playerId);
      
      const { data: member, error: memberError } = await supabaseAdmin
        .from('group_members')
        .select('*')
        .eq('group_id', input.groupId)
        .eq('player_id', input.playerId)
        .single();
      
      if (memberError || !member) {
        throw new Error('Player is not a member of this group');
      }
      
      const { error: updateGroupError } = await supabaseAdmin
        .from('groups')
        .update({ admin_id: input.playerId })
        .eq('id', input.groupId);
      
      if (updateGroupError) {
        throw new Error('Failed to update group admin');
      }
      
      const { error: updateMemberError } = await supabaseAdmin
        .from('group_members')
        .update({ is_admin: true })
        .eq('group_id', input.groupId)
        .eq('player_id', input.playerId);
      
      if (updateMemberError) {
        throw new Error('Failed to update member admin status');
      }
      
      console.log('Successfully assigned group admin');
      
      return {
        success: true,
        message: 'Group admin assigned successfully'
      };
    } catch (error) {
      console.error('Assign group admin error:', error);
      throw new Error(error instanceof Error ? error.message : 'Failed to assign group admin');
    }
  });

export const deletePlayerProcedure = publicProcedure
  .input(
    z.object({
      playerId: z.string(),
    })
  )
  .mutation(async ({ input }) => {
    try {
      console.log('=== DELETE PLAYER (SUPERADMIN) ===');
      console.log('Player ID:', input.playerId);
      
      const { data: player, error: fetchError } = await supabaseAdmin
        .from('players')
        .select('*')
        .eq('id', input.playerId)
        .single();
      
      if (fetchError || !player) {
        throw new Error('Player not found');
      }
      
      const { error: deleteError } = await supabaseAdmin
        .from('players')
        .delete()
        .eq('id', input.playerId);
      
      if (deleteError) {
        throw new Error('Failed to delete player');
      }
      
      if (player.auth_user_id) {
        await supabaseAdmin.auth.admin.deleteUser(player.auth_user_id);
      }
      
      console.log('Successfully deleted player:', player.email);
      
      return {
        success: true,
        message: `Player ${player.name} has been deleted successfully`
      };
    } catch (error) {
      console.error('Delete player error:', error);
      throw new Error(error instanceof Error ? error.message : 'Failed to delete player');
    }
  });

export const getAllMatchesProcedure = publicProcedure
  .query(async () => {
    try {
      console.log('=== GET ALL MATCHES (SUPERADMIN) ===');
      
      const { data: matches, error } = await supabaseAdmin
        .from('matches')
        .select(`
          *,
          home_player:players!matches_home_player_id_fkey(id, name, gamer_handle),
          away_player:players!matches_away_player_id_fkey(id, name, gamer_handle),
          competition:competitions(
            id,
            name,
            type,
            group:groups(id, name)
          )
        `)
        .is('deleted_at', null)
        .order('scheduled_time', { ascending: false });
      
      if (error) {
        console.error('Error fetching matches:', error);
        throw new Error('Failed to fetch matches');
      }
      
      return {
        success: true,
        data: matches || []
      };
    } catch (error) {
      console.error('Get all matches error:', error);
      throw new Error(error instanceof Error ? error.message : 'Failed to get matches');
    }
  });

export const getAllCompetitionsProcedure = publicProcedure
  .query(async () => {
    try {
      console.log('=== GET ALL COMPETITIONS (SUPERADMIN) ===');
      
      const { data: competitions, error } = await supabaseAdmin
        .from('competitions')
        .select(`
          *,
          group:groups(id, name),
          matches!inner(id, status),
          participants:competition_participants(
            id,
            player:players(id, name, gamer_handle)
          )
        `)
        .order('created_at', { ascending: false });
      
      if (error) {
        console.error('Error fetching competitions:', error);
        throw new Error('Failed to fetch competitions');
      }
      
      return {
        success: true,
        data: competitions || []
      };
    } catch (error) {
      console.error('Get all competitions error:', error);
      throw new Error(error instanceof Error ? error.message : 'Failed to get competitions');
    }
  });

export const getAllPlayersProcedure = publicProcedure
  .query(async () => {
    try {
      console.log('=== GET ALL PLAYERS (SUPERADMIN) ===');
      
      const { data: players, error } = await supabaseAdmin
        .from('players')
        .select(`
          *,
          group_memberships:group_members(
            id,
            is_admin,
            group:groups(id, name)
          ),
          stats:player_stats(*)
        `)
        .order('joined_at', { ascending: false });
      
      if (error) {
        console.error('Error fetching players:', error);
        throw new Error('Failed to fetch players');
      }
      
      return {
        success: true,
        data: players || []
      };
    } catch (error) {
      console.error('Get all players error:', error);
      throw new Error(error instanceof Error ? error.message : 'Failed to get players');
    }
  });

export const getPlatformStatsProcedure = publicProcedure
  .query(async () => {
    try {
      console.log('=== GET PLATFORM STATS (SUPERADMIN) ===');
      
      const [
        { count: totalPlayers },
        { count: totalGroups },
        { count: totalCompetitions },
        { count: totalMatches },
        { count: activeGroups },
        { count: liveMatches },
        { count: completedMatches },
      ] = await Promise.all([
        supabaseAdmin.from('players').select('*', { count: 'exact', head: true }),
        supabaseAdmin.from('groups').select('*', { count: 'exact', head: true }),
        supabaseAdmin.from('competitions').select('*', { count: 'exact', head: true }),
        supabaseAdmin.from('matches').select('*', { count: 'exact', head: true }).is('deleted_at', null),
        supabaseAdmin.from('groups').select('*', { count: 'exact', head: true }).eq('is_public', true),
        supabaseAdmin.from('matches').select('*', { count: 'exact', head: true }).eq('status', 'live').is('deleted_at', null),
        supabaseAdmin.from('matches').select('*', { count: 'exact', head: true }).eq('status', 'completed').is('deleted_at', null),
      ]);
      
      return {
        success: true,
        data: {
          totalPlayers: totalPlayers || 0,
          totalGroups: totalGroups || 0,
          totalCompetitions: totalCompetitions || 0,
          totalMatches: totalMatches || 0,
          activeGroups: activeGroups || 0,
          liveMatches: liveMatches || 0,
          completedMatches: completedMatches || 0,
        }
      };
    } catch (error) {
      console.error('Get platform stats error:', error);
      throw new Error(error instanceof Error ? error.message : 'Failed to get platform stats');
    }
  });
