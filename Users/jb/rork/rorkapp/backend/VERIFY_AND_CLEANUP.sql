-- =====================================================
-- VERIFY AND CLEANUP - Remove any remaining problematic objects
-- =====================================================

-- 1. Check if get_current_player_id function exists
SELECT 
    routine_name,
    routine_definition
FROM information_schema.routines
WHERE routine_schema = 'public' 
AND routine_name LIKE '%get_current_player%';

-- 2. Drop the function if it exists (this was causing infinite recursion)
DROP FUNCTION IF EXISTS get_current_player_id() CASCADE;

-- 3. Check for any remaining policies that might reference it
SELECT 
    schemaname,
    tablename,
    policyname,
    qual,
    with_check
FROM pg_policies
WHERE qual::text LIKE '%get_current_player_id%'
   OR with_check::text LIKE '%get_current_player_id%';

-- 4. Verify all current policies are clean
SELECT 
    tablename,
    COUNT(*) as policy_count
FROM pg_policies
WHERE schemaname = 'public'
GROUP BY tablename
ORDER BY tablename;

-- 5. Test a simple player creation to verify no recursion
-- (This is just a check query, not an actual insert)
SELECT 
    'Ready to test player creation' as status,
    auth.uid() as current_auth_uid;
