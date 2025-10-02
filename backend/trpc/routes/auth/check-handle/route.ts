import { z } from "zod";
import { publicProcedure } from "../../../create-context";
import { supabaseAdmin } from "../../../../lib/supabase-server";

export const checkGamerHandleProcedure = publicProcedure
  .input(
    z.object({
      gamerHandle: z.string().min(3).max(20),
    })
  )
  .mutation(async ({ input }) => {
    try {
      const gamerHandle = input.gamerHandle.trim();
      
      const { data: existingHandle } = await supabaseAdmin
        .from('players')
        .select('id')
        .eq('gamer_handle', gamerHandle)
        .single();
      
      const isAvailable = !existingHandle;
      
      return {
        available: isAvailable,
        suggestions: isAvailable ? [] : [
          `${gamerHandle}1`,
          `${gamerHandle}_pro`,
          `${gamerHandle}${new Date().getFullYear()}`,
        ],
      };
    } catch (error) {
      console.error('Error checking gamer handle:', error);
      return {
        available: true,
        suggestions: [],
      };
    }
  });
