-- Fix group_members SELECT policy to allow users to see all members of groups they belong to
-- The issue: Current policy only shows public groups, own record, and admin groups
-- The fix: Allow users to see ALL members of ANY group they are a member of

BEGIN;

-- Drop the restrictive policy
DROP POLICY IF EXISTS group_members_select_visible ON public.group_members;

-- Create a new policy that allows users to see all members of groups they belong to
CREATE POLICY group_members_select_visible 
ON public.group_members 
FOR SELECT 
TO public 
USING (
  -- Can see all members of groups where the user is a member
  group_id IN (
    SELECT gm.group_id
    FROM group_members gm
    JOIN players p ON p.id = gm.player_id
    WHERE p.auth_user_id = auth.uid()
  )
  OR
  -- Can see members of public groups (for browsing)
  EXISTS (
    SELECT 1 FROM groups g 
    WHERE g.id = group_members.group_id 
    AND g.is_public = true
  )
);

COMMIT;

-- Verify the fix
SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual as using_clause
FROM pg_policies 
WHERE tablename = 'group_members' 
AND policyname = 'group_members_select_visible';
