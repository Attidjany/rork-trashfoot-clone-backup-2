import { z } from "zod";
import { protectedProcedure } from "../../../create-context";
import { supabaseAdmin } from "../../../../lib/supabase-server";

export const restoreMatchProcedure = protectedProcedure
  .input(
    z.object({
      matchId: z.string().uuid(),
    })
  )
  .mutation(async ({ input, ctx }) => {
    try {
      console.log("♻️ Restoring match:", input.matchId);

      if (!ctx.user) {
        throw new Error("Not authenticated");
      }

      const supabase = supabaseAdmin;

      const { data: player } = await supabase
        .from("players")
        .select("id, role")
        .eq("auth_user_id", ctx.user.id)
        .single();

      if (!player) {
        throw new Error("Player not found");
      }

      if (player.role !== 'super_admin') {
        throw new Error("Only superadmins can restore matches");
      }

      // Check if match is soft-deleted and within 7 days
      const { data: match, error: matchError } = await supabase
        .from("matches")
        .select("id, deleted_at, status")
        .eq("id", input.matchId)
        .single();

      if (matchError || !match) {
        console.error("❌ Match not found:", matchError);
        throw new Error("Match not found");
      }

      if (!match.deleted_at || match.status !== 'deleted') {
        throw new Error("Match is not deleted");
      }

      const deletedAt = new Date(match.deleted_at);
      const daysSinceDeleted = (Date.now() - deletedAt.getTime()) / (1000 * 60 * 60 * 24);
      
      if (daysSinceDeleted > 7) {
        throw new Error("Match was deleted more than 7 days ago and cannot be restored");
      }

      // Restore the match
      const { error: restoreError } = await supabase
        .from("matches")
        .update({ 
          status: 'scheduled',
          deleted_at: null,
          updated_at: new Date().toISOString()
        })
        .eq("id", input.matchId);

      if (restoreError) {
        console.error("❌ Error restoring match:", restoreError);
        throw new Error("Failed to restore match");
      }

      console.log("✅ Match restored successfully");

      return {
        success: true,
      };
    } catch (error: any) {
      console.error("❌ Error in restoreMatch:", error);
      throw new Error(error?.message || "Failed to restore match");
    }
  });
