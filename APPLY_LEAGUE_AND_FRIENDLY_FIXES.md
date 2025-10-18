# League Completion and Friendly Sorting Fixes

## Issues Fixed

1. **League competitions** - Winner calculation and completion status now working properly for leagues (not just knockouts)
2. **Friendly matches** - Now sorted by creation date (newest first) instead of scheduled time
3. **Competition completion messages** - Shows correct winner with points and goal difference for leagues

## What Was Done

### Backend Changes
- Added `created_at` column to matches table for proper sorting
- Created trigger to check league completion when all matches finish
- Winner calculation based on: points (3 for win, 1 for draw) → goal difference → goals scored
- Podium message shows top 3 with points and goal difference

### Frontend Changes
- Updated friendly matches sorting to use newest first (by scheduledTime descending)

## How to Apply

Run this SQL file in your Supabase SQL Editor:

```sql
-- File: /backend/FIX_LEAGUE_COMPLETION_AND_FRIENDLIES.sql
```

This will:
1. Add `created_at` column to matches (if not exists)
2. Create league completion trigger
3. Calculate winners based on league standings

## How It Works

### League Completion
- When a match is completed, trigger checks if all matches in that league are done
- Calculates standings:
  - **Points**: 3 for win, 1 for draw, 0 for loss
  - **Goal Difference**: Goals scored - goals conceded
  - **Goals Scored**: Total goals
- Winner is determined by: highest points → best goal difference → most goals scored
- Sends chat message with podium (top 3) showing points and goal difference

### Friendly Matches
- Sorted by creation date (newest matches first)
- Still prioritizes: scheduled → live → completed by status
- Within same status, newest appear first

## Testing

1. Create a league competition with multiple players
2. Complete all matches
3. Verify competition status changes to "completed"
4. Check chat shows correct winner with points and goal difference
5. Create friendly matches - newest should appear first

## Notes

- Knockout tournaments continue to work as before (not affected)
- Existing matches will have `created_at` estimated from `scheduled_time - 7 days`
- New matches will have accurate `created_at` timestamps
