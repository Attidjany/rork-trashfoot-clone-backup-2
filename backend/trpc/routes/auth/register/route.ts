import { z } from "zod";
import { publicProcedure } from "../../../create-context";
import { supabaseAdmin } from "../../../../lib/supabase-server";
import { Player } from "../../../../../types/game";

export const registerProcedure = publicProcedure
  .input(
    z.object({
      email: z.string().email("Invalid email address"),
      password: z.string().min(6, "Password must be at least 6 characters"),
    })
  )
  .mutation(async ({ input }) => {
    console.log('=== REGISTER ATTEMPT ===');
    console.log('Email:', input.email);
    
    const email = input.email.trim();
    const password = input.password.trim();
    
    const { data: authData, error: authError } = await supabaseAdmin.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: 'https://trashfoot.vercel.app/auth',
      },
    });
    
    if (authError || !authData.user) {
      console.error('Auth error:', authError);
      throw new Error(authError?.message || 'Failed to create account');
    }
    
    console.log('Auth user created:', authData.user.id);
    
    const { data: player, error: playerError } = await supabaseAdmin
      .from('players')
      .insert({
        auth_user_id: authData.user.id,
        name: null,
        gamer_handle: null,
        email,
        phone: null,
        role: 'player',
        status: 'active',
      })
      .select()
      .single();
    
    if (playerError || !player) {
      console.error('Player creation error:', playerError);
      await supabaseAdmin.auth.admin.deleteUser(authData.user.id);
      throw new Error('Failed to create player profile');
    }
    
    console.log('Player profile created:', player.id);
    
    const { error: statsError } = await supabaseAdmin
      .from('player_stats')
      .insert({
        player_id: player.id,
        group_id: null,
      });
    
    if (statsError) {
      console.error('Stats creation error:', statsError);
    }
    
    const requiresEmailConfirmation = true;
    
    const user: Player = {
      id: player.id,
      name: player.name || 'New Player',
      gamerHandle: player.gamer_handle || `player_${player.id.slice(0, 8)}`,
      email: player.email || '',
      phone: player.phone || undefined,
      role: player.role as 'player' | 'admin' | 'super_admin',
      status: player.status as 'active' | 'suspended' | 'banned',
      joinedAt: player.joined_at,
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
    };
    
    console.log('=== REGISTRATION SUCCESS ===');
    console.log('User:', user.name, '(' + user.email + ')');
    console.log('Requires email confirmation:', requiresEmailConfirmation);
    
    return {
      user,
      token: '',
      requiresEmailConfirmation,
      message: requiresEmailConfirmation 
        ? "Account created! Please check your email to confirm your account."
        : "Account created successfully!",
    };
  });