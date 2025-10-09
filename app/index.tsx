import React, { useEffect, useRef } from 'react';
import { View, ActivityIndicator, StyleSheet, Text } from 'react-native';
import { useRouter } from 'expo-router';
import { useSession } from '@/hooks/use-session';
import { supabase } from '@/lib/supabase';

import { useGameStore } from '@/hooks/use-game-store';

export default function Index() {
  const router = useRouter();
  const { user, loading } = useSession();
  const { setLoggedInUser } = useGameStore();
  const hasRedirected = useRef(false);
  


  useEffect(() => {
    if (loading) {
      return;
    }
    
    if (!user) {
      hasRedirected.current = false;
    }
    
    if (hasRedirected.current) {
      return;
    }
    
    console.log('=== INDEX ROUTE CHECK ===');
    console.log('loading:', loading);
    console.log('user:', user ? `${user.email}` : 'null');
    
    async function checkAndRedirect() {
      if (!user) {
        console.log('Index: No user found, redirecting to auth');
        hasRedirected.current = true;
        router.replace('/auth');
        return;
      }

      const { data: playerData, error: playerError } = await supabase
        .from('players')
        .select('*')
        .eq('auth_user_id', user.id)
        .maybeSingle();

      if (playerError) {
        console.error('Index: Error fetching player:', playerError);
        hasRedirected.current = true;
        router.replace('/auth');
        return;
      }

      if (!playerData) {
        console.log('Index: Player profile not found, redirecting to auth');
        hasRedirected.current = true;
        router.replace('/auth');
        return;
      }

      console.log('Index: User authenticated, loading game data...');
      
      const { data: globalStats } = await supabase
        .from('player_stats')
        .select('*')
        .eq('player_id', playerData.id)
        .is('group_id', null)
        .maybeSingle();

      const player = {
        id: playerData.id,
        name: playerData.name || user.email?.split('@')[0] || 'Player',
        gamerHandle: playerData.gamer_handle || user.email?.split('@')[0] || 'player',
        email: playerData.email,
        role: playerData.role as 'player' | 'admin' | 'super_admin',
        status: playerData.status as 'active' | 'suspended' | 'banned',
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

      console.log('Index: Setting logged in user and redirecting to home');
      setLoggedInUser(player);
      hasRedirected.current = true;
      router.replace('/(tabs)/home');
    }

    checkAndRedirect();
  }, [user, loading, router, setLoggedInUser]);

  console.log('Index render - loading:', loading, 'user:', !!user);

  return (
    <View style={styles.container}>
      <ActivityIndicator size="large" color="#0EA5E9" />
      <Text style={styles.loadingText}>
        {loading ? 'Loading...' : 'Redirecting...'}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#0F172A',
  },
  loadingText: {
    color: '#64748B',
    marginTop: 16,
    fontSize: 16,
  },
});
