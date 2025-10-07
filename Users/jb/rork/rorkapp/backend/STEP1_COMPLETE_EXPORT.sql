-- ============================================================================
-- STEP 1: COMPLETE EXPORT OF CURRENT RLS POLICIES
-- ============================================================================
-- This script exports ALL current RLS policies with their full definitions
-- Run this first and save the output before making any changes
-- ============================================================================

-- Export all policies with their complete definitions
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
-- ADDITIONAL CONTEXT: Table relationships and foreign keys
-- ============================================================================

SELECT
    tc.table_name,
    kcu.column_name,
    ccu.table_name AS foreign_table_name,
    ccu.column_name AS foreign_column_name
FROM information_schema.table_constraints AS tc
JOIN information_schema.key_column_usage AS kcu
    ON tc.constraint_name = kcu.constraint_name
    AND tc.table_schema = kcu.table_schema
JOIN information_schema.constraint_column_usage AS ccu
    ON ccu.constraint_name = tc.constraint_name
    AND ccu.table_schema = tc.table_schema
WHERE tc.constraint_type = 'FOREIGN KEY'
    AND tc.table_schema = 'public'
ORDER BY tc.table_name, kcu.column_name;

-- ============================================================================
-- HELPER FUNCTIONS USED IN POLICIES
-- ============================================================================

-- Show the definition of is_superadmin function
SELECT pg_get_functiondef(oid) as function_definition
FROM pg_proc
WHERE proname = 'is_superadmin';

-- Show any other custom functions used in policies
SELECT 
    routine_name,
    routine_type,
    data_type as return_type
FROM information_schema.routines
WHERE routine_schema = 'public'
    AND routine_type = 'FUNCTION'
    AND routine_name IN (
        'is_superadmin',
        'current_player_id',
        'approve_join_request',
        'reject_join_request'
    )
ORDER BY routine_name;
