-- Fix player visibility in group member queries
-- The issue: Non-admin users can't see other players' names in matches/stats
-- Root cause: The nested query through group_members might not be returning player data properly

-- First, let's verify the current policies
SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual
FROM pg_policies
WHERE tablename IN ('players', 'group_members')
ORDER BY tablename, policyname;

-- The players table has players_viewable_by_all with qual = true
-- This should allow everyone to see all players
-- But the issue is that when querying through group_members join,
-- the RLS on group_members might be interfering

-- Let's check if there's an issue with the group_members policy
-- The policy group_members_select_visible should allow:
-- 1. Public groups
-- 2. Own membership
-- 3. Admin of group

-- The fix: Ensure that when a user is a member of a group,
-- they can see ALL members of that group (not just themselves)

-- Drop and recreate the group_members_select_visible policy
DROP POLICY IF EXISTS group_members_select_visible ON group_members;

CREATE POLICY group_members_select_visible ON group_members
  FOR SELECT
  USING (
    -- Can see members of groups where user is a member
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
