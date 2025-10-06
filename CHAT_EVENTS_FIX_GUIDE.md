# Chat Events Fix Guide

## Problem
The chat events (match live, match scores, competition events) are not showing up in the chat even though the SQL triggers were installed successfully.

## Root Cause
The `chat_messages` table has a CHECK constraint on the `type` column that only allows certain values. The original schema only allowed `'text'`, `'match_result'`, and `'youtube_link'`. The triggers are trying to insert new event types like `'match_live'`, `'match_score'`, `'competition_created'`, etc., but the constraint is blocking them.

## Solution

### Step 1: Fix the Constraint
Run this SQL file in your Supabase SQL Editor:
```
backend/fix-chat-message-types.sql
```

This will:
- Drop the old constraint
- Add a new constraint that allows all event types
- Verify the constraint was updated

### Step 2: Verify Everything is Working
Run this SQL file to verify:
```
backend/verify-chat-events-working.sql
```

This will show you:
- The current constraint definition
- All installed triggers
- Any existing event messages
- Test matches you can use for manual testing

### Step 3: Test the Events

#### Test Match Live Event
1. Find a match ID from the verification script
2. Run:
   ```sql
   UPDATE matches SET status = 'live' WHERE id = 'YOUR_MATCH_ID';
   ```
3. Check the chat in your app - you should see a "🔴 LIVE: Player1 vs Player2" message

#### Test Match Score Event
1. Use the same match or find another one
2. Run:
   ```sql
   UPDATE matches 
   SET status = 'completed', home_score = 3, away_score = 1, completed_at = NOW() 
   WHERE id = 'YOUR_MATCH_ID';
   ```
3. Check the chat - you should see a "🏆 Player1 3 - 1 Player2" message with winner highlighted

#### Test Competition Created Event
1. Create a new competition through your app
2. Check the chat - you should see a "🎮 New League created: Competition Name" message

#### Test Competition Finished Event
1. Find a competition ID
2. Run:
   ```sql
   UPDATE competitions SET status = 'completed' WHERE id = 'YOUR_COMPETITION_ID';
   ```
3. Check the chat - you should see a "🏁 League finished: Competition Name | Winner: Player Name 🏆" message

## Why This Happened
The `backend/add-chat-event-triggers.sql` file includes the constraint update (lines 5-7), but it seems the constraint update didn't take effect properly in your database. This can happen if:
1. The SQL was run in the wrong order
2. There was an error that was missed
3. The transaction was rolled back

## Prevention
In the future, when adding new message types:
1. Always update the CHECK constraint first
2. Then add the triggers
3. Verify with test data immediately

## Expected Behavior After Fix
Once the constraint is fixed, the triggers will automatically:
- Post a message when a match goes live
- Post a message with the score when a match is completed
- Post a message when a competition is created
- Post a message when a competition is finished
- Highlight winners in green/blue in the chat UI

The chat UI already has all the rendering logic for these event types (see `app/(tabs)/chat.tsx` lines 61-212), so once the messages start coming through, they'll display beautifully!
