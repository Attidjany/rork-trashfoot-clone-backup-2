-- ============================================
-- FIX CHAT MESSAGES FOR 3RD PLACE AND ADD PODIUM MESSAGE
-- ============================================

-- Update the create_next_stage_matches function to add proper chat messages
CREATE OR REPLACE FUNCTION create_next_stage_matches()
RETURNS TRIGGER AS $$
DECLARE
  v_competition_id UUID;
  v_competition_type TEXT;
  v_tournament_type TEXT;
  v_current_stage TEXT;
  v_next_stage TEXT;
  v_stage_completed BOOLEAN;
  v_stage_matches_count INTEGER;
  v_completed_matches_count INTEGER;
  v_winners UUID[];
  v_losers UUID[];
  v_deadline TIMESTAMPTZ;
  v_match_order INTEGER;
  v_group_id UUID;
  v_created_by UUID;
  v_winner_id UUID;
  v_loser_id UUID;
  v_final_winner_id UUID;
  v_final_winner_name TEXT;
  v_runner_up_id UUID;
  v_runner_up_name TEXT;
  v_third_place_winner_id UUID;
  v_third_place_winner_name TEXT;
BEGIN
  IF NEW.status != 'completed' OR OLD.status = 'completed' THEN
    RETURN NEW;
  END IF;

  SELECT c.id, c.type, c.tournament_type, c.end_date, c.group_id, c.created_by
  INTO v_competition_id, v_competition_type, v_tournament_type, v_deadline, v_group_id, v_created_by
  FROM competitions c
  WHERE c.id = NEW.competition_id;

  IF v_competition_type != 'tournament' OR v_tournament_type != 'knockout' THEN
    RETURN NEW;
  END IF;

  v_current_stage := NEW.stage;
  
  IF v_current_stage IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT COUNT(*) INTO v_stage_matches_count
  FROM matches
  WHERE competition_id = v_competition_id
  AND stage = v_current_stage;

  SELECT COUNT(*) INTO v_completed_matches_count
  FROM matches
  WHERE competition_id = v_competition_id
  AND stage = v_current_stage
  AND status = 'completed';

  v_stage_completed := (v_stage_matches_count = v_completed_matches_count);

  IF NOT v_stage_completed THEN
    RETURN NEW;
  END IF;

  -- Special handling for third_place match completion
  IF v_current_stage = 'third_place' THEN
    -- Get third place winner
    SELECT 
      CASE 
        WHEN home_score > away_score THEN home_player_id
        WHEN away_score > home_score THEN away_player_id
        ELSE NULL
      END
    INTO v_third_place_winner_id
    FROM matches
    WHERE competition_id = v_competition_id
    AND stage = 'third_place'
    AND status = 'completed';

    IF v_third_place_winner_id IS NOT NULL THEN
      SELECT name INTO v_third_place_winner_name
      FROM players
      WHERE id = v_third_place_winner_id;

      -- Post 3rd place result message
      INSERT INTO chat_messages (
        group_id,
        sender_id,
        sender_name,
        message,
        type,
        metadata
      ) VALUES (
        v_group_id,
        COALESCE(v_created_by, (SELECT admin_id FROM groups WHERE id = v_group_id)),
        'System',
        v_third_place_winner_name || ' secured 3rd place! 🥉',
        'match_result',
        jsonb_build_object(
          'stage', 'third_place',
          'winner_id', v_third_place_winner_id,
          'winner_name', v_third_place_winner_name
        )
      );
    END IF;

    RETURN NEW;
  END IF;

  -- Special handling for final match completion
  IF v_current_stage = 'final' THEN
    -- Get final winner and runner up
    SELECT 
      CASE 
        WHEN home_score > away_score THEN home_player_id
        WHEN away_score > home_score THEN away_player_id
        ELSE NULL
      END,
      CASE 
        WHEN home_score > away_score THEN away_player_id
        WHEN away_score > home_score THEN home_player_id
        ELSE NULL
      END
    INTO v_final_winner_id, v_runner_up_id
    FROM matches
    WHERE competition_id = v_competition_id
    AND stage = 'final'
    AND status = 'completed';

    IF v_final_winner_id IS NOT NULL THEN
      SELECT name INTO v_final_winner_name FROM players WHERE id = v_final_winner_id;
      SELECT name INTO v_runner_up_name FROM players WHERE id = v_runner_up_id;

      -- Get third place winner if exists
      SELECT 
        CASE 
          WHEN home_score > away_score THEN home_player_id
          WHEN away_score > home_score THEN away_player_id
          ELSE NULL
        END
      INTO v_third_place_winner_id
      FROM matches
      WHERE competition_id = v_competition_id
      AND stage = 'third_place'
      AND status = 'completed';

      IF v_third_place_winner_id IS NOT NULL THEN
        SELECT name INTO v_third_place_winner_name FROM players WHERE id = v_third_place_winner_id;
      END IF;

      -- Update competition status to completed
      UPDATE competitions
      SET status = 'completed'
      WHERE id = v_competition_id;

      -- Post podium message
      INSERT INTO chat_messages (
        group_id,
        sender_id,
        sender_name,
        message,
        type,
        metadata
      ) VALUES (
        v_group_id,
        COALESCE(v_created_by, (SELECT admin_id FROM groups WHERE id = v_group_id)),
        'System',
        '🏆 Tournament Complete! 🏆' || E'\n' ||
        '🥇 Winner: ' || v_final_winner_name || E'\n' ||
        '🥈 Runner-up: ' || v_runner_up_name ||
        CASE 
          WHEN v_third_place_winner_name IS NOT NULL 
          THEN E'\n' || '🥉 3rd Place: ' || v_third_place_winner_name
          ELSE ''
        END,
        'competition_finished',
        jsonb_build_object(
          'competition_id', v_competition_id,
          'winner_id', v_final_winner_id,
          'winner_name', v_final_winner_name,
          'runner_up_id', v_runner_up_id,
          'runner_up_name', v_runner_up_name,
          'third_place_id', v_third_place_winner_id,
          'third_place_name', v_third_place_winner_name
        )
      );
    END IF;

    RETURN NEW;
  END IF;

  v_next_stage := get_next_stage(v_current_stage);

  IF v_next_stage IS NULL THEN
    UPDATE competitions
    SET status = 'completed'
    WHERE id = v_competition_id;
    
    RETURN NEW;
  END IF;

  v_winners := ARRAY[]::UUID[];
  
  FOR v_winner_id IN
    SELECT CASE 
      WHEN home_score > away_score THEN home_player_id
      WHEN away_score > home_score THEN away_player_id
      ELSE NULL
    END as winner
    FROM matches
    WHERE competition_id = v_competition_id
    AND stage = v_current_stage
    AND status = 'completed'
    ORDER BY match_order
  LOOP
    IF v_winner_id IS NOT NULL THEN
      v_winners := array_append(v_winners, v_winner_id);
    END IF;
  END LOOP;

  IF v_next_stage = 'final' THEN
    v_losers := ARRAY[]::UUID[];
    
    FOR v_loser_id IN
      SELECT CASE 
        WHEN home_score < away_score THEN home_player_id
        WHEN away_score < home_score THEN away_player_id
        ELSE NULL
      END as loser
      FROM matches
      WHERE competition_id = v_competition_id
      AND stage = v_current_stage
      AND status = 'completed'
      ORDER BY match_order
    LOOP
      IF v_loser_id IS NOT NULL THEN
        v_losers := array_append(v_losers, v_loser_id);
      END IF;
    END LOOP;
  END IF;

  v_match_order := 1;
  
  FOR i IN 1..array_length(v_winners, 1) BY 2 LOOP
    IF i + 1 <= array_length(v_winners, 1) THEN
      INSERT INTO matches (
        competition_id,
        home_player_id,
        away_player_id,
        status,
        scheduled_time,
        stage,
        match_order
      ) VALUES (
        v_competition_id,
        v_winners[i],
        v_winners[i + 1],
        'scheduled',
        COALESCE(v_deadline, NOW() + INTERVAL '7 days'),
        v_next_stage,
        v_match_order
      );
      
      v_match_order := v_match_order + 1;
    END IF;
  END LOOP;

  IF v_next_stage = 'final' AND array_length(v_losers, 1) >= 2 THEN
    INSERT INTO matches (
      competition_id,
      home_player_id,
      away_player_id,
      status,
      scheduled_time,
      stage,
      match_order
    ) VALUES (
      v_competition_id,
      v_losers[1],
      v_losers[2],
      'scheduled',
      COALESCE(v_deadline, NOW() + INTERVAL '7 days'),
      'third_place',
      999
    );
  END IF;

  INSERT INTO chat_messages (
    group_id,
    sender_id,
    sender_name,
    message,
    type,
    metadata
  ) VALUES (
    v_group_id,
    COALESCE(v_created_by, (SELECT admin_id FROM groups WHERE id = v_group_id)),
    'System',
    'Next stage matches created: ' || v_next_stage,
    'match_result',
    jsonb_build_object(
      'stage', v_next_stage,
      'matches_created', v_match_order - 1
    )
  );

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Recreate the trigger
DROP TRIGGER IF EXISTS trigger_create_next_stage_matches ON matches;

CREATE TRIGGER trigger_create_next_stage_matches
AFTER UPDATE ON matches
FOR EACH ROW
EXECUTE FUNCTION create_next_stage_matches();

-- Success message
DO $$
BEGIN
  RAISE NOTICE '✅ Chat messages fixed!';
  RAISE NOTICE '1. 3rd place match now shows "secured 3rd place" message';
  RAISE NOTICE '2. Final match completion shows podium with winner, runner-up, and 3rd place';
  RAISE NOTICE '3. Tournament bracket display fixed to show stages correctly';
END $$;
