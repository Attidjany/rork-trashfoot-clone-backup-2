-- FINAL FIX: Update all triggers to use deadline_date instead of deadline_days
-- This script will fix the competition creation error

-- Step 1: Drop all existing triggers that might reference deadline_days
DROP TRIGGER IF EXISTS competition_created_trigger ON competitions;
DROP TRIGGER IF EXISTS competition_deadline_reminder_trigger ON competitions;

-- Step 2: Drop the functions
DROP FUNCTION IF EXISTS notify_competition_created() CASCADE;
DROP FUNCTION IF EXISTS check_competition_deadlines() CASCADE;

-- Step 3: Recreate the competition created trigger function with deadline_date
CREATE OR REPLACE FUNCTION notify_competition_created()
RETURNS TRIGGER AS $$
DECLARE
  group_name TEXT;
  creator_name TEXT;
  deadline_info TEXT;
BEGIN
  SELECT name INTO group_name FROM groups WHERE id = NEW.group_id;
  
  deadline_info := CASE
    WHEN NEW.deadline_date IS NOT NULL THEN 
      ' (Deadline: ' || TO_CHAR(NEW.deadline_date, 'Mon DD, YYYY') || ')'
    ELSE ''
  END;

  INSERT INTO chat_messages (
    group_id,
    message,
    type,
    metadata
  ) VALUES (
    NEW.group_id,
    'New ' || NEW.type || ' competition "' || NEW.name || '" has been created!' || deadline_info,
    'competition_created',
    jsonb_build_object(
      'competitionId', NEW.id,
      'competitionName', NEW.name,
      'competitionType', NEW.type,
      'deadlineDate', NEW.deadline_date
    )
  );

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Step 4: Recreate the trigger
CREATE TRIGGER competition_created_trigger
  AFTER INSERT ON competitions
  FOR EACH ROW
  EXECUTE FUNCTION notify_competition_created();

-- Step 5: Verify the column exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 
    FROM information_schema.columns 
    WHERE table_name = 'competitions' 
      AND column_name = 'deadline_date'
  ) THEN
    RAISE EXCEPTION 'Column deadline_date does not exist in competitions table. Please run change-deadline-to-date.sql first.';
  END IF;
  
  RAISE NOTICE '✅ All triggers have been updated to use deadline_date';
END $$;
