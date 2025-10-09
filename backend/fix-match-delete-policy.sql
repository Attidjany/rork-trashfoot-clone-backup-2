-- Fix match delete policy to only allow group admins and superadmins

-- Drop existing delete policy
DROP POLICY IF EXISTS "Players can delete their own scheduled matches" ON matches;

-- Create new delete policy for group admins and superadmins only
CREATE POLICY "Group admins and superadmins can delete matches"
ON matches
FOR DELETE
USING (
  -- Match is not completed
  status != 'completed' AND (
    -- User is superadmin
    EXISTS (
      SELECT 1 FROM players
      WHERE auth_user_id = auth.uid()
      AND role = 'super_admin'
    ) OR
    -- User is the group admin
    EXISTS (
      SELECT 1 FROM competitions c
      JOIN groups g ON c.group_id = g.id
      JOIN players p ON g.admin_id = p.id
      WHERE c.id = matches.competition_id
      AND p.auth_user_id = auth.uid()
    ) OR
    -- User is a group admin (from group_members)
    EXISTS (
      SELECT 1 FROM competitions c
      JOIN group_members gm ON c.group_id = gm.group_id
      JOIN players p ON gm.player_id = p.id
      WHERE c.id = matches.competition_id
      AND p.auth_user_id = auth.uid()
      AND gm.is_admin = true
    )
  )
);

-- Ensure realtime is enabled for matches table
ALTER PUBLICATION supabase_realtime ADD TABLE IF NOT EXISTS matches;
