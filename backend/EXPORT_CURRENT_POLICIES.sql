-- Export all current RLS policies for backup
-- Run this first to save current state before making changes

-- Export all policies
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
ORDER BY tablename, policyname;

-- Export all functions used in policies
SELECT 
    n.nspname as schema,
    p.proname as function_name,
    pg_get_functiondef(p.oid) as definition
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'public'
AND p.proname LIKE '%superadmin%' OR p.proname LIKE '%admin%' OR p.proname LIKE '%member%'
ORDER BY p.proname;
