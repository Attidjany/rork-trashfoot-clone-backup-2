-- Function to clean up expired matches and mark competitions as completed
-- This should be run periodically (e.g., daily via a cron job)

CREATE OR REPLACE FUNCTION cleanup_expired_competitions()
RETURNS TABLE (
  competition_id UUID,
  deleted_matches_count INTEGER,
  competition_name TEXT
) AS $$
DECLARE
  comp_record RECORD;
  deleted_count INTEGER;
BEGIN
  FOR comp_record IN 
    SELECT 
      c.id,
      c.name,
      c.start_date,
      c.deadline_days,
      c.status
    FROM competitions c
    WHERE 
      c.deadline_days IS NOT NULL
      AND c.status IN ('upcoming', 'active')
      AND (c.start_date + (c.deadline_days || ' days')::INTERVAL) < NOW()
  LOOP
    DELETE FROM matches
    WHERE 
      competition_id = comp_record.id
      AND status = 'scheduled';
    
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    
    UPDATE competitions
    SET 
      status = 'completed',
      end_date = NOW()
    WHERE id = comp_record.id;
    
    competition_id := comp_record.id;
    deleted_matches_count := deleted_count;
    competition_name := comp_record.name;
    
    RETURN NEXT;
  END LOOP;
  
  RETURN;
END;
$$ LANGUAGE plpgsql;

-- To manually run the cleanup, execute:
-- SELECT * FROM cleanup_expired_competitions();

-- To set up automatic cleanup (requires pg_cron extension):
-- SELECT cron.schedule('cleanup-expired-matches', '0 0 * * *', 'SELECT cleanup_expired_competitions()');
