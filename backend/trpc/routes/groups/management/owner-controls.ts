import { z } from "zod";
import { protectedProcedure } from "../../../create-context";
import { supabaseAdmin } from "../../../../lib/supabase-server";

export const promoteToAdminProcedure = protectedProcedure
  .input(
    z.object({
      groupId: z.string(),
      playerId: z.string(),
    })
  )
  .mutation(async ({ input, ctx }) => {
    const userId = ctx.user?.id;
    if (!userId) {
      throw new Error('User not authenticated');
    }

    const { data: currentPlayer } = await supabaseAdmin
      .from('players')
      .select('id')
      .eq('auth_user_id', userId)
      .single();

    if (!currentPlayer) {
      throw new Error('Player not found');
    }

    const { data: group } = await supabaseAdmin
      .from('groups')
      .select('admin_id, admin_ids')
      .eq('id', input.groupId)
      .single();

    if (!group || group.admin_id !== currentPlayer.id) {
      throw new Error('Only the group owner can promote admins');
    }

    const adminIds = group.admin_ids || [];
    if (adminIds.includes(input.playerId)) {
      return { success: true, message: 'Player is already an admin' };
    }

    const { error } = await supabaseAdmin
      .from('groups')
      .update({
        admin_ids: [...adminIds, input.playerId],
      })
      .eq('id', input.groupId);

    if (error) {
      throw new Error(`Failed to promote player: ${error.message}`);
    }

    return { success: true, message: 'Player promoted to admin' };
  });

export const demoteFromAdminProcedure = protectedProcedure
  .input(
    z.object({
      groupId: z.string(),
      playerId: z.string(),
    })
  )
  .mutation(async ({ input, ctx }) => {
    const userId = ctx.user?.id;
    if (!userId) {
      throw new Error('User not authenticated');
    }

    const { data: currentPlayer } = await supabaseAdmin
      .from('players')
      .select('id')
      .eq('auth_user_id', userId)
      .single();

    if (!currentPlayer) {
      throw new Error('Player not found');
    }

    const { data: group } = await supabaseAdmin
      .from('groups')
      .select('admin_id, admin_ids')
      .eq('id', input.groupId)
      .single();

    if (!group || group.admin_id !== currentPlayer.id) {
      throw new Error('Only the group owner can demote admins');
    }

    if (input.playerId === group.admin_id) {
      throw new Error('Cannot demote the group owner');
    }

    const adminIds = group.admin_ids || [];
    const newAdminIds = adminIds.filter((id: string) => id !== input.playerId);

    const { error } = await supabaseAdmin
      .from('groups')
      .update({
        admin_ids: newAdminIds,
      })
      .eq('id', input.groupId);

    if (error) {
      throw new Error(`Failed to demote player: ${error.message}`);
    }

    return { success: true, message: 'Player demoted from admin' };
  });

export const suspendPlayerProcedure = protectedProcedure
  .input(
    z.object({
      groupId: z.string(),
      playerId: z.string(),
      duration: z.number().optional(),
    })
  )
  .mutation(async ({ input, ctx }) => {
    const userId = ctx.user?.id;
    if (!userId) {
      throw new Error('User not authenticated');
    }

    const { data: currentPlayer } = await supabaseAdmin
      .from('players')
      .select('id')
      .eq('auth_user_id', userId)
      .single();

    if (!currentPlayer) {
      throw new Error('Player not found');
    }

    const { data: group } = await supabaseAdmin
      .from('groups')
      .select('admin_id')
      .eq('id', input.groupId)
      .single();

    if (!group || group.admin_id !== currentPlayer.id) {
      throw new Error('Only the group owner can suspend members');
    }

    if (input.playerId === group.admin_id) {
      throw new Error('Cannot suspend the group owner');
    }

    const { data: targetPlayer } = await supabaseAdmin
      .from('players')
      .select('suspended_in_groups')
      .eq('id', input.playerId)
      .single();

    if (!targetPlayer) {
      throw new Error('Target player not found');
    }

    const suspendedInGroups = targetPlayer.suspended_in_groups || {};
    let suspensionData: any = { suspended: true };

    if (input.duration) {
      const suspendedUntil = new Date();
      suspendedUntil.setDate(suspendedUntil.getDate() + input.duration);
      suspensionData.until = suspendedUntil.toISOString();
    }

    suspendedInGroups[input.groupId] = suspensionData;

    const { error } = await supabaseAdmin
      .from('players')
      .update({
        suspended_in_groups: suspendedInGroups,
      })
      .eq('id', input.playerId);

    if (error) {
      throw new Error(`Failed to suspend player: ${error.message}`);
    }

    return {
      success: true,
      message: input.duration
        ? `Player suspended for ${input.duration} days`
        : 'Player suspended indefinitely',
    };
  });

export const unsuspendPlayerProcedure = protectedProcedure
  .input(
    z.object({
      groupId: z.string(),
      playerId: z.string(),
    })
  )
  .mutation(async ({ input, ctx }) => {
    const userId = ctx.user?.id;
    if (!userId) {
      throw new Error('User not authenticated');
    }

    const { data: currentPlayer } = await supabaseAdmin
      .from('players')
      .select('id')
      .eq('auth_user_id', userId)
      .single();

    if (!currentPlayer) {
      throw new Error('Player not found');
    }

    const { data: group } = await supabaseAdmin
      .from('groups')
      .select('admin_id')
      .eq('id', input.groupId)
      .single();

    if (!group || group.admin_id !== currentPlayer.id) {
      throw new Error('Only the group owner can unsuspend members');
    }

    const { data: targetPlayer } = await supabaseAdmin
      .from('players')
      .select('suspended_in_groups')
      .eq('id', input.playerId)
      .single();

    if (!targetPlayer) {
      throw new Error('Target player not found');
    }

    const suspendedInGroups = targetPlayer.suspended_in_groups || {};
    delete suspendedInGroups[input.groupId];

    const { error } = await supabaseAdmin
      .from('players')
      .update({
        suspended_in_groups: suspendedInGroups,
      })
      .eq('id', input.playerId);

    if (error) {
      throw new Error(`Failed to unsuspend player: ${error.message}`);
    }

    return { success: true, message: 'Player suspension lifted' };
  });
