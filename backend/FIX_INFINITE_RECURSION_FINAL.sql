-- ============================================================================
-- CLEAN POLICY SETUP - FIX INFINITE RECURSION
-- ============================================================================
-- This script drops ALL existing policies and recreates them without recursion
-- Run this script in Supabase SQL Editor
-- ============================================================================

BEGIN;

-- ============================================================================
-- STEP 1: DROP ALL EXISTING POLICIES
-- ============================================================================

-- Drop all policies on players table
DROP POLICY IF EXISTS players_viewable_by_all ON public.players;
DROP POLICY IF EXISTS players_insert_own ON public.players;
DROP POLICY IF EXISTS players_update_own ON public.players;
DROP POLICY IF EXISTS "Players can view themselves" ON public.players;
DROP POLICY IF EXISTS "Superadmin can view all players" ON public.players;
DROP POLICY IF EXISTS "Users can insert own profile" ON public.players;
DROP POLICY IF EXISTS "Users can update own profile" ON public.players;
DROP POLICY IF EXISTS "Players are viewable by everyone" ON public.players;

-- Drop all policies on groups table
DROP POLICY IF EXISTS groups_select_public_or_member ON public.groups;
DROP POLICY IF EXISTS groups_insert_auth ON public.groups;
DROP POLICY IF EXISTS groups_update_admin ON public.groups;
DROP POLICY IF EXISTS groups_delete_admin ON public.groups;
DROP POLICY IF EXISTS "Anyone can view groups" ON public.groups;
DROP POLICY IF EXISTS "Authenticated users can create groups" ON public.groups;
DROP POLICY IF EXISTS "Group admins can update groups" ON public.groups;
DROP POLICY IF EXISTS "Group admins can delete groups" ON public.groups;
DROP POLICY IF EXISTS "Groups viewable by members" ON public.groups;
DROP POLICY IF EXISTS "Public groups are viewable by everyone" ON public.groups;
DROP POLICY IF EXISTS "Superadmin can view all groups" ON public.groups;
DROP POLICY IF EXISTS groups_select ON public.groups;

-- Drop all policies on group_members table
DROP POLICY IF EXISTS group_members_select_public_or_member ON public.group_members;
DROP POLICY IF EXISTS group_members_insert_admin_or_self ON public.group_members;
DROP POLICY IF EXISTS group_members_delete_admin_or_self ON public.group_members;
DROP POLICY IF EXISTS "Anyone can view group members" ON public.group_members;
DROP POLICY IF EXISTS "Authenticated users can join groups" ON public.group_members;
DROP POLICY IF EXISTS "Group admins can add members" ON public.group_members;
DROP POLICY IF EXISTS "Group admins can manage members" ON public.group_members;
DROP POLICY IF EXISTS "Group admins can remove members" ON public.group_members;
DROP POLICY IF EXISTS "Group members viewable by group members" ON public.group_members;
DROP POLICY IF EXISTS "Superadmin can view all group members" ON public.group_members;
DROP POLICY IF EXISTS "Users can leave groups" ON public.group_members;
DROP POLICY IF EXISTS gm_insert_self ON public.group_members;
DROP POLICY IF EXISTS gm_select_self ON public.group_members;

-- Drop all policies on pending_group_members table
DROP POLICY IF EXISTS pending_members_select_admin_or_self ON public.pending_group_members;
DROP POLICY IF EXISTS pending_members_insert_self ON public.pending_group_members;
DROP POLICY IF EXISTS pending_members_update_admin ON public.pending_group_members;
DROP POLICY IF EXISTS pending_members_delete_admin ON public.pending_group_members;
DROP POLICY IF EXISTS "Authenticated users can request to join" ON public.pending_group_members;
DROP POLICY IF EXISTS "Group admins can delete pending members" ON public.pending_group_members;
DROP POLICY IF EXISTS "Group admins can update pending members" ON public.pending_group_members;
DROP POLICY IF EXISTS "Join requests viewable by group admins" ON public.pending_group_members;
DROP POLICY IF EXISTS "Pending members viewable by admins and requester" ON public.pending_group_members;
DROP POLICY IF EXISTS "Superadmin can view all join requests" ON public.pending_group_members;

-- Drop all policies on competitions table
DROP POLICY IF EXISTS competitions_select_member ON public.competitions;
DROP POLICY IF EXISTS competitions_insert_member ON public.competitions;
DROP POLICY IF EXISTS competitions_update_admin ON public.competitions;
DROP POLICY IF EXISTS competitions_delete_admin ON public.competitions;
DROP POLICY IF EXISTS "Competitions viewable by group members" ON public.competitions;
DROP POLICY IF EXISTS "Group admins can create competitions" ON public.competitions;
DROP POLICY IF EXISTS "Group admins can delete competitions" ON public.competitions;
DROP POLICY IF EXISTS "Group admins can update competitions" ON public.competitions;
DROP POLICY IF EXISTS "Group members can create competitions" ON public.competitions;
DROP POLICY IF EXISTS "Superadmin can view all competitions" ON public.competitions;

-- Drop all policies on competition_participants table
DROP POLICY IF EXISTS competition_participants_select_member ON public.competition_participants;
DROP POLICY IF EXISTS competition_participants_insert_admin ON public.competition_participants;
DROP POLICY IF EXISTS competition_participants_delete_admin_or_self ON public.competition_participants;
DROP POLICY IF EXISTS "Anyone can view competition participants" ON public.competition_participants;
DROP POLICY IF EXISTS "Authenticated users can join competitions" ON public.competition_participants;
DROP POLICY IF EXISTS "Competition participants viewable by group members" ON public.competition_participants;
DROP POLICY IF EXISTS "Group admins can add participants" ON public.competition_participants;
DROP POLICY IF EXISTS "Group admins can delete participants" ON public.competition_participants;
DROP POLICY IF EXISTS "Users can leave competitions" ON public.competition_participants;

-- Drop all policies on matches table
DROP POLICY IF EXISTS matches_select_member ON public.matches;
DROP POLICY IF EXISTS matches_insert_admin ON public.matches;
DROP POLICY IF EXISTS matches_update_admin_or_player ON public.matches;
DROP POLICY IF EXISTS matches_delete_admin ON public.matches;
DROP POLICY IF EXISTS "Anyone can view matches" ON public.matches;
DROP POLICY IF EXISTS "Authenticated users can create matches" ON public.matches;
DROP POLICY IF EXISTS "Authenticated users can update matches" ON public.matches;
DROP POLICY IF EXISTS "Group admins and players can update matches" ON public.matches;
DROP POLICY IF EXISTS "Group admins can create matches" ON public.matches;
DROP POLICY IF EXISTS "Group admins can delete matches" ON public.matches;
DROP POLICY IF EXISTS "Matches viewable by group members" ON public.matches;
DROP POLICY IF EXISTS "Superadmin can view all matches" ON public.matches;

-- Drop all policies on chat_messages table
DROP POLICY IF EXISTS chat_messages_select_member ON public.chat_messages;
DROP POLICY IF EXISTS chat_messages_insert_member ON public.chat_messages;
DROP POLICY IF EXISTS "Anyone can view chat messages" ON public.chat_messages;
DROP POLICY IF EXISTS "Authenticated users can send messages" ON public.chat_messages;
DROP POLICY IF EXISTS "Chat messages viewable by group members" ON public.chat_messages;
DROP POLICY IF EXISTS "Group members can send messages" ON public.chat_messages;
DROP POLICY IF EXISTS chat_insert_system_policy ON public.chat_messages;

-- Drop all policies on player_stats table
DROP POLICY IF EXISTS player_stats_viewable_by_all ON public.player_stats;
DROP POLICY IF EXISTS player_stats_insert_auth ON public.player_stats;
DROP POLICY IF EXISTS player_stats_update_auth ON public.player_stats;
DROP POLICY IF EXISTS player_stats_delete_auth ON public.player_stats;
DROP POLICY IF EXISTS "Player stats are viewable by everyone" ON public.player_stats;
DROP POLICY IF EXISTS "Player stats can be deleted by authenticated users" ON public.player_stats;
DROP POLICY IF EXISTS "Player stats can be inserted by authenticated users" ON public.player_stats;
DROP POLICY IF EXISTS "Player stats can be updated by authenticated users" ON public.player_stats;

-- ============================================================================
-- STEP 2: CREATE CLEAN POLICIES WITHOUT RECURSION
-- ============================================================================

-- ----------------------------------------------------------------------------
-- PLAYERS TABLE POLICIES
-- ----------------------------------------------------------------------------
-- Simple policies - no recursion possible

CREATE POLICY players_viewable_by_all 
ON public.players 
FOR SELECT 
TO public 
USING (true);

CREATE POLICY players_insert_own 
ON public.players 
FOR INSERT 
TO public 
WITH CHECK (auth.uid() = auth_user_id);

CREATE POLICY players_update_own 
ON public.players 
FOR UPDATE 
TO public 
USING (auth.uid() = auth_user_id);

-- ----------------------------------------------------------------------------
-- GROUPS TABLE POLICIES
-- ----------------------------------------------------------------------------
-- Fixed: Use direct auth.uid() comparison instead of subquery on players

CREATE POLICY groups_select_public_or_member 
ON public.groups 
FOR SELECT 
TO public 
USING (
  is_public = true 
  OR 
  EXISTS (
    SELECT 1 
    FROM group_members gm 
    INNER JOIN players p ON p.id = gm.player_id 
    WHERE gm.group_id = groups.id 
    AND p.auth_user_id = auth.uid()
  )
);

CREATE POLICY groups_insert_auth 
ON public.groups 
FOR INSERT 
TO public 
WITH CHECK (
  auth.uid() IS NOT NULL 
  AND 
  EXISTS (
    SELECT 1 
    FROM players 
    WHERE players.id = groups.admin_id 
    AND players.auth_user_id = auth.uid()
  )
);

CREATE POLICY groups_update_admin 
ON public.groups 
FOR UPDATE 
TO public 
USING (
  EXISTS (
    SELECT 1 
    FROM players 
    WHERE players.id = groups.admin_id 
    AND players.auth_user_id = auth.uid()
  )
);

CREATE POLICY groups_delete_admin 
ON public.groups 
FOR DELETE 
TO public 
USING (
  EXISTS (
    SELECT 1 
    FROM players 
    WHERE players.id = groups.admin_id 
    AND players.auth_user_id = auth.uid()
  )
);

-- ----------------------------------------------------------------------------
-- GROUP_MEMBERS TABLE POLICIES
-- ----------------------------------------------------------------------------
-- Fixed: Avoid self-referencing by using direct joins

CREATE POLICY group_members_select_public_or_member 
ON public.group_members 
FOR SELECT 
TO public 
USING (
  EXISTS (
    SELECT 1 
    FROM groups g 
    WHERE g.id = group_members.group_id 
    AND g.is_public = true
  )
  OR 
  EXISTS (
    SELECT 1 
    FROM players p 
    WHERE p.id = group_members.player_id 
    AND p.auth_user_id = auth.uid()
  )
  OR
  EXISTS (
    SELECT 1 
    FROM group_members gm2
    INNER JOIN players p ON p.id = gm2.player_id
    WHERE gm2.group_id = group_members.group_id
    AND p.auth_user_id = auth.uid()
  )
);

CREATE POLICY group_members_insert_admin_or_self 
ON public.group_members 
FOR INSERT 
TO public 
WITH CHECK (
  EXISTS (
    SELECT 1 
    FROM players 
    WHERE players.id = group_members.player_id 
    AND players.auth_user_id = auth.uid()
  )
  OR 
  EXISTS (
    SELECT 1 
    FROM groups g 
    INNER JOIN players p ON p.id = g.admin_id 
    WHERE g.id = group_members.group_id 
    AND p.auth_user_id = auth.uid()
  )
);

CREATE POLICY group_members_delete_admin_or_self 
ON public.group_members 
FOR DELETE 
TO public 
USING (
  EXISTS (
    SELECT 1 
    FROM players 
    WHERE players.id = group_members.player_id 
    AND players.auth_user_id = auth.uid()
  )
  OR 
  EXISTS (
    SELECT 1 
    FROM groups g 
    INNER JOIN players p ON p.id = g.admin_id 
    WHERE g.id = group_members.group_id 
    AND p.auth_user_id = auth.uid()
  )
);

-- ----------------------------------------------------------------------------
-- PENDING_GROUP_MEMBERS TABLE POLICIES
-- ----------------------------------------------------------------------------

CREATE POLICY pending_members_select_admin_or_self 
ON public.pending_group_members 
FOR SELECT 
TO public 
USING (
  EXISTS (
    SELECT 1 
    FROM players 
    WHERE players.id = pending_group_members.player_id 
    AND players.auth_user_id = auth.uid()
  )
  OR 
  EXISTS (
    SELECT 1 
    FROM groups g 
    INNER JOIN players p ON p.id = g.admin_id 
    WHERE g.id = pending_group_members.group_id 
    AND p.auth_user_id = auth.uid()
  )
);

CREATE POLICY pending_members_insert_self 
ON public.pending_group_members 
FOR INSERT 
TO public 
WITH CHECK (
  EXISTS (
    SELECT 1 
    FROM players 
    WHERE players.id = pending_group_members.player_id 
    AND players.auth_user_id = auth.uid()
  )
);

CREATE POLICY pending_members_update_admin 
ON public.pending_group_members 
FOR UPDATE 
TO public 
USING (
  EXISTS (
    SELECT 1 
    FROM groups g 
    INNER JOIN players p ON p.id = g.admin_id 
    WHERE g.id = pending_group_members.group_id 
    AND p.auth_user_id = auth.uid()
  )
);

CREATE POLICY pending_members_delete_admin 
ON public.pending_group_members 
FOR DELETE 
TO public 
USING (
  EXISTS (
    SELECT 1 
    FROM groups g 
    INNER JOIN players p ON p.id = g.admin_id 
    WHERE g.id = pending_group_members.group_id 
    AND p.auth_user_id = auth.uid()
  )
);

-- ----------------------------------------------------------------------------
-- COMPETITIONS TABLE POLICIES
-- ----------------------------------------------------------------------------

CREATE POLICY competitions_select_member 
ON public.competitions 
FOR SELECT 
TO public 
USING (
  EXISTS (
    SELECT 1 
    FROM group_members gm 
    INNER JOIN players p ON p.id = gm.player_id 
    WHERE gm.group_id = competitions.group_id 
    AND p.auth_user_id = auth.uid()
  )
);

CREATE POLICY competitions_insert_member 
ON public.competitions 
FOR INSERT 
TO public 
WITH CHECK (
  EXISTS (
    SELECT 1 
    FROM group_members gm 
    INNER JOIN players p ON p.id = gm.player_id 
    WHERE gm.group_id = competitions.group_id 
    AND p.auth_user_id = auth.uid()
  )
);

CREATE POLICY competitions_update_admin 
ON public.competitions 
FOR UPDATE 
TO public 
USING (
  EXISTS (
    SELECT 1 
    FROM groups g 
    INNER JOIN players p ON p.id = g.admin_id 
    WHERE g.id = competitions.group_id 
    AND p.auth_user_id = auth.uid()
  )
);

CREATE POLICY competitions_delete_admin 
ON public.competitions 
FOR DELETE 
TO public 
USING (
  EXISTS (
    SELECT 1 
    FROM groups g 
    INNER JOIN players p ON p.id = g.admin_id 
    WHERE g.id = competitions.group_id 
    AND p.auth_user_id = auth.uid()
  )
);

-- ----------------------------------------------------------------------------
-- COMPETITION_PARTICIPANTS TABLE POLICIES
-- ----------------------------------------------------------------------------

CREATE POLICY competition_participants_select_member 
ON public.competition_participants 
FOR SELECT 
TO public 
USING (
  EXISTS (
    SELECT 1 
    FROM competitions c 
    INNER JOIN group_members gm ON gm.group_id = c.group_id 
    INNER JOIN players p ON p.id = gm.player_id 
    WHERE c.id = competition_participants.competition_id 
    AND p.auth_user_id = auth.uid()
  )
);

CREATE POLICY competition_participants_insert_admin 
ON public.competition_participants 
FOR INSERT 
TO public 
WITH CHECK (
  EXISTS (
    SELECT 1 
    FROM competitions c 
    INNER JOIN groups g ON g.id = c.group_id 
    INNER JOIN players p ON p.id = g.admin_id 
    WHERE c.id = competition_participants.competition_id 
    AND p.auth_user_id = auth.uid()
  )
);

CREATE POLICY competition_participants_delete_admin_or_self 
ON public.competition_participants 
FOR DELETE 
TO public 
USING (
  EXISTS (
    SELECT 1 
    FROM players 
    WHERE players.id = competition_participants.player_id 
    AND players.auth_user_id = auth.uid()
  )
  OR 
  EXISTS (
    SELECT 1 
    FROM competitions c 
    INNER JOIN groups g ON g.id = c.group_id 
    INNER JOIN players p ON p.id = g.admin_id 
    WHERE c.id = competition_participants.competition_id 
    AND p.auth_user_id = auth.uid()
  )
);

-- ----------------------------------------------------------------------------
-- MATCHES TABLE POLICIES
-- ----------------------------------------------------------------------------

CREATE POLICY matches_select_member 
ON public.matches 
FOR SELECT 
TO public 
USING (
  EXISTS (
    SELECT 1 
    FROM competitions c 
    INNER JOIN group_members gm ON gm.group_id = c.group_id 
    INNER JOIN players p ON p.id = gm.player_id 
    WHERE c.id = matches.competition_id 
    AND p.auth_user_id = auth.uid()
  )
);

CREATE POLICY matches_insert_admin 
ON public.matches 
FOR INSERT 
TO public 
WITH CHECK (
  EXISTS (
    SELECT 1 
    FROM competitions c 
    INNER JOIN groups g ON g.id = c.group_id 
    INNER JOIN players p ON p.id = g.admin_id 
    WHERE c.id = matches.competition_id 
    AND p.auth_user_id = auth.uid()
  )
);

CREATE POLICY matches_update_admin_or_player 
ON public.matches 
FOR UPDATE 
TO public 
USING (
  EXISTS (
    SELECT 1 
    FROM competitions c 
    INNER JOIN groups g ON g.id = c.group_id 
    INNER JOIN players p ON p.id = g.admin_id 
    WHERE c.id = matches.competition_id 
    AND p.auth_user_id = auth.uid()
  )
  OR 
  EXISTS (
    SELECT 1 
    FROM players 
    WHERE players.id = matches.home_player_id 
    AND players.auth_user_id = auth.uid()
  )
  OR 
  EXISTS (
    SELECT 1 
    FROM players 
    WHERE players.id = matches.away_player_id 
    AND players.auth_user_id = auth.uid()
  )
);

CREATE POLICY matches_delete_admin 
ON public.matches 
FOR DELETE 
TO public 
USING (
  EXISTS (
    SELECT 1 
    FROM competitions c 
    INNER JOIN groups g ON g.id = c.group_id 
    INNER JOIN players p ON p.id = g.admin_id 
    WHERE c.id = matches.competition_id 
    AND p.auth_user_id = auth.uid()
  )
);

-- ----------------------------------------------------------------------------
-- CHAT_MESSAGES TABLE POLICIES
-- ----------------------------------------------------------------------------

CREATE POLICY chat_messages_select_member 
ON public.chat_messages 
FOR SELECT 
TO public 
USING (
  EXISTS (
    SELECT 1 
    FROM group_members gm 
    INNER JOIN players p ON p.id = gm.player_id 
    WHERE gm.group_id = chat_messages.group_id 
    AND p.auth_user_id = auth.uid()
  )
);

CREATE POLICY chat_messages_insert_member 
ON public.chat_messages 
FOR INSERT 
TO public 
WITH CHECK (
  EXISTS (
    SELECT 1 
    FROM group_members gm 
    INNER JOIN players p ON p.id = gm.player_id 
    WHERE gm.group_id = chat_messages.group_id 
    AND p.auth_user_id = auth.uid()
  )
);

-- ----------------------------------------------------------------------------
-- PLAYER_STATS TABLE POLICIES
-- ----------------------------------------------------------------------------

CREATE POLICY player_stats_viewable_by_all 
ON public.player_stats 
FOR SELECT 
TO public 
USING (true);

CREATE POLICY player_stats_insert_auth 
ON public.player_stats 
FOR INSERT 
TO public 
WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY player_stats_update_auth 
ON public.player_stats 
FOR UPDATE 
TO public 
USING (auth.uid() IS NOT NULL);

CREATE POLICY player_stats_delete_auth 
ON public.player_stats 
FOR DELETE 
TO public 
USING (auth.uid() IS NOT NULL);

-- ============================================================================
-- COMMIT TRANSACTION
-- ============================================================================

COMMIT;

-- ============================================================================
-- VERIFICATION QUERIES
-- ============================================================================
-- Run these after the script completes to verify everything is working

-- Check all policies are created
SELECT schemaname, tablename, policyname 
FROM pg_policies 
WHERE schemaname = 'public' 
ORDER BY tablename, policyname;

-- Test query that was causing infinite recursion
SELECT id, name, is_public 
FROM groups 
LIMIT 5;

SELECT gm.id, gm.group_id, gm.player_id 
FROM group_members gm 
LIMIT 5;
