import { z } from "zod";
import { publicProcedure } from "@/backend/trpc/create-context";

// Import shared storage
import { userDataStorage } from "@/backend/trpc/shared/storage";

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
    console.log('Saving user data for:', input.email);
    console.log('Data includes:', {
      user: input.gameData.currentUser?.name,
      groupsCount: input.gameData.groups?.length || 0,
      activeGroupId: input.gameData.activeGroupId,
      messagesCount: input.gameData.messages?.length || 0,
    });
    
    // Ensure we're saving complete data
    const dataToSave = {
      user: input.gameData.currentUser,
      gameData: {
        currentUser: input.gameData.currentUser,
        groups: input.gameData.groups || [],
        activeGroupId: input.gameData.activeGroupId || '',
        messages: input.gameData.messages || [],
      },
      lastUpdated: new Date().toISOString(),
    };
    
    userDataStorage.set(input.email, dataToSave);
    console.log('Successfully saved data for:', input.email);
    console.log('Data summary:', {
      groupsCount: dataToSave.gameData.groups.length,
      messagesCount: dataToSave.gameData.messages.length,
      activeGroupId: dataToSave.gameData.activeGroupId,
      lastUpdated: dataToSave.lastUpdated
    });
    console.log('Storage now has keys:', Array.from(userDataStorage.keys()));
    
    return {
      success: true,
      message: "User data saved successfully",
    };
  });