# Chat Events Not Working - Fix Guide

## Problem
Chat events (match going live, match scores, competition events) are not being posted to the chat automatically.

## Root Cause
The database triggers that automatically post chat events may not be installed or may have errors. The triggers need to be properly set up in Supabase to automatically create chat messages when:
- A match status changes to 'live'
- A match is completed with scores
- A competition is created
- A competition is finished

## Solution

### Step 1: Run the Fix Script
Execute the following SQL script in your Supabase SQL Editor:

```
backend/fix-chat-triggers.sql
```

This script will:
1. Drop any existing triggers and functions
2. Update the chat_messages type constraint to include all event types
3. Recreate all trigger functions with proper error handling
4. Install the triggers on the matches and competitions tables
5. Grant necessary permissions
6. Verify the installation

### Step 2: Verify Installation
After running the fix script, run the verification script:

```
backend/verify-chat-triggers.sql
```

This will show you:
- All installed triggers
- All trigger functions
- The chat_messages type constraint
- Recent chat events (if any)

### Step 3: Test the Events

#### Test Match Live Event
1. Go to a match in your app
2. Change its status to 'live' (by sharing a YouTube link)
3. Check the chat - you should see a "🔴 LIVE: Player1 vs Player2" message

#### Test Match Score Event
1. Complete a match by entering scores
2. Check the chat - you should see a "🏆 Player1 X - Y Player2" message with winner highlighted

#### Test Competition Created Event
1. Create a new competition
2. Check the chat - you should see a "🎮 New League/Tournament created: CompName" message

#### Test Competition Finished Event
1. Mark a competition as completed (or complete all its matches)
2. Check the chat - you should see a "🏁 League/Tournament finished: CompName | Winner: PlayerName 🏆" message

## How It Works

### Database Triggers
The system uses PostgreSQL triggers that automatically fire when certain database events occur:

1. **Match Live Trigger**: Fires when a match status changes to 'live'
2. **Match Score Trigger**: Fires when a match status changes to 'completed' with scores
3. **Competition Created Trigger**: Fires when a new competition is inserted
4. **Competition Finished Trigger**: Fires when a competition status changes to 'completed'

### Event Flow
```
Database Change → Trigger Fires → Function Executes → Chat Message Inserted → Realtime Update → UI Updates
```

### Security
All trigger functions use `SECURITY DEFINER` to ensure they can insert chat messages even when called by the database system (not a specific user).

## Troubleshooting

### Events Still Not Working
1. Check Supabase logs for any errors
2. Verify RLS policies allow inserting chat messages
3. Check that the chat realtime subscription is active
4. Verify the group_id is correctly set in competitions

### Missing Event Types
If you see errors about invalid message types, ensure the chat_messages table constraint includes all event types:
- 'text'
- 'match_result'
- 'youtube_link'
- 'match_live'
- 'match_score'
- 'competition_created'
- 'competition_deadline'
- 'competition_finished'

### Realtime Not Updating
1. Check browser console for realtime subscription status
2. Verify Supabase Realtime is enabled for the chat_messages table
3. Check that the active group ID matches the group_id in messages

## Manual Testing in SQL Editor

You can manually test the triggers by updating records:

```sql
-- Test match live event
UPDATE matches 
SET status = 'live' 
WHERE id = 'your-match-id';

-- Test match score event
UPDATE matches 
SET status = 'completed', home_score = 3, away_score = 1, completed_at = NOW()
WHERE id = 'your-match-id';

-- Test competition created (insert a new one)
INSERT INTO competitions (group_id, name, type, status, start_date)
VALUES ('your-group-id', 'Test Competition', 'league', 'active', NOW());

-- Test competition finished
UPDATE competitions
SET status = 'completed'
WHERE id = 'your-competition-id';

-- Check if messages were created
SELECT * FROM chat_messages 
WHERE type IN ('match_live', 'match_score', 'competition_created', 'competition_finished')
ORDER BY timestamp DESC
LIMIT 10;
```

## Additional Features

### Deadline Reminders
The system includes a function to post deadline reminders for competitions. This needs to be called manually or via a cron job:

```sql
SELECT post_competition_deadline_reminders();
```

This will post reminders for competitions that have 3, 2, or 1 day(s) left before their deadline.

## Notes
- All event messages are posted by 'System' as the sender
- Events include rich metadata for rendering in the UI
- The chat UI already supports rendering all event types with proper styling
- Events are posted in real-time and will appear immediately in the chat
