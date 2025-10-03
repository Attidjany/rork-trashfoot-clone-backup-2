-- Fix RLS policies for competitions to allow group members to create competitions
-- Run this in your Supabase SQL Editor

-- Drop existing competition policies
DROP POLICY IF EXISTS "Competitions viewable by group members" ON competitions;
DROP POLICY IF EXISTS "Group admins can create competitions" ON competitions;
DROP POLICY IF EXISTS "Group members can create competitions" ON competitions;
DROP POLICY IF EXISTS "Group admins can update competitions" ON competitions;
DROP POLICY IF EXISTS "Group admins can delete competitions" ON competitions;

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
