-- ============================================================================
-- FINAL CLEAN RLS POLICIES - NO INFINITE RECURSION
-- ============================================================================
-- This script drops ALL existing policies and recreates them properly
-- Run this in Supabase SQL Editor
-- Date: 2025-10-07
-- ============================================================================

BEGIN;

-- ============================================================================
-- STEP 1: DROP ALL EXISTING POLICIES
-- ============================================================================

-- Drop all policies on players table
DROP POLICY IF EXISTS players_viewable_by_all ON public.players;
DROP POLICY IF EXISTS players_insert_own ON public.players;
DROP POLICY IF EXISTS players_update_own ON public.players;

-- Drop all policies on groups table
DROP POLICY IF EXISTS groups_select_public_or_admin ON public.groups;
DROP POLICY IF EXISTS groups_select_member ON public.groups;
DROP POLICY IF EXISTS groups_insert_own ON public.groups;
DROP POLICY IF EXISTS groups_update_admin ON public.groups;
DROP POLICY IF EXISTS groups_delete_admin ON public.groups;

-- Drop all policies on group_members table
DROP POLICY IF EXISTS group_members_select_visible ON public.group_members;
DROP POLICY IF EXISTS group_members_insert_admin_or_public ON public.group_members;
DROP POLICY IF EXISTS group_members_delete_admin_or_self ON public.group_members;

-- Drop all policies on pending_group_members table
DROP POLICY IF EXISTS pending_members_select_admin_or_self ON public.pending_group_members;
DROP POLICY IF EXISTS pending_members_insert_self ON public.pending_group_members;
DROP POLICY IF EXISTS pending_members_update_admin ON public.pending_group_members;
DROP POLICY IF EXISTS pending_members_delete_admin ON public.pending_group_members;

-- Drop all policies on competitions table
DROP POLICY IF EXISTS competitions_select_member ON public.competitions;
DROP POLICY IF EXISTS competitions_insert_member ON public.competitions;
DROP POLICY IF EXISTS competitions_update_admin ON public.competitions;
DROP POLICY IF EXISTS competitions_delete_admin ON public.competitions;

-- Drop all policies on competition_participants table
DROP POLICY IF EXISTS competition_participants_select_member ON public.competition_participants;
DROP POLICY IF EXISTS competition_participants_insert_admin ON public.competition_participants;
DROP POLICY IF EXISTS competition_participants_delete_admin_or_self ON public.competition_participants;

-- Drop all policies on matches table
DROP POLICY IF EXISTS matches_select_member ON public.matches;
DROP POLICY IF EXISTS matches_insert_admin ON public.matches;
DROP POLICY IF EXISTS matches_update_admin_or_player ON public.matches;
DROP POLICY IF EXISTS matches_delete_admin ON public.matches;

-- Drop all policies on chat_messages table
DROP POLICY IF EXISTS chat_messages_select_member ON public.chat_messages;
DROP POLICY IF EXISTS chat_messages_insert_member ON public.chat_messages;

-- Drop all policies on player_stats table
DROP POLICY IF EXISTS player_stats_viewable_by_all ON public.player_stats;
DROP POLICY IF EXISTS player_stats_insert_auth ON public.player_stats;
DROP POLICY IF EXISTS player_stats_update_auth ON public.player_stats;
DROP POLICY IF EXISTS player_stats_delete_auth ON public.player_stats;

-- ============================================================================
-- STEP 2: CREATE CLEAN POLICIES WITHOUT CIRCULAR DEPENDENCIES
-- ============================================================================

-- ----------------------------------------------------------------------------
-- PLAYERS TABLE - Base table, no dependencies
-- ----------------------------------------------------------------------------

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
-- GROUPS TABLE - Only depends on players (no circular dependency)
-- ----------------------------------------------------------------------------

-- Public groups are visible to everyone, admins can see their own groups
CREATE POLICY groups_select_public_or_admin 
ON public.groups 
FOR SELECT 
TO public 
USING (
  is_public = true 
  OR admin_id IN (
    SELECT id FROM players WHERE auth_user_id = auth.uid()
  )
);

-- Authenticated users can create groups (must be admin of their own group)
CREATE POLICY groups_insert_own 
ON public.groups 
FOR INSERT 
TO public 
WITH CHECK (
  auth.uid() IS NOT NULL 
  AND admin_id IN (
    SELECT id FROM players WHERE auth_user_id = auth.uid()
  )
);

-- Only group admins can update their groups
CREATE POLICY groups_update_admin 
ON public.groups 
FOR UPDATE 
TO public 
USING (
  admin_id IN (
    SELECT id FROM players WHERE auth_user_id = auth.uid()
  )
);

-- Only group admins can delete their groups
CREATE POLICY groups_delete_admin 
ON public.groups 
FOR DELETE 
TO public 
USING (
  admin_id IN (
    SELECT id FROM players WHERE auth_user_id = auth.uid()
  )
);

-- ----------------------------------------------------------------------------
-- GROUP_MEMBERS TABLE - Depends on groups and players (no circular back to groups)
-- ----------------------------------------------------------------------------

-- Members can see group_members for:
-- 1. Public groups (direct check on groups.is_public, no recursion)
-- 2. Their own membership records
-- 3. Groups they admin
CREATE POLICY group_members_select_visible 
ON public.group_members 
FOR SELECT 
TO public 
USING (
  -- Public groups: direct check, no recursion
  EXISTS (
    SELECT 1 FROM groups g 
    WHERE g.id = group_members.group_id 
    AND g.is_public = true
  )
  OR
  -- Own membership record
  player_id IN (
    SELECT id FROM players WHERE auth_user_id = auth.uid()
  )
  OR
  -- Groups where user is admin
  group_id IN (
    SELECT g.id 
    FROM groups g 
    JOIN players p ON p.id = g.admin_id 
    WHERE p.auth_user_id = auth.uid()
  )
);

-- Users can join public groups themselves, or admins can add anyone
CREATE POLICY group_members_insert_admin_or_public 
ON public.group_members 
FOR INSERT 
TO public 
WITH CHECK (
  -- Admin can add anyone
  group_id IN (
    SELECT g.id 
    FROM groups g 
    JOIN players p ON p.id = g.admin_id 
    WHERE p.auth_user_id = auth.uid()
  )
  OR
  -- User can join public groups themselves
  (
    player_id IN (
      SELECT id FROM players WHERE auth_user_id = auth.uid()
    )
    AND EXISTS (
      SELECT 1 FROM groups g 
      WHERE g.id = group_members.group_id 
      AND g.is_public = true
    )
  )
);

-- Users can leave groups, admins can remove anyone
CREATE POLICY group_members_delete_admin_or_self 
ON public.group_members 
FOR DELETE 
TO public 
USING (
  -- User can leave
  player_id IN (
    SELECT id FROM players WHERE auth_user_id = auth.uid()
  )
  OR
  -- Admin can remove
  group_id IN (
    SELECT g.id 
    FROM groups g 
    JOIN players p ON p.id = g.admin_id 
    WHERE p.auth_user_id = auth.uid()
  )
);

-- ----------------------------------------------------------------------------
-- PENDING_GROUP_MEMBERS TABLE
-- ----------------------------------------------------------------------------

CREATE POLICY pending_members_select_admin_or_self 
ON public.pending_group_members 
FOR SELECT 
TO public 
USING (
  -- User can see their own requests
  EXISTS (
    SELECT 1 FROM players 
    WHERE id = pending_group_members.player_id 
    AND auth_user_id = auth.uid()
  )
  OR
  -- Admin can see requests for their groups
  EXISTS (
    SELECT 1 
    FROM groups g 
    JOIN players p ON p.id = g.admin_id 
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
    SELECT 1 FROM players 
    WHERE id = pending_group_members.player_id 
    AND auth_user_id = auth.uid()
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
    JOIN players p ON p.id = g.admin_id 
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
    JOIN players p ON p.id = g.admin_id 
    WHERE g.id = pending_group_members.group_id 
    AND p.auth_user_id = auth.uid()
  )
);

-- ----------------------------------------------------------------------------
-- COMPETITIONS TABLE
-- ----------------------------------------------------------------------------

CREATE POLICY competitions_select_member 
ON public.competitions 
FOR SELECT 
TO public 
USING (
  EXISTS (
    SELECT 1 
    FROM group_members gm 
    JOIN players p ON p.id = gm.player_id 
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
    JOIN players p ON p.id = gm.player_id 
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
    JOIN players p ON p.id = g.admin_id 
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
    JOIN players p ON p.id = g.admin_id 
    WHERE g.id = competitions.group_id 
    AND p.auth_user_id = auth.uid()
  )
);

-- ----------------------------------------------------------------------------
-- COMPETITION_PARTICIPANTS TABLE
-- ----------------------------------------------------------------------------

CREATE POLICY competition_participants_select_member 
ON public.competition_participants 
FOR SELECT 
TO public 
USING (
  EXISTS (
    SELECT 1 
    FROM competitions c 
    JOIN group_members gm ON gm.group_id = c.group_id 
    JOIN players p ON p.id = gm.player_id 
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
    JOIN groups g ON g.id = c.group_id 
    JOIN players p ON p.id = g.admin_id 
    WHERE c.id = competition_participants.competition_id 
    AND p.auth_user_id = auth.uid()
  )
);

CREATE POLICY competition_participants_delete_admin_or_self 
ON public.competition_participants 
FOR DELETE 
TO public 
USING (
  -- User can leave competition
  EXISTS (
    SELECT 1 FROM players 
    WHERE id = competition_participants.player_id 
    AND auth_user_id = auth.uid()
  )
  OR
  -- Admin can remove anyone
  EXISTS (
    SELECT 1 
    FROM competitions c 
    JOIN groups g ON g.id = c.group_id 
    JOIN players p ON p.id = g.admin_id 
    WHERE c.id = competition_participants.competition_id 
    AND p.auth_user_id = auth.uid()
  )
);

-- ----------------------------------------------------------------------------
-- MATCHES TABLE
-- ----------------------------------------------------------------------------

CREATE POLICY matches_select_member 
ON public.matches 
FOR SELECT 
TO public 
USING (
  EXISTS (
    SELECT 1 
    FROM competitions c 
    JOIN group_members gm ON gm.group_id = c.group_id 
    JOIN players p ON p.id = gm.player_id 
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
    JOIN groups g ON g.id = c.group_id 
    JOIN players p ON p.id = g.admin_id 
    WHERE c.id = matches.competition_id 
    AND p.auth_user_id = auth.uid()
  )
);

CREATE POLICY matches_update_admin_or_player 
ON public.matches 
FOR UPDATE 
TO public 
USING (
  -- Admin can update
  EXISTS (
    SELECT 1 
    FROM competitions c 
    JOIN groups g ON g.id = c.group_id 
    JOIN players p ON p.id = g.admin_id 
    WHERE c.id = matches.competition_id 
    AND p.auth_user_id = auth.uid()
  )
  OR
  -- Home player can update
  EXISTS (
    SELECT 1 FROM players 
    WHERE id = matches.home_player_id 
    AND auth_user_id = auth.uid()
  )
  OR
  -- Away player can update
  EXISTS (
    SELECT 1 FROM players 
    WHERE id = matches.away_player_id 
    AND auth_user_id = auth.uid()
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
    JOIN groups g ON g.id = c.group_id 
    JOIN players p ON p.id = g.admin_id 
    WHERE c.id = matches.competition_id 
    AND p.auth_user_id = auth.uid()
  )
);

-- ----------------------------------------------------------------------------
-- CHAT_MESSAGES TABLE
-- ----------------------------------------------------------------------------

CREATE POLICY chat_messages_select_member 
ON public.chat_messages 
FOR SELECT 
TO public 
USING (
  EXISTS (
    SELECT 1 
    FROM group_members gm 
    JOIN players p ON p.id = gm.player_id 
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
    JOIN players p ON p.id = gm.player_id 
    WHERE gm.group_id = chat_messages.group_id 
    AND p.auth_user_id = auth.uid()
  )
);

-- ----------------------------------------------------------------------------
-- PLAYER_STATS TABLE
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
-- Run these after applying the policies to verify everything works:

-- 1. Check all policies are created
-- SELECT schemaname, tablename, policyname 
-- FROM pg_policies 
-- WHERE schemaname = 'public' 
-- ORDER BY tablename, policyname;

-- 2. Test as a user (replace with actual user ID)
-- SET LOCAL role TO authenticated;
-- SET LOCAL request.jwt.claims TO '{"sub": "your-user-uuid"}';
-- SELECT * FROM groups;
-- RESET role;
