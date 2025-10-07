-- ============================================================================
-- FIX MATCH UPDATE ISSUE
-- This ensures authenticated users can update matches
-- ============================================================================

BEGIN;

-- Drop existing match policies
DROP POLICY IF EXISTS matches_update_admin_or_player ON public.matches;
DROP POLICY IF EXISTS matches_update_superadmin ON public.matches;
DROP POLICY IF EXISTS matches_update_all ON public.matches;
DROP POLICY IF EXISTS allow_all_authenticated ON public.matches;

-- Create a permissive policy that allows:
-- 1. Group admins to update any match in their competitions
-- 2. Players involved in the match to update it
-- 3. Superadmins to update any match
CREATE POLICY matches_update_admin_or_player ON public.matches
  FOR UPDATE USING (
    is_superadmin()
    OR EXISTS (
      SELECT 1 FROM competitions c
      JOIN groups g ON g.id = c.group_id
      JOIN players p ON p.id = g.admin_id
      WHERE c.id = matches.competition_id 
      AND p.auth_user_id = auth.uid()
    )
    OR home_player_id IN (
      SELECT id FROM players WHERE auth_user_id = auth.uid()
    )
    OR away_player_id IN (
      SELECT id FROM players WHERE auth_user_id = auth.uid()
    )
  );

COMMIT;

-- ============================================================================
-- VERIFICATION
-- ============================================================================

-- Check the policy was created
SELECT 
  schemaname,
  tablename,
  policyname,
  cmd as operation,
  qual as using_expression
FROM pg_policies 
WHERE tablename = 'matches' 
AND cmd = 'UPDATE';
