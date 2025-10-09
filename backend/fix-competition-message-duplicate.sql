-- Fix the competition created trigger to avoid duplicate messages
-- and show match count properly

CREATE OR REPLACE FUNCTION post_competition_created_event()
RETURNS TRIGGER AS $$
DECLARE
  match_count INTEGER;
  comp_type_display TEXT;
  deadline_text TEXT;
BEGIN
  -- Use created_by as sender_id, fallback to first group member if not set
  IF NEW.created_by IS NULL THEN
    -- If created_by is not set, use the first group member
    SELECT player_id INTO NEW.created_by 
    FROM group_members 
    WHERE group_id = NEW.group_id 
    LIMIT 1;
  END IF;
  
  -- If still no sender found, skip the message
  IF NEW.created_by IS NULL THEN
    RETURN NEW;
  END IF;
  
  -- Wait a moment for matches to be inserted, then count them
  -- This is a workaround since matches are inserted after competition
  PERFORM pg_sleep(0.1);
  SELECT COUNT(*) INTO match_count FROM matches WHERE competition_id = NEW.id;
  
  -- Format competition type
  comp_type_display := CASE NEW.type
    WHEN 'league' THEN 'League'
    WHEN 'tournament' THEN 'Tournament'
    WHEN 'friendly' THEN 'Friendly'
    ELSE NEW.type
  END;
  
  -- Format deadline text
  IF NEW.end_date IS NOT NULL THEN
    deadline_text := TO_CHAR(NEW.end_date::timestamp, 'Mon DD, YYYY');
  ELSE
    deadline_text := NULL;
  END IF;
  
  -- Insert chat message with created_by as sender_id
  -- Only insert if a message doesn't already exist for this competition
  INSERT INTO chat_messages (
    group_id,
    sender_id,
    sender_name,
    message,
    type,
    metadata,
    timestamp
  )
  SELECT
    NEW.group_id,
    NEW.created_by,
    'System',
    '🎮 New ' || comp_type_display || ' created: ' || NEW.name,
    'competition_created',
    jsonb_build_object(
      'competitionId', NEW.id,
      'competitionName', NEW.name,
      'competitionType', comp_type_display,
      'matchCount', match_count,
      'deadlineDays', deadline_text
    ),
    NOW()
  WHERE NOT EXISTS (
    SELECT 1 FROM chat_messages 
    WHERE type = 'competition_created' 
    AND metadata->>'competitionId' = NEW.id::text
  );
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Recreate the trigger
DROP TRIGGER IF EXISTS competition_created_trigger ON competitions;
CREATE TRIGGER competition_created_trigger
  AFTER INSERT ON competitions
  FOR EACH ROW
  EXECUTE FUNCTION post_competition_created_event();
