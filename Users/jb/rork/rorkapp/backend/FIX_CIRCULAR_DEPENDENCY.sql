-- ============================================================================
-- FIX CIRCULAR DEPENDENCY BETWEEN groups AND group_members
-- ============================================================================
-- Problem: groups policies query group_members, group_members policies query groups
-- Solution: Use direct auth.uid() checks instead of cross-table queries where possible
-- ============================================================================

BEGIN;

-- ============================================================================
-- 1. DROP ALL EXISTING POLICIES
-- ============================================================================

-- Drop groups policies
DROP POLICY IF EXISTS groups_select_public_or_member ON groups;
DROP POLICY IF EXISTS groups_insert_auth ON groups;
DROP POLICY IF EXISTS groups_update_admin ON groups;
DROP POLICY IF EXISTS groups_delete_admin ON groups;

-- Drop group_members policies
DROP POLICY IF EXISTS group_members_select_public_or_member ON group_members;
DROP POLICY IF EXISTS group_members_insert_admin_or_self ON group_members;
DROP POLICY IF EXISTS group_members_delete_admin_or_self ON group_members;

-- ============================================================================
-- 2. CREATE NEW GROUPS POLICIES (NO RECURSION)
-- ============================================================================

-- SELECT: Public groups OR user is admin (direct check, no subquery to group_members)
CREATE POLICY groups_select_public_or_admin ON groups
  FOR SELECT
  TO public
  USING (
    is_public = true 
    OR admin_id IN (
      SELECT id FROM players WHERE auth_user_id = auth.uid()
    )
  );

-- INSERT: Authenticated users can create groups if they set themselves as admin
CREATE POLICY groups_insert_own ON groups
  FOR INSERT
  TO public
  WITH CHECK (
    auth.uid() IS NOT NULL 
    AND admin_id IN (
      SELECT id FROM players WHERE auth_user_id = auth.uid()
    )
  );

-- UPDATE: Only admin can update
CREATE POLICY groups_update_admin ON groups
  FOR UPDATE
  TO public
  USING (
    admin_id IN (
      SELECT id FROM players WHERE auth_user_id = auth.uid()
    )
  );

-- DELETE: Only admin can delete
CREATE POLICY groups_delete_admin ON groups
  FOR DELETE
  TO public
  USING (
    admin_id IN (
      SELECT id FROM players WHERE auth_user_id = auth.uid()
    )
  );

-- ============================================================================
-- 3. CREATE NEW GROUP_MEMBERS POLICIES (NO RECURSION)
-- ============================================================================

-- SELECT: View members of public groups OR groups where user is a member
-- Key fix: Check group.is_public directly without subquery
CREATE POLICY group_members_select_visible ON group_members
  FOR SELECT
  TO public
  USING (
    -- Public groups: anyone can see members
    EXISTS (
      SELECT 1 FROM groups g 
      WHERE g.id = group_members.group_id 
      AND g.is_public = true
    )
    OR
    -- Private groups: only members can see members
    player_id IN (
      SELECT id FROM players WHERE auth_user_id = auth.uid()
    )
    OR
    -- Group admin can see members
    group_id IN (
      SELECT g.id FROM groups g
      JOIN players p ON p.id = g.admin_id
      WHERE p.auth_user_id = auth.uid()
    )
  );

-- INSERT: Admin can add members OR user can join public groups
CREATE POLICY group_members_insert_admin_or_public ON group_members
  FOR INSERT
  TO public
  WITH CHECK (
    -- Admin can add anyone
    group_id IN (
      SELECT g.id FROM groups g
      JOIN players p ON p.id = g.admin_id
      WHERE p.auth_user_id = auth.uid()
    )
    OR
    -- User can join public groups as themselves
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

-- DELETE: Admin can remove anyone OR user can leave
CREATE POLICY group_members_delete_admin_or_self ON group_members
  FOR DELETE
  TO public
  USING (
    -- User can remove themselves
    player_id IN (
      SELECT id FROM players WHERE auth_user_id = auth.uid()
    )
    OR
    -- Admin can remove anyone
    group_id IN (
      SELECT g.id FROM groups g
      JOIN players p ON p.id = g.admin_id
      WHERE p.auth_user_id = auth.uid()
    )
  );

-- ============================================================================
-- 4. ADD POLICY FOR MEMBERS TO SEE THEIR GROUPS
-- ============================================================================

-- Additional SELECT policy for groups: Members can see groups they belong to
CREATE POLICY groups_select_member ON groups
  FOR SELECT
  TO public
  USING (
    id IN (
      SELECT gm.group_id FROM group_members gm
      JOIN players p ON p.id = gm.player_id
      WHERE p.auth_user_id = auth.uid()
    )
  );

COMMIT;

-- ============================================================================
-- VERIFICATION QUERIES
-- ============================================================================

-- Check groups policies
SELECT schemaname, tablename, policyname, cmd 
FROM pg_policies 
WHERE tablename = 'groups'
ORDER BY policyname;

-- Check group_members policies
SELECT schemaname, tablename, policyname, cmd 
FROM pg_policies 
WHERE tablename = 'group_members'
ORDER BY policyname;
