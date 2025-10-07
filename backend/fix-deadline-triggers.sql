-- Fix all triggers that reference deadline_days to use deadline_date instead

-- Drop and recreate the post_competition_created_event function
DROP FUNCTION IF EXISTS post_competition_created_event() CASCADE;

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
  RAISE NOTICE '🔔 Competition created trigger fired for competition %', NEW.id;
  
  -- Get match count
  SELECT COUNT(*) INTO match_count FROM matches WHERE competition_id = NEW.id;
  
  -- Get competition type display name
  comp_type_display := CASE 
    WHEN NEW.type = 'league' THEN 'League'
    WHEN NEW.type = 'knockout' THEN 'Knockout'
    ELSE 'Competition'
  END;
  
  -- Get admin player_id from group
  SELECT admin_id INTO admin_player_id FROM groups WHERE id = NEW.group_id;
  
  IF admin_player_id IS NULL THEN
    RAISE WARNING '⚠️ Could not find admin for group %', NEW.group_id;
    RETURN NEW;
  END IF;
  
  -- Insert chat message
  INSERT INTO chat_messages (
    group_id,
    player_id,
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
      WHEN NEW.deadline_date IS NOT NULL THEN ' (Deadline: ' || TO_CHAR(NEW.deadline_date, 'Mon DD, YYYY') || ')'
      ELSE ''
    END,
    'competition_created',
    jsonb_build_object(
      'competitionId', NEW.id,
      'competitionName', NEW.name,
      'competitionType', NEW.type,
      'matchCount', match_count,
      'deadlineDate', NEW.deadline_date
    ),
    NOW()
  );
  
  RAISE NOTICE '✅ Posted competition created event for competition % in group %', NEW.id, NEW.group_id;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Recreate the trigger
DROP TRIGGER IF EXISTS competition_created_event ON competitions;
CREATE TRIGGER competition_created_event
  AFTER INSERT ON competitions
  FOR EACH ROW
  EXECUTE FUNCTION post_competition_created_event();

RAISE NOTICE '✅ Fixed competition created trigger to use deadline_date';
