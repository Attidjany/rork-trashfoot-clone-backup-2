-- Update RLS policies to restrict suspended users from creating competitions and updating match scores
-- This ensures suspended users have read-only access within the group they're suspended in

-- Drop existing policy if it exists and create new one for competitions
DROP POLICY IF EXISTS competitions_insert_policy ON competitions;
CREATE POLICY competitions_insert_policy ON competitions
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM group_members gm
      INNER JOIN players p ON p.id = gm.player_id
      WHERE gm.group_id = group_id
        AND p.auth_user_id = auth.uid()
        AND NOT is_player_suspended_in_group(p.id, group_id)
    )
  );

-- Update policy for matches insert to check suspension
DROP POLICY IF EXISTS matches_insert_policy ON matches;
CREATE POLICY matches_insert_policy ON matches
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM competitions c
      INNER JOIN group_members gm ON gm.group_id = c.group_id
      INNER JOIN players p ON p.id = gm.player_id
      WHERE c.id = competition_id
        AND p.auth_user_id = auth.uid()
        AND NOT is_player_suspended_in_group(p.id, c.group_id)
    )
  );

-- Update policy for matches update to check suspension
DROP POLICY IF EXISTS matches_update_policy ON matches;
CREATE POLICY matches_update_policy ON matches
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM competitions c
      INNER JOIN group_members gm ON gm.group_id = c.group_id
      INNER JOIN players p ON p.id = gm.player_id
      WHERE c.id = competition_id
        AND p.auth_user_id = auth.uid()
        AND (
          p.id = home_player_id OR 
          p.id = away_player_id OR 
          p.id = (SELECT admin_id FROM groups WHERE id = c.group_id) OR
          p.id = ANY((SELECT admin_ids FROM groups WHERE id = c.group_id))
        )
        AND NOT is_player_suspended_in_group(p.id, c.group_id)
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM competitions c
      INNER JOIN group_members gm ON gm.group_id = c.group_id
      INNER JOIN players p ON p.id = gm.player_id
      WHERE c.id = competition_id
        AND p.auth_user_id = auth.uid()
        AND (
          p.id = home_player_id OR 
          p.id = away_player_id OR 
          p.id = (SELECT admin_id FROM groups WHERE id = c.group_id) OR
          p.id = ANY((SELECT admin_ids FROM groups WHERE id = c.group_id))
        )
        AND NOT is_player_suspended_in_group(p.id, c.group_id)
    )
  );

-- Chat messages insert policy - suspended users can't send messages
DROP POLICY IF EXISTS chat_messages_insert_policy ON chat_messages;
CREATE POLICY chat_messages_insert_policy ON chat_messages
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM group_members gm
      INNER JOIN players p ON p.id = gm.player_id
      WHERE gm.group_id = group_id
        AND p.auth_user_id = auth.uid()
        AND NOT is_player_suspended_in_group(p.id, group_id)
    )
  );
