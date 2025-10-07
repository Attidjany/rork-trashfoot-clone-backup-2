-- ============================================================================
-- RESTORE WORKING RLS POLICIES
-- This script will drop all existing policies and create a clean, working set
-- ============================================================================

BEGIN;

-- ============================================================================
-- STEP 1: DROP ALL EXISTING POLICIES
-- ============================================================================

-- Drop all policies from all tables
DROP POLICY IF EXISTS chat_messages_insert_member ON public.chat_messages;
DROP POLICY IF EXISTS chat_messages_select_member ON public.chat_messages;
DROP POLICY IF EXISTS chat_messages_select_superadmin ON public.chat_messages;

DROP POLICY IF EXISTS competition_participants_delete_admin_or_self ON public.competition_participants;
DROP POLICY IF EXISTS competition_participants_delete_superadmin ON public.competition_participants;
DROP POLICY IF EXISTS competition_participants_insert_admin ON public.competition_participants;
DROP POLICY IF EXISTS competition_participants_select_member ON public.competition_participants;
DROP POLICY IF EXISTS competition_participants_select_superadmin ON public.competition_participants;

DROP POLICY IF EXISTS competitions_delete_admin ON public.competitions;
DROP POLICY IF EXISTS competitions_delete_superadmin ON public.competitions;
DROP POLICY IF EXISTS competitions_insert_member ON public.competitions;
DROP POLICY IF EXISTS competitions_select_member ON public.competitions;
DROP POLICY IF EXISTS competitions_select_superadmin ON public.competitions;
DROP POLICY IF EXISTS competitions_update_admin ON public.competitions;
DROP POLICY IF EXISTS competitions_update_superadmin ON public.competitions;

DROP POLICY IF EXISTS group_members_delete ON public.group_members;
DROP POLICY IF EXISTS group_members_delete_admin_or_self ON public.group_members;
DROP POLICY IF EXISTS group_members_delete_superadmin ON public.group_members;
DROP POLICY IF EXISTS group_members_insert ON public.group_members;
DROP POLICY IF EXISTS group_members_insert_admin_or_public ON public.group_members;
DROP POLICY IF EXISTS group_members_insert_superadmin ON public.group_members;
DROP POLICY IF EXISTS group_members_select ON public.group_members;
DROP POLICY IF EXISTS group_members_select_superadmin ON public.group_members;
DROP POLICY IF EXISTS group_members_select_visible ON public.group_members;
DROP POLICY IF EXISTS group_members_update ON public.group_members;

DROP POLICY IF EXISTS groups_delete ON public.groups;
DROP POLICY IF EXISTS groups_delete_admin ON public.groups;
DROP POLICY IF EXISTS groups_delete_superadmin ON public.groups;
DROP POLICY IF EXISTS groups_insert ON public.groups;
DROP POLICY IF EXISTS groups_insert_own ON public.groups;
DROP POLICY IF EXISTS groups_select ON public.groups;
DROP POLICY IF EXISTS groups_select_all_for_browsing ON public.groups;
DROP POLICY IF EXISTS groups_select_public_or_admin ON public.groups;
DROP POLICY IF EXISTS groups_select_superadmin ON public.groups;
DROP POLICY IF EXISTS groups_update ON public.groups;
DROP POLICY IF EXISTS groups_update_admin ON public.groups;
DROP POLICY IF EXISTS groups_update_superadmin ON public.groups;

DROP POLICY IF EXISTS matches_delete_admin ON public.matches;
DROP POLICY IF EXISTS matches_delete_superadmin ON public.matches;
DROP POLICY IF EXISTS matches_insert_admin ON public.matches;
DROP POLICY IF EXISTS matches_select_member ON public.matches;
DROP POLICY IF EXISTS matches_select_superadmin ON public.matches;
DROP POLICY IF EXISTS matches_update_admin_or_player ON public.matches;
DROP POLICY IF EXISTS matches_update_superadmin ON public.matches;

DROP POLICY IF EXISTS pending_members_delete_admin ON public.pending_group_members;
DROP POLICY IF EXISTS pending_members_delete_superadmin ON public.pending_group_members;
DROP POLICY IF EXISTS pending_members_insert_self ON public.pending_group_members;
DROP POLICY IF EXISTS pending_members_select_admin_or_self ON public.pending_group_members;
DROP POLICY IF EXISTS pending_members_select_superadmin ON public.pending_group_members;
DROP POLICY IF EXISTS pending_members_update_admin ON public.pending_group_members;
DROP POLICY IF EXISTS pending_members_update_superadmin ON public.pending_group_members;

DROP POLICY IF EXISTS player_stats_delete_auth ON public.player_stats;
DROP POLICY IF EXISTS player_stats_delete_superadmin ON public.player_stats;
DROP POLICY IF EXISTS player_stats_insert_auth ON public.player_stats;
DROP POLICY IF EXISTS player_stats_select_superadmin ON public.player_stats;
DROP POLICY IF EXISTS player_stats_update_auth ON public.player_stats;
DROP POLICY IF EXISTS player_stats_update_superadmin ON public.player_stats;
DROP POLICY IF EXISTS player_stats_viewable_by_all ON public.player_stats;

DROP POLICY IF EXISTS players_delete_superadmin ON public.players;
DROP POLICY IF EXISTS players_insert_own ON public.players;
DROP POLICY IF EXISTS players_select_all ON public.players;
DROP POLICY IF EXISTS players_update_own ON public.players;
DROP POLICY IF EXISTS players_update_superadmin ON public.players;
DROP POLICY IF EXISTS players_viewable_by_all ON public.players;

-- ============================================================================
-- STEP 2: CREATE CLEAN, WORKING POLICIES
-- ============================================================================

-- ----------------------------------------------------------------------------
-- PLAYERS TABLE - Everyone can see all players, users can manage their own
-- ----------------------------------------------------------------------------
CREATE POLICY players_select_all ON public.players
  FOR SELECT USING (true);

CREATE POLICY players_insert_own ON public.players
  FOR INSERT WITH CHECK (auth.uid() = auth_user_id);

CREATE POLICY players_update_own ON public.players
  FOR UPDATE USING (auth.uid() = auth_user_id);

CREATE POLICY players_delete_superadmin ON public.players
  FOR DELETE USING (is_superadmin());

CREATE POLICY players_update_superadmin ON public.players
  FOR UPDATE USING (is_superadmin());

-- ----------------------------------------------------------------------------
-- PLAYER_STATS TABLE - Everyone can view, authenticated users can manage
-- ----------------------------------------------------------------------------
CREATE POLICY player_stats_select_all ON public.player_stats
  FOR SELECT USING (true);

CREATE POLICY player_stats_insert_auth ON public.player_stats
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY player_stats_update_auth ON public.player_stats
  FOR UPDATE USING (auth.uid() IS NOT NULL);

CREATE POLICY player_stats_delete_auth ON public.player_stats
  FOR DELETE USING (auth.uid() IS NOT NULL);

CREATE POLICY player_stats_superadmin ON public.player_stats
  FOR ALL USING (is_superadmin());

-- ----------------------------------------------------------------------------
-- GROUPS TABLE - Public groups visible to all, members see their groups
-- ----------------------------------------------------------------------------
CREATE POLICY groups_select_all ON public.groups
  FOR SELECT USING (
    is_public = true 
    OR is_superadmin()
    OR EXISTS (
      SELECT 1 FROM group_members gm
      JOIN players p ON p.id = gm.player_id
      WHERE gm.group_id = groups.id 
      AND p.auth_user_id = auth.uid()
    )
  );

CREATE POLICY groups_insert_own ON public.groups
  FOR INSERT WITH CHECK (
    auth.uid() IS NOT NULL 
    AND admin_id IN (
      SELECT id FROM players WHERE auth_user_id = auth.uid()
    )
  );

CREATE POLICY groups_update_admin ON public.groups
  FOR UPDATE USING (
    is_superadmin()
    OR admin_id IN (
      SELECT id FROM players WHERE auth_user_id = auth.uid()
    )
  );

CREATE POLICY groups_delete_admin ON public.groups
  FOR DELETE USING (
    is_superadmin()
    OR admin_id IN (
      SELECT id FROM players WHERE auth_user_id = auth.uid()
    )
  );

-- ----------------------------------------------------------------------------
-- GROUP_MEMBERS TABLE - Members see their group's members, public groups visible
-- ----------------------------------------------------------------------------
CREATE POLICY group_members_select_all ON public.group_members
  FOR SELECT USING (
    is_superadmin()
    OR EXISTS (
      SELECT 1 FROM groups g 
      WHERE g.id = group_members.group_id 
      AND g.is_public = true
    )
    OR EXISTS (
      SELECT 1 FROM group_members gm2
      JOIN players p ON p.id = gm2.player_id
      WHERE gm2.group_id = group_members.group_id 
      AND p.auth_user_id = auth.uid()
    )
  );

CREATE POLICY group_members_insert_admin_or_public ON public.group_members
  FOR INSERT WITH CHECK (
    is_superadmin()
    OR group_id IN (
      SELECT g.id FROM groups g
      JOIN players p ON p.id = g.admin_id
      WHERE p.auth_user_id = auth.uid()
    )
    OR (
      player_id IN (
        SELECT id FROM players WHERE auth_user_id = auth.uid()
      )
      AND group_id IN (
        SELECT id FROM groups WHERE is_public = true
      )
    )
  );

CREATE POLICY group_members_update_admin ON public.group_members
  FOR UPDATE USING (
    is_superadmin()
    OR group_id IN (
      SELECT g.id FROM groups g
      JOIN players p ON p.id = g.admin_id
      WHERE p.auth_user_id = auth.uid()
    )
  );

CREATE POLICY group_members_delete_admin_or_self ON public.group_members
  FOR DELETE USING (
    is_superadmin()
    OR group_id IN (
      SELECT g.id FROM groups g
      JOIN players p ON p.id = g.admin_id
      WHERE p.auth_user_id = auth.uid()
    )
    OR player_id IN (
      SELECT id FROM players WHERE auth_user_id = auth.uid()
    )
  );

-- ----------------------------------------------------------------------------
-- PENDING_GROUP_MEMBERS TABLE - Join requests
-- ----------------------------------------------------------------------------
CREATE POLICY pending_members_select_admin_or_self ON public.pending_group_members
  FOR SELECT USING (
    is_superadmin()
    OR player_id IN (
      SELECT id FROM players WHERE auth_user_id = auth.uid()
    )
    OR group_id IN (
      SELECT g.id FROM groups g
      JOIN players p ON p.id = g.admin_id
      WHERE p.auth_user_id = auth.uid()
    )
  );

CREATE POLICY pending_members_insert_self ON public.pending_group_members
  FOR INSERT WITH CHECK (
    player_id IN (
      SELECT id FROM players WHERE auth_user_id = auth.uid()
    )
  );

CREATE POLICY pending_members_update_admin ON public.pending_group_members
  FOR UPDATE USING (
    is_superadmin()
    OR group_id IN (
      SELECT g.id FROM groups g
      JOIN players p ON p.id = g.admin_id
      WHERE p.auth_user_id = auth.uid()
    )
  );

CREATE POLICY pending_members_delete_admin_or_self ON public.pending_group_members
  FOR DELETE USING (
    is_superadmin()
    OR player_id IN (
      SELECT id FROM players WHERE auth_user_id = auth.uid()
    )
    OR group_id IN (
      SELECT g.id FROM groups g
      JOIN players p ON p.id = g.admin_id
      WHERE p.auth_user_id = auth.uid()
    )
  );

-- ----------------------------------------------------------------------------
-- COMPETITIONS TABLE - Members see their group's competitions
-- ----------------------------------------------------------------------------
CREATE POLICY competitions_select_member ON public.competitions
  FOR SELECT USING (
    is_superadmin()
    OR EXISTS (
      SELECT 1 FROM group_members gm
      JOIN players p ON p.id = gm.player_id
      WHERE gm.group_id = competitions.group_id 
      AND p.auth_user_id = auth.uid()
    )
  );

CREATE POLICY competitions_insert_member ON public.competitions
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM group_members gm
      JOIN players p ON p.id = gm.player_id
      WHERE gm.group_id = competitions.group_id 
      AND p.auth_user_id = auth.uid()
    )
  );

CREATE POLICY competitions_update_admin ON public.competitions
  FOR UPDATE USING (
    is_superadmin()
    OR group_id IN (
      SELECT g.id FROM groups g
      JOIN players p ON p.id = g.admin_id
      WHERE p.auth_user_id = auth.uid()
    )
  );

CREATE POLICY competitions_delete_admin ON public.competitions
  FOR DELETE USING (
    is_superadmin()
    OR group_id IN (
      SELECT g.id FROM groups g
      JOIN players p ON p.id = g.admin_id
      WHERE p.auth_user_id = auth.uid()
    )
  );

-- ----------------------------------------------------------------------------
-- COMPETITION_PARTICIPANTS TABLE
-- ----------------------------------------------------------------------------
CREATE POLICY competition_participants_select_member ON public.competition_participants
  FOR SELECT USING (
    is_superadmin()
    OR EXISTS (
      SELECT 1 FROM competitions c
      JOIN group_members gm ON gm.group_id = c.group_id
      JOIN players p ON p.id = gm.player_id
      WHERE c.id = competition_participants.competition_id 
      AND p.auth_user_id = auth.uid()
    )
  );

CREATE POLICY competition_participants_insert_admin ON public.competition_participants
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM competitions c
      JOIN groups g ON g.id = c.group_id
      JOIN players p ON p.id = g.admin_id
      WHERE c.id = competition_participants.competition_id 
      AND p.auth_user_id = auth.uid()
    )
  );

CREATE POLICY competition_participants_delete_admin_or_self ON public.competition_participants
  FOR DELETE USING (
    is_superadmin()
    OR player_id IN (
      SELECT id FROM players WHERE auth_user_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM competitions c
      JOIN groups g ON g.id = c.group_id
      JOIN players p ON p.id = g.admin_id
      WHERE c.id = competition_participants.competition_id 
      AND p.auth_user_id = auth.uid()
    )
  );

-- ----------------------------------------------------------------------------
-- MATCHES TABLE
-- ----------------------------------------------------------------------------
CREATE POLICY matches_select_member ON public.matches
  FOR SELECT USING (
    is_superadmin()
    OR EXISTS (
      SELECT 1 FROM competitions c
      JOIN group_members gm ON gm.group_id = c.group_id
      JOIN players p ON p.id = gm.player_id
      WHERE c.id = matches.competition_id 
      AND p.auth_user_id = auth.uid()
    )
  );

CREATE POLICY matches_insert_admin ON public.matches
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM competitions c
      JOIN groups g ON g.id = c.group_id
      JOIN players p ON p.id = g.admin_id
      WHERE c.id = matches.competition_id 
      AND p.auth_user_id = auth.uid()
    )
  );

CREATE POLICY matches_update_admin_or_player ON public.matches
  FOR UPDATE USING (
    is_superadmin()
    OR EXISTS (
      SELECT 1 FROM competitions c
      JOIN groups g ON g.id = c.group_id
      JOIN players p ON p.id = g.admin_id
      WHERE c.id = matches.competition_id 
      AND p.auth_user_id = auth.uid()
    )
    OR home_player_id IN (
      SELECT id FROM players WHERE auth_user_id = auth.uid()
    )
    OR away_player_id IN (
      SELECT id FROM players WHERE auth_user_id = auth.uid()
    )
  );

CREATE POLICY matches_delete_admin ON public.matches
  FOR DELETE USING (
    is_superadmin()
    OR EXISTS (
      SELECT 1 FROM competitions c
      JOIN groups g ON g.id = c.group_id
      JOIN players p ON p.id = g.admin_id
      WHERE c.id = matches.competition_id 
      AND p.auth_user_id = auth.uid()
    )
  );

-- ----------------------------------------------------------------------------
-- CHAT_MESSAGES TABLE
-- ----------------------------------------------------------------------------
CREATE POLICY chat_messages_select_member ON public.chat_messages
  FOR SELECT USING (
    is_superadmin()
    OR EXISTS (
      SELECT 1 FROM group_members gm
      JOIN players p ON p.id = gm.player_id
      WHERE gm.group_id = chat_messages.group_id 
      AND p.auth_user_id = auth.uid()
    )
  );

CREATE POLICY chat_messages_insert_member ON public.chat_messages
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM group_members gm
      JOIN players p ON p.id = gm.player_id
      WHERE gm.group_id = chat_messages.group_id 
      AND p.auth_user_id = auth.uid()
    )
  );

COMMIT;

-- ============================================================================
-- VERIFICATION QUERIES
-- ============================================================================

-- Run these to verify the policies are working:

-- 1. Check policy counts (should be much cleaner now)
SELECT 
  schemaname,
  tablename,
  COUNT(*) as policy_count,
  array_agg(DISTINCT cmd) as operations
FROM pg_policies 
WHERE schemaname = 'public'
GROUP BY schemaname, tablename
ORDER BY tablename;

-- 2. Test group visibility (should show groups)
SELECT id, name, is_public, 
  (SELECT COUNT(*) FROM group_members WHERE group_id = groups.id) as member_count
FROM groups
LIMIT 5;

-- 3. Test group members visibility (should show members)
SELECT gm.id, gm.group_id, p.name as player_name
FROM group_members gm
JOIN players p ON p.id = gm.player_id
LIMIT 10;
