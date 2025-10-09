import { z } from "zod";
import { protectedProcedure } from "../../../create-context";
import { supabaseAdmin } from "../../../../lib/supabase-server";

export const createCompetitionProcedure = protectedProcedure
  .input(
    z.object({
      groupId: z.string(),
      name: z.string().min(1),
      type: z.enum(['league', 'tournament', 'friendly']),
      participantIds: z.array(z.string()),
      leagueFormat: z.enum(['single', 'double']).optional(),
      friendlyType: z.enum(['best_of', 'first_to']).optional(),
      friendlyTarget: z.number().optional(),
      tournamentType: z.enum(['knockout', 'group_stage', 'mixed']).optional(),
      knockoutMinPlayers: z.number().optional(),
      endDate: z.string().optional(),
    })
  )
  .mutation(async ({ input, ctx }) => {
    const userId = ctx.user?.id;
    if (!userId) {
      throw new Error('User not authenticated');
    }

    const { data: player } = await supabaseAdmin
      .from('players')
      .select('id')
      .eq('auth_user_id', userId)
      .single();

    if (!player) {
      throw new Error('Player not found');
    }

    const { data: membership } = await supabaseAdmin
      .from('group_members')
      .select('id')
      .eq('group_id', input.groupId)
      .eq('player_id', player.id)
      .single();

    if (!membership) {
      throw new Error('You must be a member of this group to create competitions');
    }

    const { data: competition, error: compError } = await supabaseAdmin
      .from('competitions')
      .insert({
        group_id: input.groupId,
        name: input.name,
        type: input.type,
        status: 'upcoming',
        start_date: new Date().toISOString(),
        tournament_type: input.tournamentType,
        league_format: input.leagueFormat,
        friendly_type: input.friendlyType,
        friendly_target: input.friendlyTarget,
        knockout_min_players: input.knockoutMinPlayers,
        end_date: input.endDate,
        created_by: player.id,
      })
      .select()
      .single();

    if (compError || !competition) {
      console.error('Error creating competition:', compError);
      throw new Error('Failed to create competition');
    }

    const participantInserts = input.participantIds.map(playerId => ({
      competition_id: competition.id,
      player_id: playerId,
    }));

    const { error: participantsError } = await supabaseAdmin
      .from('competition_participants')
      .insert(participantInserts);

    if (participantsError) {
      console.error('Error adding participants:', participantsError);
      await supabaseAdmin.from('competitions').delete().eq('id', competition.id);
      throw new Error('Failed to add participants');
    }

    const deadline = input.endDate ? new Date(input.endDate) : null;
    const matches = generateMatches(
      competition.id,
      input.participantIds,
      input.type,
      input.leagueFormat,
      input.friendlyTarget,
      input.tournamentType,
      deadline
    );

    if (matches.length > 0) {
      const { error: matchesError } = await supabaseAdmin
        .from('matches')
        .insert(matches);

      if (matchesError) {
        console.error('Error creating matches:', matchesError);
      }

      await supabaseAdmin
        .from('competitions')
        .update({ status: 'active' })
        .eq('id', competition.id);
    }

    return {
      success: true,
      competition: {
        id: competition.id,
        name: competition.name,
        type: competition.type,
        status: 'active',
      },
    };
  });

function getInitialStage(participantCount: number): string {
  if (participantCount > 8) return 'round_of_16';
  if (participantCount > 4) return 'quarter_final';
  if (participantCount > 2) return 'semi_final';
  return 'final';
}

function generateMatches(
  competitionId: string,
  participantIds: string[],
  type: 'league' | 'tournament' | 'friendly',
  leagueFormat?: 'single' | 'double',
  friendlyTarget?: number,
  tournamentType?: 'knockout' | 'group_stage' | 'mixed',
  deadline?: Date | null
) {
  const matches: any[] = [];
  const scheduledTime = deadline ? deadline.toISOString() : new Date(Date.now() + 7 * 86400000).toISOString();

  if (type === 'league') {
    for (let i = 0; i < participantIds.length; i++) {
      for (let j = i + 1; j < participantIds.length; j++) {
        matches.push({
          competition_id: competitionId,
          home_player_id: participantIds[i],
          away_player_id: participantIds[j],
          status: 'scheduled',
          scheduled_time: scheduledTime,
        });

        if (leagueFormat === 'double') {
          matches.push({
            competition_id: competitionId,
            home_player_id: participantIds[j],
            away_player_id: participantIds[i],
            status: 'scheduled',
            scheduled_time: scheduledTime,
          });
        }
      }
    }
  } else if (type === 'friendly' && participantIds.length === 2) {
    const matchCount = friendlyTarget || 1;
    for (let i = 0; i < matchCount; i++) {
      matches.push({
        competition_id: competitionId,
        home_player_id: participantIds[0],
        away_player_id: participantIds[1],
        status: 'scheduled',
        scheduled_time: scheduledTime,
      });
    }
  } else if (type === 'tournament' && tournamentType === 'knockout') {
    const stage = getInitialStage(participantIds.length);
    let matchOrder = 1;
    
    for (let i = 0; i < participantIds.length; i += 2) {
      if (i + 1 < participantIds.length) {
        matches.push({
          competition_id: competitionId,
          home_player_id: participantIds[i],
          away_player_id: participantIds[i + 1],
          status: 'scheduled',
          scheduled_time: scheduledTime,
          stage: stage,
          match_order: matchOrder,
        });
        matchOrder++;
      }
    }
  }

  return matches;
}

export const getGroupCompetitionsProcedure = protectedProcedure
  .input(
    z.object({
      groupId: z.string(),
    })
  )
  .query(async ({ input, ctx }) => {
    const userId = ctx.user?.id;
    if (!userId) {
      throw new Error('User not authenticated');
    }

    const { data: player } = await supabaseAdmin
      .from('players')
      .select('id')
      .eq('auth_user_id', userId)
      .single();

    if (!player) {
      throw new Error('Player not found');
    }

    const { data: membership } = await supabaseAdmin
      .from('group_members')
      .select('id')
      .eq('group_id', input.groupId)
      .eq('player_id', player.id)
      .single();

    if (!membership) {
      throw new Error('You are not a member of this group');
    }

    const { data: competitions, error } = await supabaseAdmin
      .from('competitions')
      .select('*')
      .eq('group_id', input.groupId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching competitions:', error);
      throw new Error('Failed to fetch competitions');
    }

    return competitions || [];
  });
