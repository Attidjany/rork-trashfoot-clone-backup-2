-- Test script for chat events
-- This script helps you manually test if chat events are working

-- IMPORTANT: Replace the placeholder IDs below with actual IDs from your database

-- Step 1: Find your group ID and some matches
SELECT 
  g.id as group_id,
  g.name as group_name,
  m.id as match_id,
  m.status as match_status,
  hp.name as home_player,
  ap.name as away_player,
  c.name as competition_name
FROM groups g
JOIN competitions c ON c.group_id = g.id
JOIN matches m ON m.competition_id = c.id
JOIN players hp ON hp.id = m.home_player_id
JOIN players ap ON ap.id = m.away_player_id
WHERE m.status IN ('scheduled', 'live')
LIMIT 5;

-- Step 2: Test match live event
-- Replace 'YOUR_MATCH_ID' with an actual match ID from Step 1
-- Uncomment the line below to test:
-- UPDATE matches SET status = 'live' WHERE id = 'YOUR_MATCH_ID';

-- Step 3: Test match score event
-- Replace 'YOUR_MATCH_ID' with an actual match ID from Step 1
-- Uncomment the lines below to test:
-- UPDATE matches 
-- SET status = 'completed', home_score = 3, away_score = 1, completed_at = NOW()
-- WHERE id = 'YOUR_MATCH_ID';

-- Step 4: Test competition created event
-- Replace 'YOUR_GROUP_ID' with an actual group ID from Step 1
-- Uncomment the lines below to test:
-- INSERT INTO competitions (group_id, name, type, status, start_date)
-- VALUES ('YOUR_GROUP_ID', 'Test Competition', 'league', 'active', NOW());

-- Step 5: Test competition finished event
-- First, find a competition to finish
SELECT 
  c.id as competition_id,
  c.name as competition_name,
  c.status,
  c.group_id,
  COUNT(m.id) as total_matches,
  COUNT(CASE WHEN m.status = 'completed' THEN 1 END) as completed_matches
FROM competitions c
LEFT JOIN matches m ON m.competition_id = c.id
WHERE c.status = 'active'
GROUP BY c.id, c.name, c.status, c.group_id
LIMIT 5;

-- Replace 'YOUR_COMPETITION_ID' with an actual competition ID from above
-- Uncomment the line below to test:
-- UPDATE competitions SET status = 'completed' WHERE id = 'YOUR_COMPETITION_ID';

-- Step 6: Check if chat messages were created
SELECT 
  cm.id,
  cm.type,
  cm.message,
  cm.sender_name,
  cm.metadata,
  cm.timestamp,
  g.name as group_name
FROM chat_messages cm
JOIN groups g ON g.id = cm.group_id
WHERE cm.type IN ('match_live', 'match_score', 'competition_created', 'competition_finished')
ORDER BY cm.timestamp DESC
LIMIT 20;

-- Step 7: Test deadline reminders
-- This will post reminders for any competitions with approaching deadlines
-- Uncomment the line below to test:
-- SELECT post_competition_deadline_reminders();

-- Step 8: Verify triggers are installed
SELECT 
  trigger_name,
  event_manipulation,
  event_object_table,
  action_timing
FROM information_schema.triggers
WHERE trigger_name IN (
  'trigger_match_live_event',
  'trigger_match_score_event',
  'trigger_competition_created_event',
  'trigger_competition_finished_event'
)
ORDER BY trigger_name;

-- Step 9: Check for any errors in trigger functions
-- If triggers are not working, check the Supabase logs for errors
SELECT 'If you see this message, the script ran successfully!' as status;
SELECT 'Now uncomment the test queries above and replace the placeholder IDs' as next_step;
SELECT 'Then run this script again to test the events' as final_step;
