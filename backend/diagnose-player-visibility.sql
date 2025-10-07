-- Diagnose why non-admin players can't see other players' data

-- 1. Check if RLS is enabled on players table
SELECT 
    schemaname,
    tablename,
    rowsecurity
FROM pg_tables 
WHERE tablename = 'players';

-- 2. Check all policies on players table
SELECT 
    schemaname,
    tablename,
    policyname,
    permissive,
    roles,
    cmd,
    qual as using_clause,
    with_check
FROM pg_policies 
WHERE tablename = 'players';

-- 3. Test if current user can see all players
-- Run this as a non-admin user
SELECT 
    id,
    name,
    gamer_handle,
    email,
    auth_user_id
FROM players;

-- 4. Check if there are any column-level security policies
SELECT 
    table_name,
    column_name,
    privilege_type
FROM information_schema.column_privileges
WHERE table_name = 'players';

-- 5. Verify the players table structure
SELECT 
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns
WHERE table_name = 'players'
ORDER BY ordinal_position;

-- SOLUTION: If RLS is blocking access, we need to ensure the SELECT policy is correct
-- The policy should be:
-- CREATE POLICY players_viewable_by_all ON players FOR SELECT USING (true);

-- If the issue persists, it might be that RLS is enabled but the policy isn't working
-- In that case, we can temporarily disable RLS for testing:
-- ALTER TABLE players DISABLE ROW LEVEL SECURITY;

-- Or ensure the policy exists and is correct:
DROP POLICY IF EXISTS players_viewable_by_all ON players;
CREATE POLICY players_viewable_by_all ON players 
    FOR SELECT 
    USING (true);
