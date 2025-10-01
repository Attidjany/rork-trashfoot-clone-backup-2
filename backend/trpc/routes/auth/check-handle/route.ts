import { z } from "zod";
import { publicProcedure } from "@/backend/trpc/create-context";

export const checkGamerHandleProcedure = publicProcedure
  .input(
    z.object({
      gamerHandle: z.string().min(3).max(20),
    })
  )
  .query(async ({ input }) => {
    // In a real app, check database for existing gamer handle
    // For demo, simulate some taken handles
    const takenHandles = ['striker_alex', 'goal_machine', 'football_king', 'super_admin'];
    
    const isAvailable = !takenHandles.includes(input.gamerHandle.toLowerCase());
    
    return {
      available: isAvailable,
      suggestions: isAvailable ? [] : [
        `${input.gamerHandle}1`,
        `${input.gamerHandle}_pro`,
        `${input.gamerHandle}2024`,
      ],
    };
  });