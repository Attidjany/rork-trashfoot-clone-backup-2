import { supabaseAdmin } from './supabase-server';

export async function calculateAndUpdatePlayerStats(playerId: string, groupId: string | null = null) {
  const { data: matches } = await supabaseAdmin
    .from('matches')
    .select('*, competitions!inner(group_id)')
    .eq('status', 'completed')
    .or(`home_player_id.eq.${playerId},away_player_id.eq.${playerId}`);
  
  if (!matches) return;
  
  const relevantMatches = groupId 
    ? matches.filter((m: any) => m.competitions.group_id === groupId)
    : matches;
  
  let wins = 0;
  let draws = 0;
  let losses = 0;
  let goalsFor = 0;
  let goalsAgainst = 0;
  let cleanSheets = 0;
  const form: ('W' | 'D' | 'L')[] = [];
  
  relevantMatches.forEach((match: any) => {
    const isHome = match.home_player_id === playerId;
    const playerScore = isHome ? match.home_score : match.away_score;
    const opponentScore = isHome ? match.away_score : match.home_score;
    
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
  
  const stats = {
    player_id: playerId,
    group_id: groupId,
    played,
    wins,
    draws,
    losses,
    goals_for: goalsFor,
    goals_against: goalsAgainst,
    clean_sheets: cleanSheets,
    points,
    win_rate: winRate,
    form: form.slice(0, 5),
  };
  
  const { error } = await supabaseAdmin
    .from('player_stats')
    .upsert(stats, {
      onConflict: 'player_id,group_id',
    });
  
  if (error) {
    console.error('Error updating player stats:', error);
  }
}

export async function createGroup(
  name: string,
  description: string,
  adminPlayerId: string,
  isPublic: boolean = false
): Promise<string | null> {
  const inviteCode = Math.random().toString(36).substr(2, 8).toUpperCase();
  
  const { data: group, error: groupError } = await supabaseAdmin
    .from('groups')
    .insert({
      name,
      description,
      admin_id: adminPlayerId,
      invite_code: inviteCode,
      is_public: isPublic,
    })
    .select()
    .single();
  
  if (groupError || !group) {
    console.error('Error creating group:', groupError);
    return null;
  }
  
  const { error: memberError } = await supabaseAdmin
    .from('group_members')
    .insert({
      group_id: group.id,
      player_id: adminPlayerId,
      is_admin: true,
    });
  
  if (memberError) {
    console.error('Error adding admin to group:', memberError);
    await supabaseAdmin.from('groups').delete().eq('id', group.id);
    return null;
  }
  
  const { error: statsError } = await supabaseAdmin
    .from('player_stats')
    .insert({
      player_id: adminPlayerId,
      group_id: group.id,
    });
  
  if (statsError) {
    console.error('Error creating group stats:', statsError);
  }
  
  return group.id;
}

export async function addPlayerToGroup(groupId: string, playerId: string, isAdmin: boolean = false) {
  const { error: memberError } = await supabaseAdmin
    .from('group_members')
    .insert({
      group_id: groupId,
      player_id: playerId,
      is_admin: isAdmin,
    });
  
  if (memberError) {
    console.error('Error adding player to group:', memberError);
    return false;
  }
  
  const { error: statsError } = await supabaseAdmin
    .from('player_stats')
    .insert({
      player_id: playerId,
      group_id: groupId,
    });
  
  if (statsError) {
    console.error('Error creating player group stats:', statsError);
  }
  
  return true;
}

export async function createCompetition(
  groupId: string,
  name: string,
  type: 'league' | 'tournament' | 'friendly',
  participantIds: string[],
  options?: {
    tournamentType?: 'knockout' | 'group_stage' | 'mixed';
    leagueFormat?: 'single' | 'double';
    friendlyType?: 'best_of' | 'first_to';
    friendlyTarget?: number;
    knockoutMinPlayers?: number;
    maxParticipants?: number;
    minParticipants?: number;
    teamRestrictions?: any;
    badge?: string;
  }
): Promise<string | null> {
  const { data: competition, error: compError } = await supabaseAdmin
    .from('competitions')
    .insert({
      group_id: groupId,
      name,
      type,
      status: 'upcoming',
      start_date: new Date().toISOString(),
      tournament_type: options?.tournamentType,
      league_format: options?.leagueFormat,
      friendly_type: options?.friendlyType,
      friendly_target: options?.friendlyTarget,
      knockout_min_players: options?.knockoutMinPlayers,
      max_participants: options?.maxParticipants,
      min_participants: options?.minParticipants,
      team_restrictions: options?.teamRestrictions,
      badge: options?.badge,
    })
    .select()
    .single();
  
  if (compError || !competition) {
    console.error('Error creating competition:', compError);
    return null;
  }
  
  const participantInserts = participantIds.map(playerId => ({
    competition_id: competition.id,
    player_id: playerId,
  }));
  
  const { error: participantError } = await supabaseAdmin
    .from('competition_participants')
    .insert(participantInserts);
  
  if (participantError) {
    console.error('Error adding participants:', participantError);
    await supabaseAdmin.from('competitions').delete().eq('id', competition.id);
    return null;
  }
  
  return competition.id;
}

export async function createMatch(
  competitionId: string,
  homePlayerId: string,
  awayPlayerId: string,
  scheduledTime: string
): Promise<string | null> {
  const { data: match, error } = await supabaseAdmin
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
  
  await supabaseAdmin
    .from('competitions')
    .update({ status: 'active' })
    .eq('id', competitionId);
  
  return match.id;
}

export async function updateMatchResult(
  matchId: string,
  homeScore: number,
  awayScore: number
): Promise<boolean> {
  const { data: match, error: matchError } = await supabaseAdmin
    .from('matches')
    .update({
      home_score: homeScore,
      away_score: awayScore,
      status: 'completed',
      completed_at: new Date().toISOString(),
    })
    .eq('id', matchId)
    .select('*, competitions!inner(group_id)')
    .single();
  
  if (matchError || !match) {
    console.error('Error updating match:', matchError);
    return false;
  }
  
  const groupId = (match as any).competitions.group_id;
  
  await calculateAndUpdatePlayerStats(match.home_player_id, groupId);
  await calculateAndUpdatePlayerStats(match.away_player_id, groupId);
  await calculateAndUpdatePlayerStats(match.home_player_id, null);
  await calculateAndUpdatePlayerStats(match.away_player_id, null);
  
  return true;
}

export async function sendChatMessage(
  groupId: string,
  senderId: string,
  senderName: string,
  message: string,
  type: 'text' | 'match_result' | 'youtube_link' = 'text',
  metadata?: any
): Promise<string | null> {
  const { data: chatMessage, error } = await supabaseAdmin
    .from('chat_messages')
    .insert({
      group_id: groupId,
      sender_id: senderId,
      sender_name: senderName,
      message,
      type,
      metadata,
      timestamp: new Date().toISOString(),
    })
    .select()
    .single();
  
  if (error || !chatMessage) {
    console.error('Error sending message:', error);
    return null;
  }
  
  return chatMessage.id;
}
