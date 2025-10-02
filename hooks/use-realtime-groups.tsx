import { useEffect, useState, useCallback } from 'react';
import { Group, Player } from '@/types/game';
import { supabase } from '@/lib/supabase';

const POLLING_INTERVAL = 5000;

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

      const groupsData: Group[] = await Promise.all(
        (groupMembers || []).map(async (gm: any) => {
          const groupId = gm.groups.id;

          const { data: members } = await supabase
            .from('group_members')
            .select(`
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
            .eq('group_id', groupId);

          const { data: competitions } = await supabase
            .from('competitions')
            .select('*')
            .eq('group_id', groupId);

          const membersList: Player[] = (members || []).map((m: any) => ({
            id: m.players.id,
            name: m.players.name,
            gamerHandle: m.players.gamer_handle,
            email: m.players.email,
            role: m.players.role,
            status: m.players.status,
            joinedAt: m.players.joined_at,
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
          }));

          return {
            id: gm.groups.id,
            name: gm.groups.name,
            description: gm.groups.description || '',
            adminId: gm.groups.admin_id,
            adminIds: [gm.groups.admin_id],
            members: membersList,
            createdAt: gm.groups.created_at,
            competitions: competitions || [],
            inviteCode: gm.groups.invite_code,
            isPublic: gm.groups.is_public,
            pendingMembers: [],
          };
        })
      );

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

    const interval = setInterval(() => {
      console.log('Polling for group updates...');
      fetchGroups();
    }, POLLING_INTERVAL);

    return () => {
      clearInterval(interval);
    };
  }, [fetchGroups]);

  return { groups, isLoading, error, refetch: fetchGroups };
}
