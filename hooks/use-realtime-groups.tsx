import { useEffect, useState, useCallback } from 'react';
import { Group, Player, Match, PlayerStats } from '@/types/game';
import { supabase } from '@/lib/supabase';
import { RealtimeChannel } from '@supabase/supabase-js';

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

export function useRealtimeGroups(userId: string | undefined) {
  const [groups, setGroups] = useState<Group[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchGroups = useCallback(async () => {
    if (!userId) {
      setGroups([]);
      setIsLoading(false);
      return;
    }

    try {
      setError(null);
      console.log('🔄 Fetching groups data...');
      const startTime = Date.now();

      const { data: player } = await supabase
        .from('players')
        .select('id')
        .eq('auth_user_id', userId)
        .single();

      if (!player) {
        setGroups([]);
        setIsLoading(false);
        return;
      }

      const { data: groupMembers, error: groupError } = await supabase
        .from('group_members')
        .select(`
          group_id,
          is_admin,
          groups (
            id,
            name,
            description,
            invite_code,
            admin_id,
            is_public,
            created_at
          )
        `)
        .eq('player_id', player.id);

      if (groupError) {
        console.error('Error fetching groups:', groupError);
        setError(groupError.message);
        setIsLoading(false);
        return;
      }

      if (!groupMembers || groupMembers.length === 0) {
        setGroups([]);
        setIsLoading(false);
        return;
      }

      const groupIds = groupMembers.map((gm: any) => gm.groups.id);

      const [allMembersData, allCompetitionsData] = await Promise.all([
        supabase
          .from('group_members')
          .select(`
            group_id,
            player_id,
            is_admin,
            players (
              id,
              name,
              gamer_handle,
              email,
              role,
              status,
              joined_at
            )
          `)
          .in('group_id', groupIds),
        
        supabase
          .from('competitions')
          .select('*')
          .in('group_id', groupIds),
      ]);

      const competitionIds = (allCompetitionsData.data || []).map((c: any) => c.id);

      const [allMatchesData, allParticipantsData] = competitionIds.length > 0 ? await Promise.all([
        supabase
          .from('matches')
          .select('*')
          .in('competition_id', competitionIds),
        
        supabase
          .from('competition_participants')
          .select('competition_id, player_id')
          .in('competition_id', competitionIds),
      ]) : [{ data: [] }, { data: [] }];

      const membersByGroup = new Map<string, any[]>();
      (allMembersData.data || []).forEach((m: any) => {
        if (!membersByGroup.has(m.group_id)) {
          membersByGroup.set(m.group_id, []);
        }
        membersByGroup.get(m.group_id)!.push(m);
      });

      const competitionsByGroup = new Map<string, any[]>();
      (allCompetitionsData.data || []).forEach((c: any) => {
        if (!competitionsByGroup.has(c.group_id)) {
          competitionsByGroup.set(c.group_id, []);
        }
        competitionsByGroup.get(c.group_id)!.push(c);
      });

      const matchesByCompetition = new Map<string, any[]>();
      (allMatchesData.data || []).forEach((m: any) => {
        if (!matchesByCompetition.has(m.competition_id)) {
          matchesByCompetition.set(m.competition_id, []);
        }
        matchesByCompetition.get(m.competition_id)!.push(m);
      });

      const participantsByCompetition = new Map<string, string[]>();
      (allParticipantsData.data || []).forEach((p: any) => {
        if (!participantsByCompetition.has(p.competition_id)) {
          participantsByCompetition.set(p.competition_id, []);
        }
        participantsByCompetition.get(p.competition_id)!.push(p.player_id);
      });

      const groupsData: Group[] = groupMembers.map((gm: any) => {
        const groupId = gm.groups.id;
        const members = membersByGroup.get(groupId) || [];
        const competitions = competitionsByGroup.get(groupId) || [];

        const competitionsWithMatches = competitions.map((comp: any) => {
          const matches = (matchesByCompetition.get(comp.id) || []).map((m: any) => ({
            id: m.id,
            competitionId: m.competition_id,
            homePlayerId: m.home_player_id,
            awayPlayerId: m.away_player_id,
            homeScore: m.home_score,
            awayScore: m.away_score,
            status: m.status,
            scheduledTime: m.scheduled_time,
            completedAt: m.completed_at,
            youtubeLink: m.youtube_link,
          }));

          return {
            id: comp.id,
            groupId: comp.group_id,
            name: comp.name,
            type: comp.type,
            status: comp.status,
            startDate: comp.start_date,
            endDate: comp.end_date,
            tournamentType: comp.tournament_type,
            leagueFormat: comp.league_format,
            friendlyType: comp.friendly_type,
            friendlyTarget: comp.friendly_target,
            knockoutMinPlayers: comp.knockout_min_players,
            matches,
            participants: participantsByCompetition.get(comp.id) || [],
          };
        });

        const allMatches = competitionsWithMatches.flatMap(c => c.matches);
        
        const membersList: Player[] = members.map((m: any) => ({
          id: m.players.id,
          name: m.players.name,
          gamerHandle: m.players.gamer_handle,
          email: m.players.email,
          role: m.players.role,
          status: m.players.status,
          joinedAt: m.players.joined_at,
          stats: calculatePlayerStats(m.players.id, allMatches),
        }));

        return {
          id: gm.groups.id,
          name: gm.groups.name,
          description: gm.groups.description || '',
          adminId: gm.groups.admin_id,
          adminIds: [gm.groups.admin_id],
          members: membersList,
          createdAt: gm.groups.created_at,
          competitions: competitionsWithMatches,
          inviteCode: gm.groups.invite_code,
          isPublic: gm.groups.is_public,
          pendingMembers: [],
        };
      });

      const endTime = Date.now();
      console.log(`✅ Groups data fetched in ${endTime - startTime}ms (${groupsData.length} groups, ${competitionIds.length} competitions, ${allMatchesData.data?.length || 0} matches)`);
      setGroups(groupsData);
      setIsLoading(false);
    } catch (err: any) {
      console.error('Error in fetchGroups:', err);
      setError(err.message);
      setIsLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    fetchGroups();

    if (!userId) return;

    const channels: RealtimeChannel[] = [];

    const matchesChannel = supabase
      .channel('matches-changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'matches' },
        (payload) => {
          console.log('🔄 Match change detected:', payload);
          fetchGroups();
        }
      )
      .subscribe();

    const competitionsChannel = supabase
      .channel('competitions-changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'competitions' },
        (payload) => {
          console.log('🔄 Competition change detected:', payload);
          fetchGroups();
        }
      )
      .subscribe();

    const groupsChannel = supabase
      .channel('groups-changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'groups' },
        (payload) => {
          console.log('🔄 Group change detected:', payload);
          fetchGroups();
        }
      )
      .subscribe();

    const groupMembersChannel = supabase
      .channel('group-members-changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'group_members' },
        (payload) => {
          console.log('🔄 Group member change detected:', payload);
          fetchGroups();
        }
      )
      .subscribe();

    const playersChannel = supabase
      .channel('players-changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'players' },
        (payload) => {
          console.log('🔄 Player change detected:', payload);
          fetchGroups();
        }
      )
      .subscribe();

    channels.push(matchesChannel, competitionsChannel, groupsChannel, groupMembersChannel, playersChannel);

    return () => {
      console.log('🔌 Unsubscribing from real-time channels');
      channels.forEach(channel => {
        supabase.removeChannel(channel);
      });
    };
  }, [fetchGroups, userId]);

  return { groups, isLoading, error, refetch: fetchGroups };
}
