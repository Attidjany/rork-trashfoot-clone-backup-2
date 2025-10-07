-- ============================================================================
-- FIX INFINITE RECURSION IN PLAYERS TABLE
-- ============================================================================
-- This script fixes the infinite recursion issue by removing the dependency
-- on get_current_player_id() in players table policies
-- ============================================================================

-- Step 1: Drop ALL existing policies on players table
DROP POLICY IF EXISTS "Players are viewable by everyone" ON players;
DROP POLICY IF EXISTS "Players can view themselves" ON players;
DROP POLICY IF EXISTS "Superadmin can view all players" ON players;
DROP POLICY IF EXISTS "Users can insert own profile" ON players;
DROP POLICY IF EXISTS "Users can update own profile" ON players;

-- Step 2: Recreate players policies WITHOUT using get_current_player_id()
-- This prevents infinite recursion

-- SELECT policies
CREATE POLICY "players_select_public"
ON players FOR SELECT
TO public
USING (true);

-- INSERT policy - users can only insert their own profile
CREATE POLICY "players_insert_own"
ON players FOR INSERT
TO public
WITH CHECK (auth.uid() = auth_user_id);

-- UPDATE policy - users can only update their own profile
CREATE POLICY "players_update_own"
ON players FOR UPDATE
TO public
USING (auth.uid() = auth_user_id)
WITH CHECK (auth.uid() = auth_user_id);

-- ============================================================================
-- Now fix other tables that might have issues with get_current_player_id()
-- ============================================================================

-- Fix group_members policies that use get_current_player_id()
DROP POLICY IF EXISTS "Group members viewable by group members" ON group_members;
DROP POLICY IF EXISTS "Group admins can add members" ON group_members;
DROP POLICY IF EXISTS "Group admins can remove members" ON group_members;
DROP POLICY IF EXISTS "Group admins can manage members" ON group_members;
DROP POLICY IF EXISTS "Users can leave groups" ON group_members;

-- Recreate group_members policies
CREATE POLICY "group_members_select_by_members"
ON group_members FOR SELECT
TO public
USING (
  group_id IN (
    SELECT gm.group_id 
    FROM group_members gm
    JOIN players p ON p.id = gm.player_id
    WHERE p.auth_user_id = auth.uid()
  )
);

CREATE POLICY "group_members_insert_by_admin"
ON group_members FOR INSERT
TO public
WITH CHECK (
  group_id IN (
    SELECT g.id 
    FROM groups g
    JOIN players p ON p.id = g.admin_id
    WHERE p.auth_user_id = auth.uid()
  )
);

CREATE POLICY "group_members_delete_by_admin"
ON group_members FOR DELETE
TO public
USING (
  group_id IN (
    SELECT g.id 
    FROM groups g
    JOIN players p ON p.id = g.admin_id
    WHERE p.auth_user_id = auth.uid()
  )
);

CREATE POLICY "group_members_delete_self"
ON group_members FOR DELETE
TO public
USING (
  player_id IN (
    SELECT p.id 
    FROM players p
    WHERE p.auth_user_id = auth.uid()
  )
);

-- Fix groups policies
DROP POLICY IF EXISTS "Groups viewable by members" ON groups;
DROP POLICY IF EXISTS "Public groups are viewable by everyone" ON groups;
DROP POLICY IF EXISTS "Group admins can update groups" ON groups;
DROP POLICY IF EXISTS "Group admins can delete groups" ON groups;

CREATE POLICY "groups_select_public_or_member"
ON groups FOR SELECT
TO public
USING (
  is_public = true 
  OR id IN (
    SELECT gm.group_id 
    FROM group_members gm
    JOIN players p ON p.id = gm.player_id
    WHERE p.auth_user_id = auth.uid()
  )
);

CREATE POLICY "groups_update_by_admin"
ON groups FOR UPDATE
TO public
USING (
  admin_id IN (
    SELECT p.id 
    FROM players p
    WHERE p.auth_user_id = auth.uid()
  )
);

CREATE POLICY "groups_delete_by_admin"
ON groups FOR DELETE
TO public
USING (
  admin_id IN (
    SELECT p.id 
    FROM players p
    WHERE p.auth_user_id = auth.uid()
  )
);

-- Fix chat_messages policies
DROP POLICY IF EXISTS "Chat messages viewable by group members" ON chat_messages;
DROP POLICY IF EXISTS "Group members can send messages" ON chat_messages;

CREATE POLICY "chat_messages_select_by_members"
ON chat_messages FOR SELECT
TO public
USING (
  group_id IN (
    SELECT gm.group_id 
    FROM group_members gm
    JOIN players p ON p.id = gm.player_id
    WHERE p.auth_user_id = auth.uid()
  )
);

CREATE POLICY "chat_messages_insert_by_members"
ON chat_messages FOR INSERT
TO public
WITH CHECK (
  group_id IN (
    SELECT gm.group_id 
    FROM group_members gm
    JOIN players p ON p.id = gm.player_id
    WHERE p.auth_user_id = auth.uid()
  )
);

-- Fix competitions policies
DROP POLICY IF EXISTS "Competitions viewable by group members" ON competitions;
DROP POLICY IF EXISTS "Group admins can create competitions" ON competitions;
DROP POLICY IF EXISTS "Group admins can update competitions" ON competitions;
DROP POLICY IF EXISTS "Group admins can delete competitions" ON competitions;

CREATE POLICY "competitions_select_by_members"
ON competitions FOR SELECT
TO public
USING (
  group_id IN (
    SELECT gm.group_id 
    FROM group_members gm
    JOIN players p ON p.id = gm.player_id
    WHERE p.auth_user_id = auth.uid()
  )
);

CREATE POLICY "competitions_insert_by_admin"
ON competitions FOR INSERT
TO public
WITH CHECK (
  group_id IN (
    SELECT g.id 
    FROM groups g
    JOIN players p ON p.id = g.admin_id
    WHERE p.auth_user_id = auth.uid()
  )
);

CREATE POLICY "competitions_update_by_admin"
ON competitions FOR UPDATE
TO public
USING (
  group_id IN (
    SELECT g.id 
    FROM groups g
    JOIN players p ON p.id = g.admin_id
    WHERE p.auth_user_id = auth.uid()
  )
);

CREATE POLICY "competitions_delete_by_admin"
ON competitions FOR DELETE
TO public
USING (
  group_id IN (
    SELECT g.id 
    FROM groups g
    JOIN players p ON p.id = g.admin_id
    WHERE p.auth_user_id = auth.uid()
  )
);

-- Fix competition_participants policies
DROP POLICY IF EXISTS "Competition participants viewable by group members" ON competition_participants;
DROP POLICY IF EXISTS "Group admins can add participants" ON competition_participants;
DROP POLICY IF EXISTS "Group admins can delete participants" ON competition_participants;

CREATE POLICY "competition_participants_select_by_members"
ON competition_participants FOR SELECT
TO public
USING (
  competition_id IN (
    SELECT c.id 
    FROM competitions c
    JOIN group_members gm ON gm.group_id = c.group_id
    JOIN players p ON p.id = gm.player_id
    WHERE p.auth_user_id = auth.uid()
  )
);

CREATE POLICY "competition_participants_insert_by_admin"
ON competition_participants FOR INSERT
TO public
WITH CHECK (
  competition_id IN (
    SELECT c.id 
    FROM competitions c
    JOIN groups g ON g.id = c.group_id
    JOIN players p ON p.id = g.admin_id
    WHERE p.auth_user_id = auth.uid()
  )
);

CREATE POLICY "competition_participants_delete_by_admin"
ON competition_participants FOR DELETE
TO public
USING (
  competition_id IN (
    SELECT c.id 
    FROM competitions c
    JOIN groups g ON g.id = c.group_id
    JOIN players p ON p.id = g.admin_id
    WHERE p.auth_user_id = auth.uid()
  )
);

-- Fix matches policies
DROP POLICY IF EXISTS "Matches viewable by group members" ON matches;
DROP POLICY IF EXISTS "Group admins can create matches" ON matches;
DROP POLICY IF EXISTS "Group admins can delete matches" ON matches;
DROP POLICY IF EXISTS "Group admins and players can update matches" ON matches;

CREATE POLICY "matches_select_by_members"
ON matches FOR SELECT
TO public
USING (
  competition_id IN (
    SELECT c.id 
    FROM competitions c
    JOIN group_members gm ON gm.group_id = c.group_id
    JOIN players p ON p.id = gm.player_id
    WHERE p.auth_user_id = auth.uid()
  )
);

CREATE POLICY "matches_insert_by_admin"
ON matches FOR INSERT
TO public
WITH CHECK (
  competition_id IN (
    SELECT c.id 
    FROM competitions c
    JOIN groups g ON g.id = c.group_id
    JOIN players p ON p.id = g.admin_id
    WHERE p.auth_user_id = auth.uid()
  )
);

CREATE POLICY "matches_delete_by_admin"
ON matches FOR DELETE
TO public
USING (
  competition_id IN (
    SELECT c.id 
    FROM competitions c
    JOIN groups g ON g.id = c.group_id
    JOIN players p ON p.id = g.admin_id
    WHERE p.auth_user_id = auth.uid()
  )
);

CREATE POLICY "matches_update_by_admin_or_players"
ON matches FOR UPDATE
TO public
USING (
  competition_id IN (
    SELECT c.id 
    FROM competitions c
    JOIN groups g ON g.id = c.group_id
    JOIN players p ON p.id = g.admin_id
    WHERE p.auth_user_id = auth.uid()
  )
  OR home_player_id IN (
    SELECT p.id FROM players p WHERE p.auth_user_id = auth.uid()
  )
  OR away_player_id IN (
    SELECT p.id FROM players p WHERE p.auth_user_id = auth.uid()
  )
);

-- Fix pending_group_members policies
DROP POLICY IF EXISTS "Pending members viewable by admins and requester" ON pending_group_members;
DROP POLICY IF EXISTS "Join requests viewable by group admins" ON pending_group_members;
DROP POLICY IF EXISTS "Group admins can update pending members" ON pending_group_members;
DROP POLICY IF EXISTS "Group admins can delete pending members" ON pending_group_members;

CREATE POLICY "pending_group_members_select_by_admin_or_self"
ON pending_group_members FOR SELECT
TO public
USING (
  group_id IN (
    SELECT g.id 
    FROM groups g
    JOIN players p ON p.id = g.admin_id
    WHERE p.auth_user_id = auth.uid()
  )
  OR player_id IN (
    SELECT p.id FROM players p WHERE p.auth_user_id = auth.uid()
  )
);

CREATE POLICY "pending_group_members_update_by_admin"
ON pending_group_members FOR UPDATE
TO public
USING (
  group_id IN (
    SELECT g.id 
    FROM groups g
    JOIN players p ON p.id = g.admin_id
    WHERE p.auth_user_id = auth.uid()
  )
);

CREATE POLICY "pending_group_members_delete_by_admin"
ON pending_group_members FOR DELETE
TO public
USING (
  group_id IN (
    SELECT g.id 
    FROM groups g
    JOIN players p ON p.id = g.admin_id
    WHERE p.auth_user_id = auth.uid()
  )
);

-- ============================================================================
-- Verification
-- ============================================================================
-- Run this to verify no infinite recursion:
-- SELECT * FROM players LIMIT 1;
-- 
-- If you get results without errors, the fix worked!
-- ============================================================================
