-- Verify and ensure player names are visible to all users
-- This script checks the current state and provides test queries

-- 1. Check current players table policies
SELECT 
    policyname,
    cmd,
    qual as using_clause,
    with_check
FROM pg_policies 
WHERE tablename = 'players'
ORDER BY cmd, policyname;

-- Expected output should include:
-- players_viewable_by_all | SELECT | true | null

-- 2. Test if current user can see all players
SELECT 
    id,
    name,
    handle,
    auth_user_id
FROM players
LIMIT 5;

-- If this returns data, RLS is working correctly for players

-- 3. Test matches with player names (this is what the app should be doing)
SELECT 
    m.id as match_id,
    m.home_score,
    m.away_score,
    m.status,
    hp.id as home_player_id,
    hp.name as home_player_name,
    hp.handle as home_player_handle,
    ap.id as away_player_id,
    ap.name as away_player_name,
    ap.handle as away_player_handle,
    c.name as competition_name,
    g.name as group_name
FROM matches m
JOIN competitions c ON c.id = m.competition_id
JOIN groups g ON g.id = c.group_id
LEFT JOIN players hp ON hp.id = m.home_player_id
LEFT JOIN players ap ON ap.id = m.away_player_id
WHERE m.competition_id IN (
    SELECT c2.id
    FROM competitions c2
    JOIN group_members gm ON gm.group_id = c2.group_id
    JOIN players p ON p.id = gm.player_id
    WHERE p.auth_user_id = auth.uid()
)
LIMIT 10;

-- If player names show as NULL, the issue is in the backend query
-- The backend must explicitly select player fields

-- 4. Check if there are any restrictive policies on players that might interfere
SELECT 
    schemaname,
    tablename,
    policyname,
    permissive,
    roles,
    cmd,
    qual
FROM pg_policies 
WHERE tablename = 'players'
ORDER BY cmd;

-- All policies should be PERMISSIVE
-- SELECT should have qual = true (no restrictions)
