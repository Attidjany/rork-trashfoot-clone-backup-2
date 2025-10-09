# Stage and Match_Order Fix Instructions

## Problem
When creating knockout tournaments, the `stage` and `match_order` columns are not being populated in the matches table, even though the TypeScript code is setting these values.

## Solution Steps

### Step 1: Run the SQL Script
Run the following SQL script in your Supabase SQL Editor:

```sql
backend/FIX_STAGE_MATCH_ORDER_FINAL.sql
```

This will:
- Add the `stage` and `match_order` columns if they don't exist
- Test that manual inserts work correctly
- Show you the current state of your matches

### Step 2: Check the Test Results
After running the script, look for these messages in the output:
- ✅ "Test match has correct stage and match_order" - This means the columns work
- ❌ "Test match is missing stage or match_order!" - This means there's a database issue

### Step 3: Create a New Tournament
1. Go to your app
2. Create a new knockout tournament with at least 4 players
3. Check your server logs (where you run `bun run dev`)

### Step 4: Check the Logs
Look for these log messages:
```
🎯 GENERATED MATCHES COUNT: X
🔍 ABOUT TO INSERT MATCHES:
  Match 1: { stage: 'semi_final', match_order: 1, ... }
🔍 FULL MATCH OBJECTS TO INSERT: [full JSON]
✅ INSERTED MATCHES COUNT: X
✅ FIRST INSERTED MATCH:
  Stage: semi_final (or NULL if broken)
  Match Order: 1 (or undefined if broken)
```

### Step 5: Diagnose the Issue

#### If the logs show `stage` and `match_order` in the objects being inserted, but they're NULL after insert:
This means the Supabase client is filtering them out. Possible causes:
1. The columns don't actually exist in the database
2. There's a BEFORE INSERT trigger modifying the data
3. The Supabase client has cached schema that doesn't include these columns

**Solution**: 
- Restart your development server after running the SQL script
- Clear any Supabase client caches
- Verify columns exist by running: `SELECT column_name FROM information_schema.columns WHERE table_name = 'matches' AND column_name IN ('stage', 'match_order');`

#### If the logs don't show `stage` and `match_order` in the generated matches:
This means the `generateMatches` function isn't creating them properly.

**Solution**: Check that the tournament type is 'knockout' and the code path is being executed.

### Step 6: Manual Verification
Run this query in Supabase SQL Editor to check if new matches have stage/match_order:

```sql
SELECT 
  m.id,
  c.name as competition_name,
  c.tournament_type,
  m.stage,
  m.match_order,
  m.created_at
FROM matches m
JOIN competitions c ON m.competition_id = c.id
WHERE c.tournament_type = 'knockout'
ORDER BY m.created_at DESC
LIMIT 10;
```

## Expected Behavior
After the fix:
- New knockout tournaments should have matches with `stage` set to values like 'semi_final', 'quarter_final', 'final', etc.
- Each match should have a `match_order` starting from 1
- The tournament bracket page should display matches grouped by stage
- When all matches in a stage are completed, the next stage should be automatically created

## Troubleshooting

### Columns exist but values are still NULL
1. Check for triggers: `SELECT * FROM information_schema.triggers WHERE event_object_table = 'matches';`
2. Restart your dev server
3. Try inserting manually via SQL to confirm it works

### Randomization not working
The `shuffleArray` function should randomize participants. Check server logs for:
```
🎲 Shuffled participants for knockout: [array of IDs]
```
If the array is always in the same order, the shuffle function isn't working.

### Tournament bracket page is empty
This is likely because `stage` and `match_order` are NULL. The frontend filters matches by stage, so if stage is NULL, no matches will be displayed.

## Files Modified
- `backend/trpc/routes/competitions/management/route.ts` - Added extensive logging
- `backend/FIX_STAGE_MATCH_ORDER_FINAL.sql` - SQL script to fix columns
- `backend/DIAGNOSE_MATCH_INSERT.sql` - Diagnostic script

## Next Steps After Fix
Once `stage` and `match_order` are working:
1. Test creating a knockout tournament
2. Verify the bracket displays correctly
3. Complete all matches in the first stage
4. Verify the next stage is automatically created
5. Continue until a winner is determined
