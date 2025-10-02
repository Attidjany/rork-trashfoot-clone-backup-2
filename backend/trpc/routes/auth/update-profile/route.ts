import { z } from "zod";
import { protectedProcedure } from "../../../create-context";
import { supabaseAdmin } from "../../../../lib/supabase-server";

export const updateProfileProcedure = protectedProcedure
  .input(
    z.object({
      name: z.string().min(2, "Name must be at least 2 characters"),
      gamerHandle: z.string().min(3, "Gamer handle must be at least 3 characters").max(20, "Gamer handle must be less than 20 characters"),
    })
  )
  .mutation(async ({ input, ctx }) => {
    const userId = ctx.user?.id;
    if (!userId) {
      throw new Error('User not authenticated');
    }
    
    console.log('=== UPDATE PROFILE ATTEMPT ===');
    console.log('User ID:', userId);
    console.log('Name:', input.name);
    console.log('Gamer Handle:', input.gamerHandle);
    
    const name = input.name.trim();
    const gamerHandle = input.gamerHandle.trim();
    
    if (!name || !gamerHandle) {
      throw new Error('Name and gamer handle are required');
    }
    
    const { data: player } = await supabaseAdmin
      .from('players')
      .select('id')
      .eq('auth_user_id', userId)
      .single();
    
    if (!player) {
      throw new Error('Player not found');
    }
    
    const { data: existingHandle, error: checkError } = await supabaseAdmin
      .from('players')
      .select('id')
      .eq('gamer_handle', gamerHandle)
      .neq('id', player.id)
      .maybeSingle();
    
    if (checkError) {
      console.error('Error checking handle:', checkError);
    }
    
    if (existingHandle) {
      console.log('Handle already taken by player:', existingHandle.id);
      throw new Error('This gamer handle is already taken. Please choose another one.');
    }
    
    console.log('Updating player with name:', name, 'and handle:', gamerHandle);
    
    const { data: updatedPlayer, error: playerError } = await supabaseAdmin
      .from('players')
      .update({
        name,
        gamer_handle: gamerHandle,
      })
      .eq('id', player.id)
      .select()
      .single();
    
    if (playerError) {
      console.error('Player update error:', playerError);
      console.error('Error details:', JSON.stringify(playerError, null, 2));
      throw new Error(`Failed to update profile: ${playerError.message}`);
    }
    
    if (!updatedPlayer) {
      console.error('No player returned after update');
      throw new Error('Failed to update profile: No data returned');
    }
    
    console.log('=== PROFILE UPDATE SUCCESS ===');
    console.log('Updated player ID:', updatedPlayer.id);
    console.log('Updated player name:', updatedPlayer.name);
    console.log('Updated player handle:', updatedPlayer.gamer_handle);
    console.log('Updated player email:', updatedPlayer.email);
    console.log('Full updated player object:', JSON.stringify(updatedPlayer, null, 2));
    
    if (!updatedPlayer.name || !updatedPlayer.gamer_handle) {
      console.error('WARNING: Player data missing after update!');
      console.error('Player object:', JSON.stringify(updatedPlayer, null, 2));
      throw new Error('Profile update succeeded but data is incomplete');
    }
    
    return {
      success: true,
      player: {
        id: updatedPlayer.id,
        name: updatedPlayer.name,
        gamerHandle: updatedPlayer.gamer_handle,
        email: updatedPlayer.email,
      },
    };
  });
