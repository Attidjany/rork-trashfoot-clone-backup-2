-- ============================================
-- AUTO-COMPLETE COMPETITIONS IN REALTIME
-- ============================================
-- This creates triggers that automatically:
-- 1. Complete competitions when all matches are played
-- 2. Complete competitions when deadline_date is reached
-- 3. Mark all scheduled matches as deleted when competition is completed

-- ============================================
-- FUNCTION 1: Mark scheduled matches as deleted when competition completes
-- ============================================
CREATE OR REPLACE FUNCTION mark_scheduled_matches_deleted()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  updated_count INTEGER;
BEGIN
  -- Only trigger when status changes to 'completed'
  IF NEW.status = 'completed' AND (OLD.status IS NULL OR OLD.status != 'completed') THEN
    RAISE NOTICE '🏁 Competition % completed, marking scheduled matches as deleted', NEW.id;
    
    -- Update all scheduled matches to deleted status
    WITH updated AS (
      UPDATE matches
      SET 
        status = 'deleted',
        updated_at = NOW()
      WHERE competition_id = NEW.id
        AND status = 'scheduled'
      RETURNING id
    )
    SELECT COUNT(*) INTO updated_count FROM updated;
    
    IF updated_count > 0 THEN
      RAISE NOTICE '✅ Marked % scheduled matches as deleted for competition %', updated_count, NEW.id;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;

-- ============================================
-- FUNCTION 2: Check if all matches are completed and auto-complete competition
-- ============================================
CREATE OR REPLACE FUNCTION check_competition_all_matches_completed()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  total_matches INTEGER;
  completed_matches INTEGER;
  comp_status TEXT;
BEGIN
  -- Only trigger when a match is completed
  IF NEW.status = 'completed' AND (OLD.status IS NULL OR OLD.status != 'completed') THEN
    -- Get competition status
    SELECT status INTO comp_status FROM competitions WHERE id = NEW.competition_id;
    
    -- Only proceed if competition is still active
    IF comp_status = 'active' OR comp_status = 'ongoing' THEN
      -- Count total non-deleted matches
      SELECT COUNT(*) INTO total_matches 
      FROM matches 
      WHERE competition_id = NEW.competition_id 
        AND status != 'deleted';
      
      -- Count completed matches
      SELECT COUNT(*) INTO completed_matches 
      FROM matches 
      WHERE competition_id = NEW.competition_id 
        AND status = 'completed';
      
      RAISE NOTICE '📊 Competition %: % / % matches completed', NEW.competition_id, completed_matches, total_matches;
      
      -- If all matches are completed, mark competition as completed
      IF completed_matches >= total_matches AND total_matches > 0 THEN
        UPDATE competitions
        SET 
          status = 'completed',
          updated_at = NOW()
        WHERE id = NEW.competition_id;
        
        RAISE NOTICE '🎉 Competition % auto-completed (all matches played)', NEW.competition_id;
      END IF;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;

-- ============================================
-- FUNCTION 3: Check deadline_date and auto-complete expired competitions
-- ============================================
CREATE OR REPLACE FUNCTION check_deadline_and_complete()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Only check on INSERT or UPDATE of matches
  -- Check if competition has passed its deadline
  IF EXISTS (
    SELECT 1 
    FROM competitions 
    WHERE id = NEW.competition_id
      AND status IN ('active', 'ongoing')
      AND deadline_date IS NOT NULL
      AND deadline_date < NOW()
  ) THEN
    -- Competition deadline has passed, mark as completed
    UPDATE competitions
    SET 
      status = 'completed',
      updated_at = NOW()
    WHERE id = NEW.competition_id;
    
    RAISE NOTICE '⏰ Competition % auto-completed (deadline passed)', NEW.competition_id;
  END IF;
  
  RETURN NEW;
END;
$$;

-- ============================================
-- FUNCTION 4: Periodic check for expired competitions (cron-style)
-- ============================================
CREATE OR REPLACE FUNCTION expire_competitions_past_deadline()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  expired_count INTEGER;
BEGIN
  -- Mark competitions as completed if deadline has passed
  WITH expired AS (
    UPDATE competitions
    SET 
      status = 'completed',
      updated_at = NOW()
    WHERE status IN ('active', 'ongoing')
      AND deadline_date IS NOT NULL
      AND deadline_date < NOW()
    RETURNING id
  )
  SELECT COUNT(*) INTO expired_count FROM expired;
  
  IF expired_count > 0 THEN
    RAISE NOTICE '⏰ Auto-completed % expired competitions', expired_count;
  END IF;
END;
$$;

-- ============================================
-- DROP EXISTING TRIGGERS
-- ============================================
DROP TRIGGER IF EXISTS trigger_mark_scheduled_deleted ON competitions;
DROP TRIGGER IF EXISTS trigger_check_all_matches_completed ON matches;
DROP TRIGGER IF EXISTS trigger_check_deadline ON matches;

-- ============================================
-- CREATE TRIGGERS
-- ============================================

-- Trigger 1: When competition status changes to completed, mark scheduled matches as deleted
CREATE TRIGGER trigger_mark_scheduled_deleted
  AFTER UPDATE ON competitions
  FOR EACH ROW
  EXECUTE FUNCTION mark_scheduled_matches_deleted();

-- Trigger 2: When a match is completed, check if all matches in competition are done
CREATE TRIGGER trigger_check_all_matches_completed
  AFTER INSERT OR UPDATE ON matches
  FOR EACH ROW
  EXECUTE FUNCTION check_competition_all_matches_completed();

-- Trigger 3: When a match is updated, check if competition deadline has passed
CREATE TRIGGER trigger_check_deadline
  AFTER INSERT OR UPDATE ON matches
  FOR EACH ROW
  EXECUTE FUNCTION check_deadline_and_complete();

-- ============================================
-- GRANT PERMISSIONS
-- ============================================
GRANT EXECUTE ON FUNCTION mark_scheduled_matches_deleted() TO authenticated;
GRANT EXECUTE ON FUNCTION check_competition_all_matches_completed() TO authenticated;
GRANT EXECUTE ON FUNCTION check_deadline_and_complete() TO authenticated;
GRANT EXECUTE ON FUNCTION expire_competitions_past_deadline() TO authenticated;

-- ============================================
-- RUN INITIAL CLEANUP
-- ============================================
-- Complete any competitions that are already past their deadline
SELECT expire_competitions_past_deadline();

-- ============================================
-- VERIFICATION
-- ============================================
DO $$
DECLARE
  trigger_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO trigger_count
  FROM information_schema.triggers
  WHERE trigger_name IN (
    'trigger_mark_scheduled_deleted',
    'trigger_check_all_matches_completed',
    'trigger_check_deadline'
  );
  
  IF trigger_count = 3 THEN
    RAISE NOTICE '✅ All 3 auto-completion triggers are active';
  ELSE
    RAISE WARNING '⚠️ Expected 3 triggers, found %', trigger_count;
  END IF;
END $$;
