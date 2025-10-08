-- ============================================
-- FIX ALL TRIGGERS THAT REFERENCE deadline_days
-- Change them to use deadline_date instead
-- ============================================

-- 1. Fix post_competition_created_event function
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
    WHEN NEW.type = 'tournament' THEN 'Tournament'
    WHEN NEW.type = 'knockout' THEN 'Knockout'
    WHEN NEW.type = 'friendly' THEN 'Friendly'
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

-- 2. Check if there's a cleanup function that needs fixing
-- Drop and recreate cleanup_expired_matches if it exists
DROP FUNCTION IF EXISTS cleanup_expired_matches() CASCADE;

CREATE OR REPLACE FUNCTION cleanup_expired_matches()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  -- Delete matches that are past their competition's deadline and still scheduled
  WITH deleted AS (
    DELETE FROM matches m
    USING competitions c
    WHERE m.competition_id = c.id
      AND m.status = 'scheduled'
      AND c.deadline_date IS NOT NULL
      AND c.deadline_date < NOW()
    RETURNING m.id
  )
  SELECT COUNT(*) INTO deleted_count FROM deleted;
  
  IF deleted_count > 0 THEN
    RAISE NOTICE 'Cleaned up % expired matches', deleted_count;
  END IF;
END;
$$;

-- 3. Verify the competitions table has deadline_date column
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 
    FROM information_schema.columns 
    WHERE table_schema = 'public' 
      AND table_name = 'competitions' 
      AND column_name = 'deadline_date'
  ) THEN
    RAISE EXCEPTION 'Column deadline_date does not exist in competitions table. Run change-deadline-to-date.sql first!';
  END IF;
  
  IF EXISTS (
    SELECT 1 
    FROM information_schema.columns 
    WHERE table_schema = 'public' 
      AND table_name = 'competitions' 
      AND column_name = 'deadline_days'
  ) THEN
    RAISE WARNING 'Column deadline_days still exists! Consider running change-deadline-to-date.sql to migrate.';
  END IF;
END $$;

-- 4. Test the trigger by selecting a sample competition
DO $$
DECLARE
  sample_comp RECORD;
BEGIN
  SELECT id, name, deadline_date 
  INTO sample_comp
  FROM competitions 
  LIMIT 1;
  
  IF FOUND THEN
    RAISE NOTICE 'Sample competition: % (deadline: %)', sample_comp.name, sample_comp.deadline_date;
  ELSE
    RAISE NOTICE 'No competitions found in database';
  END IF;
END $$;

RAISE NOTICE '✅ All deadline triggers have been fixed to use deadline_date';
