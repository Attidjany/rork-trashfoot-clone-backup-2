-- Add support for multiple group admins
-- This migration adds an is_admin column to group_members table
-- and updates RLS policies to support multiple admins

-- Step 1: Ensure is_admin column exists in group_members (it already does based on schema)
-- The column already exists, so we just need to update the policies

-- Step 2: Create a helper function to check if a user is a group admin
CREATE OR REPLACE FUNCTION is_group_admin(group_uuid uuid, player_uuid uuid)
RETURNS boolean AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM group_members
    WHERE group_id = group_uuid
    AND player_id = player_uuid
    AND is_admin = true
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Step 3: Update groups table policies to allow any admin to update
DROP POLICY IF EXISTS "Groups can be updated by admins" ON groups;
CREATE POLICY "Groups can be updated by admins" ON groups
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM group_members gm
      INNER JOIN players p ON p.id = gm.player_id
      WHERE gm.group_id = groups.id
      AND gm.is_admin = true
      AND p.auth_user_id = auth.uid()
    )
  );

-- Step 4: Update group_members policies to allow any admin to manage members
DROP POLICY IF EXISTS "Group admins can update members" ON group_members;
CREATE POLICY "Group admins can update members" ON group_members
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM group_members gm
      INNER JOIN players p ON p.id = gm.player_id
      WHERE gm.group_id = group_members.group_id
      AND gm.is_admin = true
      AND p.auth_user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Group admins can delete members" ON group_members;
CREATE POLICY "Group admins can delete members" ON group_members
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM group_members gm
      INNER JOIN players p ON p.id = gm.player_id
      WHERE gm.group_id = group_members.group_id
      AND gm.is_admin = true
      AND p.auth_user_id = auth.uid()
    )
  );

-- Step 5: Update competitions policies to allow any admin to manage competitions
DROP POLICY IF EXISTS "Group admins can update competitions" ON competitions;
CREATE POLICY "Group admins can update competitions" ON competitions
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM group_members gm
      INNER JOIN players p ON p.id = gm.player_id
      WHERE gm.group_id = competitions.group_id
      AND gm.is_admin = true
      AND p.auth_user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Group admins can delete competitions" ON competitions;
CREATE POLICY "Group admins can delete competitions" ON competitions
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM group_members gm
      INNER JOIN players p ON p.id = gm.player_id
      WHERE gm.group_id = competitions.group_id
      AND gm.is_admin = true
      AND p.auth_user_id = auth.uid()
    )
  );

-- Step 6: Update matches policies to allow any admin to manage matches
DROP POLICY IF EXISTS "Group admins can delete matches" ON matches;
CREATE POLICY "Group admins can delete matches" ON matches
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM competitions c
      INNER JOIN group_members gm ON gm.group_id = c.group_id
      INNER JOIN players p ON p.id = gm.player_id
      WHERE c.id = matches.competition_id
      AND gm.is_admin = true
      AND p.auth_user_id = auth.uid()
    )
  );

-- Step 7: Update pending_group_members policies to allow any admin to manage join requests
DROP POLICY IF EXISTS "Group admins can update pending members" ON pending_group_members;
CREATE POLICY "Group admins can update pending members" ON pending_group_members
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM group_members gm
      INNER JOIN players p ON p.id = gm.player_id
      WHERE gm.group_id = pending_group_members.group_id
      AND gm.is_admin = true
      AND p.auth_user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Group admins can delete pending members" ON pending_group_members;
CREATE POLICY "Group admins can delete pending members" ON pending_group_members
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM group_members gm
      INNER JOIN players p ON p.id = gm.player_id
      WHERE gm.group_id = pending_group_members.group_id
      AND gm.is_admin = true
      AND p.auth_user_id = auth.uid()
    )
  );

-- Step 8: Ensure the original admin (admin_id in groups table) is marked as admin in group_members
-- This is a one-time data migration
UPDATE group_members gm
SET is_admin = true
FROM groups g
WHERE gm.group_id = g.id
AND gm.player_id = g.admin_id
AND gm.is_admin = false;

-- Step 9: Grant execute permission on the helper function
GRANT EXECUTE ON FUNCTION is_group_admin(uuid, uuid) TO authenticated;
