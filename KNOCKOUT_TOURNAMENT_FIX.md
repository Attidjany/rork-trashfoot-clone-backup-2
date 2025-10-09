# Knockout Tournament Stage Progression Fix

## Problem
Knockout tournaments were not automatically creating matches for the next stage when all matches in the current stage were completed. The bracket view was also not properly displaying newly created stages.

## Solution

### 1. Database Trigger (`/backend/FIX_KNOCKOUT_STAGE_PROGRESSION.sql`)

**Run this SQL file in your Supabase SQL editor**

The trigger automatically:
- Detects when all matches in a stage are completed
- Determines the next stage (round_of_16 → quarter_final → semi_final → final)
- Extracts winners from completed matches (ordered by match_order)
- Creates new matches for the next stage with proper player assignments
- Creates a 3rd place match after semi-finals
- Uses RAISE NOTICE for debugging (check Supabase logs)

**Key Features:**
- Only processes knockout tournaments
- Maintains match_order for proper bracket progression
- Respects competition end_date for scheduling
- Handles edge cases (draws default to home player winning)

### 2. Tournament Bracket View Update (`/app/tournament-bracket.tsx`)

**Changes made:**
- Refactored bracket data structure to be stage-based instead of participant-based
- Groups matches by their `stage` field
- Sorts matches within each stage by `match_order`
- Dynamically builds bracket rounds based on actual stages present
- Properly displays stage names (Round of 16, Quarter-Final, Semi-Final, Final, 3rd Place)
- Shows newly created matches in real-time via Supabase realtime

**How it works:**
1. Fetches all tournament matches
2. Groups them by stage field
3. Builds bracket structure dynamically
4. Displays each stage as a separate round
5. Updates automatically when new stages are created

### 3. Matches Tab (`/app/(tabs)/matches.tsx`)

**Already supports:**
- Displaying all tournament matches
- Entering scores for matches
- Real-time updates via `useRealtimeGroups` hook

## Testing Instructions

1. **Run the SQL file:**
   ```sql
   -- In Supabase SQL Editor
   -- Copy and paste contents of /backend/FIX_KNOCKOUT_STAGE_PROGRESSION.sql
   -- Execute
   ```

2. **Create a test tournament:**
   - Go to Matches tab
   - Create a new knockout tournament with 4 players
   - This will create 2 semi-final matches

3. **Complete first stage:**
   - Enter scores for both semi-final matches
   - Mark them as completed

4. **Verify automatic progression:**
   - Check that 2 new matches are created:
     - 1 final match (winners of semi-finals)
     - 1 third place match (losers of semi-finals)
   - View the tournament bracket to see the new stage
   - Check Supabase logs for RAISE NOTICE messages

5. **Complete tournament:**
   - Enter scores for final and 3rd place matches
   - Verify tournament is complete

## Database Schema Requirements

The following columns must exist (already confirmed):
- `matches.stage` (TEXT) - stores stage name
- `matches.match_order` (INTEGER) - stores match position within stage
- `competitions.created_by` (UUID) - references player who created competition
- `competitions.end_date` (TIMESTAMPTZ) - deadline for matches

## Realtime Updates

The system uses Supabase realtime subscriptions to automatically update the UI when:
- New matches are created by the trigger
- Match scores are updated
- Match status changes

The `useRealtimeGroups` hook handles all realtime subscriptions.

## Stage Names

The system supports these stages:
- `round_of_16` - Round of 16
- `quarter_final` - Quarter-Final
- `semi_final` - Semi-Final
- `final` - Final
- `third_place` - 3rd Place Match

## Debugging

If stages are not progressing:

1. **Check Supabase logs** for RAISE NOTICE messages:
   - "Stage: X, Total: Y, Completed: Z"
   - "Next stage: X"
   - "Winners: [array]"
   - "Creating X match pairs for next stage"

2. **Verify trigger exists:**
   ```sql
   SELECT * FROM pg_trigger WHERE tgname = 'trigger_progress_tournament_stage';
   ```

3. **Check match data:**
   ```sql
   SELECT id, stage, match_order, status, home_score, away_score
   FROM matches
   WHERE competition_id = 'YOUR_COMPETITION_ID'
   ORDER BY stage, match_order;
   ```

4. **Manually test trigger:**
   ```sql
   -- Update a match to completed
   UPDATE matches
   SET status = 'completed', home_score = 2, away_score = 1
   WHERE id = 'YOUR_MATCH_ID';
   ```

## Notes

- The trigger uses `SECURITY DEFINER` to ensure it has permissions to create matches
- Draw handling: Currently defaults to home player winning (you may want to implement rematch logic)
- The bracket view updates automatically via realtime subscriptions
- All stage progression is handled server-side for data integrity
