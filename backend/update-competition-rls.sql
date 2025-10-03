-- Update RLS policies to allow any group member to create competitions
-- Run this in your Supabase SQL Editor

-- Drop existing competition policies
DROP POLICY IF EXISTS "Competitions viewable by group members" ON competitions;
DROP POLICY IF EXISTS "Group admins can create competitions" ON competitions;
DROP POLICY IF EXISTS "Group admins can update competitions" ON competitions;

-- Recreate policies with updated permissions
-- Any group member can view competitions
CREATE POLICY "Competitions viewable by group members" ON competitions 
FOR SELECT 
USING (
  group_id IN (
    SELECT group_id 
    FROM group_members 
    WHERE player_id IN (
      SELECT id 
      FROM players 
      WHERE auth_user_id = auth.uid()
    )
  )
);

-- Any group member can create competitions (not just admins)
CREATE POLICY "Group members can create competitions" ON competitions 
FOR INSERT 
WITH CHECK (
  group_id IN (
    SELECT group_id 
    FROM group_members 
    WHERE player_id IN (
      SELECT id 
      FROM players 
      WHERE auth_user_id = auth.uid()
    )
  )
);

-- Group admins can update competitions
CREATE POLICY "Group admins can update competitions" ON competitions 
FOR UPDATE 
USING (
  group_id IN (
    SELECT id 
    FROM groups 
    WHERE admin_id IN (
      SELECT id 
      FROM players 
      WHERE auth_user_id = auth.uid()
    )
  )
);

-- Group admins can delete competitions
CREATE POLICY "Group admins can delete competitions" ON competitions 
FOR DELETE 
USING (
  group_id IN (
    SELECT id 
    FROM groups 
    WHERE admin_id IN (
      SELECT id 
      FROM players 
      WHERE auth_user_id = auth.uid()
    )
  )
);

-- Update competition participants policies
DROP POLICY IF EXISTS "Competition participants viewable by group members" ON competition_participants;
DROP POLICY IF EXISTS "Group admins can add participants" ON competition_participants;

CREATE POLICY "Competition participants viewable by group members" ON competition_participants 
FOR SELECT 
USING (
  competition_id IN (
    SELECT id 
    FROM competitions 
    WHERE group_id IN (
      SELECT group_id 
      FROM group_members 
      WHERE player_id IN (
        SELECT id 
        FROM players 
        WHERE auth_user_id = auth.uid()
      )
    )
  )
);

-- Any group member can add participants when creating competitions
CREATE POLICY "Group members can add participants" ON competition_participants 
FOR INSERT 
WITH CHECK (
  competition_id IN (
    SELECT id 
    FROM competitions 
    WHERE group_id IN (
      SELECT group_id 
      FROM group_members 
      WHERE player_id IN (
        SELECT id 
        FROM players 
        WHERE auth_user_id = auth.uid()
      )
    )
  )
);

-- Update matches policies
DROP POLICY IF EXISTS "Matches viewable by group members" ON matches;
DROP POLICY IF EXISTS "Group admins can create matches" ON matches;
DROP POLICY IF EXISTS "Group admins and players can update matches" ON matches;

CREATE POLICY "Matches viewable by group members" ON matches 
FOR SELECT 
USING (
  competition_id IN (
    SELECT id 
    FROM competitions 
    WHERE group_id IN (
      SELECT group_id 
      FROM group_members 
      WHERE player_id IN (
        SELECT id 
        FROM players 
        WHERE auth_user_id = auth.uid()
      )
    )
  )
);

-- Any group member can create matches
CREATE POLICY "Group members can create matches" ON matches 
FOR INSERT 
WITH CHECK (
  competition_id IN (
    SELECT id 
    FROM competitions 
    WHERE group_id IN (
      SELECT group_id 
      FROM group_members 
      WHERE player_id IN (
        SELECT id 
        FROM players 
        WHERE auth_user_id = auth.uid()
      )
    )
  )
);

-- Group admins and match participants can update matches
CREATE POLICY "Group admins and players can update matches" ON matches 
FOR UPDATE 
USING (
  competition_id IN (
    SELECT id 
    FROM competitions 
    WHERE group_id IN (
      SELECT id 
      FROM groups 
      WHERE admin_id IN (
        SELECT id 
        FROM players 
        WHERE auth_user_id = auth.uid()
      )
    )
  )
  OR home_player_id IN (
    SELECT id 
    FROM players 
    WHERE auth_user_id = auth.uid()
  )
  OR away_player_id IN (
    SELECT id 
    FROM players 
    WHERE auth_user_id = auth.uid()
  )
);

-- Only group admins and match participants can delete matches
CREATE POLICY "Group admins and players can delete matches" ON matches 
FOR DELETE 
USING (
  competition_id IN (
    SELECT id 
    FROM competitions 
    WHERE group_id IN (
      SELECT id 
      FROM groups 
      WHERE admin_id IN (
        SELECT id 
        FROM players 
        WHERE auth_user_id = auth.uid()
      )
    )
  )
  OR home_player_id IN (
    SELECT id 
    FROM players 
    WHERE auth_user_id = auth.uid()
  )
  OR away_player_id IN (
    SELECT id 
    FROM players 
    WHERE auth_user_id = auth.uid()
  )
);
