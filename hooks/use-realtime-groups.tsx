import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { Group, Player } from '@/types/game';

export function useRealtimeGroups(userId: string | undefined) {
  const [groups, setGroups] = useState<Group[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!userId) {
      setGroups([]);
      setIsLoading(false);
      return;
    }

    let mounted = true;

    const fetchGroups = async () => {
      try {
        setIsLoading(true);
        setError(null);

        const { data: player } = await supabase
          .from('players')
          .select('id')
          .eq('auth_user_id', userId)
          .single();

        if (!player || !mounted) {
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

        if (!mounted) return;

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

        if (mounted) {
          setGroups(groupsData);
          setIsLoading(false);
        }
      } catch (err: any) {
        console.error('Error in fetchGroups:', err);
        if (mounted) {
          setError(err.message);
          setIsLoading(false);
        }
      }
    };

    fetchGroups();

    const groupMembersChannel = supabase
      .channel('group_members_changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'group_members',
        },
        () => {
          console.log('Group members changed, refetching...');
          fetchGroups();
        }
      )
      .subscribe();

    const groupsChannel = supabase
      .channel('groups_changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'groups',
        },
        () => {
          console.log('Groups changed, refetching...');
          fetchGroups();
        }
      )
      .subscribe();

    const competitionsChannel = supabase
      .channel('competitions_changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'competitions',
        },
        () => {
          console.log('Competitions changed, refetching...');
          fetchGroups();
        }
      )
      .subscribe();

    return () => {
      mounted = false;
      supabase.removeChannel(groupMembersChannel);
      supabase.removeChannel(groupsChannel);
      supabase.removeChannel(competitionsChannel);
    };
  }, [userId]);

  return { groups, isLoading, error, refetch: () => {} };
}
