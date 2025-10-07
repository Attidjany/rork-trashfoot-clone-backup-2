-- Export all RLS policies with complete definitions
-- Run this query and save the results to share

SELECT 
    schemaname,
    tablename,
    policyname,
    permissive,
    roles,
    cmd,
    qual,
    with_check,
    -- Generate the DROP statement
    format('DROP POLICY IF EXISTS %I ON %I.%I;', 
        policyname, schemaname, tablename) as drop_statement,
    -- Generate the CREATE statement
    format('CREATE POLICY %I ON %I.%I AS %s FOR %s TO %s %s %s;',
        policyname,
        schemaname,
        tablename,
        CASE WHEN permissive = 'PERMISSIVE' THEN 'PERMISSIVE' ELSE 'RESTRICTIVE' END,
        cmd,
        array_to_string(roles, ', '),
        CASE WHEN qual IS NOT NULL THEN 'USING (' || qual || ')' ELSE '' END,
        CASE WHEN with_check IS NOT NULL THEN 'WITH CHECK (' || with_check || ')' ELSE '' END
    ) as create_statement
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY tablename, policyname;
