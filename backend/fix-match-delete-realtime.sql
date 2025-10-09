-- Ensure realtime is enabled for matches table
ALTER PUBLICATION supabase_realtime ADD TABLE matches;

-- Verify the delete policy exists and is correct
DO $$
BEGIN
  -- Drop existing policy if it exists
  DROP POLICY IF EXISTS "Players can delete their own scheduled matches" ON matches;
  
  -- Create the delete policy
  CREATE POLICY "Players can delete their own scheduled matches"
  ON matches
  FOR DELETE
  USING (
    status != 'completed' AND (
      -- Player is one of the match participants
      home_player_id = auth.uid() OR 
      away_player_id = auth.uid() OR
      -- Player is admin of the group
      EXISTS (
        SELECT 1 FROM competitions c
        JOIN groups g ON c.group_id = g.id
        WHERE c.id = matches.competition_id
        AND g.admin_id = auth.uid()
      ) OR
      -- Player is a group admin (from group_members)
      EXISTS (
        SELECT 1 FROM competitions c
        JOIN group_members gm ON c.group_id = gm.group_id
        WHERE c.id = matches.competition_id
        AND gm.player_id = auth.uid()
        AND gm.is_admin = true
      )
    )
  );
END $$;

-- Verify realtime is working
SELECT schemaname, tablename, rowsecurity 
FROM pg_tables 
WHERE tablename = 'matches';

-- Check if realtime publication includes matches
SELECT * FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'matches';
