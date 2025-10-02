import { z } from "zod";
import { publicProcedure } from "../../../create-context";
import { supabaseAdmin } from "../../../../lib/supabase-server";

export const updateProfileProcedure = publicProcedure
  .input(
    z.object({
      userId: z.string(),
      name: z.string().min(2, "Name must be at least 2 characters"),
      gamerHandle: z.string().min(3, "Gamer handle must be at least 3 characters").max(20, "Gamer handle must be less than 20 characters"),
    })
  )
  .mutation(async ({ input }) => {
    console.log('=== UPDATE PROFILE ATTEMPT ===');
    console.log('User ID:', input.userId);
    console.log('Name:', input.name);
    console.log('Gamer Handle:', input.gamerHandle);
    
    const name = input.name.trim();
    const gamerHandle = input.gamerHandle.trim();
    
    if (!name || !gamerHandle) {
      throw new Error('Name and gamer handle are required');
    }
    
    const { data: existingHandle, error: checkError } = await supabaseAdmin
      .from('players')
      .select('id')
      .eq('gamer_handle', gamerHandle)
      .neq('id', input.userId)
      .maybeSingle();
    
    if (checkError) {
      console.error('Error checking handle:', checkError);
    }
    
    if (existingHandle) {
      console.log('Handle already taken by player:', existingHandle.id);
      throw new Error('This gamer handle is already taken. Please choose another one.');
    }
    
    console.log('Updating player with name:', name, 'and handle:', gamerHandle);
    
    const { data: player, error: playerError } = await supabaseAdmin
      .from('players')
      .update({
        name,
        gamer_handle: gamerHandle,
      })
      .eq('id', input.userId)
      .select()
      .single();
    
    if (playerError) {
      console.error('Player update error:', playerError);
      console.error('Error details:', JSON.stringify(playerError, null, 2));
      throw new Error(`Failed to update profile: ${playerError.message}`);
    }
    
    if (!player) {
      console.error('No player returned after update');
      throw new Error('Failed to update profile: No data returned');
    }
    
    console.log('=== PROFILE UPDATE SUCCESS ===');
    console.log('Updated player ID:', player.id);
    console.log('Updated player name:', player.name);
    console.log('Updated player handle:', player.gamer_handle);
    console.log('Updated player email:', player.email);
    
    if (!player.name || !player.gamer_handle) {
      console.error('WARNING: Player data missing after update!');
      console.error('Player object:', JSON.stringify(player, null, 2));
    }
    
    return {
      success: true,
      player: {
        id: player.id,
        name: player.name,
        gamerHandle: player.gamer_handle,
        email: player.email,
      },
    };
  });
