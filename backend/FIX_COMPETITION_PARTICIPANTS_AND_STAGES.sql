-- ============================================
-- FIX COMPETITION PARTICIPANTS DISPLAY & TOURNAMENT STAGE PROGRESSION
-- Apply this file in your Supabase SQL Editor
-- ============================================

-- PART 1: Fix Competition Created Message to Show Participants
-- ============================================

CREATE OR REPLACE FUNCTION post_competition_created_event()
RETURNS TRIGGER AS $$
DECLARE
  match_count INTEGER;
  comp_type_display TEXT;
  deadline_text TEXT;
  creator_name TEXT;
  participant_names TEXT;
  participant_count INTEGER;
BEGIN
  -- Use created_by as sender_id, fallback to first group member if not set
  IF NEW.created_by IS NULL THEN
    SELECT player_id INTO NEW.created_by 
    FROM group_members 
    WHERE group_id = NEW.group_id 
    LIMIT 1;
  END IF;
  
  -- If still no sender found, skip the message
  IF NEW.created_by IS NULL THEN
    RETURN NEW;
  END IF;
  
  -- Get creator name
  SELECT name INTO creator_name
  FROM players
  WHERE id = NEW.created_by;
  
  -- Wait a moment for participants and matches to be inserted
  PERFORM pg_sleep(0.2);
  
  -- Count matches for this competition
  SELECT COUNT(*) INTO match_count FROM matches WHERE competition_id = NEW.id;
  
  -- Get participant names and count
  SELECT 
    COUNT(*),
    STRING_AGG(p.name, ', ' ORDER BY p.name)
  INTO participant_count, participant_names
  FROM competition_participants cp
  JOIN players p ON cp.player_id = p.id
  WHERE cp.competition_id = NEW.id;
  
  -- Default to 0 if no participants found
  IF participant_count IS NULL THEN
    participant_count := 0;
    participant_names := 'None';
  END IF;
  
  -- Format competition type
  comp_type_display := CASE NEW.type
    WHEN 'league' THEN 'League'
    WHEN 'tournament' THEN 'Tournament'
    WHEN 'friendly' THEN 'Friendly'
    ELSE NEW.type
  END;
  
  -- Format deadline text
  IF NEW.end_date IS NOT NULL THEN
    deadline_text := TO_CHAR(NEW.end_date::timestamp, 'Mon DD, YYYY');
  ELSE
    deadline_text := 'None';
  END IF;
  
  -- Insert chat message with full details
  INSERT INTO chat_messages (
    group_id,
    sender_id,
    sender_name,
    message,
    type,
    metadata,
    timestamp
  )
  SELECT
    NEW.group_id,
    NEW.created_by,
    'System',
    '🎮 New ' || comp_type_display || ' created: ' || NEW.name || 
    E'\n👤 Created by: ' || COALESCE(creator_name, 'Unknown') ||
    E'\n👥 Participants: ' || participant_names || ' (' || participant_count || ')' ||
    E'\n⚽ Matches: ' || match_count ||
    E'\n📅 Deadline: ' || deadline_text,
    'competition_created',
    jsonb_build_object(
      'competitionId', NEW.id,
      'competitionName', NEW.name,
      'competitionType', comp_type_display,
      'matchCount', match_count,
      'participantCount', participant_count,
      'participants', participant_names,
      'createdBy', creator_name,
      'deadline', deadline_text
    ),
    NOW()
  WHERE NOT EXISTS (
    SELECT 1 FROM chat_messages 
    WHERE type = 'competition_created' 
    AND metadata->>'competitionId' = NEW.id::text
  );
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Recreate the trigger
DROP TRIGGER IF EXISTS competition_created_trigger ON competitions;
CREATE TRIGGER competition_created_trigger
  AFTER INSERT ON competitions
  FOR EACH ROW
  EXECUTE FUNCTION post_competition_created_event();

-- PART 2: Tournament Stage Progression System
-- ============================================

-- Add stage tracking columns to matches table if they don't exist
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'matches' AND column_name = 'stage') THEN
    ALTER TABLE matches ADD COLUMN stage TEXT;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'matches' AND column_name = 'match_order') THEN
    ALTER TABLE matches ADD COLUMN match_order INTEGER;
  END IF;
END $$;

-- Function to determine next stage name
CREATE OR REPLACE FUNCTION get_next_stage(current_stage TEXT)
RETURNS TEXT AS $$
BEGIN
  CASE current_stage
    WHEN 'round_of_16' THEN RETURN 'quarter_final';
    WHEN 'quarter_final' THEN RETURN 'semi_final';
    WHEN 'semi_final' THEN RETURN 'final';
    WHEN 'final' THEN RETURN NULL;
    WHEN 'third_place' THEN RETURN NULL;
    ELSE RETURN NULL;
  END CASE;
END;
$$ LANGUAGE plpgsql;

-- Function to get stage name based on participant count
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
  v_created_by UUID;
  v_group_id UUID;
  v_matches_created INTEGER;
BEGIN
  -- Only process newly completed matches
  IF NEW.status != 'completed' OR OLD.status = 'completed' THEN
    RETURN NEW;
  END IF;

  -- Get competition details
  SELECT c.id, c.type, c.tournament_type, c.end_date, c.created_by, c.group_id
  INTO v_competition_id, v_competition_type, v_tournament_type, v_deadline, v_created_by, v_group_id
  FROM competitions c
  WHERE c.id = NEW.competition_id;

  -- Only process knockout tournaments
  IF v_competition_type != 'tournament' OR v_tournament_type != 'knockout' THEN
    RETURN NEW;
  END IF;

  -- Get current stage
  v_current_stage := NEW.stage;
  
  -- If no stage set, skip
  IF v_current_stage IS NULL THEN
    RETURN NEW;
  END IF;

  -- Don't process third place matches
  IF v_current_stage = 'third_place' THEN
    RETURN NEW;
  END IF;

  -- Check if current stage is completed
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

  -- If stage not completed, return
  IF NOT v_stage_completed THEN
    RETURN NEW;
  END IF;

  -- Get next stage name
  v_next_stage := get_next_stage(v_current_stage);

  -- If no next stage (final completed), update competition status
  IF v_next_stage IS NULL THEN
    UPDATE competitions
    SET status = 'completed'
    WHERE id = v_competition_id;
    
    RETURN NEW;
  END IF;

  -- Get winners from current stage (ordered by match_order)
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

  -- Remove any NULL values (draws)
  v_winners := ARRAY(SELECT unnest(v_winners) WHERE unnest IS NOT NULL);

  -- If we're moving to final, also get losers for 3rd place match
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
    
    v_losers := ARRAY(SELECT unnest(v_losers) WHERE unnest IS NOT NULL);
  END IF;

  -- Create next stage matches
  v_match_order := 1;
  v_matches_created := 0;
  
  -- Create winner matches
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
      v_matches_created := v_matches_created + 1;
    END IF;
  END LOOP;

  -- Create 3rd place match if moving to final
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
    
    v_matches_created := v_matches_created + 1;
  END IF;

  -- Send chat notification about next stage
  INSERT INTO chat_messages (
    group_id,
    sender_id,
    sender_name,
    message,
    type,
    metadata
  ) VALUES (
    v_group_id,
    v_created_by,
    'System',
    '🏆 Stage completed! Next stage: ' || 
    CASE v_next_stage
      WHEN 'round_of_16' THEN 'Round of 16'
      WHEN 'quarter_final' THEN 'Quarter Finals'
      WHEN 'semi_final' THEN 'Semi Finals'
      WHEN 'final' THEN 'Finals'
      ELSE v_next_stage
    END || 
    E'\n⚽ Matches created: ' || v_matches_created ||
    CASE 
      WHEN v_next_stage = 'final' AND array_length(v_losers, 1) >= 2 THEN ' (including 3rd place match)'
      ELSE ''
    END,
    'match_result',
    jsonb_build_object(
      'stage', v_next_stage,
      'matches_created', v_matches_created,
      'has_third_place', (v_next_stage = 'final' AND array_length(v_losers, 1) >= 2)
    )
  );

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop existing trigger if it exists
DROP TRIGGER IF EXISTS trigger_create_next_stage_matches ON matches;

-- Create trigger for stage progression
CREATE TRIGGER trigger_create_next_stage_matches
AFTER UPDATE ON matches
FOR EACH ROW
EXECUTE FUNCTION create_next_stage_matches();

-- PART 3: Migrate Existing Tournament Matches
-- ============================================

-- Update existing tournament matches to have stage information
DO $$
DECLARE
  v_comp RECORD;
  v_match RECORD;
  v_match_count INTEGER;
  v_stage TEXT;
  v_order INTEGER;
BEGIN
  FOR v_comp IN 
    SELECT DISTINCT c.id, c.type, c.tournament_type
    FROM competitions c
    JOIN matches m ON m.competition_id = c.id
    WHERE c.type = 'tournament' 
    AND c.tournament_type = 'knockout'
    AND m.stage IS NULL
  LOOP
    -- Count matches in this competition
    SELECT COUNT(*) INTO v_match_count
    FROM matches
    WHERE competition_id = v_comp.id;
    
    -- Determine stage based on match count
    v_stage := get_initial_stage(v_match_count * 2);
    
    -- Update matches with stage and order
    v_order := 1;
    FOR v_match IN 
      SELECT id FROM matches 
      WHERE competition_id = v_comp.id 
      ORDER BY created_at
    LOOP
      UPDATE matches
      SET stage = v_stage, match_order = v_order
      WHERE id = v_match.id;
      
      v_order := v_order + 1;
    END LOOP;
  END LOOP;
END $$;

-- PART 4: Ensure Realtime is Enabled
-- ============================================

DO $$ 
BEGIN
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE IF EXISTS matches;
  EXCEPTION
    WHEN duplicate_object THEN
      NULL;
    WHEN undefined_object THEN
      NULL;
  END;
END $$;

-- ============================================
-- VERIFICATION QUERIES
-- ============================================

-- Check if columns were added
SELECT 
  column_name, 
  data_type 
FROM information_schema.columns 
WHERE table_name = 'matches' 
AND column_name IN ('stage', 'match_order');

-- Check if functions were created
SELECT 
  routine_name 
FROM information_schema.routines 
WHERE routine_name IN ('get_next_stage', 'get_initial_stage', 'create_next_stage_matches', 'post_competition_created_event');

-- Check if trigger was created
SELECT 
  trigger_name 
FROM information_schema.triggers 
WHERE trigger_name IN ('trigger_create_next_stage_matches', 'competition_created_trigger');

-- ============================================
-- SUCCESS MESSAGE
-- ============================================

DO $$
BEGIN
  RAISE NOTICE '✅ Competition creation message updated with participants and creator!';
  RAISE NOTICE '✅ Tournament stage progression system installed successfully!';
  RAISE NOTICE '📝 Check the verification queries above to confirm all changes.';
END $$;
