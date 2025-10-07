-- ============================================================================
-- COMPLETE POLICY EXPORT - Get full policy definitions for backup
-- ============================================================================

-- Export all RLS policies with their full definitions
SELECT 
    schemaname,
    tablename,
    policyname,
    permissive,
    roles,
    cmd as operation,
    qual as using_expression,
    with_check as with_check_expression
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY tablename, policyname;

-- ============================================================================
-- This will show you:
-- - schemaname: The schema (should be 'public')
-- - tablename: Which table the policy is on
-- - policyname: The policy name
-- - permissive: Whether it's PERMISSIVE or RESTRICTIVE
-- - roles: Which roles the policy applies to
-- - operation: SELECT, INSERT, UPDATE, DELETE, or ALL
-- - using_expression: The USING clause (what rows can be accessed)
-- - with_check_expression: The WITH CHECK clause (what rows can be inserted/updated)
-- ============================================================================
