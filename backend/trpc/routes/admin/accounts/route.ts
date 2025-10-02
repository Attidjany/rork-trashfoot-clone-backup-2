import { z } from "zod";
import { publicProcedure } from "../../../create-context";
import { supabaseAdmin } from "../../../../lib/supabase-server";

export const getAllAccountsProcedure = publicProcedure
  .query(async () => {
    try {
      console.log('=== GET ALL ACCOUNTS ===');
      
      const { data: players, error } = await supabaseAdmin
        .from('players')
        .select('*')
        .order('joined_at', { ascending: false });
      
      if (error) {
        console.error('Error fetching accounts:', error);
        throw new Error('Failed to fetch accounts');
      }
      
      const accounts = players || [];
      
      return {
        success: true,
        data: {
          accounts: accounts.map(p => ({
            id: p.id,
            name: p.name,
            email: p.email,
            gamerHandle: p.gamer_handle,
            role: p.role,
            status: p.status,
            joinedAt: p.joined_at,
          })),
          totalAccounts: accounts.length
        }
      };
    } catch (error) {
      console.error('Get all accounts error:', error);
      throw new Error(error instanceof Error ? error.message : 'Failed to get accounts');
    }
  });

export const deleteAccountProcedure = publicProcedure
  .input(
    z.object({
      playerId: z.string(),
    })
  )
  .mutation(async ({ input }) => {
    try {
      console.log('=== DELETE ACCOUNT ===');
      console.log('Player ID:', input.playerId);
      
      const { data: player, error: fetchError } = await supabaseAdmin
        .from('players')
        .select('*')
        .eq('id', input.playerId)
        .single();
      
      if (fetchError || !player) {
        throw new Error('Account not found');
      }
      
      const { error: deleteError } = await supabaseAdmin
        .from('players')
        .delete()
        .eq('id', input.playerId);
      
      if (deleteError) {
        throw new Error('Failed to delete account');
      }
      
      if (player.auth_user_id) {
        await supabaseAdmin.auth.admin.deleteUser(player.auth_user_id);
      }
      
      console.log('Successfully deleted account:', player.email);
      
      return {
        success: true,
        message: `Account ${player.email} has been deleted successfully`,
        deletedEmail: player.email
      };
    } catch (error) {
      console.error('Delete account error:', error);
      throw new Error(error instanceof Error ? error.message : 'Failed to delete account');
    }
  });

export const getAccountStatsProcedure = publicProcedure
  .query(async () => {
    try {
      console.log('=== GET ACCOUNT STATS ===');
      
      const { data: players, error } = await supabaseAdmin
        .from('players')
        .select('*')
        .order('joined_at', { ascending: false });
      
      if (error) {
        throw new Error('Failed to fetch account statistics');
      }
      
      const totalAccounts = players?.length || 0;
      const recentAccounts = players?.slice(0, 5) || [];
      
      const stats = {
        totalAccounts,
        recentAccounts: recentAccounts.map(p => ({
          id: p.id,
          name: p.name,
          email: p.email,
          gamerHandle: p.gamer_handle,
          joinedAt: p.joined_at,
        }))
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

export const bulkDeleteAccountsProcedure = publicProcedure
  .input(
    z.object({
      playerIds: z.array(z.string()),
    })
  )
  .mutation(async ({ input }) => {
    try {
      console.log('=== BULK DELETE ACCOUNTS ===');
      console.log('Player IDs:', input.playerIds);
      
      if (!input.playerIds || input.playerIds.length === 0) {
        throw new Error('No player IDs provided for deletion');
      }
      
      const results = {
        deleted: [] as string[],
        failed: [] as string[],
      };
      
      for (const playerId of input.playerIds) {
        try {
          const { data: player } = await supabaseAdmin
            .from('players')
            .select('*')
            .eq('id', playerId)
            .single();
          
          if (!player) {
            results.failed.push(playerId);
            continue;
          }
          
          const { error: deleteError } = await supabaseAdmin
            .from('players')
            .delete()
            .eq('id', playerId);
          
          if (deleteError) {
            results.failed.push(playerId);
            continue;
          }
          
          if (player.auth_user_id) {
            await supabaseAdmin.auth.admin.deleteUser(player.auth_user_id);
          }
          
          results.deleted.push(playerId);
        } catch (error) {
          results.failed.push(playerId);
        }
      }
      
      console.log('Bulk delete results:', results);
      
      return {
        success: true,
        message: `Bulk delete completed. Deleted: ${results.deleted.length}, Failed: ${results.failed.length}`,
        results
      };
    } catch (error) {
      console.error('Bulk delete accounts error:', error);
      throw new Error(error instanceof Error ? error.message : 'Failed to bulk delete accounts');
    }
  });