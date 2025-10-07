# Quick Start: RLS Policy Rebuild

## TL;DR
Your app's RLS policies are preventing users from seeing other players' data. This causes:
- Blank player names in matches
- Empty stats tables
- Group member counts showing 0

## The Fix (3 Steps)

### Step 1: Backup (2 minutes)
```sql
-- In Supabase SQL Editor, run:
-- File: backend/EXPORT_CURRENT_POLICIES.sql

SELECT schemaname, tablename, policyname, cmd, qual
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY tablename, policyname;
```
**Save the output** to a text file as backup.

### Step 2: Apply New Policies (2 minutes)
```sql
-- In Supabase SQL Editor, run:
-- File: backend/CLEAN_RLS_REBUILD.sql
```
This will:
1. Drop all old policies
2. Create new helper functions
3. Create new, correct policies
4. Run verification

### Step 3: Test (5 minutes)
Open your app and check:
- [ ] Home tab shows all player names
- [ ] Stats tab shows all players
- [ ] Matches tab shows both player names
- [ ] Group details shows correct member count
- [ ] Group browser shows correct member counts

## If Something Goes Wrong

### Rollback
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

-- Then paste your backup policies here
```

## What Changed?

### Before (Wrong)
```sql
-- Players could only see themselves
CREATE POLICY "players_viewable_by_all" ON players
FOR SELECT USING (auth.uid() = auth_user_id);  -- ❌ Too restrictive
```

### After (Correct)
```sql
-- Everyone can see all players (needed for matches, stats, etc.)
CREATE POLICY "players_select_all" ON players
FOR SELECT USING (true);  -- ✅ Correct
```

## Key Changes

1. **Players Table**: Everyone can now see all players
2. **Player Stats**: Everyone can see all stats
3. **Group Members**: Visible to group members and for public groups
4. **No Circular Dependencies**: Clean, simple helper functions
5. **Correct Column Names**: Using `gamer_handle` not `handle`

## Verification

After applying, run:
```sql
-- Should see all players
SELECT COUNT(*) FROM players;

-- Should see all stats
SELECT COUNT(*) FROM player_stats;

-- Should see group members
SELECT COUNT(*) FROM group_members;
```

## Need More Details?
See `backend/RLS_REBUILD_PLAN.md` for comprehensive documentation.
