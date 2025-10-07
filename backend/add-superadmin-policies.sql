-- Add superadmin policies to all tables
-- This allows superadmin to view and manage all data

-- Helper function to check if user is superadmin
CREATE OR REPLACE FUNCTION is_superadmin()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM players
    WHERE auth_user_id = auth.uid()
    AND role = 'super_admin'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- GROUPS: Superadmin can view all groups
DROP POLICY IF EXISTS groups_select_superadmin ON groups;
CREATE POLICY groups_select_superadmin ON groups
  AS PERMISSIVE FOR SELECT
  TO public
  USING (is_superadmin());

-- GROUPS: Superadmin can update all groups
DROP POLICY IF EXISTS groups_update_superadmin ON groups;
CREATE POLICY groups_update_superadmin ON groups
  AS PERMISSIVE FOR UPDATE
  TO public
  USING (is_superadmin());

-- GROUPS: Superadmin can delete all groups
DROP POLICY IF EXISTS groups_delete_superadmin ON groups;
CREATE POLICY groups_delete_superadmin ON groups
  AS PERMISSIVE FOR DELETE
  TO public
  USING (is_superadmin());

-- GROUP_MEMBERS: Superadmin can view all group members
DROP POLICY IF EXISTS group_members_select_superadmin ON group_members;
CREATE POLICY group_members_select_superadmin ON group_members
  AS PERMISSIVE FOR SELECT
  TO public
  USING (is_superadmin());

-- GROUP_MEMBERS: Superadmin can insert group members
DROP POLICY IF EXISTS group_members_insert_superadmin ON group_members;
CREATE POLICY group_members_insert_superadmin ON group_members
  AS PERMISSIVE FOR INSERT
  TO public
  WITH CHECK (is_superadmin());

-- GROUP_MEMBERS: Superadmin can delete group members
DROP POLICY IF EXISTS group_members_delete_superadmin ON group_members;
CREATE POLICY group_members_delete_superadmin ON group_members
  AS PERMISSIVE FOR DELETE
  TO public
  USING (is_superadmin());

-- COMPETITIONS: Superadmin can view all competitions
DROP POLICY IF EXISTS competitions_select_superadmin ON competitions;
CREATE POLICY competitions_select_superadmin ON competitions
  AS PERMISSIVE FOR SELECT
  TO public
  USING (is_superadmin());

-- COMPETITIONS: Superadmin can update all competitions
DROP POLICY IF EXISTS competitions_update_superadmin ON competitions;
CREATE POLICY competitions_update_superadmin ON competitions
  AS PERMISSIVE FOR UPDATE
  TO public
  USING (is_superadmin());

-- COMPETITIONS: Superadmin can delete all competitions
DROP POLICY IF EXISTS competitions_delete_superadmin ON competitions;
CREATE POLICY competitions_delete_superadmin ON competitions
  AS PERMISSIVE FOR DELETE
  TO public
  USING (is_superadmin());

-- COMPETITION_PARTICIPANTS: Superadmin can view all participants
DROP POLICY IF EXISTS competition_participants_select_superadmin ON competition_participants;
CREATE POLICY competition_participants_select_superadmin ON competition_participants
  AS PERMISSIVE FOR SELECT
  TO public
  USING (is_superadmin());

-- COMPETITION_PARTICIPANTS: Superadmin can delete participants
DROP POLICY IF EXISTS competition_participants_delete_superadmin ON competition_participants;
CREATE POLICY competition_participants_delete_superadmin ON competition_participants
  AS PERMISSIVE FOR DELETE
  TO public
  USING (is_superadmin());

-- MATCHES: Superadmin can view all matches
DROP POLICY IF EXISTS matches_select_superadmin ON matches;
CREATE POLICY matches_select_superadmin ON matches
  AS PERMISSIVE FOR SELECT
  TO public
  USING (is_superadmin());

-- MATCHES: Superadmin can update all matches
DROP POLICY IF EXISTS matches_update_superadmin ON matches;
CREATE POLICY matches_update_superadmin ON matches
  AS PERMISSIVE FOR UPDATE
  TO public
  USING (is_superadmin());

-- MATCHES: Superadmin can delete all matches
DROP POLICY IF EXISTS matches_delete_superadmin ON matches;
CREATE POLICY matches_delete_superadmin ON matches
  AS PERMISSIVE FOR DELETE
  TO public
  USING (is_superadmin());

-- PENDING_GROUP_MEMBERS: Superadmin can view all pending members
DROP POLICY IF EXISTS pending_members_select_superadmin ON pending_group_members;
CREATE POLICY pending_members_select_superadmin ON pending_group_members
  AS PERMISSIVE FOR SELECT
  TO public
  USING (is_superadmin());

-- PENDING_GROUP_MEMBERS: Superadmin can update pending members
DROP POLICY IF EXISTS pending_members_update_superadmin ON pending_group_members;
CREATE POLICY pending_members_update_superadmin ON pending_group_members
  AS PERMISSIVE FOR UPDATE
  TO public
  USING (is_superadmin());

-- PENDING_GROUP_MEMBERS: Superadmin can delete pending members
DROP POLICY IF EXISTS pending_members_delete_superadmin ON pending_group_members;
CREATE POLICY pending_members_delete_superadmin ON pending_group_members
  AS PERMISSIVE FOR DELETE
  TO public
  USING (is_superadmin());

-- CHAT_MESSAGES: Superadmin can view all chat messages
DROP POLICY IF EXISTS chat_messages_select_superadmin ON chat_messages;
CREATE POLICY chat_messages_select_superadmin ON chat_messages
  AS PERMISSIVE FOR SELECT
  TO public
  USING (is_superadmin());

-- PLAYERS: Superadmin can update all players
DROP POLICY IF EXISTS players_update_superadmin ON players;
CREATE POLICY players_update_superadmin ON players
  AS PERMISSIVE FOR UPDATE
  TO public
  USING (is_superadmin());

-- PLAYERS: Superadmin can delete all players
DROP POLICY IF EXISTS players_delete_superadmin ON players;
CREATE POLICY players_delete_superadmin ON players
  AS PERMISSIVE FOR DELETE
  TO public
  USING (is_superadmin());

-- PLAYER_STATS: Superadmin can view all player stats
DROP POLICY IF EXISTS player_stats_select_superadmin ON player_stats;
CREATE POLICY player_stats_select_superadmin ON player_stats
  AS PERMISSIVE FOR SELECT
  TO public
  USING (is_superadmin());

-- PLAYER_STATS: Superadmin can update all player stats
DROP POLICY IF EXISTS player_stats_update_superadmin ON player_stats;
CREATE POLICY player_stats_update_superadmin ON player_stats
  AS PERMISSIVE FOR UPDATE
  TO public
  USING (is_superadmin());

-- PLAYER_STATS: Superadmin can delete all player stats
DROP POLICY IF EXISTS player_stats_delete_superadmin ON player_stats;
CREATE POLICY player_stats_delete_superadmin ON player_stats
  AS PERMISSIVE FOR DELETE
  TO public
  USING (is_superadmin());

-- Fix groups visibility: All groups should be visible for browsing (not just public ones)
-- Users can see all groups to request to join them
DROP POLICY IF EXISTS groups_select_all_for_browsing ON groups;
CREATE POLICY groups_select_all_for_browsing ON groups
  AS PERMISSIVE FOR SELECT
  TO public
  USING (true);

-- Verify policies
SELECT 
  schemaname,
  tablename,
  policyname,
  cmd,
  CASE 
    WHEN policyname LIKE '%superadmin%' THEN '✅ Superadmin policy'
    WHEN policyname = 'groups_select_all_for_browsing' THEN '✅ Browse all groups'
    ELSE ''
  END as notes
FROM pg_policies
WHERE schemaname = 'public'
  AND (policyname LIKE '%superadmin%' OR policyname = 'groups_select_all_for_browsing')
ORDER BY tablename, policyname;
