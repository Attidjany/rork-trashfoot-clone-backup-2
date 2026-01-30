-- ============================================
-- FIX: AUTO-COMPLETE COMPETITIONS AT END_DATE
-- ============================================
-- This fixes the issue where competitions don't auto-complete when end_date passes
-- The previous triggers only fired on match changes, now we add triggers on competitions table

-- ============================================
-- FUNCTION 1: Check competition end_date on any update
-- ============================================
CREATE OR REPLACE FUNCTION check_competition_end_date_on_update()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Check if this competition's end_date has passed and it's still active
  IF NEW.end_date IS NOT NULL 
     AND NEW.end_date < NOW() 
     AND NEW.status IN ('active', 'ongoing') THEN
    
    -- Auto-complete the competition
    NEW.status := 'completed';
    NEW.updated_at := NOW();
    
    RAISE NOTICE '⏰ Competition % auto-completed (end_date passed)', NEW.id;
  END IF;
  
  RETURN NEW;
END;
$$;

-- ============================================
-- FUNCTION 2: Batch check all active competitions for expired end_date
-- ============================================
CREATE OR REPLACE FUNCTION expire_all_competitions_past_end_date()
RETURNS TABLE(competition_id UUID, competition_name TEXT) 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  expired_rec RECORD;
BEGIN
  FOR expired_rec IN 
    SELECT id, name 
    FROM competitions
    WHERE status IN ('active', 'ongoing')
      AND end_date IS NOT NULL
      AND end_date < NOW()
  LOOP
    UPDATE competitions
    SET 
      status = 'completed',
      updated_at = NOW()
    WHERE id = expired_rec.id;
    
    competition_id := expired_rec.id;
    competition_name := expired_rec.name;
    
    RAISE NOTICE '⏰ Competition "%" (%) auto-completed (end_date passed)', expired_rec.name, expired_rec.id;
    
    RETURN NEXT;
  END LOOP;
  
  RETURN;
END;
$$;

-- ============================================
-- DROP AND RECREATE TRIGGER
-- ============================================
DROP TRIGGER IF EXISTS trigger_check_competition_end_date ON competitions;

CREATE TRIGGER trigger_check_competition_end_date
  BEFORE UPDATE ON competitions
  FOR EACH ROW
  EXECUTE FUNCTION check_competition_end_date_on_update();

-- ============================================
-- GRANT PERMISSIONS
-- ============================================
GRANT EXECUTE ON FUNCTION check_competition_end_date_on_update() TO authenticated;
GRANT EXECUTE ON FUNCTION expire_all_competitions_past_end_date() TO authenticated;

-- ============================================
-- RUN INITIAL CLEANUP
-- ============================================
SELECT * FROM expire_all_competitions_past_end_date();

-- ============================================
-- VERIFICATION
-- ============================================
DO $$
DECLARE
  trigger_exists BOOLEAN;
  active_expired INTEGER;
BEGIN
  -- Check if trigger exists
  SELECT EXISTS (
    SELECT 1 
    FROM information_schema.triggers 
    WHERE trigger_name = 'trigger_check_competition_end_date'
  ) INTO trigger_exists;
  
  IF trigger_exists THEN
    RAISE NOTICE '✅ Competition end_date trigger is active';
  ELSE
    RAISE WARNING '⚠️ Competition end_date trigger NOT found';
  END IF;
  
  -- Check for any active competitions past their end_date
  SELECT COUNT(*) INTO active_expired
  FROM competitions
  WHERE status IN ('active', 'ongoing')
    AND end_date IS NOT NULL
    AND end_date < NOW();
  
  IF active_expired > 0 THEN
    RAISE WARNING '⚠️ Still found % active competitions past end_date', active_expired;
  ELSE
    RAISE NOTICE '✅ No active competitions past end_date';
  END IF;
END $$;
