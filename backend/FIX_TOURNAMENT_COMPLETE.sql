-- Complete Fix for Tournament Bracket and Chat Messages
-- This script fixes:
-- 1. Chat message showing 0 participants and 0 matches
-- 2. Tournament bracket being empty
-- 3. Automatic stage progression for knockout tournaments

-- ============================================
-- PART 1: Fix Chat Message Trigger
-- ============================================

-- Drop existing trigger and function
DROP TRIGGER IF EXISTS trigger_notify_competition_created ON competitions;
DROP TRIGGER IF EXISTS competition_created_trigger ON competitions;
DROP FUNCTION IF EXISTS notify_competition_created();
DROP FUNCTION IF EXISTS post_competition_created_event();

-- Create improved function that waits for participants and matches
CREATE OR REPLACE FUNCTION notify_competition_created()
RETURNS TRIGGER AS $$
DECLARE
  participant_count INTEGER;
  participant_names TEXT;
  match_count INTEGER;
  creator_name TEXT;
BEGIN
  -- Wait a moment for participants and matches to be inserted
  PERFORM pg_sleep(0.1);
  
  -- Get participant count
  SELECT COUNT(*) INTO participant_count
  FROM competition_participants
  WHERE competition_id = NEW.id;

  -- Get participant names
  SELECT STRING_AGG(p.name, ', ') INTO participant_names
  FROM competition_participants cp
  JOIN players p ON p.id = cp.player_id
  WHERE cp.competition_id = NEW.id;

  -- Get match count
  SELECT COUNT(*) INTO match_count
  FROM matches
  WHERE competition_id = NEW.id;

  -- Get creator name
  IF NEW.created_by IS NOT NULL THEN
    SELECT name INTO creator_name
    FROM players
    WHERE id = NEW.created_by;
  END IF;

  -- Insert chat message with actual counts
  INSERT INTO chat_messages (group_id, sender_id, sender_name, message, type, metadata)
  VALUES (
    NEW.group_id,
    COALESCE(NEW.created_by, (SELECT player_id FROM group_members WHERE group_id = NEW.group_id LIMIT 1)),
    COALESCE(creator_name, 'System'),
    '🎮 Competition created: ' || NEW.name,
    'competition_created',
    jsonb_build_object(
      'competition_id', NEW.id,
      'competition_name', NEW.name,
      'competition_type', NEW.type,
      'participant_count', participant_count,
      'participant_names', COALESCE(participant_names, 'None'),
      'match_count', match_count,
      'creator_name', COALESCE(creator_name, 'System'),
      'deadline', NEW.end_date
    )
  );

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger that fires when competition status changes to active
CREATE TRIGGER trigger_notify_competition_created
  AFTER UPDATE OF status ON competitions
  FOR EACH ROW
  WHEN (OLD.status = 'upcoming' AND NEW.status = 'active')
  EXECUTE FUNCTION notify_competition_created();

-- ============================================
-- PART 2: Fix Tournament Stage Progression
-- ============================================

-- Drop existing trigger and function
DROP TRIGGER IF EXISTS trigger_progress_tournament_stage ON matches;
DROP FUNCTION IF EXISTS progress_tournament_stage();

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
          ELSE home_player_id
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

-- Create trigger for tournament stage progression
CREATE TRIGGER trigger_progress_tournament_stage
  AFTER UPDATE OF status ON matches
  FOR EACH ROW
  WHEN (NEW.status = 'completed')
  EXECUTE FUNCTION progress_tournament_stage();

-- ============================================
-- PART 3: Verification
-- ============================================

SELECT '✓ Setup complete!' as status;

-- Check triggers
SELECT 
  CASE WHEN EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'trigger_notify_competition_created'
  ) THEN '✓ Competition notification trigger exists'
  ELSE '✗ Competition notification trigger missing'
  END as check_1;

SELECT 
  CASE WHEN EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'trigger_progress_tournament_stage'
  ) THEN '✓ Tournament progression trigger exists'
  ELSE '✗ Tournament progression trigger missing'
  END as check_2;

-- Check functions
SELECT 
  CASE WHEN EXISTS (
    SELECT 1 FROM pg_proc WHERE proname = 'notify_competition_created'
  ) THEN '✓ Competition notification function exists'
  ELSE '✗ Competition notification function missing'
  END as check_3;

SELECT 
  CASE WHEN EXISTS (
    SELECT 1 FROM pg_proc WHERE proname = 'progress_tournament_stage'
  ) THEN '✓ Tournament progression function exists'
  ELSE '✗ Tournament progression function missing'
  END as check_4;
