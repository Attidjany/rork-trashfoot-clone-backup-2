-- Fix group_members visibility so users can see all members of their groups
-- The issue: Non-admin users can only see their own membership record
-- The fix: Allow users to see all members of groups they belong to

DROP POLICY IF EXISTS group_members_select_visible ON group_members;

CREATE POLICY group_members_select_visible ON group_members
  FOR SELECT
  USING (
    -- Can see all members of groups where the user is a member
    group_id IN (
      SELECT gm.group_id
      FROM group_members gm
      JOIN players p ON p.id = gm.player_id
      WHERE p.auth_user_id = auth.uid()
    )
    OR
    -- Can see members of public groups
    EXISTS (
      SELECT 1
      FROM groups g
      WHERE g.id = group_members.group_id
      AND g.is_public = true
    )
  );

-- Verify the fix
SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual
FROM pg_policies
WHERE tablename = 'group_members' AND policyname = 'group_members_select_visible';
