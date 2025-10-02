import { z } from "zod";
import { publicProcedure, protectedProcedure } from "../../../create-context";
import { supabaseAdmin } from "../../../../lib/supabase-server";

function generateInviteCode(): string {
  return Math.random().toString(36).substr(2, 8).toUpperCase();
}

export const getPublicGroupsProcedure = protectedProcedure
  .query(async ({ ctx }) => {
    const userId = ctx.user?.id;
    if (!userId) {
      throw new Error('User not authenticated');
    }

    const { data: player } = await supabaseAdmin
      .from('players')
      .select('id')
      .eq('auth_user_id', userId)
      .single();

    if (!player) {
      throw new Error('Player not found');
    }

    const { data: groups, error } = await supabaseAdmin
      .from('groups')
      .select(`
        id,
        name,
        description,
        invite_code,
        is_public,
        created_at,
        admin_id
      `)
      .eq('is_public', true);

    if (error) {
      console.error('Error fetching groups:', error);
      throw new Error('Failed to fetch groups');
    }

    const { data: userGroups } = await supabaseAdmin
      .from('group_members')
      .select('group_id')
      .eq('player_id', player.id);

    const userGroupIds = new Set(userGroups?.map((g: any) => g.group_id) || []);

    const availableGroups = (groups || []).filter((g: any) => !userGroupIds.has(g.id));

    const groupsWithCounts = await Promise.all(
      availableGroups.map(async (group: any) => {
        const { count } = await supabaseAdmin
          .from('group_members')
          .select('*', { count: 'exact', head: true })
          .eq('group_id', group.id);
        
        return {
          id: group.id,
          name: group.name,
          description: group.description || '',
          inviteCode: group.invite_code,
          isPublic: group.is_public,
          memberCount: count || 0,
          createdAt: group.created_at,
        };
      })
    );

    return groupsWithCounts;
  });

export const createGroupProcedure = protectedProcedure
  .input(
    z.object({
      name: z.string().min(1),
      description: z.string().optional(),
    })
  )
  .mutation(async ({ input, ctx }) => {
    const userId = ctx.user?.id;
    if (!userId) {
      console.error('❌ Create group: User not authenticated');
      throw new Error('User not authenticated');
    }

    console.log('🔄 Creating group for user:', userId);
    console.log('🔄 Group name:', input.name);
    console.log('🔄 Group description:', input.description);

    const { data: player, error: playerError } = await supabaseAdmin
      .from('players')
      .select('id, name, gamer_handle, email')
      .eq('auth_user_id', userId)
      .single();

    if (playerError) {
      console.error('❌ Error fetching player:', playerError);
      throw new Error(`Player lookup failed: ${playerError.message}`);
    }

    if (!player) {
      console.error('❌ Player not found for auth_user_id:', userId);
      throw new Error('Player profile not found. Please complete your profile first.');
    }

    console.log('✅ Found player:', player.id, player.name, player.gamer_handle);

    const inviteCode = generateInviteCode();
    console.log('🔄 Inserting group with invite code:', inviteCode);

    const { data: group, error: groupError } = await supabaseAdmin
      .from('groups')
      .insert({
        name: input.name,
        description: input.description || '',
        admin_id: player.id,
        invite_code: inviteCode,
        is_public: true,
      })
      .select()
      .single();

    if (groupError) {
      console.error('❌ Error creating group:', groupError);
      console.error('❌ Error details:', JSON.stringify(groupError, null, 2));
      throw new Error(`Failed to create group: ${groupError.message}`);
    }

    if (!group) {
      console.error('❌ No group returned after insert');
      throw new Error('Failed to create group: No data returned');
    }

    console.log('✅ Group created:', group.id, group.name);
    console.log('🔄 Adding creator as group member...');

    const { error: memberError } = await supabaseAdmin
      .from('group_members')
      .insert({
        group_id: group.id,
        player_id: player.id,
        is_admin: true,
      });

    if (memberError) {
      console.error('❌ Error adding member:', memberError);
      console.error('❌ Error details:', JSON.stringify(memberError, null, 2));
      throw new Error(`Failed to add member to group: ${memberError.message}`);
    }

    console.log('✅ Member added successfully');
    console.log('🔄 Creating player stats...');

    const { error: statsError } = await supabaseAdmin
      .from('player_stats')
      .insert({
        player_id: player.id,
        group_id: group.id,
      });

    if (statsError) {
      console.error('⚠️ Error creating stats (non-fatal):', statsError);
    } else {
      console.log('✅ Player stats created');
    }

    console.log('✅ Group creation complete!');
    console.log('📋 Group details:', {
      id: group.id,
      name: group.name,
      inviteCode: group.invite_code,
    });

    return {
      success: true,
      group: {
        id: group.id,
        name: group.name,
        description: group.description || '',
        inviteCode: group.invite_code,
        adminId: group.admin_id,
        createdAt: group.created_at,
      },
    };
  });

export const joinGroupProcedure = protectedProcedure
  .input(
    z.object({
      inviteCode: z.string().min(1),
    })
  )
  .mutation(async ({ input, ctx }) => {
    const userId = ctx.user?.id;
    if (!userId) {
      throw new Error('User not authenticated');
    }

    const { data: player } = await supabaseAdmin
      .from('players')
      .select('id')
      .eq('auth_user_id', userId)
      .single();

    if (!player) {
      throw new Error('Player not found');
    }

    const { data: group, error: groupError } = await supabaseAdmin
      .from('groups')
      .select('*')
      .eq('invite_code', input.inviteCode.toUpperCase())
      .single();

    if (groupError || !group) {
      console.error('Error finding group:', groupError);
      throw new Error('Invalid invite code');
    }

    const { data: existingMember } = await supabaseAdmin
      .from('group_members')
      .select('id')
      .eq('group_id', group.id)
      .eq('player_id', player.id)
      .single();

    if (existingMember) {
      return {
        success: true,
        alreadyMember: true,
        group: {
          id: group.id,
          name: group.name,
          description: group.description || '',
        },
      };
    }

    const { error: memberError } = await supabaseAdmin
      .from('group_members')
      .insert({
        group_id: group.id,
        player_id: player.id,
        is_admin: false,
      });

    if (memberError) {
      console.error('Error joining group:', memberError);
      throw new Error('Failed to join group');
    }

    const { error: statsError } = await supabaseAdmin
      .from('player_stats')
      .insert({
        player_id: player.id,
        group_id: group.id,
      });

    if (statsError) {
      console.error('Error creating stats:', statsError);
    }

    return {
      success: true,
      alreadyMember: false,
      group: {
        id: group.id,
        name: group.name,
        description: group.description || '',
      },
    };
  });

export const getUserGroupsProcedure = protectedProcedure
  .query(async ({ ctx }) => {
    const userId = ctx.user?.id;
    if (!userId) {
      throw new Error('User not authenticated');
    }

    const { data: player } = await supabaseAdmin
      .from('players')
      .select('id')
      .eq('auth_user_id', userId)
      .single();

    if (!player) {
      throw new Error('Player not found');
    }

    const { data: groupMembers, error } = await supabaseAdmin
      .from('group_members')
      .select(`
        group_id,
        is_admin,
        groups (
          id,
          name,
          description,
          invite_code,
          admin_id,
          created_at
        )
      `)
      .eq('player_id', player.id);

    if (error) {
      console.error('Error fetching user groups:', error);
      throw new Error('Failed to fetch groups');
    }

    return (groupMembers || []).map((gm: any) => ({
      id: gm.groups.id,
      name: gm.groups.name,
      description: gm.groups.description || '',
      inviteCode: gm.groups.invite_code,
      adminId: gm.groups.admin_id,
      isAdmin: gm.is_admin,
      createdAt: gm.groups.created_at,
    }));
  });

export const requestJoinGroupProcedure = publicProcedure
  .input(
    z.object({
      groupId: z.string(),
      playerId: z.string(),
      playerName: z.string(),
      message: z.string().optional(),
    })
  )
  .mutation(async ({ input }) => {
    console.log('Join request:', input);
    
    return {
      success: true,
      message: "Join request sent! The group admin will review your request.",
    };
  });

export const manageGroupMemberProcedure = publicProcedure
  .input(
    z.object({
      groupId: z.string(),
      playerId: z.string(),
      action: z.enum(['promote_admin', 'demote_admin', 'suspend', 'ban', 'remove', 'unsuspend']),
      adminId: z.string(),
      duration: z.number().optional(),
    })
  )
  .mutation(async ({ input }) => {
    console.log('Member management action:', input);
    
    const actionMessages = {
      promote_admin: 'Player promoted to admin',
      demote_admin: 'Player demoted from admin',
      suspend: `Player suspended${input.duration ? ` for ${input.duration} days` : ''}`,
      ban: 'Player banned from group',
      remove: 'Player removed from group',
      unsuspend: 'Player suspension lifted',
    };
    
    return {
      success: true,
      message: actionMessages[input.action],
    };
  });

export const getGroupDetailsProcedure = protectedProcedure
  .input(
    z.object({
      groupId: z.string(),
    })
  )
  .query(async ({ input, ctx }) => {
    const userId = ctx.user?.id;
    if (!userId) {
      throw new Error('User not authenticated');
    }

    const { data: player } = await supabaseAdmin
      .from('players')
      .select('id')
      .eq('auth_user_id', userId)
      .single();

    if (!player) {
      throw new Error('Player not found');
    }

    const { data: group, error: groupError } = await supabaseAdmin
      .from('groups')
      .select('*')
      .eq('id', input.groupId)
      .single();

    if (groupError || !group) {
      console.error('Error fetching group:', groupError);
      throw new Error('Group not found');
    }

    const { data: members } = await supabaseAdmin
      .from('group_members')
      .select(`
        player_id,
        is_admin,
        players (
          id,
          name,
          gamer_handle,
          email,
          role,
          status,
          joined_at
        )
      `)
      .eq('group_id', input.groupId);

    const isMember = members?.some((m: any) => m.player_id === player.id);
    if (!isMember) {
      throw new Error('You are not a member of this group');
    }

    return {
      id: group.id,
      name: group.name,
      description: group.description || '',
      inviteCode: group.invite_code,
      adminId: group.admin_id,
      isPublic: group.is_public,
      createdAt: group.created_at,
      members: (members || []).map((m: any) => ({
        id: m.players.id,
        name: m.players.name,
        gamerHandle: m.players.gamer_handle,
        email: m.players.email,
        role: m.players.role,
        status: m.players.status,
        joinedAt: m.players.joined_at,
        isAdmin: m.is_admin,
      })),
    };
  });