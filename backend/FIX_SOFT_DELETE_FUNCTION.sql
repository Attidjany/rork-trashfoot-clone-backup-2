-- Fix soft delete implementation by dropping and recreating functions
-- This resolves the "cannot change return type of existing function" error

-- Step 1: Add soft delete column to matches table if not exists
ALTER TABLE public.matches 
ADD COLUMN IF NOT EXISTS deleted_at timestamp with time zone;

-- Step 2: Add index for better query performance
CREATE INDEX IF NOT EXISTS idx_matches_deleted_at ON matches(deleted_at);

-- Step 3: Add comment to explain the column
COMMENT ON COLUMN matches.deleted_at IS 'Timestamp when the match was soft-deleted. NULL means the match is active.';

-- Step 4: Drop existing function to allow return type change
DROP FUNCTION IF EXISTS cleanup_all_expired_competitions();

-- Step 5: Recreate cleanup function with correct return type
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

-- Step 6: Update trigger function to use soft delete
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

-- Step 7: Ensure trigger exists
DROP TRIGGER IF EXISTS check_expired_competitions_on_match ON matches;
CREATE TRIGGER check_expired_competitions_on_match
AFTER INSERT OR UPDATE ON matches
FOR EACH ROW
EXECUTE FUNCTION check_and_complete_expired_competitions();

-- Step 8: Verify the changes
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 
    FROM information_schema.columns 
    WHERE table_name = 'matches' 
    AND column_name = 'deleted_at'
  ) THEN
    RAISE NOTICE '✅ deleted_at column exists on matches table';
  ELSE
    RAISE WARNING '❌ deleted_at column does not exist on matches table';
  END IF;
  
  IF EXISTS (
    SELECT 1 
    FROM pg_indexes 
    WHERE tablename = 'matches' 
    AND indexname = 'idx_matches_deleted_at'
  ) THEN
    RAISE NOTICE '✅ Index idx_matches_deleted_at exists';
  ELSE
    RAISE WARNING '❌ Index idx_matches_deleted_at does not exist';
  END IF;
  
  IF EXISTS (
    SELECT 1 
    FROM pg_proc p
    JOIN pg_namespace n ON p.pronamespace = n.oid
    WHERE n.nspname = 'public'
    AND p.proname = 'cleanup_all_expired_competitions'
  ) THEN
    RAISE NOTICE '✅ Function cleanup_all_expired_competitions exists';
  ELSE
    RAISE WARNING '❌ Function cleanup_all_expired_competitions does not exist';
  END IF;
END $$;

-- Show count of active vs deleted matches
SELECT 
  COUNT(*) FILTER (WHERE deleted_at IS NULL) as active_matches,
  COUNT(*) FILTER (WHERE deleted_at IS NOT NULL) as deleted_matches,
  COUNT(*) as total_matches
FROM matches;
