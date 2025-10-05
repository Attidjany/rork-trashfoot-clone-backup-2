import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { RealtimeChannel } from '@supabase/supabase-js';

export function useRealtimeSuperadmin() {
  const [lastUpdate, setLastUpdate] = useState(Date.now());

  const triggerRefetch = useCallback(() => {
    console.log('🔄 Superadmin data change detected, triggering refetch');
    setLastUpdate(Date.now());
  }, []);

  useEffect(() => {
    console.log('🔌 Setting up real-time subscriptions for superadmin');
    const channels: RealtimeChannel[] = [];

    const groupsChannel = supabase
      .channel('superadmin-groups')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'groups' },
        (payload) => {
          console.log('🔄 Group change detected:', payload.eventType);
          triggerRefetch();
        }
      )
      .subscribe((status) => {
        console.log('📡 Superadmin groups channel status:', status);
      });

    const playersChannel = supabase
      .channel('superadmin-players')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'players' },
        (payload) => {
          console.log('🔄 Player change detected:', payload.eventType);
          triggerRefetch();
        }
      )
      .subscribe((status) => {
        console.log('📡 Superadmin players channel status:', status);
      });

    const matchesChannel = supabase
      .channel('superadmin-matches')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'matches' },
        (payload) => {
          console.log('🔄 Match change detected:', payload.eventType);
          triggerRefetch();
        }
      )
      .subscribe((status) => {
        console.log('📡 Superadmin matches channel status:', status);
      });

    const competitionsChannel = supabase
      .channel('superadmin-competitions')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'competitions' },
        (payload) => {
          console.log('🔄 Competition change detected:', payload.eventType);
          triggerRefetch();
        }
      )
      .subscribe((status) => {
        console.log('📡 Superadmin competitions channel status:', status);
      });

    const groupMembersChannel = supabase
      .channel('superadmin-group-members')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'group_members' },
        (payload) => {
          console.log('🔄 Group member change detected:', payload.eventType);
          triggerRefetch();
        }
      )
      .subscribe((status) => {
        console.log('📡 Superadmin group members channel status:', status);
      });

    const pendingMembersChannel = supabase
      .channel('superadmin-pending-members')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'pending_group_members' },
        (payload) => {
          console.log('🔄 Pending member change detected:', payload.eventType);
          triggerRefetch();
        }
      )
      .subscribe((status) => {
        console.log('📡 Superadmin pending members channel status:', status);
      });

    channels.push(
      groupsChannel,
      playersChannel,
      matchesChannel,
      competitionsChannel,
      groupMembersChannel,
      pendingMembersChannel
    );

    return () => {
      console.log('🔌 Cleaning up superadmin real-time subscriptions');
      channels.forEach(channel => {
        supabase.removeChannel(channel);
      });
    };
  }, [triggerRefetch]);

  return { lastUpdate };
}
