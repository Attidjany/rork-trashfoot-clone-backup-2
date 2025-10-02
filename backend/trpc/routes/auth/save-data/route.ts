import { z } from "zod";
import { publicProcedure } from "../../../create-context";

export const saveUserDataProcedure = publicProcedure
  .input(
    z.object({
      email: z.string().email("Invalid email address"),
      gameData: z.object({
        currentUser: z.any(),
        groups: z.array(z.any()),
        activeGroupId: z.string(),
        messages: z.array(z.any()),
      }),
    })
  )
  .mutation(async ({ input }) => {
    console.log('Save user data called for:', input.email);
    console.log('Data includes:', {
      user: input.gameData.currentUser?.name,
      groupsCount: input.gameData.groups?.length || 0,
      activeGroupId: input.gameData.activeGroupId,
      messagesCount: input.gameData.messages?.length || 0,
    });
    
    return {
      success: true,
      message: "User data acknowledged (serverless - no persistent storage)",
    };
  });