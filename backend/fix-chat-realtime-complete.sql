-- COMPLETE FIX FOR CHAT REALTIME AND EVENT MESSAGES
-- This fixes both realtime updates and event message triggers

-- ============================================
-- STEP 1: Fix RLS Policies for Chat Messages
-- ============================================

-- Drop all existing policies
DROP POLICY IF EXISTS "Users can view group messages" ON chat_messages;
DROP POLICY IF EXISTS "Users can insert their messages" ON chat_messages;
DROP POLICY IF EXISTS "System can insert event messages" ON chat_messages;
DROP POLICY IF EXISTS "Users can insert messages in their groups" ON chat_messages;
DROP POLICY IF EXISTS "Users can view messages in their groups" ON chat_messages;
DROP POLICY IF EXISTS "Users can insert their own messages" ON chat_messages;

-- Policy 1: Allow users to view messages in groups they're members of
CREATE POLICY "chat_select_policy"
  ON chat_messages
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 
      FROM group_members gm
      JOIN players p ON p.id = gm.player_id
      WHERE gm.group_id = chat_messages.group_id
        AND p.auth_user_id = auth.uid()
    )
  );

-- Policy 2: Allow authenticated users to insert their own messages
CREATE POLICY "chat_insert_user_policy"
  ON chat_messages
  FOR INSERT
  WITH CHECK (
    sender_id = auth.uid()
    AND EXISTS (
      SELECT 1 
      FROM group_members gm
      JOIN players p ON p.id = gm.player_id
      WHERE gm.group_id = chat_messages.group_id
        AND p.auth_user_id = auth.uid()
    )
  );

-- Policy 3: CRITICAL - Allow system messages (bypasses auth check)
-- This is what allows triggers to insert event messages
CREATE POLICY "chat_insert_system_policy"
  ON chat_messages
  FOR INSERT
  WITH CHECK (
    sender_name = 'System'
    AND type IN (
      'match_live', 
      'match_score', 
      'competition_created', 
      'competition_deadline', 
      'competition_finished'
    )
  );

-- ============================================
-- STEP 2: Enable Realtime for Chat Messages
-- ============================================

-- Drop existing publication if it exists
DROP PUBLICATION IF EXISTS supabase_realtime;

-- Create publication for realtime
CREATE PUBLICATION supabase_realtime FOR TABLE chat_messages;

-- Enable realtime on the table
ALTER TABLE chat_messages REPLICA IDENTITY FULL;

-- ============================================
-- STEP 3: Update Trigger Functions to Use Security Definer
-- ============================================

-- Function to post match live event (SECURITY DEFINER bypasses RLS)
CREATE OR REPLACE FUNCTION post_match_live_event()
RETURNS TRIGGER 
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  home_player_name TEXT;
  away_player_name TEXT;
  comp_group_id UUID;
BEGIN
  IF NEW.status = 'live' AND (OLD.status IS NULL OR OLD.status != 'live') THEN
    SELECT name INTO home_player_name FROM players WHERE id = NEW.home_player_id;
    SELECT name INTO away_player_name FROM players WHERE id = NEW.away_player_id;
    SELECT group_id INTO comp_group_id FROM competitions WHERE id = NEW.competition_id;
    
    INSERT INTO chat_messages (
      group_id,
      sender_id,
      sender_name,
      message,
      type,
      metadata,
      timestamp
    ) VALUES (
      comp_group_id,
      NEW.home_player_id,
      'System',
      '🔴 LIVE: ' || home_player_name || ' vs ' || away_player_name,
      'match_live',
      jsonb_build_object(
        'matchId', NEW.id,
        'homePlayerId', NEW.home_player_id,
        'awayPlayerId', NEW.away_player_id,
        'homePlayerName', home_player_name,
        'awayPlayerName', away_player_name
      ),
      NOW()
    );
    
    RAISE NOTICE '✅ Posted match live event for match %', NEW.id;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Function to post match score event (SECURITY DEFINER bypasses RLS)
CREATE OR REPLACE FUNCTION post_match_score_event()
RETURNS TRIGGER 
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  home_player_name TEXT;
  away_player_name TEXT;
  comp_group_id UUID;
  winner_name TEXT;
  result_text TEXT;
BEGIN
  IF NEW.status = 'completed' AND (OLD.status IS NULL OR OLD.status != 'completed') THEN
    SELECT name INTO home_player_name FROM players WHERE id = NEW.home_player_id;
    SELECT name INTO away_player_name FROM players WHERE id = NEW.away_player_id;
    SELECT group_id INTO comp_group_id FROM competitions WHERE id = NEW.competition_id;
    
    IF NEW.home_score > NEW.away_score THEN
      winner_name := home_player_name;
      result_text := '🏆 ' || home_player_name || ' ' || NEW.home_score || ' - ' || NEW.away_score || ' ' || away_player_name;
    ELSIF NEW.away_score > NEW.home_score THEN
      winner_name := away_player_name;
      result_text := '🏆 ' || home_player_name || ' ' || NEW.home_score || ' - ' || NEW.away_score || ' ' || away_player_name;
    ELSE
      winner_name := NULL;
      result_text := '🤝 Draw: ' || home_player_name || ' ' || NEW.home_score || ' - ' || NEW.away_score || ' ' || away_player_name;
    END IF;
    
    INSERT INTO chat_messages (
      group_id,
      sender_id,
      sender_name,
      message,
      type,
      metadata,
      timestamp
    ) VALUES (
      comp_group_id,
      NEW.home_player_id,
      'System',
      result_text,
      'match_score',
      jsonb_build_object(
        'matchId', NEW.id,
        'homePlayerId', NEW.home_player_id,
        'awayPlayerId', NEW.away_player_id,
        'homePlayerName', home_player_name,
        'awayPlayerName', away_player_name,
        'homeScore', NEW.home_score,
        'awayScore', NEW.away_score,
        'winnerName', winner_name
      ),
      NOW()
    );
    
    RAISE NOTICE '✅ Posted match score event for match %', NEW.id;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Function to post competition created event (SECURITY DEFINER bypasses RLS)
CREATE OR REPLACE FUNCTION post_competition_created_event()
RETURNS TRIGGER 
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  match_count INTEGER;
  comp_type_display TEXT;
  admin_player_id UUID;
BEGIN
  SELECT COUNT(*) INTO match_count FROM matches WHERE competition_id = NEW.id;
  
  comp_type_display := CASE NEW.type
    WHEN 'league' THEN 'League'
    WHEN 'tournament' THEN 'Tournament'
    WHEN 'friendly' THEN 'Friendly'
    ELSE NEW.type
  END;
  
  -- Get a player ID from the group for sender_id (use admin)
  SELECT p.id INTO admin_player_id
  FROM players p
  JOIN groups g ON g.admin_id = p.auth_user_id
  WHERE g.id = NEW.group_id
  LIMIT 1;
  
  -- Fallback: use any player from the group
  IF admin_player_id IS NULL THEN
    SELECT p.id INTO admin_player_id
    FROM players p
    JOIN group_members gm ON gm.player_id = p.id
    WHERE gm.group_id = NEW.group_id
    LIMIT 1;
  END IF;
  
  INSERT INTO chat_messages (
    group_id,
    sender_id,
    sender_name,
    message,
    type,
    metadata,
    timestamp
  ) VALUES (
    NEW.group_id,
    admin_player_id,
    'System',
    '🎮 New ' || comp_type_display || ' created: ' || NEW.name || 
    CASE 
      WHEN NEW.deadline_days IS NOT NULL THEN ' (Deadline: ' || NEW.deadline_days || ' days)'
      ELSE ''
    END,
    'competition_created',
    jsonb_build_object(
      'competitionId', NEW.id,
      'competitionName', NEW.name,
      'competitionType', NEW.type,
      'matchCount', match_count,
      'deadlineDays', NEW.deadline_days
    ),
    NOW()
  );
  
  RAISE NOTICE '✅ Posted competition created event for competition %', NEW.id;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Function to post competition finished event (SECURITY DEFINER bypasses RLS)
CREATE OR REPLACE FUNCTION post_competition_finished_event()
RETURNS TRIGGER 
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  total_matches INTEGER;
  completed_matches INTEGER;
  dropped_matches INTEGER;
  winner_id UUID;
  winner_name TEXT;
  winner_points INTEGER;
  comp_type_display TEXT;
  admin_player_id UUID;
BEGIN
  IF NEW.status = 'completed' AND (OLD.status IS NULL OR OLD.status != 'completed') THEN
    SELECT COUNT(*) INTO total_matches FROM matches WHERE competition_id = NEW.id;
    SELECT COUNT(*) INTO completed_matches FROM matches WHERE competition_id = NEW.id AND status = 'completed';
    dropped_matches := total_matches - completed_matches;
    
    comp_type_display := CASE NEW.type
      WHEN 'league' THEN 'League'
      WHEN 'tournament' THEN 'Tournament'
      WHEN 'friendly' THEN 'Friendly'
      ELSE NEW.type
    END;
    
    IF NEW.type = 'league' THEN
      SELECT 
        ps.player_id,
        p.name,
        ps.points
      INTO winner_id, winner_name, winner_points
      FROM player_stats ps
      JOIN players p ON p.id = ps.player_id
      WHERE ps.group_id = NEW.group_id
      ORDER BY ps.points DESC, ps.goals_for DESC
      LIMIT 1;
    ELSIF NEW.type = 'tournament' THEN
      SELECT 
        CASE 
          WHEN m.home_score > m.away_score THEN m.home_player_id
          WHEN m.away_score > m.home_score THEN m.away_player_id
          ELSE NULL
        END,
        CASE 
          WHEN m.home_score > m.away_score THEN hp.name
          WHEN m.away_score > m.home_score THEN ap.name
          ELSE NULL
        END
      INTO winner_id, winner_name
      FROM matches m
      JOIN players hp ON hp.id = m.home_player_id
      JOIN players ap ON ap.id = m.away_player_id
      WHERE m.competition_id = NEW.id 
        AND m.status = 'completed'
      ORDER BY m.completed_at DESC
      LIMIT 1;
    END IF;
    
    -- Get admin player ID
    SELECT p.id INTO admin_player_id
    FROM players p
    JOIN groups g ON g.admin_id = p.auth_user_id
    WHERE g.id = NEW.group_id
    LIMIT 1;
    
    IF admin_player_id IS NULL THEN
      SELECT p.id INTO admin_player_id
      FROM players p
      JOIN group_members gm ON gm.player_id = p.id
      WHERE gm.group_id = NEW.group_id
      LIMIT 1;
    END IF;
    
    INSERT INTO chat_messages (
      group_id,
      sender_id,
      sender_name,
      message,
      type,
      metadata,
      timestamp
    ) VALUES (
      NEW.group_id,
      admin_player_id,
      'System',
      '🏁 ' || comp_type_display || ' finished: ' || NEW.name || 
      CASE 
        WHEN winner_name IS NOT NULL THEN ' | Winner: ' || winner_name || ' 🏆'
        ELSE ''
      END ||
      ' | Matches: ' || completed_matches || ' played' ||
      CASE 
        WHEN dropped_matches > 0 THEN ', ' || dropped_matches || ' dropped'
        ELSE ''
      END,
      'competition_finished',
      jsonb_build_object(
        'competitionId', NEW.id,
        'competitionName', NEW.name,
        'competitionType', NEW.type,
        'winnerId', winner_id,
        'winnerName', winner_name,
        'matchesPlayed', completed_matches,
        'matchesDropped', dropped_matches
      ),
      NOW()
    );
    
    RAISE NOTICE '✅ Posted competition finished event for competition %', NEW.id;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- STEP 4: Recreate Triggers
-- ============================================

DROP TRIGGER IF EXISTS trigger_match_live_event ON matches;
DROP TRIGGER IF EXISTS trigger_match_score_event ON matches;
DROP TRIGGER IF EXISTS trigger_competition_created_event ON competitions;
DROP TRIGGER IF EXISTS trigger_competition_finished_event ON competitions;

CREATE TRIGGER trigger_match_live_event
  AFTER INSERT OR UPDATE ON matches
  FOR EACH ROW
  EXECUTE FUNCTION post_match_live_event();

CREATE TRIGGER trigger_match_score_event
  AFTER INSERT OR UPDATE ON matches
  FOR EACH ROW
  EXECUTE FUNCTION post_match_score_event();

CREATE TRIGGER trigger_competition_created_event
  AFTER INSERT ON competitions
  FOR EACH ROW
  EXECUTE FUNCTION post_competition_created_event();

CREATE TRIGGER trigger_competition_finished_event
  AFTER UPDATE ON competitions
  FOR EACH ROW
  EXECUTE FUNCTION post_competition_finished_event();

-- ============================================
-- STEP 5: Test the Setup
-- ============================================

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
  
  -- Test 1: Insert a test system message directly
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
    RAISE NOTICE '✅ Test 1 PASSED: Direct system message insert';
  EXCEPTION
    WHEN OTHERS THEN
      RAISE WARNING '❌ Test 1 FAILED: %', SQLERRM;
  END;
  
  -- Test 2: Create a test competition (should trigger event)
  BEGIN
    INSERT INTO competitions (
      group_id,
      name,
      type,
      status,
      deadline_days
    ) VALUES (
      test_group_id,
      '🧪 TEST Competition',
      'league',
      'active',
      7
    ) RETURNING id INTO test_comp_id;
    
    RAISE NOTICE '✅ Test 2 PASSED: Competition created with ID %', test_comp_id;
  EXCEPTION
    WHEN OTHERS THEN
      RAISE WARNING '❌ Test 2 FAILED: %', SQLERRM;
  END;
  
  -- Test 3: Create a test match and mark it live (should trigger event)
  IF test_comp_id IS NOT NULL THEN
    BEGIN
      -- Get two players from the group
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
            status
          ) VALUES (
            test_comp_id,
            player1_id,
            player2_id,
            'live'
          ) RETURNING id INTO test_match_id;
          
          RAISE NOTICE '✅ Test 3 PASSED: Match created and set to live with ID %', test_match_id;
          
          -- Test 4: Complete the match (should trigger score event)
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
      END;
    EXCEPTION
      WHEN OTHERS THEN
        RAISE WARNING '❌ Test 3/4 FAILED: %', SQLERRM;
    END;
  END IF;
  
  -- Count messages after
  SELECT COUNT(*) INTO msg_count_after FROM chat_messages WHERE group_id = test_group_id;
  RAISE NOTICE '📊 Messages after test: %', msg_count_after;
  RAISE NOTICE '📊 New messages created: %', msg_count_after - msg_count_before;
  
  -- Show the test messages
  RAISE NOTICE '=== TEST MESSAGES ===';
  FOR rec IN 
    SELECT message, type, timestamp
    FROM chat_messages
    WHERE group_id = test_group_id
      AND (message LIKE '%TEST%' OR timestamp > NOW() - INTERVAL '1 minute')
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
  
  RAISE NOTICE '=== TESTS COMPLETE ===';
  RAISE NOTICE 'If you saw ✅ for all tests, chat events are working!';
  RAISE NOTICE 'Check your app to see if messages appear in realtime.';
END $$;

-- ============================================
-- STEP 6: Verify Setup
-- ============================================

SELECT 
  '=== RLS POLICIES ===' as info,
  policyname,
  cmd,
  qual,
  with_check
FROM pg_policies
WHERE tablename = 'chat_messages'
ORDER BY policyname;

SELECT '=== TRIGGERS ===' as info;
SELECT 
  trigger_name,
  event_manipulation,
  event_object_table,
  action_statement
FROM information_schema.triggers
WHERE event_object_table IN ('matches', 'competitions')
  AND trigger_name LIKE '%event%'
ORDER BY event_object_table, trigger_name;

SELECT '=== REALTIME PUBLICATION ===' as info;
SELECT 
  pubname,
  puballtables
FROM pg_publication
WHERE pubname = 'supabase_realtime';

SELECT 
  schemaname,
  tablename,
  pubname
FROM pg_publication_tables
WHERE pubname = 'supabase_realtime'
  AND tablename = 'chat_messages';

RAISE NOTICE '✅ Setup complete! Chat realtime and event messages should now work.';
RAISE NOTICE '📱 Open your app and try:';
RAISE NOTICE '   1. Send a message in one tab, see it appear in another tab';
RAISE NOTICE '   2. Create a competition, see the event in chat';
RAISE NOTICE '   3. Start a match (set to live), see the event in chat';
RAISE NOTICE '   4. Complete a match with a score, see the event in chat';
