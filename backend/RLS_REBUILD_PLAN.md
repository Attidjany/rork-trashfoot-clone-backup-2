# RLS Policy Rebuild Plan

## Current Situation
- App is live and users cannot see player names except their own
- Group members count shows as 0
- Even admins cannot see group data properly
- Previous quick fixes have made things worse
- Need a complete, methodical rebuild

## Root Cause Analysis
Based on previous messages:
1. Policies are referencing wrong column names (e.g., `handle` instead of `gamer_handle`)
2. RLS policies are too restrictive - blocking legitimate data access
3. Helper functions may have circular dependencies or incorrect logic
4. The core issue: **Players table SELECT policy is too restrictive**

## The Fix Strategy

### Phase 1: Backup and Diagnosis (DO THIS FIRST)
1. Run `STEP1_EXPORT_CURRENT_STATE.sql` - Save the output to a file
2. Run `STEP2_DIAGNOSE_SCHEMA.sql` - Understand current schema
3. Review the output together before proceeding

### Phase 2: Create Clean Policies (AFTER REVIEWING PHASE 1)
Once we confirm the schema structure, we'll create a new SQL file that:
1. Drops all existing policies
2. Recreates helper functions with correct logic
3. Creates new policies based on actual requirements:
   - **Players**: Everyone can SELECT all players (for displaying names)
   - **Player Stats**: Everyone can SELECT all stats (for leaderboards)
   - **Groups**: Public groups visible to all, private to members only
   - **Group Members**: Visible to group members and for public groups
   - **Matches**: Visible to group members
   - **Chat**: Visible to group members only

### Phase 3: Test and Verify
1. Test as regular user - can they see player names?
2. Test as group member - can they see other members?
3. Test as admin - can they manage their group?
4. Test as superadmin - can they see everything?

## Key Principles for New Policies

### 1. Players Table
```sql
-- EVERYONE can see ALL players (for names in matches, stats, etc.)
SELECT: true (no restrictions)
INSERT: Only own profile (auth.uid() = auth_user_id)
UPDATE: Own profile OR superadmin
DELETE: Superadmin only
```

### 2. Player Stats Table
```sql
-- EVERYONE can see ALL stats (for leaderboards)
SELECT: true (no restrictions)
INSERT/UPDATE: Authenticated users (system updates)
DELETE: Superadmin only
```

### 3. Groups Table
```sql
SELECT: is_public = true OR is_group_member(id) OR is_superadmin()
INSERT: Any authenticated user
UPDATE/DELETE: is_group_admin(id) OR is_superadmin()
```

### 4. Group Members Table
```sql
SELECT: is_group_member(group_id) OR group is public OR is_superadmin()
INSERT: is_group_admin(group_id) OR is_superadmin()
DELETE: is_group_admin(group_id) OR self-removal OR is_superadmin()
```

## What We Need From You

Before proceeding, please:
1. Run `STEP1_EXPORT_CURRENT_STATE.sql` in Supabase SQL Editor
2. Save the complete output to a text file
3. Run `STEP2_DIAGNOSE_SCHEMA.sql` in Supabase SQL Editor
4. Share both outputs here

This will ensure we:
- Have a backup of current state
- Know exact table structure
- Can create policies that match your actual schema
- Won't reference non-existent columns

## Why This Approach?

1. **Safe**: We backup everything first
2. **Informed**: We see actual schema before writing SQL
3. **Methodical**: Step-by-step, no rushing
4. **Testable**: Clear verification steps
5. **Reversible**: We can rollback if needed

## Next Steps

**DO NOT RUN ANY OTHER SQL FILES YET**

1. Run the two diagnostic scripts above
2. Share the output
3. We'll review together
4. Then create the final rebuild script based on actual data
