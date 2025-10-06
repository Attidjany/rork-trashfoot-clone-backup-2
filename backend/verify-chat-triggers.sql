-- Verify chat event triggers are installed and working

-- 1. Check if triggers exist
SELECT 
  trigger_name,
  event_manipulation,
  event_object_table,
  action_statement
FROM information_schema.triggers
WHERE trigger_name IN (
  'trigger_match_live_event',
  'trigger_match_score_event',
  'trigger_competition_created_event',
  'trigger_competition_finished_event'
)
ORDER BY trigger_name;

-- 2. Check if functions exist
SELECT 
  routine_name,
  routine_type
FROM information_schema.routines
WHERE routine_name IN (
  'post_match_live_event',
  'post_match_score_event',
  'post_competition_created_event',
  'post_competition_finished_event',
  'post_competition_deadline_reminders'
)
ORDER BY routine_name;

-- 3. Check chat_messages type constraint
SELECT 
  constraint_name,
  check_clause
FROM information_schema.check_constraints
WHERE constraint_name = 'chat_messages_type_check';

-- 4. Test: Manually trigger a match score event (replace with actual IDs from your database)
-- First, let's see what matches exist
SELECT 
  m.id,
  m.status,
  m.home_score,
  m.away_score,
  hp.name as home_player,
  ap.name as away_player,
  c.name as competition,
  c.group_id
FROM matches m
JOIN players hp ON hp.id = m.home_player_id
JOIN players ap ON ap.id = m.away_player_id
JOIN competitions c ON c.id = m.competition_id
WHERE m.status = 'scheduled'
LIMIT 5;

-- 5. Check recent chat messages to see if any events were posted
SELECT 
  id,
  type,
  message,
  sender_name,
  metadata,
  timestamp
FROM chat_messages
WHERE type IN ('match_live', 'match_score', 'competition_created', 'competition_finished')
ORDER BY timestamp DESC
LIMIT 10;
