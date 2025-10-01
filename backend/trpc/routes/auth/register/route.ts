import { z } from "zod";
import { publicProcedure } from "@/backend/trpc/create-context";
import { supabaseAdmin } from "@/backend/lib/supabase-server";
import { Player } from "@/types/game";

export const registerProcedure = publicProcedure
  .input(
    z.object({
      name: z.string().min(2, "Name must be at least 2 characters"),
      gamerHandle: z.string().min(3, "Gamer handle must be at least 3 characters").max(20, "Gamer handle must be less than 20 characters"),
      email: z.string().email("Invalid email address"),
      password: z.string().min(6, "Password must be at least 6 characters"),
    })
  )
  .mutation(async ({ input }) => {
    try {
      console.log('=== REGISTER ATTEMPT ===');
      console.log('Name:', input.name);
      console.log('Gamer Handle:', input.gamerHandle);
      console.log('Email:', input.email);
      
      const name = input.name.trim();
      const gamerHandle = input.gamerHandle.trim();
      const email = input.email.trim();
      const password = input.password.trim();
      
      // Check if gamer handle is already taken
      const { data: existingHandle } = await supabaseAdmin
        .from('players')
        .select('id')
        .eq('gamer_handle', gamerHandle)
        .single();
      
      if (existingHandle) {
        throw new Error('This gamer handle is already taken. Please choose another one.');
      }
      
      const { data: authData, error: authError } = await supabaseAdmin.auth.signUp({
        email,
        password,
        options: {
          data: {
            name,
            gamer_handle: gamerHandle,
          },
          emailRedirectTo: 'https://trashfoot.vercel.app/auth',
        },
      });
      
      if (authError || !authData.user) {
        console.error('Auth error:', authError);
        throw new Error(authError?.message || 'Failed to create account');
      }
      
      console.log('Auth user created:', authData.user.id);
      
      // Create player profile
      const { data: player, error: playerError } = await supabaseAdmin
        .from('players')
        .insert({
          auth_user_id: authData.user.id,
          name,
          gamer_handle: gamerHandle,
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
      
      // Create initial global stats
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
        name: player.name,
        gamerHandle: player.gamer_handle,
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
    } catch (error) {
      console.error('Registration error:', error);
      const errorMessage = error instanceof Error ? error.message : 'Registration failed';
      console.error('Throwing error:', errorMessage);
      throw new Error(errorMessage);
    }
  });