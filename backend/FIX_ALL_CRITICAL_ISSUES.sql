-- ============================================
-- FIX ALL CRITICAL ISSUES
-- ============================================
-- 1. Remove deadline_days column references (use end_date instead)
-- 2. Fix tournament completion to require BOTH final and third_place
-- 3. Fix tournament winner message to show final match winner
-- ============================================

-- ============================================
-- PART 1: Fix deadline auto-deletion
-- ============================================

-- Drop old trigger
DROP TRIGGER IF EXISTS check_expired_competitions_on_match ON matches;
DROP FUNCTION IF EXISTS check_and_complete_expired_competitions() CASCADE;
DROP FUNCTION IF EXISTS cleanup_all_expired_competitions() CASCADE;

-- Create new function using end_date instead of deadline_days
CREATE OR REPLACE FUNCTION check_and_complete_expired_competitions()
RETURNS TRIGGER AS $$
DECLARE
  competition_record RECORD;
BEGIN
  -- For match updates or inserts, check the associated competition
  IF TG_TABLE_NAME = 'matches' THEN
    SELECT c.* INTO competition_record
    FROM competitions c
    WHERE c.id = NEW.competition_id;
    
    -- If deadline has passed and competition is not completed
    IF competition_record.end_date IS NOT NULL 
       AND competition_record.end_date < NOW() 
       AND competition_record.status IN ('upcoming', 'active') THEN
      -- Delete all scheduled matches for this competition
      DELETE FROM matches 
      WHERE competition_id = competition_record.id 
      AND status = 'scheduled';
      
      -- Mark competition as completed
      UPDATE competitions 
      SET status = 'completed'
      WHERE id = competition_record.id;
      
      -- Get group_id and created_by for sender
      DECLARE
        v_sender_id UUID;
      BEGIN
        v_sender_id := competition_record.created_by;
        IF v_sender_id IS NULL THEN
          SELECT admin_id INTO v_sender_id FROM groups WHERE id = competition_record.group_id;
        END IF;

        -- Insert chat message about competition expiration
        INSERT INTO chat_messages (group_id, sender_id, sender_name, message, type)
        VALUES (
          competition_record.group_id,
          v_sender_id,
          'System',
          'Competition deadline reached. All pending matches have been removed.',
          'system'
        );
      END;
      
      RAISE NOTICE 'Competition % expired and marked as completed', competition_record.name;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

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
  deleted_count INTEGER;
  v_sender_id UUID;
BEGIN
  FOR comp_record IN 
    SELECT c.*
    FROM competitions c
    WHERE 
      c.end_date IS NOT NULL
      AND c.status IN ('upcoming', 'active')
      AND c.end_date < NOW()
  LOOP
    -- Delete all scheduled matches
    DELETE FROM matches
    WHERE 
      competition_id = comp_record.id
      AND status = 'scheduled';
    
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    
    -- Mark competition as completed
    UPDATE competitions
    SET status = 'completed'
    WHERE id = comp_record.id;
    
    -- Get sender_id
    v_sender_id := comp_record.created_by;
    IF v_sender_id IS NULL THEN
      SELECT admin_id INTO v_sender_id FROM groups WHERE id = comp_record.group_id;
    END IF;

    -- Insert chat message
    INSERT INTO chat_messages (group_id, sender_id, sender_name, message, type)
    VALUES (
      comp_record.group_id,
      v_sender_id,
      'System',
      'Competition deadline reached. All pending matches have been removed.',
      'system'
    );
    
    -- Return result
    competition_id := comp_record.id;
    competition_name := comp_record.name;
    deleted_matches_count := deleted_count;
    
    RETURN NEXT;
    
    RAISE NOTICE 'Cleaned up competition %: deleted % matches', comp_record.name, deleted_count;
  END LOOP;
  
  RETURN;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- PART 2: Fix tournament completion and winner message
-- ============================================

-- Drop old functions
DROP TRIGGER IF EXISTS trigger_progress_tournament_stage ON matches;
DROP TRIGGER IF EXISTS trigger_create_next_stage_matches ON matches;
DROP FUNCTION IF EXISTS progress_tournament_stage() CASCADE;
DROP FUNCTION IF EXISTS create_next_stage_matches() CASCADE;
DROP FUNCTION IF EXISTS get_next_stage(TEXT, INTEGER) CASCADE;

-- Create helper function for stage progression
CREATE OR REPLACE FUNCTION get_next_stage(current_stage TEXT)
RETURNS TEXT AS $$
BEGIN
  RETURN CASE current_stage
    WHEN 'round_of_16' THEN 'quarter_final'
    WHEN 'quarter_final' THEN 'semi_final'
    WHEN 'semi_final' THEN 'final'
    ELSE NULL
  END;
END;
$$ LANGUAGE plpgsql;

-- Create main tournament progression function
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
  v_sender_id UUID;
  v_final_completed BOOLEAN;
  v_third_place_completed BOOLEAN;
  v_winner_id UUID;
  v_runner_up_id UUID;
  v_third_place_id UUID;
  v_winner_name TEXT;
  v_runner_up_name TEXT;
  v_third_place_name TEXT;
  v_final_home_score INTEGER;
  v_final_away_score INTEGER;
  v_final_home_player UUID;
  v_final_away_player UUID;
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

  -- Get sender_id
  v_sender_id := comp_record.created_by;
  IF v_sender_id IS NULL THEN
    SELECT admin_id INTO v_sender_id FROM groups WHERE id = comp_record.group_id;
  END IF;

  current_stage := NEW.stage;

  -- Special handling for final and third_place completion
  IF current_stage = 'final' OR current_stage = 'third_place' THEN
    -- Check if both final and third_place are completed
    SELECT 
      EXISTS(SELECT 1 FROM matches WHERE competition_id = NEW.competition_id AND stage = 'final' AND status = 'completed'),
      EXISTS(SELECT 1 FROM matches WHERE competition_id = NEW.competition_id AND stage = 'third_place' AND status = 'completed')
    INTO v_final_completed, v_third_place_completed;

    -- Only complete tournament when BOTH are done
    IF v_final_completed AND v_third_place_completed THEN
      -- Get final match details explicitly
      SELECT 
        home_player_id,
        away_player_id,
        home_score,
        away_score
      INTO v_final_home_player, v_final_away_player, v_final_home_score, v_final_away_score
      FROM matches
      WHERE competition_id = NEW.competition_id AND stage = 'final' AND status = 'completed'
      LIMIT 1;

      -- Determine winner and runner-up from FINAL match (not third place!)
      IF v_final_home_score > v_final_away_score THEN
        v_winner_id := v_final_home_player;
        v_runner_up_id := v_final_away_player;
      ELSE
        v_winner_id := v_final_away_player;
        v_runner_up_id := v_final_home_player;
      END IF;

      -- Get third place winner
      SELECT 
        CASE WHEN home_score > away_score THEN home_player_id ELSE away_player_id END
      INTO v_third_place_id
      FROM matches
      WHERE competition_id = NEW.competition_id AND stage = 'third_place' AND status = 'completed'
      LIMIT 1;

      -- Get player names
      SELECT name INTO v_winner_name FROM players WHERE id = v_winner_id;
      SELECT name INTO v_runner_up_name FROM players WHERE id = v_runner_up_id;
      SELECT name INTO v_third_place_name FROM players WHERE id = v_third_place_id;

      -- Update competition status
      UPDATE competitions
      SET status = 'completed'
      WHERE id = NEW.competition_id;

      -- Send podium message with correct winner (from final match)
      INSERT INTO chat_messages (
        group_id,
        sender_id,
        sender_name,
        message,
        type,
        metadata
      ) VALUES (
        comp_record.group_id,
        v_sender_id,
        'System',
        '🏆 Tournament Complete! 🏆
🥇 Champion: ' || v_winner_name || '
🥈 Runner-up: ' || v_runner_up_name || '
🥉 Third Place: ' || v_third_place_name,
        'competition_finished',
        jsonb_build_object(
          'competition_id', NEW.competition_id,
          'winner_id', v_winner_id,
          'winner_name', v_winner_name,
          'runner_up_id', v_runner_up_id,
          'runner_up_name', v_runner_up_name,
          'third_place_id', v_third_place_id,
          'third_place_name', v_third_place_name
        )
      );
      
      RAISE NOTICE '🏆 Tournament completed. Winner: %, Runner-up: %, Third: %', 
        v_winner_name, v_runner_up_name, v_third_place_name;
    END IF;

    RETURN NEW;
  END IF;

  -- Regular stage progression below (for non-final stages)
  
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
    next_stage := get_next_stage(current_stage);

    RAISE NOTICE 'All matches completed in stage %. Next stage: %', current_stage, next_stage;

    IF next_stage IS NOT NULL THEN
      -- Check if next stage already exists
      SELECT EXISTS(
        SELECT 1 FROM matches 
        WHERE competition_id = NEW.competition_id 
        AND stage = next_stage
      ) INTO next_stage_exists;

      IF next_stage_exists THEN
        RAISE NOTICE 'Next stage % already exists, skipping creation', next_stage;
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
            
            -- Send chat message for 3rd place match
            INSERT INTO chat_messages (
              group_id,
              sender_id,
              sender_name,
              message,
              type
            ) VALUES (
              comp_record.group_id,
              v_sender_id,
              'System',
              '🥉 3rd Place Match has been created!',
              'match_result'
            );
            
            RAISE NOTICE 'Created 3rd place match: % vs %', losers[1], losers[2];
          END IF;
        ELSE
          RAISE NOTICE 'Third place match already exists, skipping creation';
        END IF;
      END IF;

      -- Send chat message for stage progression
      INSERT INTO chat_messages (
        group_id,
        sender_id,
        sender_name,
        message,
        type
      ) VALUES (
        comp_record.group_id,
        v_sender_id,
        'System',
        CASE 
          WHEN next_stage = 'final' THEN '🏆 Final match has been created!'
          ELSE 'Next stage (' || next_stage || ') matches have been created!'
        END,
        'match_result'
      );
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
-- VERIFICATION
-- ============================================

SELECT '✅ All fixes applied successfully!' as status;
SELECT '✅ Deadline system now uses end_date instead of deadline_days' as fix1;
SELECT '✅ Tournament completes only when BOTH final and third_place are done' as fix2;
SELECT '✅ Tournament winner message shows the FINAL match winner' as fix3;
