-- Fix matches SELECT policy
-- This allows users to see matches from competitions in groups they are members of

-- Drop the current allow_all policy for matches SELECT
DROP POLICY IF EXISTS allow_all_authenticated ON matches;

-- Create a proper SELECT policy for matches
-- Users can see matches if they are members of the group that owns the competition
CREATE POLICY matches_select_member ON matches
FOR SELECT
TO public
USING (
  EXISTS (
    SELECT 1
    FROM competitions c
    JOIN group_members gm ON gm.group_id = c.group_id
    JOIN players p ON p.id = gm.player_id
    WHERE c.id = matches.competition_id
    AND p.auth_user_id = auth.uid()
  )
  OR is_superadmin()
);

-- Also ensure UPDATE policy allows match participants to update scores
CREATE POLICY matches_update_participant ON matches
FOR UPDATE
TO public
USING (
  -- Admin of the group can update
  EXISTS (
    SELECT 1
    FROM competitions c
    JOIN groups g ON g.id = c.group_id
    JOIN players p ON p.id = g.admin_id
    WHERE c.id = matches.competition_id
    AND p.auth_user_id = auth.uid()
  )
  OR
  -- Players in the match can update
  EXISTS (
    SELECT 1
    FROM players
    WHERE (players.id = matches.home_player_id OR players.id = matches.away_player_id)
    AND players.auth_user_id = auth.uid()
  )
  OR is_superadmin()
);

-- Verify the policies
SELECT 
  schemaname,
  tablename,
  policyname,
  operation,
  CASE 
    WHEN using_expression IS NOT NULL THEN 'Has USING clause'
    ELSE 'No USING clause'
  END as using_status
FROM pg_policies
WHERE tablename = 'matches'
ORDER BY operation, policyname;
