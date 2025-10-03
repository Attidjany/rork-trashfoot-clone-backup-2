import { z } from "zod";
import { protectedProcedure } from "../../../create-context";
import { supabaseAdmin } from "../../../../lib/supabase-server";

export const updateMatchResultProcedure = protectedProcedure
  .input(
    z.object({
      matchId: z.string().uuid(),
      homeScore: z.number().int().min(0),
      awayScore: z.number().int().min(0),
    })
  )
  .mutation(async ({ input, ctx }) => {
    try {
      console.log("🔄 Updating match result:", input);

      if (!ctx.user) {
        throw new Error("Not authenticated");
      }

      const supabase = supabaseAdmin;

      const { data: match, error: matchError } = await supabase
        .from("matches")
        .select("*")
        .eq("id", input.matchId)
        .single();

      if (matchError || !match) {
        console.error("❌ Match not found:", matchError);
        throw new Error("Match not found");
      }

      const { data: updatedMatch, error: updateError } = await supabase
        .from("matches")
        .update({
          home_score: input.homeScore,
          away_score: input.awayScore,
          status: "completed",
          completed_at: new Date().toISOString(),
        })
        .eq("id", input.matchId)
        .select()
        .single();

      if (updateError) {
        console.error("❌ Error updating match:", updateError);
        throw new Error(updateError.message || "Failed to update match result");
      }

      if (!updatedMatch) {
        throw new Error("Failed to update match result");
      }

      console.log("✅ Match result updated successfully");

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
      console.error("❌ Error in updateMatchResult:", error);
      throw new Error(error?.message || "Failed to update match result");
    }
  });
