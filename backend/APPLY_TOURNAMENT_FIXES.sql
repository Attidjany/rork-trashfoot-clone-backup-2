-- ============================================
-- TOURNAMENT STAGE PROGRESSION & MATCH DELETE FIX
-- Apply this file in your Supabase SQL Editor
-- ============================================

-- PART 1: Fix Match Delete Policy
-- ============================================

-- Drop existing delete policy
DROP POLICY IF EXISTS "Players can delete their own scheduled matches" ON matches;

-- Create new delete policy for group admins and superadmins only
CREATE POLICY "Group admins and superadmins can delete matches"
ON matches
FOR DELETE
USING (
  -- Match is not completed
  status != 'completed' AND (
    -- User is superadmin
    EXISTS (
      SELECT 1 FROM players
      WHERE auth_user_id = auth.uid()
      AND role = 'super_admin'
    ) OR
    -- User is the group admin
    EXISTS (
      SELECT 1 FROM competitions c
      JOIN groups g ON c.group_id = g.id
      JOIN players p ON g.admin_id = p.id
      WHERE c.id = matches.competition_id
      AND p.auth_user_id = auth.uid()
    ) OR
    -- User is a group admin (from group_members)
    EXISTS (
      SELECT 1 FROM competitions c
      JOIN group_members gm ON c.group_id = gm.group_id
      JOIN players p ON gm.player_id = p.id
      WHERE c.id = matches.competition_id
      AND p.auth_user_id = auth.uid()
      AND gm.is_admin = true
    )
  )
);

-- Ensure realtime is enabled for matches table
DO $$ 
BEGIN
  -- Try to add the table to the publication, ignore if already exists
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE matches;
  EXCEPTION
    WHEN duplicate_object THEN
      NULL;
  END;
END $$;

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
CREATE OR REPLACE FUNCTION get_next_stage(current_stage TEXT, total_participants INTEGER)
RETURNS TEXT AS $$
BEGIN
  CASE current_stage
    WHEN 'round_of_16' THEN RETURN 'quarter_final';
    WHEN 'quarter_final' THEN RETURN 'semi_final';
    WHEN 'semi_final' THEN RETURN 'final';
    WHEN 'final' THEN RETURN NULL;
    ELSE
      IF total_participants > 8 THEN RETURN 'round_of_16';
      ELSIF total_participants > 4 THEN RETURN 'quarter_final';
      ELSIF total_participants > 2 THEN RETURN 'semi_final';
      ELSE RETURN 'final';
      END IF;
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
  v_match RECORD;
BEGIN
  -- Only process completed matches
  IF NEW.status != 'completed' OR OLD.status = 'completed' THEN
    RETURN NEW;
  END IF;

  -- Get competition details
  SELECT c.id, c.type, c.tournament_type, c.end_date
  INTO v_competition_id, v_competition_type, v_tournament_type, v_deadline
  FROM competitions c
  WHERE c.id = NEW.competition_id;

  -- Only process knockout tournaments
  IF v_competition_type != 'tournament' OR v_tournament_type != 'knockout' THEN
    RETURN NEW;
  END IF;

  -- Get current stage
  v_current_stage := NEW.stage;
  
  -- If no stage set, this is an old match, skip
  IF v_current_stage IS NULL THEN
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
  SELECT get_next_stage(v_current_stage, v_stage_matches_count * 2)
  INTO v_next_stage;

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
  END IF;

  -- Send chat notification about next stage
  INSERT INTO chat_messages (
    group_id,
    sender_id,
    sender_name,
    message,
    type,
    metadata
  )
  SELECT 
    c.group_id,
    c.created_by,
    'System',
    'Next stage (' || v_next_stage || ') matches have been created! ' || (v_match_order - 1) || ' match(es) scheduled.',
    'match_result',
    jsonb_build_object(
      'stage', v_next_stage,
      'matches_created', v_match_order - 1
    )
  FROM competitions c
  WHERE c.id = v_competition_id;

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
WHERE routine_name IN ('get_next_stage', 'get_initial_stage', 'create_next_stage_matches');

-- Check if trigger was created
SELECT 
  trigger_name 
FROM information_schema.triggers 
WHERE trigger_name = 'trigger_create_next_stage_matches';

-- Check delete policy
SELECT 
  policyname 
FROM pg_policies 
WHERE tablename = 'matches' 
AND policyname = 'Group admins and superadmins can delete matches';

-- ============================================
-- SUCCESS MESSAGE
-- ============================================

DO $$
BEGIN
  RAISE NOTICE '✅ Tournament stage progression system installed successfully!';
  RAISE NOTICE '✅ Match delete policy updated successfully!';
  RAISE NOTICE '📝 Check the verification queries above to confirm all changes.';
END $$;
