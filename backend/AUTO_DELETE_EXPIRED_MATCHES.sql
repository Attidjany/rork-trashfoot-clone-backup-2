-- Create function to automatically delete expired matches and mark competitions as completed
-- This runs automatically when deadline is reached

CREATE OR REPLACE FUNCTION check_and_complete_expired_competitions()
RETURNS TRIGGER AS $$
DECLARE
  competition_record RECORD;
  match_deadline TIMESTAMP;
  comp_deadline TIMESTAMP;
BEGIN
  -- For match updates or inserts, check the associated competition
  IF TG_TABLE_NAME = 'matches' THEN
    SELECT c.* INTO competition_record
    FROM competitions c
    WHERE c.id = NEW.competition_id;
    
    -- Calculate the deadline for the competition
    IF competition_record.deadline_days IS NOT NULL THEN
      comp_deadline := competition_record.start_date + (competition_record.deadline_days || ' days')::INTERVAL;
      
      -- If deadline has passed and competition is not completed
      IF comp_deadline < NOW() AND competition_record.status IN ('upcoming', 'active') THEN
        -- Delete all scheduled matches for this competition
        DELETE FROM matches 
        WHERE competition_id = competition_record.id 
        AND status = 'scheduled';
        
        -- Mark competition as completed
        UPDATE competitions 
        SET 
          status = 'completed',
          end_date = NOW()
        WHERE id = competition_record.id;
        
        -- Insert chat message about competition expiration
        INSERT INTO chat_messages (competition_id, message_text, message_type)
        VALUES (
          competition_record.id,
          'Competition deadline reached. All pending matches have been removed.',
          'system'
        );
        
        RAISE NOTICE 'Competition % expired and marked as completed', competition_record.name;
      END IF;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop existing trigger if it exists
DROP TRIGGER IF EXISTS check_expired_competitions_on_match ON matches;

-- Create trigger that runs on match operations
CREATE TRIGGER check_expired_competitions_on_match
AFTER INSERT OR UPDATE ON matches
FOR EACH ROW
EXECUTE FUNCTION check_and_complete_expired_competitions();

-- Create a scheduled check function that can be called periodically
CREATE OR REPLACE FUNCTION cleanup_all_expired_competitions()
RETURNS TABLE (
  competition_id UUID,
  competition_name TEXT,
  deleted_matches_count INTEGER
) AS $$
DECLARE
  comp_record RECORD;
  comp_deadline TIMESTAMP;
  deleted_count INTEGER;
BEGIN
  FOR comp_record IN 
    SELECT c.*
    FROM competitions c
    WHERE 
      c.deadline_days IS NOT NULL
      AND c.status IN ('upcoming', 'active')
  LOOP
    comp_deadline := comp_record.start_date + (comp_record.deadline_days || ' days')::INTERVAL;
    
    IF comp_deadline < NOW() THEN
      -- Delete all scheduled matches
      DELETE FROM matches
      WHERE 
        competition_id = comp_record.id
        AND status = 'scheduled';
      
      GET DIAGNOSTICS deleted_count = ROW_COUNT;
      
      -- Mark competition as completed
      UPDATE competitions
      SET 
        status = 'completed',
        end_date = NOW()
      WHERE id = comp_record.id;
      
      -- Insert chat message
      INSERT INTO chat_messages (competition_id, message_text, message_type)
      VALUES (
        comp_record.id,
        'Competition deadline reached. All pending matches have been removed.',
        'system'
      );
      
      -- Return result
      competition_id := comp_record.id;
      competition_name := comp_record.name;
      deleted_matches_count := deleted_count;
      
      RETURN NEXT;
      
      RAISE NOTICE 'Cleaned up competition %: deleted % matches', comp_record.name, deleted_count;
    END IF;
  END LOOP;
  
  RETURN;
END;
$$ LANGUAGE plpgsql;

-- To manually trigger cleanup, run:
-- SELECT * FROM cleanup_all_expired_competitions();

-- To set up automatic cleanup (if pg_cron is available):
-- SELECT cron.schedule('cleanup-expired-competitions', '*/5 * * * *', 'SELECT cleanup_all_expired_competitions()');
-- This runs every 5 minutes
