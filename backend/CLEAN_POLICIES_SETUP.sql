-- =====================================================
-- CLEAN POLICIES SETUP
-- =====================================================
-- This script drops all existing policies and recreates them
-- without infinite recursion or conflicts
-- =====================================================

-- =====================================================
-- DROP ALL EXISTING POLICIES
-- =====================================================

-- Players table
DROP POLICY IF EXISTS "Players are viewable by everyone" ON players;
DROP POLICY IF EXISTS "Players can view themselves" ON players;
DROP POLICY IF EXISTS "Superadmin can view all players" ON players;
DROP POLICY IF EXISTS "Users can insert own profile" ON players;
DROP POLICY IF EXISTS "Users can update own profile" ON players;

-- Groups table
DROP POLICY IF EXISTS "Anyone can view groups" ON groups;
DROP POLICY IF EXISTS "Authenticated users can create groups" ON groups;
DROP POLICY IF EXISTS "Group admins can delete groups" ON groups;
DROP POLICY IF EXISTS "Group admins can update groups" ON groups;
DROP POLICY IF EXISTS "Groups viewable by members" ON groups;
DROP POLICY IF EXISTS "Public groups are viewable by everyone" ON groups;
DROP POLICY IF EXISTS "Superadmin can view all groups" ON groups;
DROP POLICY IF EXISTS "groups_select" ON groups;

-- Group members table
DROP POLICY IF EXISTS "Anyone can view group members" ON group_members;
DROP POLICY IF EXISTS "Authenticated users can join groups" ON group_members;
DROP POLICY IF EXISTS "Group admins can add members" ON group_members;
DROP POLICY IF EXISTS "Group admins can manage members" ON group_members;
DROP POLICY IF EXISTS "Group admins can remove members" ON group_members;
DROP POLICY IF EXISTS "Group members viewable by group members" ON group_members;
DROP POLICY IF EXISTS "Superadmin can view all group members" ON group_members;
DROP POLICY IF EXISTS "Users can leave groups" ON group_members;
DROP POLICY IF EXISTS "gm_insert_self" ON group_members;
DROP POLICY IF EXISTS "gm_select_self" ON group_members;

-- Pending group members table
DROP POLICY IF EXISTS "Authenticated users can request to join" ON pending_group_members;
DROP POLICY IF EXISTS "Group admins can delete pending members" ON pending_group_members;
DROP POLICY IF EXISTS "Group admins can update pending members" ON pending_group_members;
DROP POLICY IF EXISTS "Join requests viewable by group admins" ON pending_group_members;
DROP POLICY IF EXISTS "Pending members viewable by admins and requester" ON pending_group_members;
DROP POLICY IF EXISTS "Superadmin can view all join requests" ON pending_group_members;

-- Competitions table
DROP POLICY IF EXISTS "Competitions viewable by group members" ON competitions;
DROP POLICY IF EXISTS "Group admins can create competitions" ON competitions;
DROP POLICY IF EXISTS "Group admins can delete competitions" ON competitions;
DROP POLICY IF EXISTS "Group admins can update competitions" ON competitions;
DROP POLICY IF EXISTS "Group members can create competitions" ON competitions;
DROP POLICY IF EXISTS "Superadmin can view all competitions" ON competitions;

-- Competition participants table
DROP POLICY IF EXISTS "Anyone can view competition participants" ON competition_participants;
DROP POLICY IF EXISTS "Authenticated users can join competitions" ON competition_participants;
DROP POLICY IF EXISTS "Competition participants viewable by group members" ON competition_participants;
DROP POLICY IF EXISTS "Group admins can add participants" ON competition_participants;
DROP POLICY IF EXISTS "Group admins can delete participants" ON competition_participants;
DROP POLICY IF EXISTS "Users can leave competitions" ON competition_participants;

-- Matches table
DROP POLICY IF EXISTS "Anyone can view matches" ON matches;
DROP POLICY IF EXISTS "Authenticated users can create matches" ON matches;
DROP POLICY IF EXISTS "Authenticated users can update matches" ON matches;
DROP POLICY IF EXISTS "Group admins and players can update matches" ON matches;
DROP POLICY IF EXISTS "Group admins can create matches" ON matches;
DROP POLICY IF EXISTS "Group admins can delete matches" ON matches;
DROP POLICY IF EXISTS "Matches viewable by group members" ON matches;
DROP POLICY IF EXISTS "Superadmin can view all matches" ON matches;

-- Chat messages table
DROP POLICY IF EXISTS "Anyone can view chat messages" ON chat_messages;
DROP POLICY IF EXISTS "Authenticated users can send messages" ON chat_messages;
DROP POLICY IF EXISTS "Chat messages viewable by group members" ON chat_messages;
DROP POLICY IF EXISTS "Group members can send messages" ON chat_messages;
DROP POLICY IF EXISTS "chat_insert_system_policy" ON chat_messages;

-- Player stats table
DROP POLICY IF EXISTS "Player stats are viewable by everyone" ON player_stats;
DROP POLICY IF EXISTS "Player stats can be deleted by authenticated users" ON player_stats;
DROP POLICY IF EXISTS "Player stats can be inserted by authenticated users" ON player_stats;
DROP POLICY IF EXISTS "Player stats can be updated by authenticated users" ON player_stats;

-- =====================================================
-- CREATE CLEAN POLICIES
-- =====================================================

-- =====================================================
-- PLAYERS TABLE POLICIES
-- =====================================================
-- IMPORTANT: Do NOT use get_current_player_id() in players policies
-- as it causes infinite recursion

CREATE POLICY "players_select_all"
ON players FOR SELECT
TO public
USING (true);

CREATE POLICY "players_insert_own"
ON players FOR INSERT
TO public
WITH CHECK (auth.uid() = auth_user_id);

CREATE POLICY "players_update_own"
ON players FOR UPDATE
TO public
USING (auth.uid() = auth_user_id);

-- =====================================================
-- GROUPS TABLE POLICIES
-- =====================================================

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
  OR EXISTS (
    SELECT 1 FROM players 
    WHERE auth_user_id = auth.uid() 
    AND role = 'super_admin'
  )
);

CREATE POLICY "groups_insert_authenticated"
ON groups FOR INSERT
TO public
WITH CHECK (
  auth.uid() IS NOT NULL
  AND admin_id IN (
    SELECT id FROM players WHERE auth_user_id = auth.uid()
  )
);

CREATE POLICY "groups_update_admin"
ON groups FOR UPDATE
TO public
USING (
  admin_id IN (
    SELECT id FROM players WHERE auth_user_id = auth.uid()
  )
);

CREATE POLICY "groups_delete_admin"
ON groups FOR DELETE
TO public
USING (
  admin_id IN (
    SELECT id FROM players WHERE auth_user_id = auth.uid()
  )
);

-- =====================================================
-- GROUP MEMBERS TABLE POLICIES
-- =====================================================

CREATE POLICY "group_members_select_public_or_member"
ON group_members FOR SELECT
TO public
USING (
  group_id IN (
    SELECT id FROM groups WHERE is_public = true
  )
  OR group_id IN (
    SELECT gm.group_id 
    FROM group_members gm
    JOIN players p ON p.id = gm.player_id
    WHERE p.auth_user_id = auth.uid()
  )
  OR EXISTS (
    SELECT 1 FROM players 
    WHERE auth_user_id = auth.uid() 
    AND role = 'super_admin'
  )
);

CREATE POLICY "group_members_insert_admin_or_self"
ON group_members FOR INSERT
TO public
WITH CHECK (
  player_id IN (SELECT id FROM players WHERE auth_user_id = auth.uid())
  OR group_id IN (
    SELECT g.id FROM groups g
    JOIN players p ON p.id = g.admin_id
    WHERE p.auth_user_id = auth.uid()
  )
);

CREATE POLICY "group_members_delete_admin_or_self"
ON group_members FOR DELETE
TO public
USING (
  player_id IN (SELECT id FROM players WHERE auth_user_id = auth.uid())
  OR group_id IN (
    SELECT g.id FROM groups g
    JOIN players p ON p.id = g.admin_id
    WHERE p.auth_user_id = auth.uid()
  )
);

-- =====================================================
-- PENDING GROUP MEMBERS TABLE POLICIES
-- =====================================================

CREATE POLICY "pending_members_select_admin_or_self"
ON pending_group_members FOR SELECT
TO public
USING (
  player_id IN (SELECT id FROM players WHERE auth_user_id = auth.uid())
  OR group_id IN (
    SELECT g.id FROM groups g
    JOIN players p ON p.id = g.admin_id
    WHERE p.auth_user_id = auth.uid()
  )
  OR EXISTS (
    SELECT 1 FROM players 
    WHERE auth_user_id = auth.uid() 
    AND role = 'super_admin'
  )
);

CREATE POLICY "pending_members_insert_self"
ON pending_group_members FOR INSERT
TO public
WITH CHECK (
  player_id IN (SELECT id FROM players WHERE auth_user_id = auth.uid())
);

CREATE POLICY "pending_members_update_admin"
ON pending_group_members FOR UPDATE
TO public
USING (
  group_id IN (
    SELECT g.id FROM groups g
    JOIN players p ON p.id = g.admin_id
    WHERE p.auth_user_id = auth.uid()
  )
);

CREATE POLICY "pending_members_delete_admin"
ON pending_group_members FOR DELETE
TO public
USING (
  group_id IN (
    SELECT g.id FROM groups g
    JOIN players p ON p.id = g.admin_id
    WHERE p.auth_user_id = auth.uid()
  )
);

-- =====================================================
-- COMPETITIONS TABLE POLICIES
-- =====================================================

CREATE POLICY "competitions_select_member"
ON competitions FOR SELECT
TO public
USING (
  group_id IN (
    SELECT gm.group_id 
    FROM group_members gm
    JOIN players p ON p.id = gm.player_id
    WHERE p.auth_user_id = auth.uid()
  )
  OR EXISTS (
    SELECT 1 FROM players 
    WHERE auth_user_id = auth.uid() 
    AND role = 'super_admin'
  )
);

CREATE POLICY "competitions_insert_member"
ON competitions FOR INSERT
TO public
WITH CHECK (
  group_id IN (
    SELECT gm.group_id 
    FROM group_members gm
    JOIN players p ON p.id = gm.player_id
    WHERE p.auth_user_id = auth.uid()
  )
);

CREATE POLICY "competitions_update_admin"
ON competitions FOR UPDATE
TO public
USING (
  group_id IN (
    SELECT g.id FROM groups g
    JOIN players p ON p.id = g.admin_id
    WHERE p.auth_user_id = auth.uid()
  )
);

CREATE POLICY "competitions_delete_admin"
ON competitions FOR DELETE
TO public
USING (
  group_id IN (
    SELECT g.id FROM groups g
    JOIN players p ON p.id = g.admin_id
    WHERE p.auth_user_id = auth.uid()
  )
);

-- =====================================================
-- COMPETITION PARTICIPANTS TABLE POLICIES
-- =====================================================

CREATE POLICY "competition_participants_select_member"
ON competition_participants FOR SELECT
TO public
USING (
  competition_id IN (
    SELECT c.id FROM competitions c
    JOIN group_members gm ON gm.group_id = c.group_id
    JOIN players p ON p.id = gm.player_id
    WHERE p.auth_user_id = auth.uid()
  )
);

CREATE POLICY "competition_participants_insert_admin"
ON competition_participants FOR INSERT
TO public
WITH CHECK (
  competition_id IN (
    SELECT c.id FROM competitions c
    JOIN groups g ON g.id = c.group_id
    JOIN players p ON p.id = g.admin_id
    WHERE p.auth_user_id = auth.uid()
  )
);

CREATE POLICY "competition_participants_delete_admin_or_self"
ON competition_participants FOR DELETE
TO public
USING (
  player_id IN (SELECT id FROM players WHERE auth_user_id = auth.uid())
  OR competition_id IN (
    SELECT c.id FROM competitions c
    JOIN groups g ON g.id = c.group_id
    JOIN players p ON p.id = g.admin_id
    WHERE p.auth_user_id = auth.uid()
  )
);

-- =====================================================
-- MATCHES TABLE POLICIES
-- =====================================================

CREATE POLICY "matches_select_member"
ON matches FOR SELECT
TO public
USING (
  competition_id IN (
    SELECT c.id FROM competitions c
    JOIN group_members gm ON gm.group_id = c.group_id
    JOIN players p ON p.id = gm.player_id
    WHERE p.auth_user_id = auth.uid()
  )
  OR EXISTS (
    SELECT 1 FROM players 
    WHERE auth_user_id = auth.uid() 
    AND role = 'super_admin'
  )
);

CREATE POLICY "matches_insert_admin"
ON matches FOR INSERT
TO public
WITH CHECK (
  competition_id IN (
    SELECT c.id FROM competitions c
    JOIN groups g ON g.id = c.group_id
    JOIN players p ON p.id = g.admin_id
    WHERE p.auth_user_id = auth.uid()
  )
);

CREATE POLICY "matches_update_admin_or_player"
ON matches FOR UPDATE
TO public
USING (
  competition_id IN (
    SELECT c.id FROM competitions c
    JOIN groups g ON g.id = c.group_id
    JOIN players p ON p.id = g.admin_id
    WHERE p.auth_user_id = auth.uid()
  )
  OR home_player_id IN (SELECT id FROM players WHERE auth_user_id = auth.uid())
  OR away_player_id IN (SELECT id FROM players WHERE auth_user_id = auth.uid())
);

CREATE POLICY "matches_delete_admin"
ON matches FOR DELETE
TO public
USING (
  competition_id IN (
    SELECT c.id FROM competitions c
    JOIN groups g ON g.id = c.group_id
    JOIN players p ON p.id = g.admin_id
    WHERE p.auth_user_id = auth.uid()
  )
);

-- =====================================================
-- CHAT MESSAGES TABLE POLICIES
-- =====================================================

CREATE POLICY "chat_messages_select_member"
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

CREATE POLICY "chat_messages_insert_member"
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

CREATE POLICY "chat_messages_insert_system"
ON chat_messages FOR INSERT
TO public
WITH CHECK (
  sender_name = 'System'
  AND type IN ('match_live', 'match_score', 'competition_created', 'competition_deadline', 'competition_finished')
);

-- =====================================================
-- PLAYER STATS TABLE POLICIES
-- =====================================================

CREATE POLICY "player_stats_select_all"
ON player_stats FOR SELECT
TO public
USING (true);

CREATE POLICY "player_stats_insert_authenticated"
ON player_stats FOR INSERT
TO public
WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "player_stats_update_authenticated"
ON player_stats FOR UPDATE
TO public
USING (auth.uid() IS NOT NULL);

CREATE POLICY "player_stats_delete_authenticated"
ON player_stats FOR DELETE
TO public
USING (auth.uid() IS NOT NULL);

-- =====================================================
-- VERIFICATION
-- =====================================================

-- Verify policies were created
SELECT 
  schemaname,
  tablename,
  policyname,
  cmd,
  CASE 
    WHEN qual IS NOT NULL THEN 'Has USING clause'
    ELSE 'No USING clause'
  END as using_clause,
  CASE 
    WHEN with_check IS NOT NULL THEN 'Has WITH CHECK clause'
    ELSE 'No WITH CHECK clause'
  END as with_check_clause
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY tablename, cmd, policyname;
