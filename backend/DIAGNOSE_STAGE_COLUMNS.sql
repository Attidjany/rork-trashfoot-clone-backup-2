-- ============================================
-- DIAGNOSE: Check stage and match_order columns
-- ============================================

-- 1. Check if columns exist
SELECT 
  'Column check:' as info,
  column_name, 
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns 
WHERE table_schema = 'public' 
  AND table_name = 'matches'
  AND column_name IN ('stage', 'match_order', 'competition_id', 'home_player_id', 'away_player_id', 'status', 'scheduled_time');

-- 2. Check for any triggers on matches table
SELECT 
  'Triggers on matches:' as info,
  trigger_name,
  event_manipulation,
  action_timing,
  action_statement
FROM information_schema.triggers
WHERE event_object_table = 'matches';

-- 3. Check for any constraints
SELECT
  'Constraints on matches:' as info,
  conname as constraint_name,
  contype as constraint_type,
  pg_get_constraintdef(oid) as definition
FROM pg_constraint
WHERE conrelid = 'matches'::regclass;

-- 4. Test insert with stage and match_order
-- First, get a valid competition_id and player_ids
DO $$
DECLARE
  test_comp_id UUID;
  test_player1_id UUID;
  test_player2_id UUID;
  test_match_id UUID;
BEGIN
  -- Get a tournament competition
  SELECT id INTO test_comp_id
  FROM competitions
  WHERE type = 'tournament'
  LIMIT 1;
  
  -- Get two players
  SELECT id INTO test_player1_id FROM players LIMIT 1;
  SELECT id INTO test_player2_id FROM players LIMIT 1 OFFSET 1;
  
  IF test_comp_id IS NOT NULL AND test_player1_id IS NOT NULL AND test_player2_id IS NOT NULL THEN
    -- Insert test match with stage and match_order
    INSERT INTO matches (
      competition_id,
      home_player_id,
      away_player_id,
      status,
      scheduled_time,
      stage,
      match_order
    ) VALUES (
      test_comp_id,
      test_player1_id,
      test_player2_id,
      'scheduled',
      NOW() + INTERVAL '7 days',
      'TEST_STAGE',
      999
    ) RETURNING id INTO test_match_id;
    
    RAISE NOTICE 'Test match inserted with ID: %', test_match_id;
    
    -- Check if stage and match_order were saved
    PERFORM 
      CASE 
        WHEN stage = 'TEST_STAGE' AND match_order = 999 THEN
          RAISE NOTICE 'SUCCESS: stage and match_order were saved correctly!'
        ELSE
          RAISE NOTICE 'FAILURE: stage=%, match_order=% (expected TEST_STAGE, 999)', stage, match_order
      END
    FROM matches
    WHERE id = test_match_id;
    
    -- Clean up test match
    DELETE FROM matches WHERE id = test_match_id;
    RAISE NOTICE 'Test match deleted';
  ELSE
    RAISE NOTICE 'Could not find test data (comp_id=%, player1=%, player2=%)', test_comp_id, test_player1_id, test_player2_id;
  END IF;
END $$;

-- 5. Show recent matches with their stage and match_order
SELECT 
  'Recent matches:' as info,
  m.id,
  c.name as competition,
  c.type,
  c.tournament_type,
  m.stage,
  m.match_order,
  m.status,
  m.created_at
FROM matches m
JOIN competitions c ON m.competition_id = c.id
ORDER BY m.created_at DESC
LIMIT 10;
