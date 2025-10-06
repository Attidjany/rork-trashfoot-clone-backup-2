-- Comprehensive verification script for chat events
-- Run this after fixing the constraint

-- Step 1: Verify the constraint allows all event types
SELECT 
  conname as constraint_name,
  pg_get_constraintdef(oid) as constraint_definition
FROM pg_constraint
WHERE conname = 'chat_messages_type_check';

-- Step 2: Verify all triggers exist
SELECT 
  trigger_name,
  event_manipulation,
  event_object_table,
  action_timing,
  action_statement
FROM information_schema.triggers
WHERE trigger_name IN (
  'trigger_match_live_event',
  'trigger_match_score_event',
  'trigger_competition_created_event',
  'trigger_competition_finished_event'
)
ORDER BY trigger_name;

-- Step 3: Check if there are any existing event messages
SELECT 
  type,
  COUNT(*) as count
FROM chat_messages
WHERE type IN ('match_live', 'match_score', 'competition_created', 'competition_deadline', 'competition_finished')
GROUP BY type
ORDER BY type;

-- Step 4: Find a test match to update
SELECT 
  m.id as match_id,
  m.status,
  m.home_score,
  m.away_score,
  hp.name as home_player,
  ap.name as away_player,
  c.name as competition_name,
  g.name as group_name,
  g.id as group_id
FROM matches m
JOIN competitions c ON c.id = m.competition_id
JOIN groups g ON g.id = c.group_id
JOIN players hp ON hp.id = m.home_player_id
JOIN players ap ON ap.id = m.away_player_id
WHERE m.status IN ('scheduled', 'live')
ORDER BY m.created_at DESC
LIMIT 5;

-- Step 5: Instructions for manual testing
SELECT '
MANUAL TEST INSTRUCTIONS:
========================

1. Copy a match_id from Step 4 above
2. Run this to test match live event:
   UPDATE matches SET status = ''live'' WHERE id = ''PASTE_MATCH_ID_HERE'';

3. Check if a chat message was created:
   SELECT * FROM chat_messages WHERE type = ''match_live'' ORDER BY timestamp DESC LIMIT 1;

4. If you see a message, the trigger is working!

5. To test match score event:
   UPDATE matches SET status = ''completed'', home_score = 3, away_score = 1, completed_at = NOW() WHERE id = ''PASTE_MATCH_ID_HERE'';

6. Check for score message:
   SELECT * FROM chat_messages WHERE type = ''match_score'' ORDER BY timestamp DESC LIMIT 1;

7. To test competition created event, create a new competition through the app

8. To test competition finished event:
   UPDATE competitions SET status = ''completed'' WHERE id = ''PASTE_COMPETITION_ID_HERE'';

' as instructions;

-- Step 6: Check recent chat messages to see if any events came through
SELECT 
  cm.id,
  cm.type,
  cm.message,
  cm.sender_name,
  cm.timestamp,
  g.name as group_name
FROM chat_messages cm
JOIN groups g ON g.id = cm.group_id
ORDER BY cm.timestamp DESC
LIMIT 20;
