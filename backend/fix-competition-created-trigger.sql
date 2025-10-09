-- Fix the competition created trigger to handle sender_id properly and use deadline_date

-- Update the function to use a valid sender_id and deadline_date
CREATE OR REPLACE FUNCTION post_competition_created_event()
RETURNS TRIGGER AS $$
DECLARE
  match_count INTEGER;
  comp_type_display TEXT;
  system_sender_id UUID;
BEGIN
  -- Get a valid player ID from the group to use as sender
  -- Use the first group member as the system sender
  SELECT player_id INTO system_sender_id 
  FROM group_members 
  WHERE group_id = NEW.group_id 
  LIMIT 1;
  
  -- If no members found, skip the message
  IF system_sender_id IS NULL THEN
    RETURN NEW;
  END IF;
  
  -- Count matches for this competition (wait a moment for them to be inserted)
  SELECT COUNT(*) INTO match_count FROM matches WHERE competition_id = NEW.id;
  
  -- Format competition type
  comp_type_display := CASE NEW.type
    WHEN 'league' THEN 'League'
    WHEN 'tournament' THEN 'Tournament'
    WHEN 'friendly' THEN 'Friendly'
    ELSE NEW.type
  END;
  
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
    system_sender_id,
    'System',
    '🎮 New ' || comp_type_display || ' created: ' || NEW.name || 
    CASE 
      WHEN NEW.end_date IS NOT NULL THEN ' (Deadline: ' || TO_CHAR(NEW.end_date::timestamp, 'Mon DD, YYYY') || ')'
      ELSE ''
    END,
    'competition_created',
    jsonb_build_object(
      'competitionId', NEW.id,
      'competitionName', NEW.name,
      'competitionType', NEW.type,
      'matchCount', match_count,
      'endDate', NEW.end_date
    ),
    NOW()
  );
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Also fix the competition finished trigger
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
  system_sender_id UUID;
BEGIN
  -- Only trigger when status changes to 'completed'
  IF NEW.status = 'completed' AND (OLD.status IS NULL OR OLD.status != 'completed') THEN
    -- Get a valid player ID from the group to use as sender
    SELECT player_id INTO system_sender_id 
    FROM group_members 
    WHERE group_id = NEW.group_id 
    LIMIT 1;
    
    -- If no members found, skip the message
    IF system_sender_id IS NULL THEN
      RETURN NEW;
    END IF;
    
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
      system_sender_id,
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
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
