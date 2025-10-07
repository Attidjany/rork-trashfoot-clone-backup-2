# RLS Policy Rebuild Plan

## Overview
This document outlines the step-by-step process to rebuild all RLS policies from scratch based on actual app requirements.

## Current Issues
1. Players can only see their own data (except admins)
2. Group member counts showing as 0
3. Player names not displaying in matches/stats for non-admin users
4. Queries referencing non-existent "handle" column instead of "gamer_handle"
5. Circular dependencies and infinite recursion in policies

## Root Causes
1. **Overly restrictive policies** - Players table policies preventing users from seeing other players
2. **Incorrect column references** - Code using "handle" instead of "gamer_handle"
3. **Circular policy dependencies** - Policies calling each other recursively
4. **Inconsistent policy logic** - Different access patterns across similar tables

## Solution Approach

### Phase 1: Discovery & Backup (NO CHANGES)
**Goal**: Document current state before making any changes

**Steps**:
1. Run `EXPORT_CURRENT_POLICIES.sql` to backup all current policies
2. Save output to a file for reference
3. Document all helper functions
4. Map out current data access patterns from app code

**Verification**:
- [ ] All policies exported and saved
- [ ] All helper functions documented
- [ ] Current state fully backed up

---

### Phase 2: Analysis
**Goal**: Understand what the app actually needs

**Data Access Requirements** (from code analysis):

#### Home Tab (`app/(tabs)/home.tsx`)
- Needs: Player names, gamer_handles, stats
- Access: All players in active group
- Current issue: Only seeing own name

#### Stats Tab (`app/(tabs)/stats.tsx`)
- Needs: All player stats, gamer_handles, achievements
- Access: All players in active group
- Current issue: Only seeing own row

#### Matches Tab (`app/(tabs)/matches.tsx`)
- Needs: Player names for home/away players
- Access: All players in matches
- Current issue: Names blank except own

#### Profile Tab (`app/(tabs)/profile.tsx`)
- Needs: Own player data, group memberships
- Access: Own data + groups
- Current issue: Working correctly

#### Group Details (`app/group-details.tsx`)
- Needs: All group members, their stats
- Access: All members of the group
- Current issue: Member count showing 0

#### Group Browser (`app/group-browser.tsx`)
- Needs: Public groups, member counts
- Access: All public groups
- Current issue: Member counts showing 0

**Required Access Patterns**:
1. **Players**: Everyone can see all players (for matches, stats, leaderboards)
2. **Player Stats**: Everyone can see all stats (for leaderboards, comparisons)
3. **Groups**: Public groups visible to all, private groups to members only
4. **Group Members**: Visible to group members and for public groups
5. **Matches**: Visible to group members
6. **Competitions**: Visible to group members
7. **Chat**: Visible to group members only

---

### Phase 3: Design New Policy System
**Goal**: Create clean, non-circular policies

**Design Principles**:
1. **No circular dependencies** - Helper functions don't call other helper functions
2. **Simple and explicit** - Each policy has one clear purpose
3. **Performance optimized** - Use SECURITY DEFINER and STABLE for helper functions
4. **Well documented** - Every policy has a comment explaining its purpose

**Helper Functions** (in order of dependency):
```sql
1. is_superadmin() - No dependencies
2. current_player_id() - No dependencies
3. is_group_admin(group_id) - Uses current_player_id indirectly via auth.uid()
4. is_group_member(group_id) - Uses current_player_id indirectly via auth.uid()
```

**Policy Structure** (per table):
- SELECT: Who can read data
- INSERT: Who can create data
- UPDATE: Who can modify data
- DELETE: Who can remove data

---

### Phase 4: Implementation (CONTROLLED)
**Goal**: Apply new policies safely with testing at each step

**Pre-Implementation Checklist**:
- [ ] Backup completed (Phase 1)
- [ ] Analysis completed (Phase 2)
- [ ] Design reviewed (Phase 3)
- [ ] Test users ready (superadmin, group admin, regular player)
- [ ] Rollback plan ready

**Implementation Steps**:

#### Step 1: Export Current State
```bash
# In Supabase SQL Editor
Run: backend/EXPORT_CURRENT_POLICIES.sql
Save output to: backend/BACKUP_POLICIES_[DATE].txt
```

#### Step 2: Apply New Policies
```bash
# In Supabase SQL Editor
Run: backend/CLEAN_RLS_REBUILD.sql
```

This will:
1. Drop all existing policies
2. Create new helper functions
3. Create new policies for all tables
4. Run verification queries

#### Step 3: Verify Policies Created
Check the output of verification queries:
- [ ] All tables have policies
- [ ] Helper functions exist
- [ ] No errors in output

---

### Phase 5: Testing
**Goal**: Verify all access patterns work correctly

**Test Users**:
1. **Superadmin** - Has super_admin role
2. **Group Admin** - Admin of at least one group
3. **Regular Player** - Member of at least one group
4. **Non-Member** - Not a member of any group

**Test Cases**:

#### Test 1: Players Table
| User Type | Action | Expected Result |
|-----------|--------|-----------------|
| Any | View all players | ✅ Can see all players |
| Own | Update own profile | ✅ Can update |
| Other | Update other profile | ❌ Cannot update |
| Superadmin | Update any profile | ✅ Can update |
| Superadmin | Delete any player | ✅ Can delete |

#### Test 2: Home Tab
| User Type | Expected Result |
|-----------|-----------------|
| Group Member | See all player names in group |
| Group Member | See all player stats |
| Group Member | See top players leaderboard |

#### Test 3: Stats Tab
| User Type | Expected Result |
|-----------|-----------------|
| Group Member | See all players in leaderboard |
| Group Member | See all player gamer_handles |
| Group Member | See all player stats |

#### Test 4: Matches Tab
| User Type | Expected Result |
|-----------|-----------------|
| Group Member | See all matches |
| Group Member | See both player names in each match |
| Match Player | Can update own match score |
| Group Admin | Can update any match |

#### Test 5: Group Details
| User Type | Expected Result |
|-----------|-----------------|
| Group Member | See all group members |
| Group Member | See member count correctly |
| Group Admin | Can manage members |

#### Test 6: Group Browser
| User Type | Expected Result |
|-----------|-----------------|
| Any | See all public groups |
| Any | See correct member counts |
| Any | Can request to join |

**Testing Procedure**:
1. Log in as each test user type
2. Navigate to each screen
3. Verify data displays correctly
4. Test actions (update, delete, etc.)
5. Document any issues

---

### Phase 6: Rollback Plan
**Goal**: Be able to quickly revert if issues occur

**Rollback Steps**:
1. Keep the backup file from Phase 1
2. If issues occur, create a rollback script from the backup
3. Apply rollback script in Supabase SQL Editor

**Rollback Script Template**:
```sql
-- Drop new policies
DO $$ 
DECLARE r RECORD;
BEGIN
    FOR r IN (SELECT schemaname, tablename, policyname FROM pg_policies WHERE schemaname = 'public')
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON %I.%I', r.policyname, r.schemaname, r.tablename);
    END LOOP;
END $$;

-- Recreate old policies from backup
-- (paste policies from backup file here)
```

---

## Execution Timeline

### Before Starting
- [ ] Read this entire document
- [ ] Understand all phases
- [ ] Have Supabase SQL Editor open
- [ ] Have app open for testing
- [ ] Have test users ready

### Phase 1: Backup (5 minutes)
- [ ] Run EXPORT_CURRENT_POLICIES.sql
- [ ] Save output
- [ ] Verify backup is complete

### Phase 2: Apply New Policies (2 minutes)
- [ ] Run CLEAN_RLS_REBUILD.sql
- [ ] Check for errors
- [ ] Verify policies created

### Phase 3: Test (15 minutes)
- [ ] Test as superadmin
- [ ] Test as group admin
- [ ] Test as regular player
- [ ] Test all screens
- [ ] Document results

### Phase 4: Decision Point
**If all tests pass**: ✅ Done! Policies are working correctly
**If tests fail**: ⚠️ Proceed to rollback

### Phase 5: Rollback (if needed)
- [ ] Run rollback script
- [ ] Verify old policies restored
- [ ] Document what went wrong
- [ ] Revise policy design

---

## Success Criteria

### Must Have (Critical)
- [ ] All players visible to all users
- [ ] Player names display in all screens
- [ ] Group member counts correct
- [ ] Stats tables show all players
- [ ] Matches show both player names

### Should Have (Important)
- [ ] No performance degradation
- [ ] No circular dependencies
- [ ] Clean, maintainable code
- [ ] Well-documented policies

### Nice to Have (Optional)
- [ ] Optimized query performance
- [ ] Comprehensive test coverage
- [ ] Monitoring/logging

---

## Post-Implementation

### Verification Queries
Run these after implementation to verify everything works:

```sql
-- Check policy count per table
SELECT tablename, COUNT(*) as policy_count
FROM pg_policies
WHERE schemaname = 'public'
GROUP BY tablename
ORDER BY tablename;

-- Expected counts:
-- players: 4 policies (SELECT, INSERT, UPDATE, DELETE)
-- player_stats: 4 policies
-- groups: 4 policies
-- group_members: 3 policies (SELECT, INSERT, DELETE)
-- pending_group_members: 4 policies
-- competitions: 4 policies
-- competition_participants: 3 policies (SELECT, INSERT, DELETE)
-- matches: 4 policies
-- chat_messages: 3 policies (SELECT, INSERT, DELETE)

-- Test helper functions
SELECT is_superadmin() as am_i_superadmin;
SELECT current_player_id() as my_player_id;

-- Test data visibility
SELECT COUNT(*) as visible_players FROM players;
SELECT COUNT(*) as visible_groups FROM groups;
SELECT COUNT(*) as visible_matches FROM matches;
```

### Monitoring
After deployment, monitor for:
1. Error rates in app
2. Query performance
3. User reports of missing data
4. RLS policy violations in logs

---

## Contact & Support
If you encounter issues:
1. Check the rollback plan
2. Review test results
3. Check Supabase logs
4. Document the issue clearly

---

## Appendix: Column Name Reference

### Correct Column Names
- `players.gamer_handle` ✅ (NOT "handle")
- `players.name` ✅
- `players.auth_user_id` ✅
- `groups.admin_id` ✅
- `group_members.player_id` ✅

### Common Mistakes
- ❌ `players.handle` - Does not exist
- ❌ `players.username` - Does not exist
- ❌ `groups.owner_id` - Does not exist (use admin_id)
