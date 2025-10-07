-- ============================================================================
-- CLEAN RLS POLICY REBUILD
-- ============================================================================
-- This script completely rebuilds all RLS policies from scratch
-- Based on actual app requirements and data access patterns
-- 
-- IMPORTANT: Run EXPORT_CURRENT_POLICIES.sql first to backup current state
-- ============================================================================

-- ============================================================================
-- STEP 1: DROP ALL EXISTING POLICIES
-- ============================================================================

-- Drop all policies on all tables
DO $$ 
DECLARE
    r RECORD;
BEGIN
    FOR r IN (
        SELECT schemaname, tablename, policyname
        FROM pg_policies
        WHERE schemaname = 'public'
    ) LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON %I.%I', 
            r.policyname, r.schemaname, r.tablename);
    END LOOP;
END $$;

-- ============================================================================
-- STEP 2: CREATE HELPER FUNCTIONS
-- ============================================================================

-- Function to check if current user is a superadmin
CREATE OR REPLACE FUNCTION is_superadmin()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM players
    WHERE auth_user_id = auth.uid()
    AND role = 'super_admin'
    AND status = 'active'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- Function to check if current user is admin of a specific group
CREATE OR REPLACE FUNCTION is_group_admin(group_uuid UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM groups g
    INNER JOIN players p ON g.admin_id = p.id
    WHERE g.id = group_uuid
    AND p.auth_user_id = auth.uid()
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- Function to check if current user is a member of a specific group
CREATE OR REPLACE FUNCTION is_group_member(group_uuid UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM group_members gm
    INNER JOIN players p ON gm.player_id = p.id
    WHERE gm.group_id = group_uuid
    AND p.auth_user_id = auth.uid()
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- Function to get current player ID
CREATE OR REPLACE FUNCTION current_player_id()
RETURNS UUID AS $$
BEGIN
  RETURN (
    SELECT id FROM players
    WHERE auth_user_id = auth.uid()
    LIMIT 1
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- ============================================================================
-- STEP 3: PLAYERS TABLE POLICIES
-- ============================================================================
-- Requirements:
-- - All authenticated users can see all player profiles (for matches, stats, etc.)
-- - Users can only update their own profile
-- - Users can insert their own profile during registration
-- - Superadmins can update and delete any player

-- SELECT: Everyone can see all players
CREATE POLICY "players_select_all"
ON players FOR SELECT
TO public
USING (true);

-- INSERT: Users can create their own player profile
CREATE POLICY "players_insert_own"
ON players FOR INSERT
TO public
WITH CHECK (auth.uid() = auth_user_id);

-- UPDATE: Users can update their own profile OR superadmin can update anyone
CREATE POLICY "players_update_own_or_superadmin"
ON players FOR UPDATE
TO public
USING (
  auth.uid() = auth_user_id
  OR is_superadmin()
);

-- DELETE: Only superadmins can delete players
CREATE POLICY "players_delete_superadmin"
ON players FOR DELETE
TO public
USING (is_superadmin());

-- ============================================================================
-- STEP 4: PLAYER_STATS TABLE POLICIES
-- ============================================================================
-- Requirements:
-- - All authenticated users can see all stats (for leaderboards, comparisons)
-- - System can insert/update stats (no user restrictions needed)

-- SELECT: Everyone can see all stats
CREATE POLICY "player_stats_select_all"
ON player_stats FOR SELECT
TO public
USING (true);

-- INSERT: Any authenticated user can insert stats
CREATE POLICY "player_stats_insert_authenticated"
ON player_stats FOR INSERT
TO public
WITH CHECK (auth.uid() IS NOT NULL);

-- UPDATE: Any authenticated user can update stats
CREATE POLICY "player_stats_update_authenticated"
ON player_stats FOR UPDATE
TO public
USING (auth.uid() IS NOT NULL);

-- DELETE: Only superadmins can delete stats
CREATE POLICY "player_stats_delete_superadmin"
ON player_stats FOR DELETE
TO public
USING (is_superadmin());

-- ============================================================================
-- STEP 5: GROUPS TABLE POLICIES
-- ============================================================================
-- Requirements:
-- - Public groups visible to all
-- - Private groups visible only to members
-- - Any authenticated user can create a group
-- - Only group admin can update/delete their group

-- SELECT: Public groups OR groups where user is a member
CREATE POLICY "groups_select_public_or_member"
ON groups FOR SELECT
TO public
USING (
  is_public = true
  OR is_group_member(id)
  OR is_superadmin()
);

-- INSERT: Any authenticated user can create a group
CREATE POLICY "groups_insert_authenticated"
ON groups FOR INSERT
TO public
WITH CHECK (auth.uid() IS NOT NULL);

-- UPDATE: Only group admin or superadmin can update
CREATE POLICY "groups_update_admin_or_superadmin"
ON groups FOR UPDATE
TO public
USING (
  is_group_admin(id)
  OR is_superadmin()
);

-- DELETE: Only group admin or superadmin can delete
CREATE POLICY "groups_delete_admin_or_superadmin"
ON groups FOR DELETE
TO public
USING (
  is_group_admin(id)
  OR is_superadmin()
);

-- ============================================================================
-- STEP 6: GROUP_MEMBERS TABLE POLICIES
-- ============================================================================
-- Requirements:
-- - Group members can see all members of their groups
-- - Public groups: anyone can see members
-- - Group admins can add/remove members
-- - Users can remove themselves

-- SELECT: Members of the group OR public groups OR superadmin
CREATE POLICY "group_members_select_member_or_public"
ON group_members FOR SELECT
TO public
USING (
  is_group_member(group_id)
  OR EXISTS (SELECT 1 FROM groups WHERE id = group_id AND is_public = true)
  OR is_superadmin()
);

-- INSERT: Group admin or superadmin can add members
CREATE POLICY "group_members_insert_admin_or_superadmin"
ON group_members FOR INSERT
TO public
WITH CHECK (
  is_group_admin(group_id)
  OR is_superadmin()
);

-- DELETE: Group admin can remove anyone, users can remove themselves, or superadmin
CREATE POLICY "group_members_delete_admin_self_or_superadmin"
ON group_members FOR DELETE
TO public
USING (
  is_group_admin(group_id)
  OR player_id = current_player_id()
  OR is_superadmin()
);

-- ============================================================================
-- STEP 7: PENDING_GROUP_MEMBERS TABLE POLICIES
-- ============================================================================
-- Requirements:
-- - Group admins can see pending requests for their groups
-- - Requesting player can see their own requests
-- - Anyone can create a join request
-- - Group admins can update/delete requests

-- SELECT: Group admin OR the requesting player OR superadmin
CREATE POLICY "pending_members_select_admin_or_requester"
ON pending_group_members FOR SELECT
TO public
USING (
  is_group_admin(group_id)
  OR player_id = current_player_id()
  OR is_superadmin()
);

-- INSERT: Any authenticated user can request to join
CREATE POLICY "pending_members_insert_authenticated"
ON pending_group_members FOR INSERT
TO public
WITH CHECK (auth.uid() IS NOT NULL);

-- UPDATE: Group admin or superadmin can update status
CREATE POLICY "pending_members_update_admin_or_superadmin"
ON pending_group_members FOR UPDATE
TO public
USING (
  is_group_admin(group_id)
  OR is_superadmin()
);

-- DELETE: Group admin, requester, or superadmin can delete
CREATE POLICY "pending_members_delete_admin_requester_or_superadmin"
ON pending_group_members FOR DELETE
TO public
USING (
  is_group_admin(group_id)
  OR player_id = current_player_id()
  OR is_superadmin()
);

-- ============================================================================
-- STEP 8: COMPETITIONS TABLE POLICIES
-- ============================================================================
-- Requirements:
-- - Group members can see competitions in their groups
-- - Group admins can create/update/delete competitions

-- SELECT: Group members OR superadmin
CREATE POLICY "competitions_select_member"
ON competitions FOR SELECT
TO public
USING (
  is_group_member(group_id)
  OR is_superadmin()
);

-- INSERT: Group admin or superadmin
CREATE POLICY "competitions_insert_admin_or_superadmin"
ON competitions FOR INSERT
TO public
WITH CHECK (
  is_group_admin(group_id)
  OR is_superadmin()
);

-- UPDATE: Group admin or superadmin
CREATE POLICY "competitions_update_admin_or_superadmin"
ON competitions FOR UPDATE
TO public
USING (
  is_group_admin(group_id)
  OR is_superadmin()
);

-- DELETE: Group admin or superadmin
CREATE POLICY "competitions_delete_admin_or_superadmin"
ON competitions FOR DELETE
TO public
USING (
  is_group_admin(group_id)
  OR is_superadmin()
);

-- ============================================================================
-- STEP 9: COMPETITION_PARTICIPANTS TABLE POLICIES
-- ============================================================================
-- Requirements:
-- - Group members can see participants
-- - Group admins can add/remove participants

-- SELECT: Group members OR superadmin
CREATE POLICY "comp_participants_select_member"
ON competition_participants FOR SELECT
TO public
USING (
  EXISTS (
    SELECT 1 FROM competitions c
    WHERE c.id = competition_id
    AND is_group_member(c.group_id)
  )
  OR is_superadmin()
);

-- INSERT: Group admin or superadmin
CREATE POLICY "comp_participants_insert_admin_or_superadmin"
ON competition_participants FOR INSERT
TO public
WITH CHECK (
  EXISTS (
    SELECT 1 FROM competitions c
    WHERE c.id = competition_id
    AND (is_group_admin(c.group_id) OR is_superadmin())
  )
);

-- DELETE: Group admin or superadmin
CREATE POLICY "comp_participants_delete_admin_or_superadmin"
ON competition_participants FOR DELETE
TO public
USING (
  EXISTS (
    SELECT 1 FROM competitions c
    WHERE c.id = competition_id
    AND (is_group_admin(c.group_id) OR is_superadmin())
  )
);

-- ============================================================================
-- STEP 10: MATCHES TABLE POLICIES
-- ============================================================================
-- Requirements:
-- - Group members can see matches
-- - Group admins can create/delete matches
-- - Players in the match can update scores
-- - Group admins can update any match

-- SELECT: Group members OR superadmin
CREATE POLICY "matches_select_member"
ON matches FOR SELECT
TO public
USING (
  EXISTS (
    SELECT 1 FROM competitions c
    WHERE c.id = competition_id
    AND is_group_member(c.group_id)
  )
  OR is_superadmin()
);

-- INSERT: Group admin or superadmin
CREATE POLICY "matches_insert_admin_or_superadmin"
ON matches FOR INSERT
TO public
WITH CHECK (
  EXISTS (
    SELECT 1 FROM competitions c
    WHERE c.id = competition_id
    AND (is_group_admin(c.group_id) OR is_superadmin())
  )
);

-- UPDATE: Group admin, players in the match, or superadmin
CREATE POLICY "matches_update_admin_players_or_superadmin"
ON matches FOR UPDATE
TO public
USING (
  EXISTS (
    SELECT 1 FROM competitions c
    WHERE c.id = competition_id
    AND is_group_admin(c.group_id)
  )
  OR home_player_id = current_player_id()
  OR away_player_id = current_player_id()
  OR is_superadmin()
);

-- DELETE: Group admin or superadmin
CREATE POLICY "matches_delete_admin_or_superadmin"
ON matches FOR DELETE
TO public
USING (
  EXISTS (
    SELECT 1 FROM competitions c
    WHERE c.id = competition_id
    AND (is_group_admin(c.group_id) OR is_superadmin())
  )
);

-- ============================================================================
-- STEP 11: CHAT_MESSAGES TABLE POLICIES
-- ============================================================================
-- Requirements:
-- - Group members can see messages in their groups
-- - Group members can send messages
-- - Superadmins can see all messages

-- SELECT: Group members OR superadmin
CREATE POLICY "chat_messages_select_member"
ON chat_messages FOR SELECT
TO public
USING (
  is_group_member(group_id)
  OR is_superadmin()
);

-- INSERT: Group members OR superadmin
CREATE POLICY "chat_messages_insert_member"
ON chat_messages FOR INSERT
TO public
WITH CHECK (
  is_group_member(group_id)
  OR is_superadmin()
);

-- UPDATE: No one can update messages (immutable)
-- DELETE: Only superadmin can delete messages
CREATE POLICY "chat_messages_delete_superadmin"
ON chat_messages FOR DELETE
TO public
USING (is_superadmin());

-- ============================================================================
-- VERIFICATION QUERIES
-- ============================================================================

-- Count policies per table
SELECT 
    tablename,
    COUNT(*) as policy_count
FROM pg_policies
WHERE schemaname = 'public'
GROUP BY tablename
ORDER BY tablename;

-- List all policies
SELECT 
    tablename,
    policyname,
    cmd,
    CASE 
        WHEN qual IS NOT NULL THEN 'USING clause present'
        ELSE 'No USING clause'
    END as has_using,
    CASE 
        WHEN with_check IS NOT NULL THEN 'WITH CHECK present'
        ELSE 'No WITH CHECK'
    END as has_with_check
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY tablename, cmd, policyname;

-- Test helper functions
SELECT 
    'is_superadmin' as function_name,
    is_superadmin() as result
UNION ALL
SELECT 
    'current_player_id',
    current_player_id()::text;

COMMENT ON FUNCTION is_superadmin() IS 'Returns true if current user is a superadmin';
COMMENT ON FUNCTION is_group_admin(UUID) IS 'Returns true if current user is admin of the specified group';
COMMENT ON FUNCTION is_group_member(UUID) IS 'Returns true if current user is a member of the specified group';
COMMENT ON FUNCTION current_player_id() IS 'Returns the player ID of the current authenticated user';
