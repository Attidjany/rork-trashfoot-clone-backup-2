import { z } from "zod";
import { publicProcedure } from "../../../create-context";
import { supabaseAdmin } from "../../../../lib/supabase-server";

export const correctMatchScoreProcedure = publicProcedure
  .input(
    z.object({
      matchId: z.string().uuid(),
      homeScore: z.number().int().min(0),
      awayScore: z.number().int().min(0),
    })
  )
  .mutation(async ({ input, ctx }) => {
    try {
      console.log("🔄 Correcting match score:", input);

      const supabase = supabaseAdmin;
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError || !user) {
        throw new Error("Not authenticated");
      }

      const { data: player } = await supabase
        .from("players")
        .select("id")
        .eq("auth_user_id", user.id)
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
        throw new Error("Match not found");
      }

      const groupAdminId = (match.competitions as any).groups.admin_id;
      if (groupAdminId !== player.id) {
        throw new Error("Only group admins can correct match scores");
      }

      const { data: updatedMatch, error: updateError } = await supabase
        .from("matches")
        .update({
          home_score: input.homeScore,
          away_score: input.awayScore,
        })
        .eq("id", input.matchId)
        .select()
        .single();

      if (updateError || !updatedMatch) {
        console.error("❌ Error correcting match score:", updateError);
        throw new Error("Failed to correct match score");
      }

      console.log("✅ Match score corrected successfully");

      return {
        success: true,
        match: {
          id: updatedMatch.id,
          competitionId: updatedMatch.competition_id,
          homePlayerId: updatedMatch.home_player_id,
          awayPlayerId: updatedMatch.away_player_id,
          homeScore: updatedMatch.home_score,
          awayScore: updatedMatch.away_score,
          status: updatedMatch.status,
          scheduledTime: updatedMatch.scheduled_time,
          youtubeLink: updatedMatch.youtube_link,
          completedAt: updatedMatch.completed_at,
        },
      };
    } catch (error: any) {
      console.error("❌ Error in correctMatchScore:", error);
      throw new Error(error?.message || "Failed to correct match score");
    }
  });
