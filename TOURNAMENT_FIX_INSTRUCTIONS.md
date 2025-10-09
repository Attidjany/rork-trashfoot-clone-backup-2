# Tournament and Chat Message Fix

## Issues Fixed

1. **Chat messages showing 0 participants and 0 matches** - The trigger now fires AFTER competition status is updated to 'active', ensuring participants and matches are already inserted
2. **Tournament stage progression not working** - Added trigger to automatically create next stage matches when current stage is completed
3. **Missing metadata in chat messages** - Added participant names, creator name, and proper match count to competition creation messages

## What Was Changed

### 1. Database Schema (`backend/FIX_TOURNAMENT_AND_CHAT.sql`)
- Added `created_by` column to `competitions` table
- Added `stage` and `match_order` columns to `matches` table for tournament progression
- Created `notify_competition_created()` function that sends a chat message with full details
- Created trigger that fires when competition status changes from 'upcoming' to 'active'
- Created `progress_tournament_stage()` function that automatically creates next stage matches
- Created trigger that fires when a match is completed to progress tournament stages

### 2. Backend Route (`backend/trpc/routes/competitions/management/route.ts`)
- Added `created_by` field when creating competitions
- Added better error handling and logging
- Ensured matches are created with `stage` and `match_order` for tournaments

### 3. Frontend Types (`types/game.ts`)
- Added `participantCount`, `participantNames`, `creatorName`, and `deadline` to ChatMessage metadata

### 4. Chat UI (`app/(tabs)/chat.tsx`)
- Updated competition_created message display to show:
  - Creator name
  - Participant count
  - Participant names (in a styled list)
  - Match count
  - Deadline date

## How to Apply the Fix

### Step 1: Run the SQL Script
Run the SQL script in your Supabase SQL Editor:
```sql
-- Copy and paste the contents of backend/FIX_TOURNAMENT_AND_CHAT.sql
```

This will:
- Add missing columns
- Create the triggers for chat messages and tournament progression
- Enable realtime for matches table

### Step 2: Restart Your Development Server
The TypeScript changes are already applied, so just restart your dev server to pick up the changes.

## How It Works Now

### Competition Creation Flow
1. User creates a competition
2. Backend creates competition record with status='upcoming'
3. Backend adds participants to `competition_participants` table
4. Backend generates and inserts matches
5. Backend updates competition status to 'active'
6. **Trigger fires** and creates a chat message with:
   - Competition name and type
   - Creator name
   - Full list of participant names
   - Actual match count
   - Deadline date

### Tournament Stage Progression
1. When a match in a tournament is completed:
2. **Trigger checks** if all matches in that stage are completed
3. If yes, it:
   - Determines the next stage (round_of_16 → quarter_final → semi_final → final)
   - Gets the winners from current stage (ordered by match_order)
   - Creates matches for the next stage
   - If semi-finals just completed, also creates 3rd place match
4. Process repeats until final is completed

### Example Tournament Flow (4 players)
1. **Initial**: Creates 2 semi-final matches (stage='semi_final', match_order=1,2)
2. **After both semi-finals complete**: Trigger creates:
   - 1 final match (winners from semi-finals)
   - 1 third place match (losers from semi-finals)
3. **After final completes**: Tournament is complete

### Example Tournament Flow (8 players)
1. **Initial**: Creates 4 quarter-final matches
2. **After all quarter-finals**: Creates 2 semi-final matches
3. **After both semi-finals**: Creates final + 3rd place match
4. **After final**: Tournament complete

## Testing Checklist

- [ ] Create a new tournament competition with 4 players
- [ ] Verify chat message shows correct participant count and names
- [ ] Verify chat message shows correct match count (should be 2 for semi-finals)
- [ ] Complete both semi-final matches
- [ ] Verify that final and 3rd place matches are automatically created
- [ ] Complete final match
- [ ] Verify tournament is complete

- [ ] Create a new league competition
- [ ] Verify chat message shows all details correctly

- [ ] Create a new friendly competition
- [ ] Verify chat message shows all details correctly

## Troubleshooting

### If chat message still shows 0 matches:
- Check that the trigger is firing: `SELECT * FROM pg_trigger WHERE tgname = 'trigger_notify_competition_created';`
- Check trigger logs in Supabase dashboard
- Verify competition status is being updated to 'active'

### If tournament stages aren't progressing:
- Check that the trigger exists: `SELECT * FROM pg_trigger WHERE tgname = 'trigger_progress_tournament_stage';`
- Verify matches have `stage` and `match_order` columns populated
- Check that all matches in current stage are marked as 'completed'

### If you see syntax errors:
- Make sure you're running the SQL in Supabase SQL Editor, not in a terminal
- Copy the entire file contents at once
- Don't try to run it line by line
