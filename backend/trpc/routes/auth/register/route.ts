import { z } from "zod";
import { publicProcedure } from "../../../create-context";
import { supabaseAdmin } from "../../../../lib/supabase-server";

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
        email,
        role: 'player',
        status: 'active',
      })
      .select()
      .single();
    
    if (playerError || !player) {
      console.error('Player creation error:', playerError);
      try {
        await supabaseAdmin.auth.admin.deleteUser(authData.user.id);
      } catch (deleteError) {
        console.error('Failed to delete auth user after player creation error:', deleteError);
      }
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
    
    const requiresEmailConfirmation = !authData.session;
    
    console.log('=== REGISTRATION SUCCESS ===');
    console.log('User email:', player.email);
    console.log('Requires email confirmation:', requiresEmailConfirmation);
    
    return {
      playerId: player.id,
      email: player.email,
      requiresEmailConfirmation,
      message: requiresEmailConfirmation 
        ? "Account created! Please check your email to confirm your account."
        : "Account created successfully! Please complete your profile.",
    };
  });
