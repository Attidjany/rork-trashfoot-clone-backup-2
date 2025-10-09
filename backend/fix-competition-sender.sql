-- Add created_by column to competitions table if it doesn't exist
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'competitions' AND column_name = 'created_by'
  ) THEN
    ALTER TABLE competitions ADD COLUMN created_by UUID REFERENCES players(id);
  END IF;
END $$;

-- Update the trigger function to use created_by as sender_id
CREATE OR REPLACE FUNCTION post_competition_created_event()
RETURNS TRIGGER AS $$
DECLARE
  match_count INTEGER;
  comp_type_display TEXT;
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
  
  -- Count matches for this competition
  SELECT COUNT(*) INTO match_count FROM matches WHERE competition_id = NEW.id;
  
  -- Format competition type
  comp_type_display := CASE NEW.type
    WHEN 'league' THEN 'League'
    WHEN 'tournament' THEN 'Tournament'
    WHEN 'friendly' THEN 'Friendly'
    ELSE NEW.type
  END;
  
  -- Insert chat message with created_by as sender_id
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
    NEW.created_by,
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

-- Recreate the trigger
DROP TRIGGER IF EXISTS competition_created_trigger ON competitions;
CREATE TRIGGER competition_created_trigger
  AFTER INSERT ON competitions
  FOR EACH ROW
  EXECUTE FUNCTION post_competition_created_event();
