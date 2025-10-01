import { z } from "zod";
import { publicProcedure } from "@/backend/trpc/create-context";
import { createRealAccount, isRealAccount, isDummyAccount } from "@/backend/trpc/shared/storage";
import { Player } from "@/types/game";

export const registerProcedure = publicProcedure
  .input(
    z.object({
      name: z.string().min(2, "Name must be at least 2 characters"),
      gamerHandle: z.string().min(3, "Gamer handle must be at least 3 characters").max(20, "Gamer handle must be less than 20 characters"),
      email: z.string().email("Invalid email address"),
      password: z.string().min(6, "Password must be at least 6 characters"),
    })
  )
  .mutation(async ({ input }) => {
    try {
      console.log('=== REGISTER ATTEMPT ===');
      console.log('Name:', input.name);
      console.log('Gamer Handle:', input.gamerHandle);
      console.log('Email:', input.email);
      
      // Validate input
      if (!input.email?.trim()) {
        throw new Error('Email is required');
      }
      if (!input.name?.trim()) {
        throw new Error('Name is required');
      }
      if (!input.gamerHandle?.trim()) {
        throw new Error('Gamer handle is required');
      }
      if (!input.password?.trim()) {
        throw new Error('Password is required');
      }
      
      const email = input.email.trim();
      const name = input.name.trim();
      const gamerHandle = input.gamerHandle.trim();
      
      // Check if account already exists (real or dummy)
      if (isRealAccount(email)) {
        throw new Error('An account with this email already exists');
      }
      
      if (isDummyAccount(email)) {
        throw new Error('This email is reserved for demo accounts. Please use a different email.');
      }
      
      // Create new real user
      const user: Player = {
        id: Date.now().toString(36) + Math.random().toString(36).substr(2),
        name,
        gamerHandle,
        email,
        joinedAt: new Date().toISOString(),
        role: 'player' as const,
        status: 'active' as const,
        stats: {
          played: 0,
          wins: 0,
          draws: 0,
          losses: 0,
          goalsFor: 0,
          goalsAgainst: 0,
          cleanSheets: 0,
          points: 0,
          winRate: 0,
          form: [],
          leaguesWon: 0,
          knockoutsWon: 0,
        },
      };
      
      // Save as real account
      createRealAccount(user);
      
      // Generate a simple token (in production, use proper JWT)
      const token = Buffer.from(JSON.stringify({ 
        userId: user.id, 
        email: user.email,
        role: user.role,
        timestamp: Date.now()
      })).toString('base64');
      
      console.log('=== REGISTRATION SUCCESS ===');
      console.log('User:', user.name, '(' + user.email + ')');
      console.log('Account type: real');
      
      return {
        user,
        token,
        message: "Real account created successfully!",
      };
    } catch (error) {
      console.error('Registration error:', error);
      throw new Error(error instanceof Error ? error.message : 'Registration failed');
    }
  });