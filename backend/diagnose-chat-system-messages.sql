-- COMPREHENSIVE DIAGNOSTIC AND FIX FOR CHAT SYSTEM MESSAGES
-- Run this to diagnose why system messages aren't appearing

-- ============================================
-- STEP 1: Check if triggers exist and are enabled
-- ============================================
SELECT 
  '=== CHECKING TRIGGERS ===' as info;

SELECT 
  trigger_name,
  event_object_table,
  action_statement,
  action_timing,
  event_manipulation
FROM information_schema.triggers
WHERE event_object_table IN ('matches', 'competitions')
  AND trigger_name LIKE '%event%'
ORDER BY event_object_table, trigger_name;

-- ============================================
-- STEP 2: Check RLS policies on chat_messages
-- ============================================
SELECT 
  '=== CHECKING RLS POLICIES ===' as info;

SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual,
  with_check
FROM pg_policies
WHERE tablename = 'chat_messages'
ORDER BY policyname;

-- ============================================
-- STEP 3: Check if realtime is enabled
-- ============================================
SELECT 
  '=== CHECKING REALTIME ===' as info;

SELECT 
  schemaname,
  tablename
FROM pg_publication_tables
WHERE pubname = 'supabase_realtime'
  AND tablename = 'chat_messages';

-- ============================================
-- STEP 4: Test trigger functions directly
-- ============================================
SELECT 
  '=== TESTING TRIGGER FUNCTIONS ===' as info;

-- Test if we can call the functions
DO $$
DECLARE
  test_group_id UUID;
  test_player_id UUID;
  test_comp_id UUID;
  test_match_id UUID;
  msg_count_before INTEGER;
  msg_count_after INTEGER;
BEGIN
  -- Get a test group and player
  SELECT g.id, p.id INTO test_group_id, test_player_id
  FROM groups g
  JOIN group_members gm ON gm.group_id = g.id
  JOIN players p ON p.id = gm.player_id
  LIMIT 1;
  
  IF test_group_id IS NULL THEN
    RAISE NOTICE '⚠️ No groups found for testing';
    RETURN;
  END IF;
  
  RAISE NOTICE '🧪 Testing with group: % and player: %', test_group_id, test_player_id;
  
  -- Count messages before
  SELECT COUNT(*) INTO msg_count_before FROM chat_messages WHERE group_id = test_group_id;
  RAISE NOTICE '📊 Messages before test: %', msg_count_before;
  
  -- Test 1: Try to insert a system message directly
  BEGIN
    INSERT INTO chat_messages (
      group_id,
      sender_id,
      sender_name,
      message,
      type,
      metadata,
      timestamp
    ) VALUES (
      test_group_id,
      test_player_id,
      'System',
      '🧪 TEST: Direct system message insert',
      'competition_created',
      jsonb_build_object('test', true),
      NOW()
    );
    RAISE NOTICE '✅ Test 1 PASSED: Direct system message insert succeeded';
  EXCEPTION
    WHEN OTHERS THEN
      RAISE WARNING '❌ Test 1 FAILED: % (SQLSTATE: %)', SQLERRM, SQLSTATE;
  END;
  
  -- Test 2: Create a test competition (should trigger event)
  BEGIN
    INSERT INTO competitions (
      group_id,
      name,
      type,
      status,
      start_date
    ) VALUES (
      test_group_id,
      '🧪 TEST Competition ' || NOW()::TEXT,
      'league',
      'active',
      NOW()
    ) RETURNING id INTO test_comp_id;
    
    RAISE NOTICE '✅ Test 2 PASSED: Competition created with ID %', test_comp_id;
  EXCEPTION
    WHEN OTHERS THEN
      RAISE WARNING '❌ Test 2 FAILED: % (SQLSTATE: %)', SQLERRM, SQLSTATE;
  END;
  
  -- Wait a moment for trigger to execute
  PERFORM pg_sleep(0.5);
  
  -- Test 3: Create a test match and mark it live
  IF test_comp_id IS NOT NULL THEN
    DECLARE
      player1_id UUID;
      player2_id UUID;
    BEGIN
      SELECT p.id INTO player1_id
      FROM players p
      JOIN group_members gm ON gm.player_id = p.id
      WHERE gm.group_id = test_group_id
      LIMIT 1;
      
      SELECT p.id INTO player2_id
      FROM players p
      JOIN group_members gm ON gm.player_id = p.id
      WHERE gm.group_id = test_group_id
        AND p.id != player1_id
      LIMIT 1 OFFSET 1;
      
      IF player1_id IS NOT NULL AND player2_id IS NOT NULL THEN
        INSERT INTO matches (
          competition_id,
          home_player_id,
          away_player_id,
          status,
          scheduled_time
        ) VALUES (
          test_comp_id,
          player1_id,
          player2_id,
          'live',
          NOW()
        ) RETURNING id INTO test_match_id;
        
        RAISE NOTICE '✅ Test 3 PASSED: Match created and set to live with ID %', test_match_id;
        
        -- Wait for trigger
        PERFORM pg_sleep(0.5);
        
        -- Test 4: Complete the match
        UPDATE matches
        SET status = 'completed',
            home_score = 3,
            away_score = 1,
            completed_at = NOW()
        WHERE id = test_match_id;
        
        RAISE NOTICE '✅ Test 4 PASSED: Match completed with score';
      ELSE
        RAISE NOTICE '⚠️ Not enough players for match test';
      END IF;
    EXCEPTION
      WHEN OTHERS THEN
        RAISE WARNING '❌ Test 3/4 FAILED: % (SQLSTATE: %)', SQLERRM, SQLSTATE;
    END;
  END IF;
  
  -- Wait for all triggers to complete
  PERFORM pg_sleep(1);
  
  -- Count messages after
  SELECT COUNT(*) INTO msg_count_after FROM chat_messages WHERE group_id = test_group_id;
  RAISE NOTICE '📊 Messages after test: %', msg_count_after;
  RAISE NOTICE '📊 New messages created: %', msg_count_after - msg_count_before;
  
  -- Show the test messages
  RAISE NOTICE '=== TEST MESSAGES ===';
  FOR rec IN 
    SELECT id, message, type, sender_name, timestamp
    FROM chat_messages
    WHERE group_id = test_group_id
      AND (message LIKE '%TEST%' OR timestamp > NOW() - INTERVAL '2 minutes')
    ORDER BY timestamp DESC
    LIMIT 10
  LOOP
    RAISE NOTICE '  [%] % - % (ID: %)', rec.type, rec.message, rec.timestamp, rec.id;
  END LOOP;
  
  -- Cleanup test data
  IF test_match_id IS NOT NULL THEN
    DELETE FROM matches WHERE id = test_match_id;
    RAISE NOTICE '🧹 Cleaned up test match';
  END IF;
  
  IF test_comp_id IS NOT NULL THEN
    DELETE FROM competitions WHERE id = test_comp_id;
    RAISE NOTICE '🧹 Cleaned up test competition';
  END IF;
  
  DELETE FROM chat_messages WHERE message LIKE '%TEST%';
  RAISE NOTICE '🧹 Cleaned up test messages';
  
  RAISE NOTICE '=== DIAGNOSTIC COMPLETE ===';
  IF msg_count_after > msg_count_before THEN
    RAISE NOTICE '✅ System messages ARE being created by triggers!';
    RAISE NOTICE '💡 If you don''t see them in the app, check:';
    RAISE NOTICE '   1. Realtime subscription is working';
    RAISE NOTICE '   2. RLS policies allow reading system messages';
    RAISE NOTICE '   3. Frontend is correctly filtering/displaying messages';
  ELSE
    RAISE NOTICE '❌ System messages are NOT being created by triggers!';
    RAISE NOTICE '💡 Check:';
    RAISE NOTICE '   1. Triggers are properly installed';
    RAISE NOTICE '   2. Trigger functions have SECURITY DEFINER';
    RAISE NOTICE '   3. RLS policies allow system message inserts';
  END IF;
END $$;

-- ============================================
-- STEP 5: Show recent system messages
-- ============================================
SELECT 
  '=== RECENT SYSTEM MESSAGES ===' as info;

SELECT 
  cm.id,
  cm.message,
  cm.type,
  cm.sender_name,
  cm.timestamp,
  g.name as group_name
FROM chat_messages cm
JOIN groups g ON g.id = cm.group_id
WHERE cm.sender_name = 'System'
  AND cm.timestamp > NOW() - INTERVAL '24 hours'
ORDER BY cm.timestamp DESC
LIMIT 20;

-- ============================================
-- STEP 6: Check for any errors in trigger execution
-- ============================================
SELECT 
  '=== CHECKING FOR TRIGGER ERRORS ===' as info;

-- Show any recent competitions without corresponding chat messages
SELECT 
  c.id,
  c.name,
  c.type,
  c.created_at,
  g.name as group_name,
  (SELECT COUNT(*) FROM chat_messages 
   WHERE group_id = c.group_id 
     AND type = 'competition_created' 
     AND metadata->>'competitionId' = c.id::text) as message_count
FROM competitions c
JOIN groups g ON g.id = c.group_id
WHERE c.created_at > NOW() - INTERVAL '24 hours'
ORDER BY c.created_at DESC
LIMIT 10;

-- Show any recent completed matches without corresponding chat messages
SELECT 
  m.id,
  m.home_score,
  m.away_score,
  m.status,
  m.completed_at,
  c.name as competition_name,
  (SELECT COUNT(*) FROM chat_messages 
   WHERE group_id = c.group_id 
     AND type = 'match_score' 
     AND metadata->>'matchId' = m.id::text) as message_count
FROM matches m
JOIN competitions c ON c.id = m.competition_id
WHERE m.status = 'completed'
  AND m.completed_at > NOW() - INTERVAL '24 hours'
ORDER BY m.completed_at DESC
LIMIT 10;
