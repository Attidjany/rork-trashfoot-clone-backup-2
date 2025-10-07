-- Fix player names visibility in matches
-- The issue is that players table is viewable by all, but the queries
-- need to properly join the data

-- First, let's verify the current players policies are correct
-- players_viewable_by_all should allow SELECT for everyone

-- The issue is likely in how the frontend queries are structured
-- or in the matches policies

-- Let's check if there are any issues with the matches SELECT policy
-- It should allow viewing matches AND their associated player data

-- Current policy: matches_select_member
-- This only allows viewing if you're a member of the group

-- We need to ensure that when a match is visible, 
-- the player names are also visible (which they should be with players_viewable_by_all)

-- Let's verify the players table policies are working:
SELECT 
    schemaname,
    tablename,
    policyname,
    cmd,
    qual,
    with_check
FROM pg_policies 
WHERE tablename = 'players'
ORDER BY policyname;

-- The players_viewable_by_all policy should have:
-- cmd: SELECT
-- qual: true
-- This means anyone can SELECT from players table

-- If player names are not showing, it's likely a frontend query issue
-- or the query is not properly joining the tables

-- Let's also check if there are any column-level permissions:
SELECT 
    table_name,
    column_name,
    privilege_type
FROM information_schema.column_privileges
WHERE table_name = 'players';

-- Check table-level permissions:
SELECT 
    table_name,
    privilege_type,
    grantee
FROM information_schema.table_privileges
WHERE table_name = 'players';
