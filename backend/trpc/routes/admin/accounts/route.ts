import { z } from "zod";
import { publicProcedure } from "@/backend/trpc/create-context";
import { 
  getAllAccounts, 
  deleteAccount, 
  isDummyAccount,
  isRealAccount,
  getAllDummyAccounts,
  getAllRealAccounts
} from "@/backend/trpc/shared/storage";

// Get all accounts (dummy and real)
export const getAllAccountsProcedure = publicProcedure
  .query(async () => {
    try {
      console.log('=== GET ALL ACCOUNTS ===');
      
      const accounts = getAllAccounts();
      
      console.log('Dummy accounts:', accounts.dummy.length);
      console.log('Real accounts:', accounts.real.length);
      
      return {
        success: true,
        data: {
          dummyAccounts: accounts.dummy,
          realAccounts: accounts.real,
          totalDummy: accounts.dummy.length,
          totalReal: accounts.real.length,
          totalAccounts: accounts.dummy.length + accounts.real.length
        }
      };
    } catch (error) {
      console.error('Get all accounts error:', error);
      throw new Error(error instanceof Error ? error.message : 'Failed to get accounts');
    }
  });

// Delete account (dummy or real)
export const deleteAccountProcedure = publicProcedure
  .input(
    z.object({
      email: z.string().email("Invalid email address"),
      accountType: z.enum(['dummy', 'real']).optional()
    })
  )
  .mutation(async ({ input }) => {
    try {
      console.log('=== DELETE ACCOUNT ===');
      console.log('Email:', input.email);
      console.log('Account type:', input.accountType);
      
      if (!input.email?.trim()) {
        throw new Error('Email is required');
      }
      
      const email = input.email.trim();
      
      // Verify account type if provided
      if (input.accountType) {
        if (input.accountType === 'dummy' && !isDummyAccount(email)) {
          throw new Error('Account is not a dummy account');
        }
        if (input.accountType === 'real' && !isRealAccount(email)) {
          throw new Error('Account is not a real account');
        }
      }
      
      const deleted = deleteAccount(email);
      
      if (!deleted) {
        throw new Error('Account not found or could not be deleted');
      }
      
      console.log('Successfully deleted account:', email);
      
      return {
        success: true,
        message: `Account ${email} has been deleted successfully`,
        deletedEmail: email
      };
    } catch (error) {
      console.error('Delete account error:', error);
      throw new Error(error instanceof Error ? error.message : 'Failed to delete account');
    }
  });

// Get account statistics
export const getAccountStatsProcedure = publicProcedure
  .query(async () => {
    try {
      console.log('=== GET ACCOUNT STATS ===');
      
      const dummyAccounts = getAllDummyAccounts();
      const realAccounts = getAllRealAccounts();
      
      const stats = {
        totalAccounts: dummyAccounts.length + realAccounts.length,
        dummyAccounts: dummyAccounts.length,
        realAccounts: realAccounts.length,
        dummyPercentage: dummyAccounts.length > 0 ? 
          Math.round((dummyAccounts.length / (dummyAccounts.length + realAccounts.length)) * 100) : 0,
        realPercentage: realAccounts.length > 0 ? 
          Math.round((realAccounts.length / (dummyAccounts.length + realAccounts.length)) * 100) : 0,
        recentDummyAccounts: dummyAccounts.slice(0, 5),
        recentRealAccounts: realAccounts.slice(0, 5)
      };
      
      console.log('Account stats:', stats);
      
      return {
        success: true,
        data: stats
      };
    } catch (error) {
      console.error('Get account stats error:', error);
      throw new Error(error instanceof Error ? error.message : 'Failed to get account statistics');
    }
  });

// Bulk delete accounts
export const bulkDeleteAccountsProcedure = publicProcedure
  .input(
    z.object({
      emails: z.array(z.string().email()),
      accountType: z.enum(['dummy', 'real', 'all']).optional()
    })
  )
  .mutation(async ({ input }) => {
    try {
      console.log('=== BULK DELETE ACCOUNTS ===');
      console.log('Emails:', input.emails);
      console.log('Account type filter:', input.accountType);
      
      if (!input.emails || input.emails.length === 0) {
        throw new Error('No emails provided for deletion');
      }
      
      const results = {
        deleted: [] as string[],
        failed: [] as string[],
        skipped: [] as string[]
      };
      
      for (const email of input.emails) {
        if (!email?.trim()) {
          results.failed.push(email);
          continue;
        }
        
        const cleanEmail = email.trim();
        
        // Apply account type filter if specified
        if (input.accountType && input.accountType !== 'all') {
          if (input.accountType === 'dummy' && !isDummyAccount(cleanEmail)) {
            results.skipped.push(cleanEmail);
            continue;
          }
          if (input.accountType === 'real' && !isRealAccount(cleanEmail)) {
            results.skipped.push(cleanEmail);
            continue;
          }
        }
        
        const deleted = deleteAccount(cleanEmail);
        if (deleted) {
          results.deleted.push(cleanEmail);
        } else {
          results.failed.push(cleanEmail);
        }
      }
      
      console.log('Bulk delete results:', results);
      
      return {
        success: true,
        message: `Bulk delete completed. Deleted: ${results.deleted.length}, Failed: ${results.failed.length}, Skipped: ${results.skipped.length}`,
        results
      };
    } catch (error) {
      console.error('Bulk delete accounts error:', error);
      throw new Error(error instanceof Error ? error.message : 'Failed to bulk delete accounts');
    }
  });