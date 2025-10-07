-- ============================================================================
-- STEP 1: COMPLETE EXPORT OF CURRENT RLS STATE
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
    cmd,
    qual,
    with_check
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY tablename, cmd, policyname;

-- ============================================================================
-- SUMMARY: Count policies per table
-- ============================================================================
SELECT 
    tablename,
    COUNT(*) as policy_count,
    array_agg(DISTINCT cmd::text ORDER BY cmd::text) as operations
FROM pg_policies
WHERE schemaname = 'public'
GROUP BY tablename
ORDER BY tablename;

-- ============================================================================
-- EXPORT: Generate DROP statements for all current policies
-- ============================================================================
SELECT 
    'DROP POLICY IF EXISTS ' || policyname || ' ON ' || schemaname || '.' || tablename || ';' as drop_statement
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY tablename, policyname;
