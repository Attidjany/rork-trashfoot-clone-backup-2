-- Fix and reinstall chat event triggers
-- Run this script to ensure all chat event triggers are working

-- Step 1: Drop existing triggers and functions
DROP TRIGGER IF EXISTS trigger_match_live_event ON matches;
DROP TRIGGER IF EXISTS trigger_match_score_event ON matches;
DROP TRIGGER IF EXISTS trigger_competition_created_event ON competitions;
DROP TRIGGER IF EXISTS trigger_competition_finished_event ON competitions;

DROP FUNCTION IF EXISTS post_match_live_event();
DROP FUNCTION IF EXISTS post_match_score_event();
DROP FUNCTION IF EXISTS post_competition_created_event();
DROP FUNCTION IF EXISTS post_competition_finished_event();
DROP FUNCTION IF EXISTS post_competition_deadline_reminders();

-- Step 2: Update chat_messages type constraint to include new event types
ALTER TABLE chat_messages DROP CONSTRAINT IF EXISTS chat_messages_type_check;
ALTER TABLE chat_messages ADD CONSTRAINT chat_messages_type_check 
  CHECK (type IN ('text', 'match_result', 'youtube_link', 'match_live', 'match_score', 'competition_created', 'competition_deadline', 'competition_finished'));

-- Step 3: Create function to post match live event
CREATE OR REPLACE FUNCTION post_match_live_event()
RETURNS TRIGGER AS $$
DECLARE
  home_player_name TEXT;
  away_player_name TEXT;
  comp_group_id UUID;
BEGIN
  -- Only trigger when status changes to 'live'
  IF NEW.status = 'live' AND (OLD IS NULL OR OLD.status IS NULL OR OLD.status != 'live') THEN
    -- Get player names
    SELECT name INTO home_player_name FROM players WHERE id = NEW.home_player_id;
    SELECT name INTO away_player_name FROM players WHERE id = NEW.away_player_id;
    
    -- Get group_id from competition
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
    
    RAISE NOTICE 'Posted match live event for match %', NEW.id;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Step 4: Create function to post match score event
CREATE OR REPLACE FUNCTION post_match_score_event()
RETURNS TRIGGER AS $$
DECLARE
  home_player_name TEXT;
  away_player_name TEXT;
  comp_group_id UUID;
  winner_name TEXT;
  result_text TEXT;
BEGIN
  -- Only trigger when status changes to 'completed' and scores are set
  IF NEW.status = 'completed' 
     AND NEW.home_score IS NOT NULL 
     AND NEW.away_score IS NOT NULL
     AND (OLD IS NULL OR OLD.status IS NULL OR OLD.status != 'completed') THEN
    
    -- Get player names
    SELECT name INTO home_player_name FROM players WHERE id = NEW.home_player_id;
    SELECT name INTO away_player_name FROM players WHERE id = NEW.away_player_id;
    
    -- Get group_id from competition
    SELECT group_id INTO comp_group_id FROM competitions WHERE id = NEW.competition_id;
    
    -- Determine winner
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
    
    RAISE NOTICE 'Posted match score event for match %', NEW.id;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Step 5: Create function to post competition created event
CREATE OR REPLACE FUNCTION post_competition_created_event()
RETURNS TRIGGER AS $$
DECLARE
  match_count INTEGER;
  comp_type_display TEXT;
  admin_player_id UUID;
BEGIN
  -- Count matches for this competition (will be 0 initially, updated later)
  SELECT COUNT(*) INTO match_count FROM matches WHERE competition_id = NEW.id;
  
  -- Format competition type
  comp_type_display := CASE NEW.type
    WHEN 'league' THEN 'League'
    WHEN 'tournament' THEN 'Tournament'
    WHEN 'friendly' THEN 'Friendly'
    ELSE NEW.type
  END;
  
  -- Get admin player ID
  SELECT admin_id INTO admin_player_id FROM groups WHERE id = NEW.group_id;
  
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
    COALESCE(admin_player_id, NEW.group_id), -- Fallback to group_id if admin not found
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
  
  RAISE NOTICE 'Posted competition created event for competition %', NEW.id;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Step 6: Create function to post competition finished event
CREATE OR REPLACE FUNCTION post_competition_finished_event()
RETURNS TRIGGER AS $$
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
  -- Only trigger when status changes to 'completed'
  IF NEW.status = 'completed' AND (OLD IS NULL OR OLD.status IS NULL OR OLD.status != 'completed') THEN
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
    
    -- Calculate winner (for league/tournament)
    IF NEW.type = 'league' THEN
      -- Winner is player with most points
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
      -- Winner is the last match winner
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
    SELECT admin_id INTO admin_player_id FROM groups WHERE id = NEW.group_id;
    
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
      COALESCE(admin_player_id, NEW.group_id), -- Fallback to group_id if admin not found
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
    
    RAISE NOTICE 'Posted competition finished event for competition %', NEW.id;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Step 7: Create deadline reminder function
CREATE OR REPLACE FUNCTION post_competition_deadline_reminders()
RETURNS void AS $$
DECLARE
  comp RECORD;
  days_left INTEGER;
  total_matches INTEGER;
  completed_matches INTEGER;
  pending_matches INTEGER;
  admin_player_id UUID;
BEGIN
  -- Find competitions with deadlines approaching
  FOR comp IN 
    SELECT c.id, c.name, c.type, c.group_id, c.deadline_days, c.created_at
    FROM competitions c
    WHERE c.status = 'active' 
      AND c.deadline_days IS NOT NULL
  LOOP
    -- Calculate days since creation
    days_left := comp.deadline_days - EXTRACT(DAY FROM (NOW() - comp.created_at));
    
    -- Only post reminder if 3, 2, or 1 day left
    IF days_left IN (3, 2, 1) THEN
      -- Count matches
      SELECT COUNT(*) INTO total_matches FROM matches WHERE competition_id = comp.id;
      SELECT COUNT(*) INTO completed_matches FROM matches WHERE competition_id = comp.id AND status = 'completed';
      pending_matches := total_matches - completed_matches;
      
      -- Get admin player ID
      SELECT admin_id INTO admin_player_id FROM groups WHERE id = comp.group_id;
      
      -- Insert reminder message
      INSERT INTO chat_messages (
        group_id,
        sender_id,
        sender_name,
        message,
        type,
        metadata,
        timestamp
      ) VALUES (
        comp.group_id,
        COALESCE(admin_player_id, comp.group_id),
        'System',
        '⏰ Deadline reminder: ' || comp.name || ' - ' || days_left || ' day(s) left | ' || 
        pending_matches || ' match(es) remaining',
        'competition_deadline',
        jsonb_build_object(
          'competitionId', comp.id,
          'competitionName', comp.name,
          'deadlineDays', days_left,
          'matchCount', pending_matches
        ),
        NOW()
      );
      
      RAISE NOTICE 'Posted deadline reminder for competition %', comp.id;
    END IF;
  END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Step 8: Create triggers
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

-- Step 9: Grant execute permissions
GRANT EXECUTE ON FUNCTION post_match_live_event() TO authenticated;
GRANT EXECUTE ON FUNCTION post_match_score_event() TO authenticated;
GRANT EXECUTE ON FUNCTION post_competition_created_event() TO authenticated;
GRANT EXECUTE ON FUNCTION post_competition_finished_event() TO authenticated;
GRANT EXECUTE ON FUNCTION post_competition_deadline_reminders() TO authenticated;

-- Step 10: Verify installation
SELECT 'Triggers installed successfully!' as status;

SELECT 
  trigger_name,
  event_manipulation,
  event_object_table
FROM information_schema.triggers
WHERE trigger_name IN (
  'trigger_match_live_event',
  'trigger_match_score_event',
  'trigger_competition_created_event',
  'trigger_competition_finished_event'
)
ORDER BY trigger_name;
