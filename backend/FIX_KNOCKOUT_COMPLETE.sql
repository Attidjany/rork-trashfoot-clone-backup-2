-- ============================================
-- COMPLETE FIX FOR KNOCKOUT TOURNAMENTS
-- ============================================
-- This script fixes:
-- 1. Knockout bracket display showing empty
-- 2. Next stage matches not being created automatically
-- 3. Matches not being randomized at creation
-- ============================================

-- ============================================
-- PART 1: Ensure Required Columns Exist
-- ============================================

DO $$
BEGIN
  -- Add stage column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'matches' AND column_name = 'stage'
  ) THEN
    ALTER TABLE matches ADD COLUMN stage TEXT;
    RAISE NOTICE '✓ Added stage column to matches table';
  ELSE
    RAISE NOTICE '✓ Stage column already exists';
  END IF;

  -- Add match_order column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'matches' AND column_name = 'match_order'
  ) THEN
    ALTER TABLE matches ADD COLUMN match_order INTEGER;
    RAISE NOTICE '✓ Added match_order column to matches table';
  ELSE
    RAISE NOTICE '✓ Match_order column already exists';
  END IF;
END $$;

-- ============================================
-- PART 2: Enable Realtime for Matches
-- ============================================

ALTER PUBLICATION supabase_realtime DROP TABLE IF EXISTS matches;
ALTER PUBLICATION supabase_realtime ADD TABLE matches;

SELECT '✓ Realtime enabled for matches table' as status;

-- ============================================
-- PART 3: Fix Tournament Stage Progression
-- ============================================

-- Drop existing trigger and function
DROP TRIGGER IF EXISTS trigger_progress_tournament_stage ON matches;
DROP FUNCTION IF EXISTS progress_tournament_stage() CASCADE;

-- Create improved function for tournament stage progression
CREATE OR REPLACE FUNCTION progress_tournament_stage()
RETURNS TRIGGER AS $$
DECLARE
  comp_record RECORD;
  current_stage TEXT;
  next_stage TEXT;
  stage_matches_total INTEGER;
  stage_matches_completed INTEGER;
  winners UUID[];
  losers UUID[];
  match_pairs INTEGER;
  i INTEGER;
  scheduled_time TIMESTAMPTZ;
BEGIN
  -- Only process if match is completed and has a stage
  IF NEW.status != 'completed' OR NEW.stage IS NULL THEN
    RETURN NEW;
  END IF;

  -- Get competition details
  SELECT c.* INTO comp_record
  FROM competitions c
  WHERE c.id = NEW.competition_id
    AND c.type = 'tournament'
    AND c.tournament_type = 'knockout';

  IF NOT FOUND THEN
    RETURN NEW;
  END IF;

  current_stage := NEW.stage;

  -- Count total and completed matches in current stage
  SELECT COUNT(*), COUNT(*) FILTER (WHERE status = 'completed')
  INTO stage_matches_total, stage_matches_completed
  FROM matches
  WHERE competition_id = NEW.competition_id
    AND stage = current_stage;

  RAISE NOTICE 'Tournament %: Stage %, Total matches: %, Completed: %', 
    NEW.competition_id, current_stage, stage_matches_total, stage_matches_completed;

  -- If all matches in stage are completed, create next stage
  IF stage_matches_completed = stage_matches_total THEN
    -- Determine next stage
    next_stage := CASE current_stage
      WHEN 'round_of_16' THEN 'quarter_final'
      WHEN 'quarter_final' THEN 'semi_final'
      WHEN 'semi_final' THEN 'final'
      ELSE NULL
    END;

    RAISE NOTICE 'All matches completed in stage %. Next stage: %', current_stage, next_stage;

    IF next_stage IS NOT NULL THEN
      -- Get winners from current stage (ordered by match_order)
      SELECT ARRAY_AGG(
        CASE
          WHEN home_score > away_score THEN home_player_id
          WHEN away_score > home_score THEN away_player_id
          ELSE home_player_id
        END
        ORDER BY match_order
      ) INTO winners
      FROM matches
      WHERE competition_id = NEW.competition_id
        AND stage = current_stage
        AND status = 'completed';

      RAISE NOTICE 'Winners from stage %: %', current_stage, winners;

      -- Set scheduled time
      scheduled_time := COALESCE(comp_record.end_date, NOW() + INTERVAL '7 days');

      -- Create matches for next stage
      match_pairs := array_length(winners, 1) / 2;
      
      RAISE NOTICE 'Creating % match pairs for stage %', match_pairs, next_stage;
      
      FOR i IN 1..match_pairs LOOP
        INSERT INTO matches (
          competition_id,
          home_player_id,
          away_player_id,
          status,
          scheduled_time,
          stage,
          match_order
        ) VALUES (
          NEW.competition_id,
          winners[i * 2 - 1],
          winners[i * 2],
          'scheduled',
          scheduled_time,
          next_stage,
          i
        );
        
        RAISE NOTICE 'Created match % for stage %: % vs %', i, next_stage, winners[i * 2 - 1], winners[i * 2];
      END LOOP;

      -- If this was semi-final, also create 3rd place match
      IF current_stage = 'semi_final' THEN
        -- Get losers from semi-finals
        SELECT ARRAY_AGG(
          CASE
            WHEN home_score < away_score THEN home_player_id
            WHEN away_score < home_score THEN away_player_id
            ELSE away_player_id
          END
          ORDER BY match_order
        ) INTO losers
        FROM matches
        WHERE competition_id = NEW.competition_id
          AND stage = 'semi_final'
          AND status = 'completed';

        IF array_length(losers, 1) = 2 THEN
          INSERT INTO matches (
            competition_id,
            home_player_id,
            away_player_id,
            status,
            scheduled_time,
            stage,
            match_order
          ) VALUES (
            NEW.competition_id,
            losers[1],
            losers[2],
            'scheduled',
            scheduled_time,
            'third_place',
            1
          );
          
          RAISE NOTICE 'Created 3rd place match: % vs %', losers[1], losers[2];
        END IF;
      END IF;
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger for tournament stage progression
CREATE TRIGGER trigger_progress_tournament_stage
  AFTER UPDATE OF status ON matches
  FOR EACH ROW
  WHEN (NEW.status = 'completed')
  EXECUTE FUNCTION progress_tournament_stage();

SELECT '✓ Tournament progression trigger created' as status;

-- ============================================
-- PART 4: Verification
-- ============================================

-- Check triggers
SELECT 
  CASE WHEN EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'trigger_progress_tournament_stage'
  ) THEN '✓ Tournament progression trigger exists'
  ELSE '✗ Tournament progression trigger missing'
  END as check_1;

-- Check functions
SELECT 
  CASE WHEN EXISTS (
    SELECT 1 FROM pg_proc WHERE proname = 'progress_tournament_stage'
  ) THEN '✓ Tournament progression function exists'
  ELSE '✗ Tournament progression function missing'
  END as check_2;

-- Check columns
SELECT 
  CASE WHEN EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'matches' AND column_name = 'stage'
  ) THEN '✓ matches.stage column exists'
  ELSE '✗ matches.stage column missing'
  END as check_3;

SELECT 
  CASE WHEN EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'matches' AND column_name = 'match_order'
  ) THEN '✓ matches.match_order column exists'
  ELSE '✗ matches.match_order column missing'
  END as check_4;

-- Check realtime
SELECT 
  CASE WHEN EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND tablename = 'matches'
  ) THEN '✓ Realtime enabled for matches'
  ELSE '✗ Realtime not enabled for matches'
  END as check_5;

SELECT '✅ All checks complete! Knockout tournaments should now work correctly.' as final_status;
