-- ============================================
-- FIX SOFT DELETE SYSTEM FOR MATCHES
-- ============================================
-- This fixes the soft delete system to work with the existing CHECK constraint
-- that only allows: 'scheduled', 'live', 'completed'
--
-- Strategy:
-- 1. Use deleted_at column for soft deletes (don't change status)
-- 2. Auto-mark scheduled matches when competition completes
-- 3. Auto-complete competitions when all matches are done or end_date passes
-- 4. Cleanup old soft-deleted matches after 7 days

-- ============================================
-- FUNCTION 1: Soft delete scheduled matches when competition completes
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
  IF NEW.status = 'completed' AND (OLD.status IS NULL OR OLD.status != 'completed') THEN
    RAISE NOTICE '🏁 Competition % completed, soft-deleting scheduled matches', NEW.id;
    
    WITH updated AS (
      UPDATE matches
      SET 
        deleted_at = NOW(),
        updated_at = NOW()
      WHERE competition_id = NEW.id
        AND status = 'scheduled'
        AND deleted_at IS NULL
      RETURNING id
    )
    SELECT COUNT(*) INTO updated_count FROM updated;
    
    IF updated_count > 0 THEN
      RAISE NOTICE '✅ Soft-deleted % scheduled matches for competition %', updated_count, NEW.id;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;

-- ============================================
-- FUNCTION 2: Check if all matches completed and auto-complete competition
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
  IF NEW.status = 'completed' AND (OLD.status IS NULL OR OLD.status != 'completed') THEN
    SELECT status INTO comp_status FROM competitions WHERE id = NEW.competition_id;
    
    IF comp_status IN ('active', 'ongoing') THEN
      SELECT COUNT(*) INTO total_matches 
      FROM matches 
      WHERE competition_id = NEW.competition_id 
        AND deleted_at IS NULL;
      
      SELECT COUNT(*) INTO completed_matches 
      FROM matches 
      WHERE competition_id = NEW.competition_id 
        AND status = 'completed'
        AND deleted_at IS NULL;
      
      RAISE NOTICE '📊 Competition %: %/% matches completed', NEW.competition_id, completed_matches, total_matches;
      
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
-- FUNCTION 3: Check end_date and auto-complete expired competitions
-- ============================================
CREATE OR REPLACE FUNCTION check_end_date_and_complete()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF EXISTS (
    SELECT 1 
    FROM competitions 
    WHERE id = NEW.competition_id
      AND status IN ('active', 'ongoing')
      AND end_date IS NOT NULL
      AND end_date < NOW()
  ) THEN
    UPDATE competitions
    SET 
      status = 'completed',
      updated_at = NOW()
    WHERE id = NEW.competition_id;
    
    RAISE NOTICE '⏰ Competition % auto-completed (end_date passed)', NEW.competition_id;
  END IF;
  
  RETURN NEW;
END;
$$;

-- ============================================
-- FUNCTION 4: Expire competitions past end_date
-- ============================================
CREATE OR REPLACE FUNCTION expire_competitions_past_end_date()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  expired_count INTEGER;
BEGIN
  WITH expired AS (
    UPDATE competitions
    SET 
      status = 'completed',
      updated_at = NOW()
    WHERE status IN ('active', 'ongoing')
      AND end_date IS NOT NULL
      AND end_date < NOW()
    RETURNING id
  )
  SELECT COUNT(*) INTO expired_count FROM expired;
  
  IF expired_count > 0 THEN
    RAISE NOTICE '⏰ Auto-completed % expired competitions', expired_count;
  END IF;
END;
$$;

-- ============================================
-- FUNCTION 5: Cleanup old soft-deleted matches (7+ days)
-- ============================================
CREATE OR REPLACE FUNCTION cleanup_old_deleted_matches()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  WITH deleted AS (
    DELETE FROM matches
    WHERE deleted_at IS NOT NULL
      AND deleted_at < NOW() - INTERVAL '7 days'
    RETURNING id
  )
  SELECT COUNT(*) INTO deleted_count FROM deleted;
  
  IF deleted_count > 0 THEN
    RAISE NOTICE '🗑️ Permanently deleted % matches older than 7 days', deleted_count;
  END IF;
END;
$$;

-- ============================================
-- DROP EXISTING TRIGGERS
-- ============================================
DROP TRIGGER IF EXISTS trigger_mark_scheduled_deleted ON competitions;
DROP TRIGGER IF EXISTS trigger_check_all_matches_completed ON matches;
DROP TRIGGER IF EXISTS trigger_check_end_date ON matches;

-- ============================================
-- CREATE TRIGGERS
-- ============================================

CREATE TRIGGER trigger_mark_scheduled_deleted
  AFTER UPDATE ON competitions
  FOR EACH ROW
  EXECUTE FUNCTION mark_scheduled_matches_deleted();

CREATE TRIGGER trigger_check_all_matches_completed
  AFTER INSERT OR UPDATE ON matches
  FOR EACH ROW
  EXECUTE FUNCTION check_competition_all_matches_completed();

CREATE TRIGGER trigger_check_end_date
  AFTER INSERT OR UPDATE ON matches
  FOR EACH ROW
  EXECUTE FUNCTION check_end_date_and_complete();

-- ============================================
-- GRANT PERMISSIONS
-- ============================================
GRANT EXECUTE ON FUNCTION mark_scheduled_matches_deleted() TO authenticated;
GRANT EXECUTE ON FUNCTION check_competition_all_matches_completed() TO authenticated;
GRANT EXECUTE ON FUNCTION check_end_date_and_complete() TO authenticated;
GRANT EXECUTE ON FUNCTION expire_competitions_past_end_date() TO authenticated;
GRANT EXECUTE ON FUNCTION cleanup_old_deleted_matches() TO authenticated;

-- ============================================
-- RUN INITIAL TASKS
-- ============================================
SELECT expire_competitions_past_end_date();
SELECT cleanup_old_deleted_matches();

-- ============================================
-- SUCCESS MESSAGE
-- ============================================
DO $$
BEGIN
  RAISE NOTICE '
╔════════════════════════════════════════════════════════════════╗
║  ✅ SOFT DELETE SYSTEM FIXED                                   ║
╚════════════════════════════════════════════════════════════════╝

Behavior:
  1. ✓ Soft delete uses deleted_at column (status unchanged)
  2. ✓ When competition completes → scheduled matches soft-deleted
  3. ✓ When all matches done → competition auto-completes
  4. ✓ When end_date passes → competition auto-completes
  5. ✓ Soft-deleted matches kept for 7 days, then permanently deleted

Functions available:
  - expire_competitions_past_end_date()
  - cleanup_old_deleted_matches()
';
END $$;
