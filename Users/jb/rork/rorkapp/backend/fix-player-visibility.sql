-- Fix player name visibility issue
-- The players table should be viewable by all, which it already is
-- But we need to ensure the queries are properly joining player data

-- First, verify the current players SELECT policy
SELECT 
    schemaname,
    tablename,
    policyname,
    cmd,
    qual
FROM pg_policies 
WHERE tablename = 'players' AND cmd = 'SELECT';

-- The policy should show: players_viewable_by_all with qual = true
-- This means all authenticated users can see all players

-- Now let's check if there are any issues with the matches table
-- that might prevent proper joins
SELECT 
    schemaname,
    tablename,
    policyname,
    cmd,
    qual
FROM pg_policies 
WHERE tablename = 'matches';

-- Test query to verify player data is accessible
-- This should return player names for all matches
SELECT 
    m.id,
    m.home_player_id,
    m.away_player_id,
    hp.name as home_player_name,
    hp.handle as home_player_handle,
    ap.name as away_player_name,
    ap.handle as away_player_handle
FROM matches m
LEFT JOIN players hp ON hp.id = m.home_player_id
LEFT JOIN players ap ON ap.id = m.away_player_id
WHERE m.competition_id IN (
    SELECT c.id
    FROM competitions c
    JOIN group_members gm ON gm.group_id = c.group_id
    JOIN players p ON p.id = gm.player_id
    WHERE p.auth_user_id = auth.uid()
)
LIMIT 10;

-- If the above query works in SQL but not in the app,
-- the issue is likely in the backend query construction
-- The backend needs to explicitly join the players table
