-- DIAGNOSE WHY STAGE AND MATCH_ORDER ARE NOT BEING INSERTED
-- Run this to check the current state

-- ============================================
-- STEP 1: Verify columns exist and their types
-- ============================================
SELECT 
  '📋 MATCHES TABLE SCHEMA' as info,
  column_name, 
  data_type, 
  is_nullable,
  column_default
FROM information_schema.columns 
WHERE table_schema = 'public' 
  AND table_name = 'matches'
  AND column_name IN ('stage', 'match_order', 'competition_id', 'home_player_id', 'away_player_id', 'status', 'scheduled_time')
ORDER BY ordinal_position;

-- ============================================
-- STEP 2: Check if there are any triggers on matches table
-- ============================================
SELECT 
  '🔧 TRIGGERS ON MATCHES TABLE' as info,
  trigger_name,
  event_manipulation,
  action_statement,
  action_timing
FROM information_schema.triggers
WHERE event_object_table = 'matches'
  AND event_object_schema = 'public';

-- ============================================
-- STEP 3: Check recent matches to see if stage/match_order are NULL
-- ============================================
SELECT 
  '🔍 RECENT MATCHES (Last 20)' as info,
  m.id,
  c.name as competition_name,
  c.type as comp_type,
  c.tournament_type,
  m.stage,
  m.match_order,
  m.status,
  m.created_at
FROM matches m
JOIN competitions c ON m.competition_id = c.id
ORDER BY m.created_at DESC
LIMIT 20;

-- ============================================
-- STEP 4: Test manual insert with stage and match_order
-- ============================================
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
  WHERE type = 'tournament' AND tournament_type = 'knockout'
  ORDER BY created_at DESC
  LIMIT 1;
  
  IF test_comp_id IS NULL THEN
    RAISE NOTICE '⚠️  No knockout tournament found to test with';
    RETURN;
  END IF;
  
  -- Get two players from that competition
  SELECT player_id INTO test_player1_id
  FROM competition_participants
  WHERE competition_id = test_comp_id
  LIMIT 1;
  
  SELECT player_id INTO test_player2_id
  FROM competition_participants
  WHERE competition_id = test_comp_id
  AND player_id != test_player1_id
  LIMIT 1;
  
  IF test_player1_id IS NULL OR test_player2_id IS NULL THEN
    RAISE NOTICE '⚠️  Not enough players in competition to test';
    RETURN;
  END IF;
  
  -- Try to insert a test match with stage and match_order
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
  )
  RETURNING id INTO test_match_id;
  
  RAISE NOTICE '✅ Test match inserted with ID: %', test_match_id;
  
  -- Verify the insert
  PERFORM 1 FROM matches
  WHERE id = test_match_id
    AND stage = 'TEST_STAGE'
    AND match_order = 999;
  
  IF FOUND THEN
    RAISE NOTICE '✅ Test match has correct stage and match_order';
  ELSE
    RAISE NOTICE '❌ Test match is missing stage or match_order!';
  END IF;
  
  -- Clean up test match
  DELETE FROM matches WHERE id = test_match_id;
  RAISE NOTICE '🧹 Test match cleaned up';
  
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE '❌ Error during test: %', SQLERRM;
END $$;

-- ============================================
-- STEP 5: Check if there are any default values or constraints
-- ============================================
SELECT 
  '⚙️  CONSTRAINTS ON MATCHES TABLE' as info,
  conname as constraint_name,
  contype as constraint_type,
  pg_get_constraintdef(oid) as definition
FROM pg_constraint
WHERE conrelid = 'public.matches'::regclass;
