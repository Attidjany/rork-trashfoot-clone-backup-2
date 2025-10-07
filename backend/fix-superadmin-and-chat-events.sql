-- COMPREHENSIVE FIX FOR SUPERADMIN AND CHAT EVENTS
-- This fixes:
-- 1. Superadmin not seeing competitions (RLS bypass needed)
-- 2. Chat events not appearing (trigger issues)

-- ============================================
-- PART 1: FIX SUPERADMIN RLS POLICIES
-- ============================================

-- Add superadmin bypass to competitions SELECT policy
DROP POLICY IF EXISTS "Competitions viewable by group members" ON competitions;
DROP POLICY IF EXISTS "Superadmin can view all competitions" ON competitions;

-- Policy 1: Group members can view their competitions
CREATE POLICY "Competitions viewable by group members" ON competitions 
FOR SELECT 
USING (
  group_id IN (
    SELECT group_id 
    FROM group_members 
    WHERE player_id IN (
      SELECT id 
      FROM players 
      WHERE auth_user_id = auth.uid()
    )
  )
);

-- Policy 2: Superadmin can view ALL competitions
CREATE POLICY "Superadmin can view all competitions" ON competitions 
FOR SELECT 
USING (
  EXISTS (
    SELECT 1 
    FROM players 
    WHERE auth_user_id = auth.uid() 
      AND role = 'super_admin'
  )
);

-- Add superadmin bypass to groups SELECT policy
DROP POLICY IF EXISTS "Groups viewable by members" ON groups;
DROP POLICY IF EXISTS "Superadmin can view all groups" ON groups;

CREATE POLICY "Groups viewable by members" ON groups 
FOR SELECT 
USING (
  id IN (
    SELECT group_id 
    FROM group_members 
    WHERE player_id IN (
      SELECT id 
      FROM players 
      WHERE auth_user_id = auth.uid()
    )
  )
);

CREATE POLICY "Superadmin can view all groups" ON groups 
FOR SELECT 
USING (
  EXISTS (
    SELECT 1 
    FROM players 
    WHERE auth_user_id = auth.uid() 
      AND role = 'super_admin'
  )
);

-- Add superadmin bypass to matches SELECT policy
DROP POLICY IF EXISTS "Matches viewable by group members" ON matches;
DROP POLICY IF EXISTS "Superadmin can view all matches" ON matches;

CREATE POLICY "Matches viewable by group members" ON matches 
FOR SELECT 
USING (
  competition_id IN (
    SELECT id 
    FROM competitions 
    WHERE group_id IN (
      SELECT group_id 
      FROM group_members 
      WHERE player_id IN (
        SELECT id 
        FROM players 
        WHERE auth_user_id = auth.uid()
      )
    )
  )
);

CREATE POLICY "Superadmin can view all matches" ON matches 
FOR SELECT 
USING (
  EXISTS (
    SELECT 1 
    FROM players 
    WHERE auth_user_id = auth.uid() 
      AND role = 'super_admin'
  )
);

-- Add superadmin bypass to players SELECT policy
DROP POLICY IF EXISTS "Players can view themselves" ON players;
DROP POLICY IF EXISTS "Superadmin can view all players" ON players;

CREATE POLICY "Players can view themselves" ON players 
FOR SELECT 
USING (auth_user_id = auth.uid());

CREATE POLICY "Superadmin can view all players" ON players 
FOR SELECT 
USING (
  EXISTS (
    SELECT 1 
    FROM players p
    WHERE p.auth_user_id = auth.uid() 
      AND p.role = 'super_admin'
  )
);

-- Add superadmin bypass to group_members SELECT policy
DROP POLICY IF EXISTS "Group members viewable by group members" ON group_members;
DROP POLICY IF EXISTS "Superadmin can view all group members" ON group_members;

CREATE POLICY "Group members viewable by group members" ON group_members 
FOR SELECT 
USING (
  group_id IN (
    SELECT group_id 
    FROM group_members gm
    WHERE gm.player_id IN (
      SELECT id 
      FROM players 
      WHERE auth_user_id = auth.uid()
    )
  )
);

CREATE POLICY "Superadmin can view all group members" ON group_members 
FOR SELECT 
USING (
  EXISTS (
    SELECT 1 
    FROM players 
    WHERE auth_user_id = auth.uid() 
      AND role = 'super_admin'
  )
);

-- Add superadmin bypass to join_requests SELECT policy
DROP POLICY IF EXISTS "Join requests viewable by group admins" ON join_requests;
DROP POLICY IF EXISTS "Superadmin can view all join requests" ON join_requests;

CREATE POLICY "Join requests viewable by group admins" ON join_requests 
FOR SELECT 
USING (
  group_id IN (
    SELECT id 
    FROM groups 
    WHERE admin_id IN (
      SELECT id 
      FROM players 
      WHERE auth_user_id = auth.uid()
    )
  )
);

CREATE POLICY "Superadmin can view all join requests" ON join_requests 
FOR SELECT 
USING (
  EXISTS (
    SELECT 1 
    FROM players 
    WHERE auth_user_id = auth.uid() 
      AND role = 'super_admin'
  )
);

-- ============================================
-- PART 2: FIX CHAT EVENT TRIGGERS
-- ============================================

-- Ensure chat_messages RLS allows system messages
DROP POLICY IF EXISTS "chat_insert_system_policy" ON chat_messages;

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

-- Recreate trigger functions with SECURITY DEFINER
-- This allows them to bypass RLS

-- Function: post_match_live_event
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
  -- Only trigger when status changes to 'live'
  IF NEW.status = 'live' AND (OLD IS NULL OR OLD.status IS DISTINCT FROM 'live') THEN
    -- Get player names
    SELECT name INTO home_player_name FROM players WHERE id = NEW.home_player_id;
    SELECT name INTO away_player_name FROM players WHERE id = NEW.away_player_id;
    
    -- Get competition's group_id
    SELECT group_id INTO comp_group_id FROM competitions WHERE id = NEW.competition_id;
    
    -- Insert chat message
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
    
    RAISE NOTICE '✅ Posted match live event for match % in group %', NEW.id, comp_group_id;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Function: post_match_score_event
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
  -- Only trigger when status changes to 'completed'
  IF NEW.status = 'completed' AND (OLD IS NULL OR OLD.status IS DISTINCT FROM 'completed') THEN
    -- Get player names
    SELECT name INTO home_player_name FROM players WHERE id = NEW.home_player_id;
    SELECT name INTO away_player_name FROM players WHERE id = NEW.away_player_id;
    
    -- Get competition's group_id
    SELECT group_id INTO comp_group_id FROM competitions WHERE id = NEW.competition_id;
    
    -- Determine winner and result text
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
    
    -- Insert chat message
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
    
    RAISE NOTICE '✅ Posted match score event for match % in group %', NEW.id, comp_group_id;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Function: post_competition_created_event
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
  -- Count matches in this competition
  SELECT COUNT(*) INTO match_count FROM matches WHERE competition_id = NEW.id;
  
  -- Format competition type
  comp_type_display := CASE NEW.type
    WHEN 'league' THEN 'League'
    WHEN 'tournament' THEN 'Tournament'
    WHEN 'friendly' THEN 'Friendly'
    ELSE NEW.type
  END;
  
  -- Get a player ID from the group (use admin)
  SELECT p.id INTO admin_player_id
  FROM players p
  JOIN groups g ON g.admin_id = p.id
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
  
  -- Insert chat message
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
  
  RAISE NOTICE '✅ Posted competition created event for competition % in group %', NEW.id, NEW.group_id;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Function: post_competition_finished_event
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
  comp_type_display TEXT;
  admin_player_id UUID;
BEGIN
  -- Only trigger when status changes to 'completed'
  IF NEW.status = 'completed' AND (OLD IS NULL OR OLD.status IS DISTINCT FROM 'completed') THEN
    -- Count matches
    SELECT COUNT(*) INTO total_matches FROM matches WHERE competition_id = NEW.id;
    SELECT COUNT(*) INTO completed_matches FROM matches WHERE competition_id = NEW.id AND status = 'completed';
    dropped_matches := total_matches - completed_matches;
    
    -- Format competition type
    comp_type_display := CASE NEW.type
      WHEN 'league' THEN 'League'
      WHEN 'tournament' THEN 'Tournament'
      WHEN 'friendly' THEN 'Friendly'
      ELSE NEW.type
    END;
    
    -- Determine winner based on competition type
    IF NEW.type = 'league' THEN
      SELECT 
        ps.player_id,
        p.name
      INTO winner_id, winner_name
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
    JOIN groups g ON g.admin_id = p.id
    WHERE g.id = NEW.group_id
    LIMIT 1;
    
    IF admin_player_id IS NULL THEN
      SELECT p.id INTO admin_player_id
      FROM players p
      JOIN group_members gm ON gm.player_id = p.id
      WHERE gm.group_id = NEW.group_id
      LIMIT 1;
    END IF;
    
    -- Insert chat message
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
    
    RAISE NOTICE '✅ Posted competition finished event for competition % in group %', NEW.id, NEW.group_id;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Recreate triggers
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
-- VERIFICATION
-- ============================================

SELECT '=== VERIFICATION ===' as info;

-- Check RLS policies
SELECT 
  '=== COMPETITIONS RLS POLICIES ===' as info,
  policyname,
  cmd
FROM pg_policies
WHERE tablename = 'competitions'
ORDER BY policyname;

-- Check triggers
SELECT 
  '=== TRIGGERS ===' as info,
  trigger_name,
  event_manipulation,
  event_object_table
FROM information_schema.triggers
WHERE event_object_table IN ('matches', 'competitions')
  AND trigger_name LIKE '%event%'
ORDER BY event_object_table, trigger_name;

-- Show data counts
SELECT 
  '=== DATA COUNTS ===' as info,
  'Competitions' as table_name,
  COUNT(*)::TEXT as count
FROM competitions
UNION ALL
SELECT 
  '',
  'Matches',
  COUNT(*)::TEXT
FROM matches
UNION ALL
SELECT 
  '',
  'Chat Messages',
  COUNT(*)::TEXT
FROM chat_messages;

-- Final notice
DO $
BEGIN
  RAISE NOTICE '✅ Setup complete!';
  RAISE NOTICE '📱 Test in your app:';
  RAISE NOTICE '   1. Superadmin should now see all competitions';
  RAISE NOTICE '   2. Create a competition - should see chat event';
  RAISE NOTICE '   3. Start a match - should see chat event';
  RAISE NOTICE '   4. Complete a match - should see chat event';
END $;
