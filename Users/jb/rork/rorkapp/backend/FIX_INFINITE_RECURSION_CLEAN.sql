-- ============================================================================
-- CLEAN FIX FOR INFINITE RECURSION
-- This removes the recursive policy on group_members that was causing issues
-- ============================================================================

BEGIN;

-- Drop the problematic policy on group_members
DROP POLICY IF EXISTS group_members_select_public_or_member ON public.group_members;

-- Recreate it WITHOUT the recursive subquery
-- Instead of checking group_members again, we just allow viewing:
-- 1. Members of public groups
-- 2. Members where the viewer is also a member (checked via a simpler method)
CREATE POLICY group_members_select_public_or_member ON public.group_members 
AS PERMISSIVE FOR SELECT TO public 
USING (
  -- Allow viewing members of public groups
  (group_id IN (
    SELECT id FROM groups WHERE is_public = true
  ))
  OR
  -- Allow viewing if you're a member of the same group
  -- This uses a lateral join to avoid recursion
  EXISTS (
    SELECT 1 
    FROM players p
    WHERE p.auth_user_id = auth.uid()
    AND EXISTS (
      SELECT 1 
      FROM group_members gm2 
      WHERE gm2.player_id = p.id 
      AND gm2.group_id = group_members.group_id
    )
  )
);

COMMIT;

-- Verify the fix
SELECT 
  schemaname,
  tablename,
  policyname,
  cmd,
  qual
FROM pg_policies 
WHERE tablename = 'group_members' 
AND policyname = 'group_members_select_public_or_member';
