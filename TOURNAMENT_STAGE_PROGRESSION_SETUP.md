# Tournament Stage Progression Setup Guide

## Overview
This guide explains the tournament stage progression system that automatically creates next-stage matches when a tournament stage is completed.

## Changes Made

### 1. Match Delete Policy Fix
**File:** `backend/fix-match-delete-policy.sql`

- Updated RLS policy to only allow group admins and superadmins to delete matches
- Removed ability for regular players to delete matches
- Added superadmin check in the policy

**To Apply:**
```sql
-- Run this in your Supabase SQL Editor
-- File: backend/fix-match-delete-policy.sql
```

### 2. Tournament Stage Progression System
**File:** `backend/add-tournament-stage-progression.sql`

This adds automatic stage progression for knockout tournaments:

**Features:**
- Adds `stage` and `match_order` columns to matches table
- Automatically creates next stage matches when current stage completes
- Supports all tournament stages: round_of_16 → quarter_final → semi_final → final
- Creates 3rd place match automatically when moving to finals
- Sends chat notifications when new stage matches are created
- Migrates existing tournament matches to have stage information

**Stages:**
- `round_of_16` - For 16 participants
- `quarter_final` - For 8 participants (or winners from round_of_16)
- `semi_final` - For 4 participants (or winners from quarter_final)
- `final` - Championship match (2 participants)
- `third_place` - 3rd place playoff (losers from semi_final)

**To Apply:**
```sql
-- Run this in your Supabase SQL Editor
-- File: backend/add-tournament-stage-progression.sql
```

### 3. Backend Code Updates

#### Match Delete Route
**File:** `backend/trpc/routes/matches/delete/route.ts`

- Added superadmin role check
- Now checks if user is either superadmin OR group admin
- Better error messages

#### Competition Management Route
**File:** `backend/trpc/routes/competitions/management/route.ts`

- Added `getInitialStage()` function to determine starting stage based on participant count
- Updated `generateMatches()` to include `stage` and `match_order` for tournament matches
- Ensures proper stage tracking from competition creation

## How It Works

### Tournament Creation
1. When a knockout tournament is created, matches are generated with:
   - `stage`: Determined by participant count (e.g., 8 players = quarter_final)
   - `match_order`: Sequential order within the stage (1, 2, 3, etc.)

### Stage Progression
1. When a match is completed (status changes to 'completed'):
   - Trigger checks if all matches in current stage are completed
   - If stage is complete, determines winners from each match
   - Creates matches for next stage pairing winners
   - If moving to finals, also creates 3rd place match from semi-final losers
   - Sends chat notification about new stage

### Example Flow (8 participants)
```
Quarter Finals (4 matches)
├─ Match 1: Player A vs Player B → Winner: A
├─ Match 2: Player C vs Player D → Winner: C
├─ Match 3: Player E vs Player F → Winner: E
└─ Match 4: Player G vs Player H → Winner: G

↓ All quarter finals completed ↓

Semi Finals (2 matches) - AUTO CREATED
├─ Match 1: A vs C → Winner: A
└─ Match 2: E vs G → Winner: E

↓ All semi finals completed ↓

Finals (2 matches) - AUTO CREATED
├─ Final: A vs E
└─ 3rd Place: C vs G (losers from semi-finals)
```

## Testing

### Test Match Deletion
1. Login as group admin
2. Navigate to group details → matches
3. Try to delete a scheduled match → Should work
4. Login as regular player
5. Try to delete a match → Should fail with permission error
6. Login as superadmin
7. Try to delete any match → Should work

### Test Tournament Progression
1. Create a knockout tournament with 8 participants
2. Verify 4 quarter-final matches are created with `stage='quarter_final'`
3. Complete all 4 quarter-final matches by submitting scores
4. Verify 2 semi-final matches are automatically created
5. Complete both semi-final matches
6. Verify final match AND 3rd place match are automatically created
7. Check chat for stage progression notifications

## Database Schema Changes

### New Columns in `matches` table:
```sql
stage TEXT           -- Tournament stage (round_of_16, quarter_final, semi_final, final, third_place)
match_order INTEGER  -- Order within the stage (1, 2, 3, etc.)
```

### New Functions:
- `get_next_stage(current_stage, total_participants)` - Determines next stage
- `get_initial_stage(participant_count)` - Determines starting stage
- `create_next_stage_matches()` - Trigger function for stage progression

### New Trigger:
- `trigger_create_next_stage_matches` - Fires after match update to create next stage

## Troubleshooting

### Matches not progressing to next stage
1. Check if all matches in current stage are completed
2. Verify matches have `stage` and `match_order` set
3. Check Supabase logs for trigger errors
4. Ensure no draws in knockout matches (draws create rematches)

### Delete not working
1. Verify user is group admin or superadmin
2. Check if match status is 'completed' (completed matches can't be deleted)
3. Check Supabase logs for RLS policy errors

### Chat notifications not appearing
1. Verify `created_by` field is set on competition
2. Check if chat_messages table has proper RLS policies
3. Ensure realtime is enabled for chat_messages table

## Migration Notes

- Existing tournament matches will be automatically migrated with stage information
- The migration runs once when you apply the SQL file
- Matches are assigned stages based on their count and creation order
- No data loss occurs during migration

## Future Enhancements

Possible improvements:
- Support for group stage tournaments
- Seeding system for participants
- Bracket visualization
- Manual bracket editing by admins
- Best-of-3 or best-of-5 series support
