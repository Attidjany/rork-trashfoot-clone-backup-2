# RLS Policy Rebuild - Complete Guide

## 📋 Overview

This directory contains a complete, methodical solution to rebuild your app's Row Level Security (RLS) policies from scratch.

## 🚨 The Problem

Your app has serious RLS policy issues:
1. **Players can only see their own data** (except admins)
2. **Group member counts show as 0**
3. **Player names don't display in matches/stats**
4. **Queries reference wrong column names** (`handle` instead of `gamer_handle`)
5. **Circular dependencies causing infinite recursion**

## ✅ The Solution

A complete rebuild of all RLS policies based on actual app requirements, with:
- Clean, non-circular helper functions
- Explicit, well-documented policies
- Comprehensive testing plan
- Safe rollback procedure

## 📁 Files in This Directory

### 1. Quick Start (Start Here!)
**File**: `QUICK_START_RLS_REBUILD.md`
- 3-step process to fix the issue
- Takes ~10 minutes total
- Includes rollback instructions

### 2. Comprehensive Plan
**File**: `RLS_REBUILD_PLAN.md`
- Complete methodology
- Phase-by-phase approach
- Success criteria
- Post-implementation monitoring

### 3. SQL Scripts

#### `EXPORT_CURRENT_POLICIES.sql`
- Backs up all current policies
- Exports helper functions
- **Run this FIRST before making any changes**

#### `CLEAN_RLS_REBUILD.sql`
- Drops all existing policies
- Creates new helper functions
- Creates new policies for all tables
- Includes verification queries
- **This is the main fix**

### 4. Testing
**File**: `TESTING_CHECKLIST.md`
- Comprehensive test cases
- Step-by-step testing procedure
- Performance testing
- Sign-off checklist

## 🚀 Quick Start (10 Minutes)

### Step 1: Backup (2 min)
```bash
1. Open Supabase SQL Editor
2. Run: backend/EXPORT_CURRENT_POLICIES.sql
3. Save the output to a text file
```

### Step 2: Apply Fix (2 min)
```bash
1. In Supabase SQL Editor
2. Run: backend/CLEAN_RLS_REBUILD.sql
3. Check for errors (should be none)
```

### Step 3: Test (5 min)
```bash
1. Open your app
2. Check Home tab - see all player names? ✅
3. Check Stats tab - see all players? ✅
4. Check Matches tab - see both player names? ✅
5. Check Group Details - see member count > 0? ✅
```

### Step 4: Celebrate! 🎉
If all tests pass, you're done! The issue is fixed.

## 🔄 If Something Goes Wrong

### Rollback Procedure
```sql
-- 1. Drop new policies
DO $$ 
DECLARE r RECORD;
BEGIN
    FOR r IN (SELECT schemaname, tablename, policyname FROM pg_policies WHERE schemaname = 'public')
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON %I.%I', r.policyname, r.schemaname, r.tablename);
    END LOOP;
END $$;

-- 2. Paste your backup policies here (from Step 1)
```

## 📊 What Gets Fixed

### Before → After

#### Players Table
```sql
-- BEFORE (Wrong)
CREATE POLICY "players_viewable_by_all" ON players
FOR SELECT USING (auth.uid() = auth_user_id);  -- ❌ Too restrictive

-- AFTER (Correct)
CREATE POLICY "players_select_all" ON players
FOR SELECT USING (true);  -- ✅ Everyone can see all players
```

#### Group Members Table
```sql
-- BEFORE (Wrong)
CREATE POLICY "group_members_viewable" ON group_members
FOR SELECT USING (
  group_id IN (SELECT group_id FROM group_members WHERE player_id = current_player_id())
);  -- ❌ Circular dependency

-- AFTER (Correct)
CREATE POLICY "group_members_select_member_or_public" ON group_members
FOR SELECT USING (
  is_group_member(group_id)
  OR EXISTS (SELECT 1 FROM groups WHERE id = group_id AND is_public = true)
  OR is_superadmin()
);  -- ✅ Clean, no circular dependencies
```

## 🎯 Key Improvements

### 1. Correct Access Patterns
- **Players**: Everyone can see all players (needed for matches, stats, leaderboards)
- **Stats**: Everyone can see all stats (needed for comparisons)
- **Groups**: Public groups visible to all, private to members only
- **Matches**: Visible to group members

### 2. Clean Helper Functions
```sql
is_superadmin()           -- No dependencies
current_player_id()       -- No dependencies
is_group_admin(group_id)  -- Simple, no circular calls
is_group_member(group_id) -- Simple, no circular calls
```

### 3. Performance Optimized
- All helper functions use `SECURITY DEFINER`
- All helper functions marked as `STABLE`
- Efficient query patterns
- No N+1 queries

### 4. Well Documented
- Every policy has a clear purpose
- Comments explain the logic
- Easy to understand and maintain

## 📈 Expected Results

### Immediate Fixes
- ✅ All player names visible everywhere
- ✅ Group member counts correct
- ✅ Stats tables show all players
- ✅ Matches show both player names
- ✅ No more blank data

### Performance
- ✅ No performance degradation
- ✅ Queries remain fast (< 200ms)
- ✅ No circular dependency issues

### Maintainability
- ✅ Clean, readable policies
- ✅ Easy to modify
- ✅ Well documented
- ✅ No technical debt

## 🧪 Testing

### Automated Verification
```sql
-- Run these after applying the fix

-- 1. Check policy counts
SELECT tablename, COUNT(*) as policy_count
FROM pg_policies
WHERE schemaname = 'public'
GROUP BY tablename
ORDER BY tablename;

-- 2. Test helper functions
SELECT is_superadmin() as am_i_superadmin;
SELECT current_player_id() as my_player_id;

-- 3. Test data visibility
SELECT COUNT(*) as visible_players FROM players;
SELECT COUNT(*) as visible_groups FROM groups;
SELECT COUNT(*) as visible_matches FROM matches;
```

### Manual Testing
See `TESTING_CHECKLIST.md` for comprehensive test cases.

## 📞 Support

### If You Need Help
1. Check the rollback procedure above
2. Review `RLS_REBUILD_PLAN.md` for details
3. Check `TESTING_CHECKLIST.md` for specific test cases
4. Review Supabase logs for errors

### Common Issues

#### Issue: "Still seeing blank player names"
**Solution**: Verify policies were applied
```sql
SELECT policyname FROM pg_policies 
WHERE tablename = 'players' AND cmd = 'SELECT';
-- Should see: players_select_all
```

#### Issue: "Group member count still 0"
**Solution**: Check group_members policies
```sql
SELECT policyname FROM pg_policies 
WHERE tablename = 'group_members' AND cmd = 'SELECT';
-- Should see: group_members_select_member_or_public
```

#### Issue: "Performance is slow"
**Solution**: Check query plans
```sql
EXPLAIN ANALYZE SELECT * FROM players;
-- Should be < 100ms
```

## 🎓 Understanding the Fix

### Why This Approach?

1. **Methodical**: Step-by-step with verification at each stage
2. **Safe**: Backup first, rollback plan ready
3. **Tested**: Comprehensive test cases
4. **Documented**: Clear explanations throughout
5. **Permanent**: Fixes root causes, not symptoms

### What Makes It Different?

Previous attempts were quick fixes that:
- ❌ Didn't address root causes
- ❌ Created circular dependencies
- ❌ Used wrong column names
- ❌ Weren't tested thoroughly

This approach:
- ✅ Rebuilds from scratch based on requirements
- ✅ Eliminates circular dependencies
- ✅ Uses correct column names
- ✅ Includes comprehensive testing

## 📝 Checklist

### Before Starting
- [ ] Read `QUICK_START_RLS_REBUILD.md`
- [ ] Have Supabase SQL Editor open
- [ ] Have app open for testing
- [ ] Ready to spend 10 minutes

### During Implementation
- [ ] Run `EXPORT_CURRENT_POLICIES.sql`
- [ ] Save backup output
- [ ] Run `CLEAN_RLS_REBUILD.sql`
- [ ] Check for errors
- [ ] Run verification queries

### After Implementation
- [ ] Test Home tab
- [ ] Test Stats tab
- [ ] Test Matches tab
- [ ] Test Group Details
- [ ] Test Group Browser
- [ ] All tests pass? ✅

### If Issues Occur
- [ ] Run rollback script
- [ ] Restore from backup
- [ ] Document what went wrong
- [ ] Review plan and try again

## 🎉 Success!

Once all tests pass, you'll have:
- ✅ Clean, maintainable RLS policies
- ✅ All data visible to appropriate users
- ✅ No circular dependencies
- ✅ Correct column references
- ✅ Well-documented system
- ✅ Happy users!

---

**Ready to start?** → Open `QUICK_START_RLS_REBUILD.md`

**Need more details?** → Open `RLS_REBUILD_PLAN.md`

**Ready to test?** → Open `TESTING_CHECKLIST.md`
