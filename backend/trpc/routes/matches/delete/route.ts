import { z } from "zod";
import { protectedProcedure } from "../../../create-context";
import { supabaseAdmin } from "../../../../lib/supabase-server";

export const deleteMatchProcedure = protectedProcedure
  .input(
    z.object({
      matchId: z.string().uuid(),
    })
  )
  .mutation(async ({ input, ctx }) => {
    try {
      console.log("🗑️ Deleting match:", input.matchId);

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

      const { data: match, error: matchError } = await supabase
        .from("matches")
        .select("*, competitions!inner(group_id, groups!inner(admin_id))")
        .eq("id", input.matchId)
        .single();

      if (matchError || !match) {
        console.error("❌ Match not found:", matchError);
        throw new Error("Match not found");
      }

      const isSuperAdmin = player.role === 'super_admin';
      const groupAdminId = (match.competitions as any).groups.admin_id;
      const isGroupAdmin = groupAdminId === player.id;

      if (!isSuperAdmin && !isGroupAdmin) {
        throw new Error("Only group admins and superadmins can delete matches");
      }

      const { error: deleteError } = await supabase
        .from("matches")
        .delete()
        .eq("id", input.matchId);

      if (deleteError) {
        console.error("❌ Error deleting match:", deleteError);
        throw new Error("Failed to delete match");
      }

      console.log("✅ Match deleted successfully");

      return {
        success: true,
      };
    } catch (error: any) {
      console.error("❌ Error in deleteMatch:", error);
      throw new Error(error?.message || "Failed to delete match");
    }
  });
