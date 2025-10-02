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
    
    const { data: existingHandle } = await supabaseAdmin
      .from('players')
      .select('id')
      .eq('gamer_handle', gamerHandle)
      .neq('id', input.userId)
      .single();
    
    if (existingHandle) {
      throw new Error('This gamer handle is already taken. Please choose another one.');
    }
    
    const { data: player, error: playerError } = await supabaseAdmin
      .from('players')
      .update({
        name,
        gamer_handle: gamerHandle,
      })
      .eq('id', input.userId)
      .select()
      .single();
    
    if (playerError || !player) {
      console.error('Player update error:', playerError);
      throw new Error('Failed to update profile');
    }
    
    console.log('=== PROFILE UPDATE SUCCESS ===');
    console.log('Updated player:', player.name, '(' + player.gamer_handle + ')');
    
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
