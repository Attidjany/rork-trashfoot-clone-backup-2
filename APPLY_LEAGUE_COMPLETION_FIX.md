# Apply League Completion Fix

This fix ensures leagues are completed correctly in TWO situations:

## ✅ What This Fixes

### Situation 1: All Matches Completed
When all league matches have been played and scores entered:
- Competition automatically marks as "completed"
- Winner is calculated based on:
  1. Points (3 for win, 1 for draw, 0 for loss)
  2. Goal difference (tiebreaker)
  3. Goals scored (second tiebreaker)
- Podium message shows top 3 players with their stats

### Situation 2: Deadline Reached
When the competition deadline arrives:
- All pending/scheduled matches are automatically deleted
- Competition marks as "completed"
- Winner is calculated from completed matches (if any)
- Chat message announces:
  - Deadline reached
  - Number of matches deleted
  - Winner with podium (if matches were played)
  - OR "No winner" message (if no matches were completed)

## 🚀 How to Apply

Run this SQL script in your Supabase SQL Editor:

```sql
-- Copy and paste the entire content of:
/backend/FIX_LEAGUE_COMPLETION_LOGIC.sql
```

## 📋 What Gets Updated

1. **League Completion Trigger** (`trigger_check_league_completion`)
   - Triggers when a match is completed
   - Checks if all matches are done
   - Calculates winner and sends podium message

2. **Deadline Cleanup Function** (`check_and_complete_expired_competitions`)
   - Triggers on any match operation
   - Checks if deadline has passed
   - Deletes pending matches
   - Calculates winner from completed matches
   - Sends appropriate completion message

3. **Manual Cleanup Function** (`cleanup_all_expired_competitions`)
   - Can be run manually to clean up all expired competitions
   - Useful for batch processing or scheduled tasks

## ✅ After Applying

Test both scenarios:

### Test Scenario 1: Normal Completion
1. Create a league with 3+ players
2. Complete all matches
3. Check that:
   - Competition shows as "completed"
   - Chat shows podium with winner, runner-up, third place
   - Stats include points and goal difference

### Test Scenario 2: Deadline Expiration
1. Create a league with deadline in the past (or wait for deadline)
2. Complete some matches, leave others pending
3. Trigger the cleanup:
   - Insert/update any match to trigger the check
   - OR run: `SELECT * FROM cleanup_all_expired_competitions();`
4. Check that:
   - Pending matches are deleted
   - Competition shows as "completed"
   - Chat shows deadline message + winner based on completed matches
   - OR "No winner" if no matches were completed

## 🔧 Manual Cleanup Command

If you need to manually trigger cleanup of expired competitions:

```sql
SELECT * FROM cleanup_all_expired_competitions();
```

This will return a table showing:
- `competition_id`: UUID of the competition
- `competition_name`: Name of the competition
- `competition_type`: 'league' or 'tournament'
- `deleted_matches_count`: Number of matches removed
- `winner_name`: Name of the winner (NULL if no matches completed)

## ⚠️ Important Notes

- Friendly matches are NOT affected by this system
- Only leagues with `end_date` set will auto-expire
- Winner calculation is consistent in both scenarios
- Chat messages clearly indicate whether completion was normal or due to deadline
- The fix preserves all existing tournament logic (knockout tournaments are unaffected)
