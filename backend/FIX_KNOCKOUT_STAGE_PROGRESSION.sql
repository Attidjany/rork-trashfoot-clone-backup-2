-- Fix Knockout Tournament Stage Progression
-- This script ensures automatic creation of next stage matches when all matches in current stage are completed

-- 1. Drop existing trigger and function to recreate them
DROP TRIGGER IF EXISTS trigger_progress_tournament_stage ON matches;
DROP FUNCTION IF EXISTS progress_tournament_stage();

-- 2. Create improved function to progress tournament stages
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

  RAISE NOTICE 'Stage: %, Total: %, Completed: %', current_stage, stage_matches_total, stage_matches_completed;

  -- If all matches in stage are completed, create next stage
  IF stage_matches_completed = stage_matches_total THEN
    -- Determine next stage
    next_stage := CASE current_stage
      WHEN 'round_of_16' THEN 'quarter_final'
      WHEN 'quarter_final' THEN 'semi_final'
      WHEN 'semi_final' THEN 'final'
      ELSE NULL
    END;

    RAISE NOTICE 'Next stage: %', next_stage;

    IF next_stage IS NOT NULL THEN
      -- Get winners from current stage (ordered by match_order)
      SELECT ARRAY_AGG(
        CASE
          WHEN home_score > away_score THEN home_player_id
          WHEN away_score > home_score THEN away_player_id
          ELSE home_player_id -- In case of draw, home wins (should create rematch in production)
        END
        ORDER BY match_order
      ) INTO winners
      FROM matches
      WHERE competition_id = NEW.competition_id
        AND stage = current_stage
        AND status = 'completed';

      RAISE NOTICE 'Winners: %', winners;

      -- Set scheduled time
      scheduled_time := COALESCE(comp_record.end_date, NOW() + INTERVAL '7 days');

      -- Create matches for next stage
      match_pairs := array_length(winners, 1) / 2;
      
      RAISE NOTICE 'Creating % match pairs for next stage', match_pairs;
      
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

-- 3. Create trigger for tournament stage progression
CREATE TRIGGER trigger_progress_tournament_stage
  AFTER UPDATE OF status ON matches
  FOR EACH ROW
  WHEN (NEW.status = 'completed')
  EXECUTE FUNCTION progress_tournament_stage();

-- 4. Verify setup
SELECT 'Setup complete!' as status;

-- Check if trigger exists
SELECT 
  CASE WHEN EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'trigger_progress_tournament_stage'
  ) THEN '✓ Tournament progression trigger exists'
  ELSE '✗ Tournament progression trigger missing'
  END as check_trigger;

-- Check if function exists
SELECT 
  CASE WHEN EXISTS (
    SELECT 1 FROM pg_proc WHERE proname = 'progress_tournament_stage'
  ) THEN '✓ Tournament progression function exists'
  ELSE '✗ Tournament progression function missing'
  END as check_function;
