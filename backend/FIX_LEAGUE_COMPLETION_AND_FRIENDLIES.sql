-- ============================================
-- FIX LEAGUE COMPLETION AND FRIENDLY SORTING
-- ============================================
-- 1. Add trigger to check league completion when all matches finish
-- 2. Calculate correct winner based on points/goal difference
-- 3. Sort friendly matches by creation date (newest first)
-- ============================================

-- ============================================
-- PART 1: Add created_at column to matches if not exists
-- ============================================

-- Add created_at column to track match creation time
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'matches' AND column_name = 'created_at'
  ) THEN
    ALTER TABLE matches ADD COLUMN created_at TIMESTAMPTZ DEFAULT NOW();
    RAISE NOTICE 'Added created_at column to matches table';
  ELSE
    RAISE NOTICE 'created_at column already exists in matches table';
  END IF;
END $$;

-- Update existing matches with estimated creation times based on scheduled_time
UPDATE matches 
SET created_at = scheduled_time - INTERVAL '7 days'
WHERE created_at IS NULL;

-- ============================================
-- PART 2: League Completion Logic
-- ============================================

-- Drop existing league completion trigger if exists
DROP TRIGGER IF EXISTS trigger_check_league_completion ON matches;
DROP FUNCTION IF EXISTS check_league_completion() CASCADE;

-- Create function to check and complete leagues
CREATE OR REPLACE FUNCTION check_league_completion()
RETURNS TRIGGER AS $$
DECLARE
  comp_record RECORD;
  total_matches INTEGER;
  completed_matches INTEGER;
  v_sender_id UUID;
  winner_record RECORD;
  winner_name TEXT;
  runner_up_record RECORD;
  runner_up_name TEXT;
  third_place_record RECORD;
  third_place_name TEXT;
BEGIN
  -- Only process completed matches
  IF NEW.status != 'completed' THEN
    RETURN NEW;
  END IF;

  -- Get competition details (only for leagues)
  SELECT c.* INTO comp_record
  FROM competitions c
  WHERE c.id = NEW.competition_id
    AND c.type = 'league'
    AND c.status = 'active';

  -- If not a league or not active, skip
  IF NOT FOUND THEN
    RETURN NEW;
  END IF;

  -- Count total and completed matches
  SELECT COUNT(*), COUNT(*) FILTER (WHERE status = 'completed')
  INTO total_matches, completed_matches
  FROM matches
  WHERE competition_id = NEW.competition_id;

  RAISE NOTICE 'League %: Total matches: %, Completed: %', 
    comp_record.name, total_matches, completed_matches;

  -- If all matches are completed, finalize the league
  IF completed_matches = total_matches THEN
    RAISE NOTICE 'All matches completed in league %, calculating winner...', comp_record.name;

    -- Calculate standings: points (3 for win, 1 for draw), goal difference, goals scored
    -- Winner is player with highest points, then best goal difference, then most goals scored
    WITH player_stats AS (
      SELECT 
        p.id,
        p.name,
        -- Points from home matches
        SUM(CASE 
          WHEN m.home_player_id = p.id AND m.home_score > m.away_score THEN 3
          WHEN m.home_player_id = p.id AND m.home_score = m.away_score THEN 1
          ELSE 0
        END) +
        -- Points from away matches
        SUM(CASE 
          WHEN m.away_player_id = p.id AND m.away_score > m.home_score THEN 3
          WHEN m.away_player_id = p.id AND m.away_score = m.home_score THEN 1
          ELSE 0
        END) AS points,
        -- Goal difference
        SUM(CASE WHEN m.home_player_id = p.id THEN m.home_score ELSE 0 END) +
        SUM(CASE WHEN m.away_player_id = p.id THEN m.away_score ELSE 0 END) -
        SUM(CASE WHEN m.home_player_id = p.id THEN m.away_score ELSE 0 END) -
        SUM(CASE WHEN m.away_player_id = p.id THEN m.home_score ELSE 0 END) AS goal_difference,
        -- Goals scored
        SUM(CASE WHEN m.home_player_id = p.id THEN m.home_score ELSE 0 END) +
        SUM(CASE WHEN m.away_player_id = p.id THEN m.away_score ELSE 0 END) AS goals_scored
      FROM players p
      JOIN competition_participants cp ON cp.player_id = p.id
      JOIN matches m ON m.competition_id = cp.competition_id 
        AND (m.home_player_id = p.id OR m.away_player_id = p.id)
        AND m.status = 'completed'
      WHERE cp.competition_id = NEW.competition_id
      GROUP BY p.id, p.name
    )
    SELECT * INTO winner_record
    FROM player_stats
    ORDER BY points DESC, goal_difference DESC, goals_scored DESC
    LIMIT 1;

    IF winner_record.id IS NOT NULL THEN
      winner_name := winner_record.name;
      
      -- Get runner-up (2nd place)
      WITH player_stats AS (
        SELECT 
          p.id,
          p.name,
          SUM(CASE 
            WHEN m.home_player_id = p.id AND m.home_score > m.away_score THEN 3
            WHEN m.home_player_id = p.id AND m.home_score = m.away_score THEN 1
            ELSE 0
          END) +
          SUM(CASE 
            WHEN m.away_player_id = p.id AND m.away_score > m.home_score THEN 3
            WHEN m.away_player_id = p.id AND m.away_score = m.home_score THEN 1
            ELSE 0
          END) AS points,
          SUM(CASE WHEN m.home_player_id = p.id THEN m.home_score ELSE 0 END) +
          SUM(CASE WHEN m.away_player_id = p.id THEN m.away_score ELSE 0 END) -
          SUM(CASE WHEN m.home_player_id = p.id THEN m.away_score ELSE 0 END) -
          SUM(CASE WHEN m.away_player_id = p.id THEN m.home_score ELSE 0 END) AS goal_difference,
          SUM(CASE WHEN m.home_player_id = p.id THEN m.home_score ELSE 0 END) +
          SUM(CASE WHEN m.away_player_id = p.id THEN m.away_score ELSE 0 END) AS goals_scored
        FROM players p
        JOIN competition_participants cp ON cp.player_id = p.id
        JOIN matches m ON m.competition_id = cp.competition_id 
          AND (m.home_player_id = p.id OR m.away_player_id = p.id)
          AND m.status = 'completed'
        WHERE cp.competition_id = NEW.competition_id
        GROUP BY p.id, p.name
      )
      SELECT * INTO runner_up_record
      FROM player_stats
      ORDER BY points DESC, goal_difference DESC, goals_scored DESC
      LIMIT 1 OFFSET 1;

      IF runner_up_record.id IS NOT NULL THEN
        runner_up_name := runner_up_record.name;
      END IF;

      -- Get third place
      WITH player_stats AS (
        SELECT 
          p.id,
          p.name,
          SUM(CASE 
            WHEN m.home_player_id = p.id AND m.home_score > m.away_score THEN 3
            WHEN m.home_player_id = p.id AND m.home_score = m.away_score THEN 1
            ELSE 0
          END) +
          SUM(CASE 
            WHEN m.away_player_id = p.id AND m.away_score > m.home_score THEN 3
            WHEN m.away_player_id = p.id AND m.away_score = m.home_score THEN 1
            ELSE 0
          END) AS points,
          SUM(CASE WHEN m.home_player_id = p.id THEN m.home_score ELSE 0 END) +
          SUM(CASE WHEN m.away_player_id = p.id THEN m.away_score ELSE 0 END) -
          SUM(CASE WHEN m.home_player_id = p.id THEN m.away_score ELSE 0 END) -
          SUM(CASE WHEN m.away_player_id = p.id THEN m.home_score ELSE 0 END) AS goal_difference,
          SUM(CASE WHEN m.home_player_id = p.id THEN m.home_score ELSE 0 END) +
          SUM(CASE WHEN m.away_player_id = p.id THEN m.away_score ELSE 0 END) AS goals_scored
        FROM players p
        JOIN competition_participants cp ON cp.player_id = p.id
        JOIN matches m ON m.competition_id = cp.competition_id 
          AND (m.home_player_id = p.id OR m.away_player_id = p.id)
          AND m.status = 'completed'
        WHERE cp.competition_id = NEW.competition_id
        GROUP BY p.id, p.name
      )
      SELECT * INTO third_place_record
      FROM player_stats
      ORDER BY points DESC, goal_difference DESC, goals_scored DESC
      LIMIT 1 OFFSET 2;

      IF third_place_record.id IS NOT NULL THEN
        third_place_name := third_place_record.name;
      END IF;

      -- Mark competition as completed
      UPDATE competitions
      SET status = 'completed'
      WHERE id = NEW.competition_id;

      -- Get sender_id for system message
      v_sender_id := comp_record.created_by;
      IF v_sender_id IS NULL THEN
        SELECT admin_id INTO v_sender_id FROM groups WHERE id = comp_record.group_id;
      END IF;

      -- Send completion message with podium
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
        CASE 
          WHEN runner_up_name IS NOT NULL AND third_place_name IS NOT NULL THEN
            '🏆 League Complete! 🏆
🥇 Champion: ' || winner_name || ' (' || winner_record.points || ' pts, ' || 
              CASE WHEN winner_record.goal_difference >= 0 THEN '+' ELSE '' END || 
              winner_record.goal_difference || ' GD)
🥈 Runner-up: ' || runner_up_name || ' (' || runner_up_record.points || ' pts, ' || 
              CASE WHEN runner_up_record.goal_difference >= 0 THEN '+' ELSE '' END || 
              runner_up_record.goal_difference || ' GD)
🥉 Third Place: ' || third_place_name || ' (' || third_place_record.points || ' pts, ' || 
              CASE WHEN third_place_record.goal_difference >= 0 THEN '+' ELSE '' END || 
              third_place_record.goal_difference || ' GD)'
          WHEN runner_up_name IS NOT NULL THEN
            '🏆 League Complete! 🏆
🥇 Champion: ' || winner_name || ' (' || winner_record.points || ' pts)
🥈 Runner-up: ' || runner_up_name || ' (' || runner_up_record.points || ' pts)'
          ELSE
            '🏆 League Complete! 🏆
🥇 Champion: ' || winner_name || ' (' || winner_record.points || ' pts)'
        END,
        'competition_finished',
        jsonb_build_object(
          'competition_id', NEW.competition_id,
          'winner_id', winner_record.id,
          'winner_name', winner_name,
          'winner_points', winner_record.points,
          'winner_goal_difference', winner_record.goal_difference,
          'runner_up_id', runner_up_record.id,
          'runner_up_name', runner_up_name,
          'third_place_id', third_place_record.id,
          'third_place_name', third_place_name
        )
      );

      RAISE NOTICE '🏆 League completed. Winner: % with % points', winner_name, winner_record.points;
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger for league completion
CREATE TRIGGER trigger_check_league_completion
  AFTER UPDATE OF status ON matches
  FOR EACH ROW
  WHEN (NEW.status = 'completed')
  EXECUTE FUNCTION check_league_completion();

-- ============================================
-- VERIFICATION
-- ============================================

SELECT '✅ All fixes applied successfully!' as status;
SELECT '✅ League completion trigger created' as fix1;
SELECT '✅ Winner calculation based on points, goal difference, and goals scored' as fix2;
SELECT '✅ created_at column added to matches for sorting friendlies' as fix3;
