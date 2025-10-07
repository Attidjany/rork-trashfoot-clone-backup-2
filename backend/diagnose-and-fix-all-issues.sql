-- COMPREHENSIVE DIAGNOSTIC AND FIX FOR CHAT EVENTS AND SUPERADMIN
-- Run this to diagnose and fix both issues

-- ============================================
-- STEP 1: Check if triggers exist
-- ============================================
SELECT '=== CHECKING TRIGGERS ===' as info;

SELECT 
  trigger_name,
  event_object_table,
  action_timing,
  event_manipulation,
  action_statement
FROM information_schema.triggers
WHERE event_object_table IN ('matches', 'competitions')
  AND trigger_name LIKE '%event%'
ORDER BY event_object_table, trigger_name;

-- ============================================
-- STEP 2: Check RLS policies on chat_messages
-- ============================================
SELECT '=== CHECKING CHAT RLS POLICIES ===' as info;

SELECT 
  policyname,
  cmd,
  qual,
  with_check
FROM pg_policies
WHERE tablename = 'chat_messages'
ORDER BY policyname;

-- ============================================
-- STEP 3: Check if realtime is enabled
-- ============================================
SELECT '=== CHECKING REALTIME ===' as info;

SELECT 
  schemaname,
  tablename
FROM pg_publication_tables
WHERE pubname = 'supabase_realtime'
  AND tablename = 'chat_messages';

-- ============================================
-- STEP 4: Test trigger execution manually
-- ============================================
SELECT '=== TESTING TRIGGER EXECUTION ===' as info;

DO $$
DECLARE
  test_group_id UUID;
  test_player1_id UUID;
  test_player2_id UUID;
  test_comp_id UUID;
  test_match_id UUID;
  msg_count_before INTEGER;
  msg_count_after INTEGER;
BEGIN
  -- Get a test group and players
  SELECT g.id INTO test_group_id
  FROM groups g
  LIMIT 1;
  
  IF test_group_id IS NULL THEN
    RAISE NOTICE '⚠️ No groups found for testing';
    RETURN;
  END IF;
  
  SELECT p.id INTO test_player1_id
  FROM players p
  JOIN group_members gm ON gm.player_id = p.id
  WHERE gm.group_id = test_group_id
  LIMIT 1;
  
  SELECT p.id INTO test_player2_id
  FROM players p
  JOIN group_members gm ON gm.player_id = p.id
  WHERE gm.group_id = test_group_id
    AND p.id != test_player1_id
  LIMIT 1 OFFSET 1;
  
  IF test_player1_id IS NULL OR test_player2_id IS NULL THEN
    RAISE NOTICE '⚠️ Not enough players in group for testing';
    RETURN;
  END IF;
  
  RAISE NOTICE '🧪 Testing with group: %, player1: %, player2: %', test_group_id, test_player1_id, test_player2_id;
  
  -- Count messages before
  SELECT COUNT(*) INTO msg_count_before FROM chat_messages WHERE group_id = test_group_id;
  RAISE NOTICE '📊 Messages before test: %', msg_count_before;
  
  -- Test 1: Create a competition (should trigger event)
  BEGIN
    INSERT INTO competitions (
      group_id,
      name,
      type,
      status,
      deadline_days
    ) VALUES (
      test_group_id,
      '🧪 TEST Competition ' || NOW()::TEXT,
      'league',
      'active',
      7
    ) RETURNING id INTO test_comp_id;
    
    RAISE NOTICE '✅ Test 1: Competition created with ID %', test_comp_id;
  EXCEPTION
    WHEN OTHERS THEN
      RAISE WARNING '❌ Test 1 FAILED: % (SQLSTATE: %)', SQLERRM, SQLSTATE;
  END;
  
  -- Wait for trigger
  PERFORM pg_sleep(0.5);
  
  -- Test 2: Create a match and set it live (should trigger event)
  IF test_comp_id IS NOT NULL THEN
    BEGIN
      INSERT INTO matches (
        competition_id,
        home_player_id,
        away_player_id,
        status,
        scheduled_time
      ) VALUES (
        test_comp_id,
        test_player1_id,
        test_player2_id,
        'live',
        NOW()
      ) RETURNING id INTO test_match_id;
      
      RAISE NOTICE '✅ Test 2: Match created and set to live with ID %', test_match_id;
    EXCEPTION
      WHEN OTHERS THEN
        RAISE WARNING '❌ Test 2 FAILED: % (SQLSTATE: %)', SQLERRM, SQLSTATE;
    END;
    
    -- Wait for trigger
    PERFORM pg_sleep(0.5);
    
    -- Test 3: Complete the match (should trigger score event)
    IF test_match_id IS NOT NULL THEN
      BEGIN
        UPDATE matches
        SET status = 'completed',
            home_score = 3,
            away_score = 1,
            completed_at = NOW()
        WHERE id = test_match_id;
        
        RAISE NOTICE '✅ Test 3: Match completed with score';
      EXCEPTION
        WHEN OTHERS THEN
          RAISE WARNING '❌ Test 3 FAILED: % (SQLSTATE: %)', SQLERRM, SQLSTATE;
      END;
    END IF;
  END IF;
  
  -- Wait for all triggers
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
      AND timestamp > NOW() - INTERVAL '2 minutes'
    ORDER BY timestamp DESC
    LIMIT 10
  LOOP
    RAISE NOTICE '  [%] % - %', rec.type, rec.message, rec.timestamp;
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
  
  -- Final diagnosis
  IF msg_count_after > msg_count_before THEN
    RAISE NOTICE '✅ CHAT EVENTS ARE WORKING!';
    RAISE NOTICE '💡 If you don''t see them in the app:';
    RAISE NOTICE '   1. Check console for realtime subscription status';
    RAISE NOTICE '   2. Verify you''re in the correct group';
    RAISE NOTICE '   3. Check RLS policies allow reading system messages';
  ELSE
    RAISE NOTICE '❌ CHAT EVENTS ARE NOT WORKING!';
    RAISE NOTICE '💡 Triggers are not creating messages. Check:';
    RAISE NOTICE '   1. Triggers are installed (see above)';
    RAISE NOTICE '   2. Trigger functions have SECURITY DEFINER';
    RAISE NOTICE '   3. RLS policies allow system message inserts';
  END IF;
END $$;

-- ============================================
-- STEP 5: Check competitions data
-- ============================================
SELECT '=== CHECKING COMPETITIONS DATA ===' as info;

SELECT 
  id,
  name,
  type,
  status,
  group_id,
  created_at
FROM competitions
ORDER BY created_at DESC
LIMIT 10;

SELECT 
  '=== TOTAL COMPETITIONS ===' as info,
  COUNT(*) as total_competitions
FROM competitions;

-- ============================================
-- STEP 6: Check if superadmin can read competitions
-- ============================================
SELECT '=== CHECKING COMPETITION RLS POLICIES ===' as info;

SELECT 
  policyname,
  cmd,
  qual,
  with_check
FROM pg_policies
WHERE tablename = 'competitions'
ORDER BY policyname;

-- ============================================
-- STEP 7: Show recent system messages
-- ============================================
SELECT '=== RECENT SYSTEM MESSAGES ===' as info;

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
-- STEP 8: Check for competitions without chat messages
-- ============================================
SELECT '=== COMPETITIONS WITHOUT CHAT MESSAGES ===' as info;

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

-- ============================================
-- STEP 9: Check for completed matches without chat messages
-- ============================================
SELECT '=== COMPLETED MATCHES WITHOUT CHAT MESSAGES ===' as info;

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

-- ============================================
-- FINAL SUMMARY
-- ============================================
SELECT '=== DIAGNOSTIC SUMMARY ===' as info;

SELECT 
  'Total Groups' as metric,
  COUNT(*)::TEXT as value
FROM groups
UNION ALL
SELECT 
  'Total Competitions',
  COUNT(*)::TEXT
FROM competitions
UNION ALL
SELECT 
  'Total Matches',
  COUNT(*)::TEXT
FROM matches
UNION ALL
SELECT 
  'Total Chat Messages',
  COUNT(*)::TEXT
FROM chat_messages
UNION ALL
SELECT 
  'System Messages (24h)',
  COUNT(*)::TEXT
FROM chat_messages
WHERE sender_name = 'System'
  AND timestamp > NOW() - INTERVAL '24 hours'
UNION ALL
SELECT 
  'Competitions (24h)',
  COUNT(*)::TEXT
FROM competitions
WHERE created_at > NOW() - INTERVAL '24 hours'
UNION ALL
SELECT 
  'Completed Matches (24h)',
  COUNT(*)::TEXT
FROM matches
WHERE status = 'completed'
  AND completed_at > NOW() - INTERVAL '24 hours';
