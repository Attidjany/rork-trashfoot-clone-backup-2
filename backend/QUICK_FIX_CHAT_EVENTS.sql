-- ============================================
-- QUICK FIX FOR CHAT EVENTS
-- Run this entire file in Supabase SQL Editor
-- ============================================

-- 1. Fix the constraint to allow all event types
ALTER TABLE chat_messages DROP CONSTRAINT IF EXISTS chat_messages_type_check;

ALTER TABLE chat_messages ADD CONSTRAINT chat_messages_type_check 
  CHECK (type IN (
    'text', 
    'match_result', 
    'youtube_link', 
    'match_live', 
    'match_score', 
    'competition_created', 
    'competition_deadline', 
    'competition_finished'
  ));

-- 2. Verify constraint was updated
DO $$
DECLARE
  constraint_def TEXT;
BEGIN
  SELECT pg_get_constraintdef(oid) INTO constraint_def
  FROM pg_constraint
  WHERE conname = 'chat_messages_type_check';
  
  IF constraint_def LIKE '%match_live%' THEN
    RAISE NOTICE '✅ Constraint updated successfully!';
  ELSE
    RAISE WARNING '❌ Constraint may not have updated properly';
  END IF;
END $$;

-- 3. Verify triggers exist
DO $$
DECLARE
  trigger_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO trigger_count
  FROM information_schema.triggers
  WHERE trigger_name IN (
    'trigger_match_live_event',
    'trigger_match_score_event',
    'trigger_competition_created_event',
    'trigger_competition_finished_event'
  );
  
  IF trigger_count = 4 THEN
    RAISE NOTICE '✅ All 4 triggers are installed!';
  ELSE
    RAISE WARNING '❌ Only % triggers found. Expected 4.', trigger_count;
  END IF;
END $$;

-- 4. Show summary
SELECT 
  '✅ Chat events fix applied successfully!' as status,
  'Now test by updating a match status or creating a competition' as next_step;

-- 5. Show available test data
SELECT 
  'Available matches for testing:' as info,
  m.id as match_id,
  m.status,
  hp.name || ' vs ' || ap.name as matchup,
  c.name as competition
FROM matches m
JOIN competitions c ON c.id = m.competition_id
JOIN players hp ON hp.id = m.home_player_id
JOIN players ap ON ap.id = m.away_player_id
WHERE m.status IN ('scheduled', 'live')
ORDER BY m.created_at DESC
LIMIT 5;
