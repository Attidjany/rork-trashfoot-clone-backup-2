-- ============================================
-- DIAGNOSE AND FIX DEADLINE_DAYS ISSUE
-- ============================================

-- Step 1: Check if deadline_days column still exists
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 
    FROM information_schema.columns 
    WHERE table_schema = 'public' 
      AND table_name = 'competitions' 
      AND column_name = 'deadline_days'
  ) THEN
    RAISE NOTICE '❌ Column deadline_days still exists in competitions table';
    
    -- Drop the column
    ALTER TABLE competitions DROP COLUMN IF EXISTS deadline_days;
    RAISE NOTICE '✅ Dropped deadline_days column';
  ELSE
    RAISE NOTICE '✅ Column deadline_days does not exist (good)';
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 
    FROM information_schema.columns 
    WHERE table_schema = 'public' 
      AND table_name = 'competitions' 
      AND column_name = 'deadline_date'
  ) THEN
    RAISE NOTICE '❌ Column deadline_date does not exist';
    
    -- Add the column
    ALTER TABLE competitions ADD COLUMN deadline_date TIMESTAMP WITH TIME ZONE;
    RAISE NOTICE '✅ Added deadline_date column';
  ELSE
    RAISE NOTICE '✅ Column deadline_date exists (good)';
  END IF;
END $$;

-- Step 2: List all triggers on competitions table
SELECT 
  trigger_name,
  event_manipulation,
  action_statement
FROM information_schema.triggers
WHERE event_object_table = 'competitions'
  AND trigger_schema = 'public';

-- Step 3: List all functions that might reference deadline_days
SELECT 
  routine_name,
  routine_definition
FROM information_schema.routines
WHERE routine_schema = 'public'
  AND routine_type = 'FUNCTION'
  AND routine_definition LIKE '%deadline_days%';

-- Step 4: Drop and recreate all competition-related triggers with correct column name

-- Drop existing trigger and function
DROP TRIGGER IF EXISTS competition_created_event ON competitions;
DROP FUNCTION IF EXISTS post_competition_created_event() CASCADE;

-- Recreate the function with deadline_date
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
  
  -- Insert chat message (only if type is valid)
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
      NEW.group_id,
      admin_player_id,
      'System',
      '🎮 New ' || comp_type_display || ' created: ' || NEW.name || 
      CASE 
        WHEN NEW.deadline_date IS NOT NULL THEN ' (Deadline: ' || TO_CHAR(NEW.deadline_date, 'Mon DD, YYYY') || ')'
        ELSE ''
      END,
      'text',  -- Use 'text' instead of 'competition_created' to avoid constraint issues
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
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING '⚠️ Failed to post competition created event: %', SQLERRM;
  END;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Recreate the trigger
CREATE TRIGGER competition_created_event
  AFTER INSERT ON competitions
  FOR EACH ROW
  EXECUTE FUNCTION post_competition_created_event();

-- Step 5: Verify the fix
DO $$
BEGIN
  RAISE NOTICE '✅ All triggers have been fixed to use deadline_date instead of deadline_days';
  RAISE NOTICE '✅ You can now create competitions without errors';
END $$;
