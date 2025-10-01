import { z } from "zod";
import { publicProcedure } from "@/backend/trpc/create-context";
import { supabaseAdmin } from "@/backend/lib/supabase-server";
import { Player } from "@/types/game";

export const registerProcedure = publicProcedure
  .input(
    z.object({
      name: z.string().min(2, "Name must be at least 2 characters"),
      gamerHandle: z.string().min(3, "Gamer handle must be at least 3 characters").max(20, "Gamer handle must be less than 20 characters"),
      email: z.string().email("Invalid email address").optional(),
      phone: z.string().optional(),
      password: z.string().min(6, "Password must be at least 6 characters"),
    }).refine(data => data.email || data.phone, {
      message: "Either email or phone is required",
    })
  )
  .mutation(async ({ input }) => {
    try {
      console.log('=== REGISTER ATTEMPT ===');
      console.log('Name:', input.name);
      console.log('Gamer Handle:', input.gamerHandle);
      console.log('Email:', input.email);
      console.log('Phone:', input.phone);
      
      const name = input.name.trim();
      const gamerHandle = input.gamerHandle.trim();
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
      
      // Create auth user in Supabase
      let authData;
      let authError;
      
      if (input.email) {
        const email = input.email.trim();
        const result = await supabaseAdmin.auth.admin.createUser({
          email,
          password,
          email_confirm: true,
        });
        authData = result.data;
        authError = result.error;
      } else if (input.phone) {
        const phone = input.phone.trim();
        const result = await supabaseAdmin.auth.admin.createUser({
          phone,
          password,
          phone_confirm: true,
        });
        authData = result.data;
        authError = result.error;
      } else {
        throw new Error('Either email or phone is required');
      }
      
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
          email: input.email?.trim() || null,
          phone: input.phone?.trim() || null,
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
      
      // Sign in the user to get a session
      let sessionToken: string;
      
      if (input.email) {
        const email = input.email.trim();
        const result = await supabaseAdmin.auth.signInWithPassword({
          email,
          password,
        });
        
        if (result.error || !result.data.session) {
          console.error('Sign in error:', result.error);
          throw new Error('Account created but failed to sign in. Please try logging in.');
        }
        
        sessionToken = result.data.session.access_token;
      } else if (input.phone) {
        const phone = input.phone.trim();
        const result = await supabaseAdmin.auth.signInWithPassword({
          phone,
          password,
        });
        
        if (result.error || !result.data.session) {
          console.error('Sign in error:', result.error);
          throw new Error('Account created but failed to sign in. Please try logging in.');
        }
        
        sessionToken = result.data.session.access_token;
      } else {
        throw new Error('Either email or phone is required');
      }
      
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
      
      return {
        user,
        token: sessionToken,
        message: "Account created successfully!",
      };
    } catch (error) {
      console.error('Registration error:', error);
      const errorMessage = error instanceof Error ? error.message : 'Registration failed';
      console.error('Throwing error:', errorMessage);
      throw new Error(errorMessage);
    }
  });