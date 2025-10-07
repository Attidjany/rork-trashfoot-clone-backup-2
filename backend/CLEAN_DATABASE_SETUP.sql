-- =====================================================
-- CLEAN DATABASE SETUP
-- This is the authoritative, clean setup for all policies
-- Run this AFTER running diagnose-all-policies.sql
-- =====================================================

-- STEP 1: Drop ALL existing policies (clean slate)
-- =====================================================

DO $$ 
DECLARE
    r RECORD;
BEGIN
    FOR r IN (
        SELECT schemaname, tablename, policyname
        FROM pg_policies
        WHERE schemaname = 'public'
    ) LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON %I.%I CASCADE', 
            r.policyname, r.schemaname, r.tablename);
    END LOOP;
END $$;

-- STEP 2: Ensure RLS is enabled on all tables
-- =====================================================

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE players ENABLE ROW LEVEL SECURITY;
ALTER TABLE competitions ENABLE ROW LEVEL SECURITY;
ALTER TABLE matches ENABLE ROW LEVEL SECURITY;
ALTER TABLE match_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE join_requests ENABLE ROW LEVEL SECURITY;

-- STEP 3: Create helper functions (if they don't exist)
-- =====================================================

-- Drop existing functions first
DROP FUNCTION IF EXISTS is_group_member(uuid);
DROP FUNCTION IF EXISTS is_group_admin(uuid);
DROP FUNCTION IF EXISTS is_competition_participant(uuid);
DROP FUNCTION IF EXISTS is_match_participant(uuid);

-- Create helper functions
CREATE OR REPLACE FUNCTION is_group_member(group_id uuid)
RETURNS boolean AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM players
        WHERE players.group_id = is_group_member.group_id
        AND players.user_id = auth.uid()
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

CREATE OR REPLACE FUNCTION is_group_admin(group_id uuid)
RETURNS boolean AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM players
        WHERE players.group_id = is_group_admin.group_id
        AND players.user_id = auth.uid()
        AND players.is_admin = true
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

CREATE OR REPLACE FUNCTION is_competition_participant(competition_id uuid)
RETURNS boolean AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM competitions c
        JOIN players p ON p.group_id = c.group_id
        WHERE c.id = is_competition_participant.competition_id
        AND p.user_id = auth.uid()
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

CREATE OR REPLACE FUNCTION is_match_participant(match_id uuid)
RETURNS boolean AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM matches m
        JOIN competitions c ON c.id = m.competition_id
        JOIN players p ON p.group_id = c.group_id
        WHERE m.id = is_match_participant.match_id
        AND p.user_id = auth.uid()
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- STEP 4: Create policies for PROFILES table
-- =====================================================

-- Users can view all profiles
CREATE POLICY "profiles_select_all"
ON profiles FOR SELECT
TO authenticated
USING (true);

-- Users can insert their own profile
CREATE POLICY "profiles_insert_own"
ON profiles FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = id);

-- Users can update their own profile
CREATE POLICY "profiles_update_own"
ON profiles FOR UPDATE
TO authenticated
USING (auth.uid() = id)
WITH CHECK (auth.uid() = id);

-- STEP 5: Create policies for GROUPS table
-- =====================================================

-- Anyone can view groups
CREATE POLICY "groups_select_all"
ON groups FOR SELECT
TO authenticated
USING (true);

-- Anyone can create groups
CREATE POLICY "groups_insert_all"
ON groups FOR INSERT
TO authenticated
WITH CHECK (true);

-- Only group admins can update groups
CREATE POLICY "groups_update_admin"
ON groups FOR UPDATE
TO authenticated
USING (is_group_admin(id))
WITH CHECK (is_group_admin(id));

-- Only group admins can delete groups
CREATE POLICY "groups_delete_admin"
ON groups FOR DELETE
TO authenticated
USING (is_group_admin(id));

-- STEP 6: Create policies for PLAYERS table
-- =====================================================

-- Anyone can view players
CREATE POLICY "players_select_all"
ON players FOR SELECT
TO authenticated
USING (true);

-- Group admins can insert players
CREATE POLICY "players_insert_admin"
ON players FOR INSERT
TO authenticated
WITH CHECK (is_group_admin(group_id));

-- Group admins can update players
CREATE POLICY "players_update_admin"
ON players FOR UPDATE
TO authenticated
USING (is_group_admin(group_id))
WITH CHECK (is_group_admin(group_id));

-- Group admins can delete players
CREATE POLICY "players_delete_admin"
ON players FOR DELETE
TO authenticated
USING (is_group_admin(group_id));

-- STEP 7: Create policies for COMPETITIONS table
-- =====================================================

-- Group members can view competitions in their groups
CREATE POLICY "competitions_select_members"
ON competitions FOR SELECT
TO authenticated
USING (is_group_member(group_id));

-- Group admins can insert competitions
CREATE POLICY "competitions_insert_admin"
ON competitions FOR INSERT
TO authenticated
WITH CHECK (is_group_admin(group_id));

-- Group admins can update competitions
CREATE POLICY "competitions_update_admin"
ON competitions FOR UPDATE
TO authenticated
USING (is_group_admin(group_id))
WITH CHECK (is_group_admin(group_id));

-- Group admins can delete competitions
CREATE POLICY "competitions_delete_admin"
ON competitions FOR DELETE
TO authenticated
USING (is_group_admin(group_id));

-- STEP 8: Create policies for MATCHES table
-- =====================================================

-- Competition participants can view matches
CREATE POLICY "matches_select_participants"
ON matches FOR SELECT
TO authenticated
USING (is_competition_participant(competition_id));

-- Group admins can insert matches
CREATE POLICY "matches_insert_admin"
ON matches FOR INSERT
TO authenticated
WITH CHECK (
    EXISTS (
        SELECT 1 FROM competitions c
        WHERE c.id = competition_id
        AND is_group_admin(c.group_id)
    )
);

-- Group admins can update matches
CREATE POLICY "matches_update_admin"
ON matches FOR UPDATE
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM competitions c
        WHERE c.id = competition_id
        AND is_group_admin(c.group_id)
    )
)
WITH CHECK (
    EXISTS (
        SELECT 1 FROM competitions c
        WHERE c.id = competition_id
        AND is_group_admin(c.group_id)
    )
);

-- Group admins can delete matches
CREATE POLICY "matches_delete_admin"
ON matches FOR DELETE
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM competitions c
        WHERE c.id = competition_id
        AND is_group_admin(c.group_id)
    )
);

-- STEP 9: Create policies for MATCH_RESULTS table
-- =====================================================

-- Match participants can view results
CREATE POLICY "match_results_select_participants"
ON match_results FOR SELECT
TO authenticated
USING (is_match_participant(match_id));

-- Group admins can insert results
CREATE POLICY "match_results_insert_admin"
ON match_results FOR INSERT
TO authenticated
WITH CHECK (
    EXISTS (
        SELECT 1 FROM matches m
        JOIN competitions c ON c.id = m.competition_id
        WHERE m.id = match_id
        AND is_group_admin(c.group_id)
    )
);

-- Group admins can update results
CREATE POLICY "match_results_update_admin"
ON match_results FOR UPDATE
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM matches m
        JOIN competitions c ON c.id = m.competition_id
        WHERE m.id = match_id
        AND is_group_admin(c.group_id)
    )
)
WITH CHECK (
    EXISTS (
        SELECT 1 FROM matches m
        JOIN competitions c ON c.id = m.competition_id
        WHERE m.id = match_id
        AND is_group_admin(c.group_id)
    )
);

-- Group admins can delete results
CREATE POLICY "match_results_delete_admin"
ON match_results FOR DELETE
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM matches m
        JOIN competitions c ON c.id = m.competition_id
        WHERE m.id = match_id
        AND is_group_admin(c.group_id)
    )
);

-- STEP 10: Create policies for CHAT_MESSAGES table
-- =====================================================

-- Group members can view chat messages
CREATE POLICY "chat_messages_select_members"
ON chat_messages FOR SELECT
TO authenticated
USING (is_group_member(group_id));

-- Group members can insert chat messages
CREATE POLICY "chat_messages_insert_members"
ON chat_messages FOR INSERT
TO authenticated
WITH CHECK (
    is_group_member(group_id) 
    AND (user_id = auth.uid() OR user_id IS NULL)
);

-- Users can update their own messages
CREATE POLICY "chat_messages_update_own"
ON chat_messages FOR UPDATE
TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

-- Users can delete their own messages
CREATE POLICY "chat_messages_delete_own"
ON chat_messages FOR DELETE
TO authenticated
USING (user_id = auth.uid());

-- STEP 11: Create policies for JOIN_REQUESTS table
-- =====================================================

-- Users can view their own join requests
CREATE POLICY "join_requests_select_own"
ON join_requests FOR SELECT
TO authenticated
USING (user_id = auth.uid());

-- Group admins can view join requests for their groups
CREATE POLICY "join_requests_select_admin"
ON join_requests FOR SELECT
TO authenticated
USING (is_group_admin(group_id));

-- Users can insert their own join requests
CREATE POLICY "join_requests_insert_own"
ON join_requests FOR INSERT
TO authenticated
WITH CHECK (user_id = auth.uid());

-- Group admins can update join requests
CREATE POLICY "join_requests_update_admin"
ON join_requests FOR UPDATE
TO authenticated
USING (is_group_admin(group_id))
WITH CHECK (is_group_admin(group_id));

-- Users can delete their own join requests
CREATE POLICY "join_requests_delete_own"
ON join_requests FOR DELETE
TO authenticated
USING (user_id = auth.uid());

-- Group admins can delete join requests for their groups
CREATE POLICY "join_requests_delete_admin"
ON join_requests FOR DELETE
TO authenticated
USING (is_group_admin(group_id));

-- STEP 12: Grant necessary permissions
-- =====================================================

GRANT USAGE ON SCHEMA public TO authenticated;
GRANT ALL ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO authenticated;

-- STEP 13: Enable realtime for necessary tables
-- =====================================================

ALTER PUBLICATION supabase_realtime ADD TABLE chat_messages;
ALTER PUBLICATION supabase_realtime ADD TABLE matches;
ALTER PUBLICATION supabase_realtime ADD TABLE match_results;
ALTER PUBLICATION supabase_realtime ADD TABLE competitions;
ALTER PUBLICATION supabase_realtime ADD TABLE players;
ALTER PUBLICATION supabase_realtime ADD TABLE join_requests;

-- =====================================================
-- VERIFICATION QUERIES
-- Run these to verify everything is set up correctly
-- =====================================================

-- Count policies per table
SELECT 
    tablename,
    COUNT(*) as policy_count
FROM pg_policies
WHERE schemaname = 'public'
GROUP BY tablename
ORDER BY tablename;

-- Verify RLS is enabled
SELECT 
    tablename,
    rowsecurity as rls_enabled
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY tablename;

-- Final success message
DO $$
BEGIN
    RAISE NOTICE '✅ Clean database setup completed successfully!';
    RAISE NOTICE 'All policies have been recreated from scratch.';
    RAISE NOTICE 'Please test your app functionality now.';
END $$;
