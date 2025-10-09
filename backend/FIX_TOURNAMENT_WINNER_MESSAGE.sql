-- Fix tournament winner message to always show the final match winner
-- The issue was that the trigger could be fired by either final or third_place completion

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

  -- Get sender_id: use created_by if available, otherwise use group admin
  v_sender_id := v_created_by;
  IF v_sender_id IS NULL THEN
    SELECT admin_id INTO v_sender_id FROM groups WHERE id = v_group_id;
  END IF;

  v_current_stage := NEW.stage;
  
  IF v_current_stage IS NULL THEN
    RETURN NEW;
  END IF;

  -- Special handling for final and third_place completion
  IF v_current_stage = 'final' OR v_current_stage = 'third_place' THEN
    -- Check if both final and third_place are completed
    SELECT 
      EXISTS(SELECT 1 FROM matches WHERE competition_id = v_competition_id AND stage = 'final' AND status = 'completed'),
      EXISTS(SELECT 1 FROM matches WHERE competition_id = v_competition_id AND stage = 'third_place' AND status = 'completed')
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
      WHERE competition_id = v_competition_id AND stage = 'final' AND status = 'completed'
      LIMIT 1;

      -- Determine winner and runner-up from final match
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
      WHERE competition_id = v_competition_id AND stage = 'third_place' AND status = 'completed'
      LIMIT 1;

      -- Get player names
      SELECT name INTO v_winner_name FROM players WHERE id = v_winner_id;
      SELECT name INTO v_runner_up_name FROM players WHERE id = v_runner_up_id;
      SELECT name INTO v_third_place_name FROM players WHERE id = v_third_place_id;

      -- Update competition status
      UPDATE competitions
      SET status = 'completed'
      WHERE id = v_competition_id;

      -- Send podium message
      INSERT INTO chat_messages (
        group_id,
        sender_id,
        sender_name,
        message,
        type,
        metadata
      ) VALUES (
        v_group_id,
        v_sender_id,
        'System',
        '🏆 Tournament Complete! 🏆',
        'competition_finished',
        jsonb_build_object(
          'competition_id', v_competition_id,
          'winner_id', v_winner_id,
          'winner_name', v_winner_name,
          'runner_up_id', v_runner_up_id,
          'runner_up_name', v_runner_up_name,
          'third_place_id', v_third_place_id,
          'third_place_name', v_third_place_name
        )
      );
    END IF;

    RETURN NEW;
  END IF;

  -- Regular stage progression logic
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

  SELECT get_next_stage(v_current_stage, v_stage_matches_count * 2)
  INTO v_next_stage;

  IF v_next_stage IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT ARRAY_AGG(
    CASE 
      WHEN home_score > away_score THEN home_player_id
      WHEN away_score > home_score THEN away_player_id
      ELSE NULL
    END
    ORDER BY match_order
  )
  INTO v_winners
  FROM matches
  WHERE competition_id = v_competition_id
  AND stage = v_current_stage
  AND status = 'completed';

  -- Remove NULL values from array
  v_winners := ARRAY(SELECT x FROM unnest(v_winners) x WHERE x IS NOT NULL);

  IF v_next_stage = 'final' THEN
    SELECT ARRAY_AGG(
      CASE 
        WHEN home_score < away_score THEN home_player_id
        WHEN away_score < home_score THEN away_player_id
        ELSE NULL
      END
      ORDER BY match_order
    )
    INTO v_losers
    FROM matches
    WHERE competition_id = v_competition_id
    AND stage = v_current_stage
    AND status = 'completed';
    
    -- Remove NULL values from array
    v_losers := ARRAY(SELECT x FROM unnest(v_losers) x WHERE x IS NOT NULL);
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

    -- Send chat message for 3rd place match creation
    INSERT INTO chat_messages (
      group_id,
      sender_id,
      sender_name,
      message,
      type,
      metadata
    ) VALUES (
      v_group_id,
      v_sender_id,
      'System',
      '🥉 3rd Place Match has been created!',
      'match_result',
      jsonb_build_object('stage', 'third_place')
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
    v_sender_id,
    'System',
    CASE 
      WHEN v_next_stage = 'final' THEN '🏆 Final match has been created!'
      ELSE 'Next stage (' || v_next_stage || ') matches have been created!'
    END,
    'match_result',
    jsonb_build_object(
      'stage', v_next_stage,
      'matches_created', v_match_order - 1
    )
  );

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Recreate the trigger
DROP TRIGGER IF EXISTS trigger_create_next_stage_matches ON matches;
CREATE TRIGGER trigger_create_next_stage_matches
AFTER UPDATE ON matches
FOR EACH ROW
EXECUTE FUNCTION create_next_stage_matches();
