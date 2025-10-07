-- Fix player column references in SQL files
-- The correct column is gamer_handle, not handle

-- First, let's verify the players table structure
SELECT 
    column_name,
    data_type,
    is_nullable
FROM information_schema.columns
WHERE table_name = 'players'
ORDER BY ordinal_position;

-- Verify that players_viewable_by_all policy exists and is correct
SELECT 
    policyname,
    cmd,
    qual as using_clause,
    with_check
FROM pg_policies 
WHERE tablename = 'players' AND cmd = 'SELECT';

-- Test query to verify player data is accessible
-- This should return all players with their gamer_handle
SELECT 
    id,
    name,
    gamer_handle,
    email,
    auth_user_id
FROM players
LIMIT 5;

-- Test query to verify matches with player names work
SELECT 
    m.id as match_id,
    m.home_score,
    m.away_score,
    m.status,
    hp.id as home_player_id,
    hp.name as home_player_name,
    hp.gamer_handle as home_player_handle,
    ap.id as away_player_id,
    ap.name as away_player_name,
    ap.gamer_handle as away_player_handle
FROM matches m
LEFT JOIN players hp ON hp.id = m.home_player_id
LEFT JOIN players ap ON ap.id = m.away_player_id
LIMIT 10;

-- If the above query returns NULL for player names, it means:
-- 1. The players table doesn't have a 'name' column (only gamer_handle)
-- 2. OR the RLS policy is blocking access to the name column
-- 3. OR the name column is NULL in the database

-- Check if there are any NULL names in the players table
SELECT 
    COUNT(*) as total_players,
    COUNT(name) as players_with_name,
    COUNT(gamer_handle) as players_with_handle
FROM players;
