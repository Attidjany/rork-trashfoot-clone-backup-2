-- ============================================
-- FINAL FIX FOR STAGE AND MATCH_ORDER COLUMNS
-- This script will:
-- 1. Add the columns if they don't exist
-- 2. Test that inserts work correctly
-- 3. Verify the fix
-- ============================================

-- STEP 1: Add columns if they don't exist
DO $$ 
BEGIN
  -- Add stage column
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
      AND table_name = 'matches' 
      AND column_name = 'stage'
  ) THEN
    ALTER TABLE public.matches ADD COLUMN stage TEXT;
    RAISE NOTICE '✅ Added stage column to matches table';
  ELSE
    RAISE NOTICE 'ℹ️  stage column already exists';
  END IF;
  
  -- Add match_order column
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
      AND table_name = 'matches' 
      AND column_name = 'match_order'
  ) THEN
    ALTER TABLE public.matches ADD COLUMN match_order INTEGER;
    RAISE NOTICE '✅ Added match_order column to matches table';
  ELSE
    RAISE NOTICE 'ℹ️  match_order column already exists';
  END IF;
END $$;

-- STEP 2: Verify columns exist
SELECT 
  column_name, 
  data_type, 
  is_nullable
FROM information_schema.columns 
WHERE table_schema = 'public' 
  AND table_name = 'matches'
  AND column_name IN ('stage', 'match_order')
ORDER BY column_name;

-- STEP 3: Check for any triggers that might interfere
SELECT 
  trigger_name,
  event_manipulation,
  action_timing,
  action_statement
FROM information_schema.triggers
WHERE event_object_table = 'matches'
  AND event_object_schema = 'public'
  AND trigger_name NOT LIKE '%updated_at%';

-- STEP 4: Test insert with stage and match_order
-- This will help us verify that the columns work
DO $$
DECLARE
  test_comp_id UUID;
  test_player1_id UUID;
  test_player2_id UUID;
  test_match_id UUID;
  test_stage TEXT;
  test_order INTEGER;
BEGIN
  -- Get a tournament competition
  SELECT id INTO test_comp_id
  FROM competitions
  WHERE type = 'tournament'
  ORDER BY created_at DESC
  LIMIT 1;
  
  IF test_comp_id IS NULL THEN
    RAISE NOTICE '⚠️  No tournament found. Creating test will be skipped.';
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
    RAISE NOTICE '⚠️  Not enough players in competition. Test will be skipped.';
    RETURN;
  END IF;
  
  -- Insert test match
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
  RETURNING id, stage, match_order INTO test_match_id, test_stage, test_order;
  
  RAISE NOTICE '✅ Test match inserted with ID: %', test_match_id;
  RAISE NOTICE '   Stage: %, Match Order: %', test_stage, test_order;
  
  -- Verify the values were saved
  IF test_stage = 'TEST_STAGE' AND test_order = 999 THEN
    RAISE NOTICE '✅ SUCCESS: stage and match_order are working correctly!';
  ELSE
    RAISE NOTICE '❌ FAILURE: stage or match_order were not saved correctly';
    RAISE NOTICE '   Expected: stage=TEST_STAGE, match_order=999';
    RAISE NOTICE '   Got: stage=%, match_order=%', test_stage, test_order;
  END IF;
  
  -- Clean up
  DELETE FROM matches WHERE id = test_match_id;
  RAISE NOTICE '🧹 Test match cleaned up';
  
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE '❌ Error during test: %', SQLERRM;
END $$;

-- STEP 5: Show current state of recent matches
SELECT 
  m.id,
  c.name as competition_name,
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

-- ============================================
-- INSTRUCTIONS:
-- ============================================
-- After running this script:
-- 1. Check the output to ensure columns exist
-- 2. Verify the test insert succeeded
-- 3. Try creating a new knockout tournament from the app
-- 4. Check the server logs to see what's being inserted
-- 5. If stage/match_order are still NULL, the issue is in the
--    Supabase client library or there's a type mismatch
-- ============================================
