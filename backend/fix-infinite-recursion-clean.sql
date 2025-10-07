-- COMPLETE FIX: Remove infinite recursion in players table RLS policies
-- This script will completely reset all RLS policies and fix the recursion issue

-- Step 1: Drop ALL existing policies on ALL tables
DO $$ 
DECLARE
    r RECORD;
BEGIN
    FOR r IN (SELECT schemaname, tablename, policyname 
              FROM pg_policies 
              WHERE schemaname = 'public') 
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON %I.%I', 
                      r.policyname, r.schemaname, r.tablename);
    END LOOP;
END $$;

-- Step 2: Drop the helper function if it exists
DROP FUNCTION IF EXISTS get_current_player_id();

-- Step 3: Create security definer function to get player_id without triggering RLS
CREATE OR REPLACE FUNCTION get_current_player_id()
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN (SELECT id FROM players WHERE auth_user_id = auth.uid() LIMIT 1);
END;
$$;

-- Step 4: Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION get_current_player_id() TO authenticated;

-- ============================================================================
-- PLAYERS POLICIES - Simple, no recursion
-- ============================================================================
CREATE POLICY "Players are viewable by everyone" 
  ON players FOR SELECT 
  USING (true);

CREATE POLICY "Users can update own profile" 
  ON players FOR UPDATE 
  USING (auth.uid() = auth_user_id);

CREATE POLICY "Users can insert own profile" 
  ON players FOR INSERT 
  WITH CHECK (auth.uid() = auth_user_id);

-- ============================================================================
-- GROUPS POLICIES - Use security definer function
-- ============================================================================
CREATE POLICY "Public groups are viewable by everyone" 
  ON groups FOR SELECT 
  USING (
    is_public = true 
    OR id IN (
      SELECT group_id 
      FROM group_members 
      WHERE player_id = get_current_player_id()
    )
  );

CREATE POLICY "Authenticated users can create groups" 
  ON groups FOR INSERT 
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Group admins can update groups" 
  ON groups FOR UPDATE 
  USING (admin_id = get_current_player_id());

CREATE POLICY "Group admins can delete groups" 
  ON groups FOR DELETE 
  USING (admin_id = get_current_player_id());

-- ============================================================================
-- GROUP MEMBERS POLICIES
-- ============================================================================
CREATE POLICY "Group members viewable by group members" 
  ON group_members FOR SELECT 
  USING (
    group_id IN (
      SELECT group_id 
      FROM group_members 
      WHERE player_id = get_current_player_id()
    )
  );

CREATE POLICY "Group admins can add members" 
  ON group_members FOR INSERT 
  WITH CHECK (
    group_id IN (
      SELECT id 
      FROM groups 
      WHERE admin_id = get_current_player_id()
    )
  );

CREATE POLICY "Group admins can remove members" 
  ON group_members FOR DELETE 
  USING (
    group_id IN (
      SELECT id 
      FROM groups 
      WHERE admin_id = get_current_player_id()
    )
  );

-- ============================================================================
-- PENDING MEMBERS POLICIES
-- ============================================================================
CREATE POLICY "Pending members viewable by admins and requester" 
  ON pending_group_members FOR SELECT 
  USING (
    group_id IN (
      SELECT id 
      FROM groups 
      WHERE admin_id = get_current_player_id()
    )
    OR player_id = get_current_player_id()
  );

CREATE POLICY "Authenticated users can request to join" 
  ON pending_group_members FOR INSERT 
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Group admins can update pending members" 
  ON pending_group_members FOR UPDATE 
  USING (
    group_id IN (
      SELECT id 
      FROM groups 
      WHERE admin_id = get_current_player_id()
    )
  );

CREATE POLICY "Group admins can delete pending members" 
  ON pending_group_members FOR DELETE 
  USING (
    group_id IN (
      SELECT id 
      FROM groups 
      WHERE admin_id = get_current_player_id()
    )
  );

-- ============================================================================
-- COMPETITIONS POLICIES
-- ============================================================================
CREATE POLICY "Competitions viewable by group members" 
  ON competitions FOR SELECT 
  USING (
    group_id IN (
      SELECT group_id 
      FROM group_members 
      WHERE player_id = get_current_player_id()
    )
  );

CREATE POLICY "Group admins can create competitions" 
  ON competitions FOR INSERT 
  WITH CHECK (
    group_id IN (
      SELECT id 
      FROM groups 
      WHERE admin_id = get_current_player_id()
    )
  );

CREATE POLICY "Group admins can update competitions" 
  ON competitions FOR UPDATE 
  USING (
    group_id IN (
      SELECT id 
      FROM groups 
      WHERE admin_id = get_current_player_id()
    )
  );

CREATE POLICY "Group admins can delete competitions" 
  ON competitions FOR DELETE 
  USING (
    group_id IN (
      SELECT id 
      FROM groups 
      WHERE admin_id = get_current_player_id()
    )
  );

-- ============================================================================
-- COMPETITION PARTICIPANTS POLICIES
-- ============================================================================
CREATE POLICY "Competition participants viewable by group members" 
  ON competition_participants FOR SELECT 
  USING (
    competition_id IN (
      SELECT c.id 
      FROM competitions c
      INNER JOIN group_members gm ON gm.group_id = c.group_id
      WHERE gm.player_id = get_current_player_id()
    )
  );

CREATE POLICY "Group admins can add participants" 
  ON competition_participants FOR INSERT 
  WITH CHECK (
    competition_id IN (
      SELECT c.id 
      FROM competitions c
      INNER JOIN groups g ON g.id = c.group_id
      WHERE g.admin_id = get_current_player_id()
    )
  );

CREATE POLICY "Group admins can delete participants" 
  ON competition_participants FOR DELETE 
  USING (
    competition_id IN (
      SELECT c.id 
      FROM competitions c
      INNER JOIN groups g ON g.id = c.group_id
      WHERE g.admin_id = get_current_player_id()
    )
  );

-- ============================================================================
-- MATCHES POLICIES
-- ============================================================================
CREATE POLICY "Matches viewable by group members" 
  ON matches FOR SELECT 
  USING (
    competition_id IN (
      SELECT c.id 
      FROM competitions c
      INNER JOIN group_members gm ON gm.group_id = c.group_id
      WHERE gm.player_id = get_current_player_id()
    )
  );

CREATE POLICY "Group admins can create matches" 
  ON matches FOR INSERT 
  WITH CHECK (
    competition_id IN (
      SELECT c.id 
      FROM competitions c
      INNER JOIN groups g ON g.id = c.group_id
      WHERE g.admin_id = get_current_player_id()
    )
  );

CREATE POLICY "Group admins and players can update matches" 
  ON matches FOR UPDATE 
  USING (
    competition_id IN (
      SELECT c.id 
      FROM competitions c
      INNER JOIN groups g ON g.id = c.group_id
      WHERE g.admin_id = get_current_player_id()
    )
    OR home_player_id = get_current_player_id()
    OR away_player_id = get_current_player_id()
  );

CREATE POLICY "Group admins can delete matches" 
  ON matches FOR DELETE 
  USING (
    competition_id IN (
      SELECT c.id 
      FROM competitions c
      INNER JOIN groups g ON g.id = c.group_id
      WHERE g.admin_id = get_current_player_id()
    )
  );

-- ============================================================================
-- CHAT MESSAGES POLICIES
-- ============================================================================
CREATE POLICY "Chat messages viewable by group members" 
  ON chat_messages FOR SELECT 
  USING (
    group_id IN (
      SELECT group_id 
      FROM group_members 
      WHERE player_id = get_current_player_id()
    )
  );

CREATE POLICY "Group members can send messages" 
  ON chat_messages FOR INSERT 
  WITH CHECK (
    group_id IN (
      SELECT group_id 
      FROM group_members 
      WHERE player_id = get_current_player_id()
    )
  );

-- ============================================================================
-- PLAYER STATS POLICIES
-- ============================================================================
CREATE POLICY "Player stats are viewable by everyone" 
  ON player_stats FOR SELECT 
  USING (true);

CREATE POLICY "Player stats can be inserted by authenticated users" 
  ON player_stats FOR INSERT 
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Player stats can be updated by authenticated users" 
  ON player_stats FOR UPDATE 
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Player stats can be deleted by authenticated users" 
  ON player_stats FOR DELETE 
  USING (auth.uid() IS NOT NULL);

-- Verification: List all policies to confirm they were created
SELECT schemaname, tablename, policyname, cmd 
FROM pg_policies 
WHERE schemaname = 'public' 
ORDER BY tablename, policyname;
