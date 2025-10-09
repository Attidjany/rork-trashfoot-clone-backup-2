-- CLEAN FIX FOR ALL COMPETITION AND TOURNAMENT ISSUES
-- Run this in Supabase SQL Editor

-- ============================================
-- PART 1: Add created_by column to competitions
-- ============================================

DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'competitions' AND column_name = 'created_by'
  ) THEN
    ALTER TABLE competitions ADD COLUMN created_by UUID REFERENCES players(id) ON DELETE SET NULL;
    
    UPDATE competitions c
    SET created_by = g.admin_id
    FROM groups g
    WHERE c.group_id = g.id AND c.created_by IS NULL;
  END IF;
END $$;

-- ============================================
-- PART 2: Fix competition creation chat message trigger
-- ============================================

CREATE OR REPLACE FUNCTION notify_competition_created()
RETURNS TRIGGER AS $$
DECLARE
  v_participant_count INTEGER;
  v_match_count INTEGER;
  v_participant_names TEXT;
  v_creator_name TEXT;
BEGIN
  SELECT COUNT(*) INTO v_participant_count
  FROM competition_participants
  WHERE competition_id = NEW.id;
  
  SELECT COUNT(*) INTO v_match_count
  FROM matches
  WHERE competition_id = NEW.id;
  
  SELECT string_agg(p.name, ', ' ORDER BY p.name) INTO v_participant_names
  FROM competition_participants cp
  JOIN players p ON p.id = cp.player_id
  WHERE cp.competition_id = NEW.id;
  
  SELECT name INTO v_creator_name
  FROM players
  WHERE id = NEW.created_by;
  
  INSERT INTO chat_messages (
    group_id,
    sender_id,
    sender_name,
    message,
    type,
    metadata
  ) VALUES (
    NEW.group_id,
    COALESCE(NEW.created_by, (SELECT admin_id FROM groups WHERE id = NEW.group_id)),
    'System',
    'New competition created: ' || NEW.name,
    'match_result',
    jsonb_build_object(
      'competition_id', NEW.id,
      'competition_name', NEW.name,
      'competition_type', NEW.type,
      'deadline', NEW.end_date,
      'participant_count', v_participant_count,
      'participants', COALESCE(v_participant_names, 'None'),
      'match_count', v_match_count,
      'creator', COALESCE(v_creator_name, 'Unknown')
    )
  );
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trigger_notify_competition_created ON competitions;

CREATE TRIGGER trigger_notify_competition_created
AFTER INSERT ON competitions
FOR EACH ROW
EXECUTE FUNCTION notify_competition_created();

-- ============================================
-- PART 3: Fix match delete policy
-- ============================================

DROP POLICY IF EXISTS "Group admins and superadmins can delete matches" ON matches;

CREATE POLICY "Group admins and superadmins can delete matches" ON matches
FOR DELETE USING (
  EXISTS (
    SELECT 1 FROM players p
    WHERE p.auth_user_id = auth.uid()
    AND (
      p.role = 'super_admin'
      OR p.id IN (
        SELECT g.admin_id
        FROM competitions c
        JOIN groups g ON g.id = c.group_id
        WHERE c.id = matches.competition_id
      )
    )
  )
);

-- ============================================
-- PART 4: Enable realtime for matches table
-- ============================================

ALTER PUBLICATION supabase_realtime DROP TABLE IF EXISTS matches;
ALTER PUBLICATION supabase_realtime ADD TABLE matches;

-- ============================================
-- PART 5: Fix tournament stage progression
-- ============================================

-- Add stage columns if they don't exist
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'matches' AND column_name = 'stage'
  ) THEN
    ALTER TABLE matches ADD COLUMN stage TEXT;
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'matches' AND column_name = 'match_order'
  ) THEN
    ALTER TABLE matches ADD COLUMN match_order INTEGER;
  END IF;
END $$;

-- Function to get next stage
CREATE OR REPLACE FUNCTION get_next_stage(current_stage TEXT)
RETURNS TEXT AS $$
BEGIN
  CASE current_stage
    WHEN 'round_of_16' THEN RETURN 'quarter_final';
    WHEN 'quarter_final' THEN RETURN 'semi_final';
    WHEN 'semi_final' THEN RETURN 'final';
    WHEN 'final' THEN RETURN NULL;
    ELSE RETURN NULL;
  END CASE;
END;
$$ LANGUAGE plpgsql;

-- Function to get initial stage based on participant count
CREATE OR REPLACE FUNCTION get_initial_stage(participant_count INTEGER)
RETURNS TEXT AS $$
BEGIN
  IF participant_count > 8 THEN RETURN 'round_of_16';
  ELSIF participant_count > 4 THEN RETURN 'quarter_final';
  ELSIF participant_count > 2 THEN RETURN 'semi_final';
  ELSE RETURN 'final';
  END IF;
END;
$$ LANGUAGE plpgsql;

-- Function to create next stage matches
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

DROP TRIGGER IF EXISTS trigger_create_next_stage_matches ON matches;

CREATE TRIGGER trigger_create_next_stage_matches
AFTER UPDATE ON matches
FOR EACH ROW
EXECUTE FUNCTION create_next_stage_matches();

-- ============================================
-- SUCCESS MESSAGE
-- ============================================

DO $$
BEGIN
  RAISE NOTICE 'All fixes applied successfully!';
  RAISE NOTICE '1. Competition created_by column added';
  RAISE NOTICE '2. Competition creation messages fixed with participants and creator';
  RAISE NOTICE '3. Match delete policy fixed for admins and superadmins';
  RAISE NOTICE '4. Realtime enabled for matches table';
  RAISE NOTICE '5. Tournament stage progression system installed';
END $$;
