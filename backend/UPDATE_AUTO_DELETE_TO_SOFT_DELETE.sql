-- Update auto-delete expired matches function to use soft delete instead of hard delete

CREATE OR REPLACE FUNCTION check_and_complete_expired_competitions()
RETURNS TRIGGER AS $$
DECLARE
  competition_record RECORD;
  match_deadline TIMESTAMP;
  comp_deadline TIMESTAMP;
BEGIN
  IF TG_TABLE_NAME = 'matches' THEN
    SELECT c.* INTO competition_record
    FROM competitions c
    WHERE c.id = NEW.competition_id;
    
    IF competition_record.deadline_date IS NOT NULL THEN
      IF competition_record.deadline_date < NOW() AND competition_record.status IN ('upcoming', 'active') THEN
        -- Soft delete all scheduled matches for this competition
        UPDATE matches 
        SET deleted_at = NOW()
        WHERE competition_id = competition_record.id 
        AND status = 'scheduled'
        AND deleted_at IS NULL;
        
        UPDATE competitions 
        SET 
          status = 'completed',
          end_date = NOW()
        WHERE id = competition_record.id;
        
        RAISE NOTICE 'Competition % expired and marked as completed', competition_record.name;
      END IF;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION cleanup_all_expired_competitions()
RETURNS TABLE (
  competition_id UUID,
  competition_name TEXT,
  deleted_matches_count INTEGER
) AS $$
DECLARE
  comp_record RECORD;
  deleted_count INTEGER;
BEGIN
  FOR comp_record IN 
    SELECT c.*
    FROM competitions c
    WHERE 
      c.deadline_date IS NOT NULL
      AND c.status IN ('upcoming', 'active')
  LOOP
    IF comp_record.deadline_date < NOW() THEN
      -- Soft delete all scheduled matches
      UPDATE matches
      SET deleted_at = NOW()
      WHERE 
        competition_id = comp_record.id
        AND status = 'scheduled'
        AND deleted_at IS NULL;
      
      GET DIAGNOSTICS deleted_count = ROW_COUNT;
      
      UPDATE competitions
      SET 
        status = 'completed',
        end_date = NOW()
      WHERE id = comp_record.id;
      
      competition_id := comp_record.id;
      competition_name := comp_record.name;
      deleted_matches_count := deleted_count;
      
      RETURN NEXT;
      
      RAISE NOTICE 'Cleaned up competition %: soft deleted % matches', comp_record.name, deleted_count;
    END IF;
  END LOOP;
  
  RETURN;
END;
$$ LANGUAGE plpgsql;
