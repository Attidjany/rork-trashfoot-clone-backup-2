-- Fix infinite recursion in players RLS policies
-- The key is to NEVER join back to players table in any policy
-- Instead, use auth.uid() directly

-- Drop all existing policies
DROP POLICY IF EXISTS "Players are viewable by everyone" ON players;
DROP POLICY IF EXISTS "Users can update own profile" ON players;
DROP POLICY IF EXISTS "Users can insert own profile" ON players;

DROP POLICY IF EXISTS "Public groups are viewable by everyone" ON groups;
DROP POLICY IF EXISTS "Authenticated users can create groups" ON groups;
DROP POLICY IF EXISTS "Group admins can update groups" ON groups;
DROP POLICY IF EXISTS "Group admins can delete groups" ON groups;

DROP POLICY IF EXISTS "Group members viewable by group members" ON group_members;
DROP POLICY IF EXISTS "Group admins can add members" ON group_members;
DROP POLICY IF EXISTS "Group admins can remove members" ON group_members;

DROP POLICY IF EXISTS "Pending members viewable by admins and requester" ON pending_group_members;
DROP POLICY IF EXISTS "Authenticated users can request to join" ON pending_group_members;
DROP POLICY IF EXISTS "Group admins can update pending members" ON pending_group_members;
DROP POLICY IF EXISTS "Group admins can delete pending members" ON pending_group_members;

DROP POLICY IF EXISTS "Competitions viewable by group members" ON competitions;
DROP POLICY IF EXISTS "Group admins can create competitions" ON competitions;
DROP POLICY IF EXISTS "Group admins can update competitions" ON competitions;
DROP POLICY IF EXISTS "Group admins can delete pending members" ON competitions;
DROP POLICY IF EXISTS "Group admins can delete competitions" ON competitions;

DROP POLICY IF EXISTS "Competition participants viewable by group members" ON competition_participants;
DROP POLICY IF EXISTS "Group admins can add participants" ON competition_participants;
DROP POLICY IF EXISTS "Group admins can delete participants" ON competition_participants;

DROP POLICY IF EXISTS "Matches viewable by group members" ON matches;
DROP POLICY IF EXISTS "Group admins can create matches" ON matches;
DROP POLICY IF EXISTS "Group admins and players can update matches" ON matches;
DROP POLICY IF EXISTS "Group admins can delete matches" ON matches;

DROP POLICY IF EXISTS "Chat messages viewable by group members" ON chat_messages;
DROP POLICY IF EXISTS "Group members can send messages" ON chat_messages;

DROP POLICY IF EXISTS "Player stats are viewable by everyone" ON player_stats;
DROP POLICY IF EXISTS "Player stats can be inserted by authenticated users" ON player_stats;
DROP POLICY IF EXISTS "Player stats can be updated by authenticated users" ON player_stats;
DROP POLICY IF EXISTS "Player stats can be deleted by authenticated users" ON player_stats;

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
-- GROUPS POLICIES - Use auth.uid() directly, NO players table join
-- ============================================================================
CREATE POLICY "Public groups are viewable by everyone" 
  ON groups FOR SELECT 
  USING (
    is_public = true 
    OR id IN (
      SELECT group_id 
      FROM group_members 
      WHERE player_id IN (
        SELECT id FROM players WHERE auth_user_id = auth.uid()
      )
    )
  );

CREATE POLICY "Authenticated users can create groups" 
  ON groups FOR INSERT 
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Group admins can update groups" 
  ON groups FOR UPDATE 
  USING (
    admin_id IN (
      SELECT id FROM players WHERE auth_user_id = auth.uid()
    )
  );

CREATE POLICY "Group admins can delete groups" 
  ON groups FOR DELETE 
  USING (
    admin_id IN (
      SELECT id FROM players WHERE auth_user_id = auth.uid()
    )
  );

-- ============================================================================
-- GROUP MEMBERS POLICIES
-- ============================================================================
CREATE POLICY "Group members viewable by group members" 
  ON group_members FOR SELECT 
  USING (
    group_id IN (
      SELECT group_id 
      FROM group_members 
      WHERE player_id IN (
        SELECT id FROM players WHERE auth_user_id = auth.uid()
      )
    )
  );

CREATE POLICY "Group admins can add members" 
  ON group_members FOR INSERT 
  WITH CHECK (
    group_id IN (
      SELECT id 
      FROM groups 
      WHERE admin_id IN (
        SELECT id FROM players WHERE auth_user_id = auth.uid()
      )
    )
  );

CREATE POLICY "Group admins can remove members" 
  ON group_members FOR DELETE 
  USING (
    group_id IN (
      SELECT id 
      FROM groups 
      WHERE admin_id IN (
        SELECT id FROM players WHERE auth_user_id = auth.uid()
      )
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
      WHERE admin_id IN (
        SELECT id FROM players WHERE auth_user_id = auth.uid()
      )
    )
    OR player_id IN (
      SELECT id FROM players WHERE auth_user_id = auth.uid()
    )
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
      WHERE admin_id IN (
        SELECT id FROM players WHERE auth_user_id = auth.uid()
      )
    )
  );

CREATE POLICY "Group admins can delete pending members" 
  ON pending_group_members FOR DELETE 
  USING (
    group_id IN (
      SELECT id 
      FROM groups 
      WHERE admin_id IN (
        SELECT id FROM players WHERE auth_user_id = auth.uid()
      )
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
      WHERE player_id IN (
        SELECT id FROM players WHERE auth_user_id = auth.uid()
      )
    )
  );

CREATE POLICY "Group admins can create competitions" 
  ON competitions FOR INSERT 
  WITH CHECK (
    group_id IN (
      SELECT id 
      FROM groups 
      WHERE admin_id IN (
        SELECT id FROM players WHERE auth_user_id = auth.uid()
      )
    )
  );

CREATE POLICY "Group admins can update competitions" 
  ON competitions FOR UPDATE 
  USING (
    group_id IN (
      SELECT id 
      FROM groups 
      WHERE admin_id IN (
        SELECT id FROM players WHERE auth_user_id = auth.uid()
      )
    )
  );

CREATE POLICY "Group admins can delete competitions" 
  ON competitions FOR DELETE 
  USING (
    group_id IN (
      SELECT id 
      FROM groups 
      WHERE admin_id IN (
        SELECT id FROM players WHERE auth_user_id = auth.uid()
      )
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
      WHERE gm.player_id IN (
        SELECT id FROM players WHERE auth_user_id = auth.uid()
      )
    )
  );

CREATE POLICY "Group admins can add participants" 
  ON competition_participants FOR INSERT 
  WITH CHECK (
    competition_id IN (
      SELECT c.id 
      FROM competitions c
      INNER JOIN groups g ON g.id = c.group_id
      WHERE g.admin_id IN (
        SELECT id FROM players WHERE auth_user_id = auth.uid()
      )
    )
  );

CREATE POLICY "Group admins can delete participants" 
  ON competition_participants FOR DELETE 
  USING (
    competition_id IN (
      SELECT c.id 
      FROM competitions c
      INNER JOIN groups g ON g.id = c.group_id
      WHERE g.admin_id IN (
        SELECT id FROM players WHERE auth_user_id = auth.uid()
      )
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
      WHERE gm.player_id IN (
        SELECT id FROM players WHERE auth_user_id = auth.uid()
      )
    )
  );

CREATE POLICY "Group admins can create matches" 
  ON matches FOR INSERT 
  WITH CHECK (
    competition_id IN (
      SELECT c.id 
      FROM competitions c
      INNER JOIN groups g ON g.id = c.group_id
      WHERE g.admin_id IN (
        SELECT id FROM players WHERE auth_user_id = auth.uid()
      )
    )
  );

CREATE POLICY "Group admins and players can update matches" 
  ON matches FOR UPDATE 
  USING (
    competition_id IN (
      SELECT c.id 
      FROM competitions c
      INNER JOIN groups g ON g.id = c.group_id
      WHERE g.admin_id IN (
        SELECT id FROM players WHERE auth_user_id = auth.uid()
      )
    )
    OR home_player_id IN (
      SELECT id FROM players WHERE auth_user_id = auth.uid()
    )
    OR away_player_id IN (
      SELECT id FROM players WHERE auth_user_id = auth.uid()
    )
  );

CREATE POLICY "Group admins can delete matches" 
  ON matches FOR DELETE 
  USING (
    competition_id IN (
      SELECT c.id 
      FROM competitions c
      INNER JOIN groups g ON g.id = c.group_id
      WHERE g.admin_id IN (
        SELECT id FROM players WHERE auth_user_id = auth.uid()
      )
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
      WHERE player_id IN (
        SELECT id FROM players WHERE auth_user_id = auth.uid()
      )
    )
  );

CREATE POLICY "Group members can send messages" 
  ON chat_messages FOR INSERT 
  WITH CHECK (
    group_id IN (
      SELECT group_id 
      FROM group_members 
      WHERE player_id IN (
        SELECT id FROM players WHERE auth_user_id = auth.uid()
      )
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

-- Verification query
SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual,
  with_check
FROM pg_policies 
WHERE schemaname = 'public'
ORDER BY tablename, policyname;
