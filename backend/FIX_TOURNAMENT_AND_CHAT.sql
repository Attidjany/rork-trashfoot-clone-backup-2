-- Fix Tournament and Chat Message Issues
-- This script adds missing columns, triggers for chat messages, and tournament stage progression

-- 1. Add missing columns to competitions table
ALTER TABLE competitions ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES players(id) ON DELETE SET NULL;

-- 2. Add missing columns to matches table for tournament stages
ALTER TABLE matches ADD COLUMN IF NOT EXISTS stage TEXT;
ALTER TABLE matches ADD COLUMN IF NOT EXISTS match_order INTEGER;

-- 3. Create function to send chat message when competition is created
CREATE OR REPLACE FUNCTION notify_competition_created()
RETURNS TRIGGER AS $$
DECLARE
  participant_count INTEGER;
  participant_names TEXT;
  match_count INTEGER;
  creator_name TEXT;
BEGIN
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

  -- Insert chat message
  INSERT INTO chat_messages (group_id, sender_id, sender_name, message, type, metadata)
  VALUES (
    NEW.group_id,
    COALESCE(NEW.created_by, NEW.group_id),
    COALESCE(creator_name, 'System'),
    'Competition created: ' || NEW.name,
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

-- 4. Create trigger for competition creation (fires AFTER participants and matches are inserted)
DROP TRIGGER IF EXISTS trigger_notify_competition_created ON competitions;
CREATE TRIGGER trigger_notify_competition_created
  AFTER UPDATE OF status ON competitions
  FOR EACH ROW
  WHEN (OLD.status = 'upcoming' AND NEW.status = 'active')
  EXECUTE FUNCTION notify_competition_created();

-- 5. Create function to progress tournament stages
CREATE OR REPLACE FUNCTION progress_tournament_stage()
RETURNS TRIGGER AS $$
DECLARE
  comp_record RECORD;
  current_stage TEXT;
  next_stage TEXT;
  stage_matches_total INTEGER;
  stage_matches_completed INTEGER;
  winners UUID[];
  match_pairs INTEGER;
  i INTEGER;
  scheduled_time TIMESTAMPTZ;
BEGIN
  -- Only process if match is completed
  IF NEW.status != 'completed' OR NEW.stage IS NULL THEN
    RETURN NEW;
  END IF;

  -- Get competition details
  SELECT c.*, c.end_date INTO comp_record
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

  -- If all matches in stage are completed, create next stage
  IF stage_matches_completed = stage_matches_total THEN
    -- Determine next stage
    next_stage := CASE current_stage
      WHEN 'round_of_16' THEN 'quarter_final'
      WHEN 'quarter_final' THEN 'semi_final'
      WHEN 'semi_final' THEN 'final'
      ELSE NULL
    END;

    IF next_stage IS NOT NULL THEN
      -- Get winners from current stage (ordered by match_order)
      SELECT ARRAY_AGG(
        CASE
          WHEN home_score > away_score THEN home_player_id
          WHEN away_score > home_score THEN away_player_id
          ELSE home_player_id -- In case of draw, home wins (or implement penalty logic)
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

      -- If this was semi-final, also create 3rd place match
      IF current_stage = 'semi_final' THEN
        -- Get losers from semi-finals
        DECLARE
          losers UUID[];
        BEGIN
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
        END;
      END IF;
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 6. Create trigger for tournament stage progression
DROP TRIGGER IF EXISTS trigger_progress_tournament_stage ON matches;
CREATE TRIGGER trigger_progress_tournament_stage
  AFTER UPDATE OF status ON matches
  FOR EACH ROW
  WHEN (NEW.status = 'completed')
  EXECUTE FUNCTION progress_tournament_stage();

-- 7. Enable realtime for matches table
ALTER PUBLICATION supabase_realtime DROP TABLE IF EXISTS matches;
ALTER PUBLICATION supabase_realtime ADD TABLE matches;

-- 8. Grant necessary permissions
GRANT ALL ON competitions TO authenticated;
GRANT ALL ON matches TO authenticated;
GRANT ALL ON chat_messages TO authenticated;
GRANT ALL ON competition_participants TO authenticated;

-- Verification queries
SELECT 'Setup complete! Verifying...' as status;

-- Check if columns exist
SELECT 
  CASE WHEN EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'competitions' AND column_name = 'created_by'
  ) THEN '✓ created_by column exists'
  ELSE '✗ created_by column missing'
  END as check_1;

SELECT 
  CASE WHEN EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'matches' AND column_name = 'stage'
  ) THEN '✓ stage column exists'
  ELSE '✗ stage column missing'
  END as check_2;

SELECT 
  CASE WHEN EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'matches' AND column_name = 'match_order'
  ) THEN '✓ match_order column exists'
  ELSE '✗ match_order column missing'
  END as check_3;

-- Check if triggers exist
SELECT 
  CASE WHEN EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'trigger_notify_competition_created'
  ) THEN '✓ Competition notification trigger exists'
  ELSE '✗ Competition notification trigger missing'
  END as check_4;

SELECT 
  CASE WHEN EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'trigger_progress_tournament_stage'
  ) THEN '✓ Tournament progression trigger exists'
  ELSE '✗ Tournament progression trigger missing'
  END as check_5;
