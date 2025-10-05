-- Add DELETE policy for matches table
-- Run this in your Supabase SQL Editor

-- Drop existing delete policy if it exists
DROP POLICY IF EXISTS "Group admins can delete matches" ON matches;

-- Create new delete policy for matches
-- Only group admins can delete matches
CREATE POLICY "Group admins can delete matches" ON matches FOR DELETE USING (
  competition_id IN (
    SELECT c.id 
    FROM competitions c
    INNER JOIN groups g ON c.group_id = g.id
    WHERE g.admin_id IN (SELECT id FROM players WHERE auth_user_id = auth.uid())
  )
);

-- Verify the policy was created
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual
FROM pg_policies
WHERE tablename = 'matches' AND cmd = 'DELETE';
