-- ============================================
-- FIX INFINITE RECURSION IN PLAYERS TABLE
-- ============================================
-- This script removes the problematic superadmin policy
-- that causes infinite recursion by querying the players table
-- within a players table policy.

BEGIN;

-- Drop the problematic superadmin policy on players
DROP POLICY IF EXISTS "Superadmin can view all players" ON players;

-- The "Players are viewable by everyone" policy already allows
-- superadmins to view all players, so we don't need a separate policy.
-- This policy is: SELECT | true

-- Verify remaining policies on players table:
-- 1. "Players are viewable by everyone" - SELECT | true
-- 2. "Players can view themselves" - SELECT | auth_user_id = auth.uid()
-- 3. "Users can insert own profile" - INSERT | auth.uid() = auth_user_id
-- 4. "Users can update own profile" - UPDATE | auth.uid() = auth_user_id

COMMIT;

-- Test query to verify no recursion
SELECT id, handle, role FROM players LIMIT 5;
