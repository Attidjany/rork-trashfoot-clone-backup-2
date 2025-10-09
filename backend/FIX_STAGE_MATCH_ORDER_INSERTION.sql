-- ============================================
-- FIX STAGE AND MATCH_ORDER NOT BEING POPULATED
-- ============================================

-- Step 1: Verify columns exist
SELECT 
  '✅ CHECKING COLUMNS' as status,
  column_name, 
  data_type, 
  is_nullable
FROM information_schema.columns 
WHERE table_schema = 'public' 
  AND table_name = 'matches'
  AND column_name IN ('stage', 'match_order')
ORDER BY column_name;

-- Step 2: Check recent knockout competitions and their matches
SELECT 
  '📊 RECENT KNOCKOUT COMPETITIONS' as status,
  c.id as competition_id,
  c.name,
  c.tournament_type,
  c.created_at,
  COUNT(m.id) as total_matches,
  COUNT(CASE WHEN m.stage IS NOT NULL THEN 1 END) as matches_with_stage,
  COUNT(CASE WHEN m.match_order IS NOT NULL THEN 1 END) as matches_with_order
FROM competitions c
LEFT JOIN matches m ON c.id = m.competition_id
WHERE c.type = 'tournament' 
  AND c.tournament_type = 'knockout'
GROUP BY c.id, c.name, c.tournament_type, c.created_at
ORDER BY c.created_at DESC
LIMIT 10;

-- Step 3: Show sample matches from knockout tournaments
SELECT 
  '🔍 SAMPLE KNOCKOUT MATCHES' as status,
  m.id,
  c.name as competition_name,
  m.stage,
  m.match_order,
  m.status,
  m.created_at
FROM matches m
JOIN competitions c ON m.competition_id = c.id
WHERE c.tournament_type = 'knockout'
ORDER BY m.created_at DESC
LIMIT 20;

-- Step 4: Check if there are any RLS policies blocking inserts
SELECT 
  '🔒 MATCHES INSERT POLICIES' as status,
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual,
  with_check
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename = 'matches'
  AND cmd = 'INSERT'
ORDER BY policyname;

-- Step 5: Test insert with stage and match_order (will rollback)
DO $$
DECLARE
  test_competition_id UUID;
  test_player1_id UUID;
  test_player2_id UUID;
  test_match_id UUID;
BEGIN
  -- Get a test competition
  SELECT id INTO test_competition_id
  FROM competitions
  WHERE type = 'tournament' AND tournament_type = 'knockout'
  ORDER BY created_at DESC
  LIMIT 1;
  
  -- Get two test players
  SELECT id INTO test_player1_id FROM players LIMIT 1;
  SELECT id INTO test_player2_id FROM players LIMIT 1 OFFSET 1;
  
  IF test_competition_id IS NOT NULL AND test_player1_id IS NOT NULL AND test_player2_id IS NOT NULL THEN
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
      test_competition_id,
      test_player1_id,
      test_player2_id,
      'scheduled',
      NOW() + INTERVAL '7 days',
      'semi_final',
      1
    ) RETURNING id INTO test_match_id;
    
    -- Check if it was inserted correctly
    IF test_match_id IS NOT NULL THEN
      RAISE NOTICE '✅ TEST INSERT SUCCESSFUL - stage and match_order can be inserted';
      
      -- Verify the values
      DECLARE
        inserted_stage TEXT;
        inserted_order INTEGER;
      BEGIN
        SELECT stage, match_order INTO inserted_stage, inserted_order
        FROM matches
        WHERE id = test_match_id;
        
        RAISE NOTICE '   Stage: %, Match Order: %', inserted_stage, inserted_order;
      END;
      
      -- Rollback the test insert
      RAISE EXCEPTION 'Rolling back test insert';
    END IF;
  ELSE
    RAISE NOTICE '⚠️  Could not find test data for insert test';
  END IF;
  
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE '❌ TEST INSERT FAILED: %', SQLERRM;
END $$;

-- Step 6: Show the structure of matches table
SELECT 
  '📋 MATCHES TABLE STRUCTURE' as status,
  column_name,
  data_type,
  character_maximum_length,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'matches'
ORDER BY ordinal_position;
