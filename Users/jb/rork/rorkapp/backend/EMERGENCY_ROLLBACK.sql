-- EMERGENCY ROLLBACK - RESTORE BASIC FUNCTIONALITY
-- Run this immediately to restore app functionality

-- Drop all existing policies on critical tables
DROP POLICY IF EXISTS players_viewable_by_all ON players;
DROP POLICY IF EXISTS players_insert_own ON players;
DROP POLICY IF EXISTS players_update_own ON players;
DROP POLICY IF EXISTS players_delete_superadmin ON players;
DROP POLICY IF EXISTS players_update_superadmin ON players;

DROP POLICY IF EXISTS group_members_select ON group_members;
DROP POLICY IF EXISTS group_members_insert ON group_members;
DROP POLICY IF EXISTS group_members_update ON group_members;
DROP POLICY IF EXISTS group_members_delete ON group_members;

DROP POLICY IF EXISTS groups_select ON groups;
DROP POLICY IF EXISTS groups_insert ON groups;
DROP POLICY IF EXISTS groups_update ON groups;
DROP POLICY IF EXISTS groups_delete ON groups;

-- PLAYERS TABLE - SIMPLE AND WORKING
-- Everyone can see all players (needed for matches, stats, etc)
CREATE POLICY players_select_all ON players
  FOR SELECT
  USING (true);

-- Users can insert their own player record
CREATE POLICY players_insert_own ON players
  FOR INSERT
  WITH CHECK (auth.uid() = auth_user_id);

-- Users can update their own player record
CREATE POLICY players_update_own ON players
  FOR UPDATE
  USING (auth.uid() = auth_user_id);

-- Superadmins can update any player
CREATE POLICY players_update_superadmin ON players
  FOR UPDATE
  USING (is_superadmin());

-- Superadmins can delete any player
CREATE POLICY players_delete_superadmin ON players
  FOR DELETE
  USING (is_superadmin());

-- GROUP_MEMBERS TABLE - SIMPLE AND WORKING
-- Users can see group members if they are in the same group
CREATE POLICY group_members_select ON group_members
  FOR SELECT
  USING (
    -- User is a member of this group
    EXISTS (
      SELECT 1 FROM group_members gm2
      WHERE gm2.group_id = group_members.group_id
      AND gm2.player_id IN (
        SELECT id FROM players WHERE auth_user_id = auth.uid()
      )
    )
    OR
    -- Or the group is public
    EXISTS (
      SELECT 1 FROM groups g
      WHERE g.id = group_members.group_id
      AND g.visibility = 'public'
    )
    OR
    -- Or user is superadmin
    is_superadmin()
  );

-- Users can be added to groups by group admins
CREATE POLICY group_members_insert ON group_members
  FOR INSERT
  WITH CHECK (
    -- Group admin can add members
    EXISTS (
      SELECT 1 FROM group_members gm
      WHERE gm.group_id = group_members.group_id
      AND gm.player_id IN (
        SELECT id FROM players WHERE auth_user_id = auth.uid()
      )
      AND gm.role IN ('admin', 'owner')
    )
    OR
    -- Or superadmin
    is_superadmin()
  );

-- Group admins can update member roles
CREATE POLICY group_members_update ON group_members
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM group_members gm
      WHERE gm.group_id = group_members.group_id
      AND gm.player_id IN (
        SELECT id FROM players WHERE auth_user_id = auth.uid()
      )
      AND gm.role IN ('admin', 'owner')
    )
    OR
    is_superadmin()
  );

-- Group admins can remove members
CREATE POLICY group_members_delete ON group_members
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM group_members gm
      WHERE gm.group_id = group_members.group_id
      AND gm.player_id IN (
        SELECT id FROM players WHERE auth_user_id = auth.uid()
      )
      AND gm.role IN ('admin', 'owner')
    )
    OR
    is_superadmin()
  );

-- GROUPS TABLE - SIMPLE AND WORKING
-- Users can see groups they are members of or public groups
CREATE POLICY groups_select ON groups
  FOR SELECT
  USING (
    -- User is a member of this group
    EXISTS (
      SELECT 1 FROM group_members gm
      WHERE gm.group_id = groups.id
      AND gm.player_id IN (
        SELECT id FROM players WHERE auth_user_id = auth.uid()
      )
    )
    OR
    -- Or the group is public
    visibility = 'public'
    OR
    -- Or user is superadmin
    is_superadmin()
  );

-- Any authenticated user can create a group
CREATE POLICY groups_insert ON groups
  FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

-- Group admins can update their group
CREATE POLICY groups_update ON groups
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM group_members gm
      WHERE gm.group_id = groups.id
      AND gm.player_id IN (
        SELECT id FROM players WHERE auth_user_id = auth.uid()
      )
      AND gm.role IN ('admin', 'owner')
    )
    OR
    is_superadmin()
  );

-- Group owners can delete their group
CREATE POLICY groups_delete ON groups
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM group_members gm
      WHERE gm.group_id = groups.id
      AND gm.player_id IN (
        SELECT id FROM players WHERE auth_user_id = auth.uid()
      )
      AND gm.role = 'owner'
    )
    OR
    is_superadmin()
  );

-- Verify the policies are in place
SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd
FROM pg_policies
WHERE tablename IN ('players', 'group_members', 'groups')
ORDER BY tablename, cmd, policyname;
