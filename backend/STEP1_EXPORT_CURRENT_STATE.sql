-- ============================================================================
-- STEP 1: EXPORT CURRENT RLS STATE
-- ============================================================================
-- This script exports all current policies and functions for backup
-- Run this first and save the output before making any changes
-- ============================================================================

-- Export all current policies with full details
SELECT 
    '-- Policy on table: ' || tablename || E'\n' ||
    'CREATE POLICY "' || policyname || E'"\n' ||
    'ON ' || tablename || ' FOR ' || cmd || E'\n' ||
    'TO ' || array_to_string(roles, ', ') || E'\n' ||
    CASE 
        WHEN qual IS NOT NULL THEN 'USING (' || qual || E')\n'
        ELSE ''
    END ||
    CASE 
        WHEN with_check IS NOT NULL THEN 'WITH CHECK (' || with_check || ');'
        ELSE ';'
    END as policy_definition
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY tablename, policyname;

-- Export all helper functions
SELECT 
    E'\n-- Function: ' || p.proname || E'\n' ||
    pg_get_functiondef(p.oid) || E';\n'
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'public'
AND (
    p.proname LIKE '%superadmin%' 
    OR p.proname LIKE '%admin%' 
    OR p.proname LIKE '%member%'
    OR p.proname LIKE '%player%'
)
ORDER BY p.proname;

-- Summary of current state
SELECT 
    tablename,
    COUNT(*) as policy_count,
    array_agg(DISTINCT cmd::text ORDER BY cmd::text) as operations
FROM pg_policies
WHERE schemaname = 'public'
GROUP BY tablename
ORDER BY tablename;
