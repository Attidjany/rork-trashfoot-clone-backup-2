import { z } from "zod";
import { publicProcedure } from "@/backend/trpc/create-context";

import { Player, Group } from "@/types/game";

// Import shared storage
import { 
  userDataStorage, 
  isDummyAccount, 
  isRealAccount, 
  getDummyDataForUser,
  realAccountsStorage
} from "@/backend/trpc/shared/storage";

export const loginProcedure = publicProcedure
  .input(
    z.object({
      email: z.string().email("Invalid email address"),
      password: z.string().min(1, "Password is required"),
    })
  )
  .mutation(async ({ input }) => {
    try {
    console.log('=== LOGIN ATTEMPT ===');
    console.log('Email:', input.email);
    console.log('Password:', input.password);
    
    const email = input.email.trim();
    
    // Check if this is a super admin login
    if (email === 'admin@trashfoot.com' && input.password === 'admin123') {
      console.log('Super admin login attempt');
      // Handle super admin login separately
    } else if (isDummyAccount(email)) {
      // Handle dummy account login
      console.log('Dummy account login for:', email);
      
      const demoCredentials = [
        { email: 'alex@trashfoot.com', password: 'striker123' },
        { email: 'marcus@trashfoot.com', password: 'wall123' },
        { email: 'jamie@trashfoot.com', password: 'speed123' },
        { email: 'david@trashfoot.com', password: 'maestro123' },
        { email: 'sarah@trashfoot.com', password: 'rocket123' },
        { email: 'mike@trashfoot.com', password: 'clutch123' },
      ];
      
      const credentials = demoCredentials.find(c => c.email === email && c.password === input.password);
      
      if (!credentials) {
        console.log('Invalid dummy account credentials for:', email);
        throw new Error(`Invalid password for dummy account. Available demo accounts:\n\n• alex@trashfoot.com / striker123\n• marcus@trashfoot.com / wall123\n• jamie@trashfoot.com / speed123\n• david@trashfoot.com / maestro123\n• sarah@trashfoot.com / rocket123\n• mike@trashfoot.com / clutch123`);
      }
    } else if (isRealAccount(email)) {
      // Handle real account login
      console.log('Real account login for:', email);
      // In a real app, you would verify the password hash here
      // For now, we'll just check if the account exists
      const realUser = realAccountsStorage.get(email);
      if (!realUser) {
        throw new Error('Account not found');
      }
      // TODO: Add proper password verification for real accounts
      console.log('Real account found, password verification needed');
    } else {
      // Account doesn't exist
      console.log('Account not found for:', email);
      throw new Error('Account not found. Please register first or use a demo account.');
    }

    console.log('Valid credentials found for:', email);

    let gameData: any = null;
    let user: Player | null = null;
    
    if (email === 'admin@trashfoot.com') {
      // Super admin user
      user = {
        id: 'super_admin',
        name: 'Super Admin',
        gamerHandle: 'super_admin',
        email: 'admin@trashfoot.com',
        role: 'super_admin' as const,
        status: 'active' as const,
        joinedAt: new Date().toISOString(),
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
      gameData = null; // Super admin doesn't need game data
      console.log('Super admin login successful');
    } else if (isDummyAccount(email)) {
      // Dummy account login
      console.log('Processing dummy account login...');
      
      // For demo purposes, always create fresh dummy data to ensure users see matches
      console.log('Creating fresh dummy data for demo login');
      const dummyData = getDummyDataForUser(email);
      const allPlayers = dummyData.groups.flatMap(g => g.members);
      
      user = allPlayers.find(p => p.email === email) || null;
      
      if (!user) {
        console.log('User not found in dummy data');
        throw new Error("User not found in dummy data. This should not happen.");
      }
      
      gameData = {
        currentUser: user,
        groups: dummyData.groups,
        activeGroupId: dummyData.groups.length > 0 ? dummyData.groups[0].id : '',
        messages: dummyData.messages || [],
      };
      
      // Save the fresh data to storage immediately
      const dataToSave = {
        user,
        gameData,
        lastUpdated: new Date().toISOString(),
        accountType: 'dummy'
      };
      userDataStorage.set(email, dataToSave);
      console.log('Saved fresh dummy data for user:', email);
      console.log('Data includes:', {
        groupsCount: gameData.groups.length,
        matchesCount: gameData.groups.flatMap((g: Group) => g.competitions.flatMap(c => c.matches)).length,
        messagesCount: gameData.messages.length
      });
    } else if (isRealAccount(email)) {
      // Real account login
      console.log('Processing real account login...');
      
      const realUser = realAccountsStorage.get(email);
      if (!realUser) {
        throw new Error('Real account not found');
      }
      
      user = realUser;
      
      // For real accounts, start with empty game data
      // They can join groups or create their own
      gameData = {
        currentUser: user,
        groups: [],
        activeGroupId: '',
        messages: [],
      };
      
      // Save the data to storage
      const dataToSave = {
        user,
        gameData,
        lastUpdated: new Date().toISOString(),
        accountType: 'real'
      };
      userDataStorage.set(email, dataToSave);
      console.log('Saved real account data for user:', email);
    } else {
      throw new Error('Account type could not be determined');
    }
    
    if (!user) {
      console.error('User is null after processing');
      throw new Error("Failed to load user data");
    }

    // Generate a simple token (in production, use proper JWT)
    const token = Buffer.from(JSON.stringify({ 
      userId: user.id, 
      email: user.email, 
      role: user.role,
      timestamp: Date.now()
    })).toString('base64');

    console.log('=== LOGIN SUCCESS ===');
    console.log('User:', user.name, '(' + user.email + ')');
    console.log('Role:', user.role);
    console.log('Has game data:', !!gameData);
    console.log('Groups count:', gameData?.groups?.length || 0);
    
    return {
      user,
      token,
      gameData,
      message: "Login successful!",
    };
    } catch (error) {
      console.error('Login procedure error:', error);
      throw new Error(error instanceof Error ? error.message : 'Login failed');
    }
  });