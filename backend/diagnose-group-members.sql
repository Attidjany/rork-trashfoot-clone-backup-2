-- Diagnose group_members visibility issue
-- The problem: Users can't see other members of groups they belong to

-- 1. Check current policy on group_members
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
ORDER BY policyname;

-- 2. Check if RLS is enabled
SELECT 
  schemaname,
  tablename,
  rowsecurity
FROM pg_tables 
WHERE tablename = 'group_members';

-- 3. Test query to see what a user can see
-- (Run this as an authenticated user to test)
SELECT 
  gm.id,
  gm.group_id,
  gm.player_id,
  gm.is_admin,
  p.name,
  p.gamer_handle,
  g.name as group_name
FROM group_members gm
JOIN players p ON p.id = gm.player_id
JOIN groups g ON g.id = gm.group_id;
