-- Fix match insert policy to allow group members to create matches
-- This allows competition creators (who are group members) to create matches

-- Drop the old restrictive policy
DROP POLICY IF EXISTS "Group admins can create matches" ON matches;

-- Create a new policy that allows group members to create matches
CREATE POLICY "Group members can create matches" ON matches 
FOR INSERT 
WITH CHECK (
  competition_id IN (
    SELECT id FROM competitions 
    WHERE group_id IN (
      SELECT group_id FROM group_members 
      WHERE player_id IN (
        SELECT id FROM players 
        WHERE auth_user_id = auth.uid()
      )
    )
  )
);
