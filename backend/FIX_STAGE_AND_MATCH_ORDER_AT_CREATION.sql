-- ============================================
-- FIX STAGE AND MATCH_ORDER AT CREATION
-- AND PREVENT DUPLICATE FINALS/THIRD PLACE
-- ============================================

-- Drop existing trigger and function
DROP TRIGGER IF EXISTS trigger_progress_tournament_stage ON matches;
DROP FUNCTION IF EXISTS progress_tournament_stage() CASCADE;

-- Create improved function for tournament stage progression
-- This version prevents duplicate finals and third place matches
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
  next_stage_exists BOOLEAN;
  third_place_exists BOOLEAN;
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

  -- Don't process final or third_place stages (they don't have next stages)
  IF current_stage IN ('final', 'third_place') THEN
    RETURN NEW;
  END IF;

  -- Count total and completed matches in current stage
  SELECT COUNT(*), COUNT(*) FILTER (WHERE status = 'completed')
  INTO stage_matches_total, stage_matches_completed
  FROM matches
  WHERE competition_id = NEW.competition_id
    AND stage = current_stage;

  -- If all matches in stage are completed, create next stage
  IF stage_matches_completed = stage_matches_total THEN
    -- Determine next stage
    next_stage := CASE current_stage
      WHEN 'round_of_32' THEN 'round_of_16'
      WHEN 'round_of_16' THEN 'quarter_final'
      WHEN 'quarter_final' THEN 'semi_final'
      WHEN 'semi_final' THEN 'final'
      ELSE NULL
    END;

    IF next_stage IS NOT NULL THEN
      -- Check if next stage already exists (prevent duplicates)
      SELECT EXISTS(
        SELECT 1 FROM matches 
        WHERE competition_id = NEW.competition_id 
        AND stage = next_stage
      ) INTO next_stage_exists;

      IF next_stage_exists THEN
        RETURN NEW;
      END IF;

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

      -- Set scheduled time
      scheduled_time := COALESCE(comp_record.end_date, NOW() + INTERVAL '7 days');

      -- Create matches for next stage
      match_pairs := array_length(winners, 1) / 2;
      
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
      END LOOP;

      -- If this was semi-final, also create 3rd place match (only once)
      IF current_stage = 'semi_final' THEN
        -- Check if third place match already exists
        SELECT EXISTS(
          SELECT 1 FROM matches 
          WHERE competition_id = NEW.competition_id 
          AND stage = 'third_place'
        ) INTO third_place_exists;

        IF NOT third_place_exists THEN
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
          END IF;
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

-- ============================================
-- CLEANUP: Remove duplicate matches if any exist
-- ============================================

-- Find and delete duplicate final matches (keep only the first one by created_at)
WITH duplicate_finals AS (
  SELECT 
    id,
    competition_id,
    ROW_NUMBER() OVER (PARTITION BY competition_id ORDER BY created_at) as rn
  FROM matches
  WHERE stage = 'final'
)
DELETE FROM matches
WHERE id IN (
  SELECT id FROM duplicate_finals WHERE rn > 1
);

-- Find and delete duplicate third place matches (keep only the first one by created_at)
WITH duplicate_third_place AS (
  SELECT 
    id,
    competition_id,
    ROW_NUMBER() OVER (PARTITION BY competition_id ORDER BY created_at) as rn
  FROM matches
  WHERE stage = 'third_place'
)
DELETE FROM matches
WHERE id IN (
  SELECT id FROM duplicate_third_place WHERE rn > 1
);

-- ============================================
-- VERIFICATION
-- ============================================

SELECT '✅ Tournament progression trigger recreated with duplicate prevention' as status;

-- Show all knockout tournament matches with their stages
SELECT 
  c.name as competition_name,
  m.stage,
  m.match_order,
  m.status,
  p1.name as home_player,
  p2.name as away_player,
  m.home_score,
  m.away_score
FROM matches m
JOIN competitions c ON c.id = m.competition_id
LEFT JOIN players p1 ON p1.id = m.home_player_id
LEFT JOIN players p2 ON p2.id = m.away_player_id
WHERE c.type = 'tournament' 
  AND c.tournament_type = 'knockout'
ORDER BY c.name, 
  CASE m.stage
    WHEN 'round_of_32' THEN 1
    WHEN 'round_of_16' THEN 2
    WHEN 'quarter_final' THEN 3
    WHEN 'semi_final' THEN 4
    WHEN 'third_place' THEN 5
    WHEN 'final' THEN 6
    ELSE 7
  END,
  m.match_order;

SELECT '✅ All fixes applied successfully!' as final_status;
