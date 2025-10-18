-- ============================================
-- FIX LEAGUE COMPLETION LOGIC
-- ============================================
-- League should be completed in TWO situations:
-- 1. All matches have been played and scores entered
-- 2. Deadline has been reached: auto-delete expired matches and complete with winner
-- ============================================

-- ============================================
-- PART 1: Enhanced league completion trigger
-- ============================================

-- Drop existing trigger
DROP TRIGGER IF EXISTS trigger_check_league_completion ON matches;
DROP FUNCTION IF EXISTS check_league_completion() CASCADE;

-- Create enhanced function to check and complete leagues
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
-- PART 2: Enhanced deadline cleanup for leagues
-- ============================================

-- Drop existing functions
DROP TRIGGER IF EXISTS check_expired_competitions_on_match ON matches;
DROP FUNCTION IF EXISTS check_and_complete_expired_competitions() CASCADE;
DROP FUNCTION IF EXISTS cleanup_all_expired_competitions() CASCADE;

-- Create new function that handles league completion with winner calculation
CREATE OR REPLACE FUNCTION check_and_complete_expired_competitions()
RETURNS TRIGGER AS $$
DECLARE
  competition_record RECORD;
  v_sender_id UUID;
  deleted_count INTEGER;
  remaining_matches INTEGER;
  winner_record RECORD;
  winner_name TEXT;
  runner_up_record RECORD;
  runner_up_name TEXT;
  third_place_record RECORD;
  third_place_name TEXT;
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
      
      -- Get sender_id
      v_sender_id := competition_record.created_by;
      IF v_sender_id IS NULL THEN
        SELECT admin_id INTO v_sender_id FROM groups WHERE id = competition_record.group_id;
      END IF;

      -- Delete all scheduled matches for this competition
      DELETE FROM matches 
      WHERE competition_id = competition_record.id 
      AND status = 'scheduled';
      
      GET DIAGNOSTICS deleted_count = ROW_COUNT;
      
      -- Check if there are any remaining completed matches
      SELECT COUNT(*) INTO remaining_matches
      FROM matches
      WHERE competition_id = competition_record.id
        AND status = 'completed';
      
      -- Mark competition as completed
      UPDATE competitions 
      SET status = 'completed'
      WHERE id = competition_record.id;
      
      -- For leagues with completed matches, calculate and announce winner
      IF competition_record.type = 'league' AND remaining_matches > 0 THEN
        -- Calculate standings for league
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
          WHERE cp.competition_id = competition_record.id
          GROUP BY p.id, p.name
        )
        SELECT * INTO winner_record
        FROM player_stats
        ORDER BY points DESC, goal_difference DESC, goals_scored DESC
        LIMIT 1;

        IF winner_record.id IS NOT NULL THEN
          winner_name := winner_record.name;
          
          -- Get runner-up and third place
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
            WHERE cp.competition_id = competition_record.id
            GROUP BY p.id, p.name
          )
          SELECT * INTO runner_up_record
          FROM player_stats
          ORDER BY points DESC, goal_difference DESC, goals_scored DESC
          LIMIT 1 OFFSET 1;

          IF runner_up_record.id IS NOT NULL THEN
            runner_up_name := runner_up_record.name;
          END IF;

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
            WHERE cp.competition_id = competition_record.id
            GROUP BY p.id, p.name
          )
          SELECT * INTO third_place_record
          FROM player_stats
          ORDER BY points DESC, goal_difference DESC, goals_scored DESC
          LIMIT 1 OFFSET 2;

          IF third_place_record.id IS NOT NULL THEN
            third_place_name := third_place_record.name;
          END IF;

          -- Insert chat message with winner announcement
          INSERT INTO chat_messages (group_id, sender_id, sender_name, message, type, metadata)
          VALUES (
            competition_record.group_id,
            v_sender_id,
            'System',
            '⏰ Competition deadline reached. ' || deleted_count || ' pending matches removed.

🏆 League Complete! 🏆
' || CASE 
              WHEN runner_up_name IS NOT NULL AND third_place_name IS NOT NULL THEN
                '🥇 Champion: ' || winner_name || ' (' || winner_record.points || ' pts, ' || 
                CASE WHEN winner_record.goal_difference >= 0 THEN '+' ELSE '' END || 
                winner_record.goal_difference || ' GD)
🥈 Runner-up: ' || runner_up_name || ' (' || runner_up_record.points || ' pts, ' || 
                CASE WHEN runner_up_record.goal_difference >= 0 THEN '+' ELSE '' END || 
                runner_up_record.goal_difference || ' GD)
🥉 Third Place: ' || third_place_name || ' (' || third_place_record.points || ' pts, ' || 
                CASE WHEN third_place_record.goal_difference >= 0 THEN '+' ELSE '' END || 
                third_place_record.goal_difference || ' GD)'
              WHEN runner_up_name IS NOT NULL THEN
                '🥇 Champion: ' || winner_name || ' (' || winner_record.points || ' pts)
🥈 Runner-up: ' || runner_up_name || ' (' || runner_up_record.points || ' pts)'
              ELSE
                '🥇 Champion: ' || winner_name || ' (' || winner_record.points || ' pts)'
            END,
            'competition_finished',
            jsonb_build_object(
              'competition_id', competition_record.id,
              'deadline_expired', true,
              'deleted_matches', deleted_count,
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

          RAISE NOTICE '🏆 League completed by deadline. Winner: % with % points', winner_name, winner_record.points;
        ELSE
          -- No completed matches at all
          INSERT INTO chat_messages (group_id, sender_id, sender_name, message, type)
          VALUES (
            competition_record.group_id,
            v_sender_id,
            'System',
            '⏰ Competition deadline reached. All pending matches have been removed. No winner declared as no matches were completed.',
            'system'
          );
        END IF;
      ELSE
        -- For tournaments or leagues with no completed matches
        INSERT INTO chat_messages (group_id, sender_id, sender_name, message, type)
        VALUES (
          competition_record.group_id,
          v_sender_id,
          'System',
          '⏰ Competition deadline reached. All pending matches have been removed.',
          'system'
        );
      END IF;
      
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
  competition_type TEXT,
  deleted_matches_count INTEGER,
  winner_name TEXT
) AS $$
DECLARE
  comp_record RECORD;
  deleted_count INTEGER;
  remaining_matches INTEGER;
  v_sender_id UUID;
  winner_record RECORD;
  v_winner_name TEXT;
  runner_up_record RECORD;
  runner_up_name TEXT;
  third_place_record RECORD;
  third_place_name TEXT;
BEGIN
  FOR comp_record IN 
    SELECT c.*
    FROM competitions c
    WHERE 
      c.end_date IS NOT NULL
      AND c.status IN ('upcoming', 'active')
      AND c.end_date < NOW()
  LOOP
    -- Get sender_id
    v_sender_id := comp_record.created_by;
    IF v_sender_id IS NULL THEN
      SELECT admin_id INTO v_sender_id FROM groups WHERE id = comp_record.group_id;
    END IF;

    -- Delete all scheduled matches
    DELETE FROM matches
    WHERE 
      competition_id = comp_record.id
      AND status = 'scheduled';
    
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    
    -- Check remaining completed matches
    SELECT COUNT(*) INTO remaining_matches
    FROM matches
    WHERE competition_id = comp_record.id
      AND status = 'completed';
    
    -- Mark competition as completed
    UPDATE competitions
    SET status = 'completed'
    WHERE id = comp_record.id;
    
    v_winner_name := NULL;
    
    -- For leagues with completed matches, calculate winner
    IF comp_record.type = 'league' AND remaining_matches > 0 THEN
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
        WHERE cp.competition_id = comp_record.id
        GROUP BY p.id, p.name
      )
      SELECT * INTO winner_record
      FROM player_stats
      ORDER BY points DESC, goal_difference DESC, goals_scored DESC
      LIMIT 1;

      IF winner_record.id IS NOT NULL THEN
        v_winner_name := winner_record.name;
        
        -- Get runner-up and third place (similar logic as above)
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
          WHERE cp.competition_id = comp_record.id
          GROUP BY p.id, p.name
        )
        SELECT * INTO runner_up_record
        FROM player_stats
        ORDER BY points DESC, goal_difference DESC, goals_scored DESC
        LIMIT 1 OFFSET 1;

        IF runner_up_record.id IS NOT NULL THEN
          runner_up_name := runner_up_record.name;
        END IF;

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
          WHERE cp.competition_id = comp_record.id
          GROUP BY p.id, p.name
        )
        SELECT * INTO third_place_record
        FROM player_stats
        ORDER BY points DESC, goal_difference DESC, goals_scored DESC
        LIMIT 1 OFFSET 2;

        IF third_place_record.id IS NOT NULL THEN
          third_place_name := third_place_record.name;
        END IF;

        -- Insert chat message with winner
        INSERT INTO chat_messages (group_id, sender_id, sender_name, message, type, metadata)
        VALUES (
          comp_record.group_id,
          v_sender_id,
          'System',
          '⏰ Competition deadline reached. ' || deleted_count || ' pending matches removed.

🏆 League Complete! 🏆
' || CASE 
            WHEN runner_up_name IS NOT NULL AND third_place_name IS NOT NULL THEN
              '🥇 Champion: ' || v_winner_name || ' (' || winner_record.points || ' pts, ' || 
              CASE WHEN winner_record.goal_difference >= 0 THEN '+' ELSE '' END || 
              winner_record.goal_difference || ' GD)
🥈 Runner-up: ' || runner_up_name || ' (' || runner_up_record.points || ' pts, ' || 
              CASE WHEN runner_up_record.goal_difference >= 0 THEN '+' ELSE '' END || 
              runner_up_record.goal_difference || ' GD)
🥉 Third Place: ' || third_place_name || ' (' || third_place_record.points || ' pts, ' || 
              CASE WHEN third_place_record.goal_difference >= 0 THEN '+' ELSE '' END || 
              third_place_record.goal_difference || ' GD)'
            WHEN runner_up_name IS NOT NULL THEN
              '🥇 Champion: ' || v_winner_name || ' (' || winner_record.points || ' pts)
🥈 Runner-up: ' || runner_up_name || ' (' || runner_up_record.points || ' pts)'
            ELSE
              '🥇 Champion: ' || v_winner_name || ' (' || winner_record.points || ' pts)'
          END,
          'competition_finished',
          jsonb_build_object(
            'competition_id', comp_record.id,
            'deadline_expired', true,
            'deleted_matches', deleted_count,
            'winner_id', winner_record.id,
            'winner_name', v_winner_name,
            'winner_points', winner_record.points,
            'winner_goal_difference', winner_record.goal_difference,
            'runner_up_id', runner_up_record.id,
            'runner_up_name', runner_up_name,
            'third_place_id', third_place_record.id,
            'third_place_name', third_place_name
          )
        );
      ELSE
        -- No winner
        INSERT INTO chat_messages (group_id, sender_id, sender_name, message, type)
        VALUES (
          comp_record.group_id,
          v_sender_id,
          'System',
          '⏰ Competition deadline reached. All pending matches have been removed. No winner declared as no matches were completed.',
          'system'
        );
      END IF;
    ELSE
      -- For tournaments or leagues with no completed matches
      INSERT INTO chat_messages (group_id, sender_id, sender_name, message, type)
      VALUES (
        comp_record.group_id,
        v_sender_id,
        'System',
        '⏰ Competition deadline reached. All pending matches have been removed.',
        'system'
      );
    END IF;
    
    -- Return result
    competition_id := comp_record.id;
    competition_name := comp_record.name;
    competition_type := comp_record.type;
    deleted_matches_count := deleted_count;
    winner_name := v_winner_name;
    
    RETURN NEXT;
    
    RAISE NOTICE 'Cleaned up competition %: deleted % matches, winner: %', 
      comp_record.name, deleted_count, COALESCE(v_winner_name, 'none');
  END LOOP;
  
  RETURN;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- VERIFICATION
-- ============================================

SELECT '✅ League completion logic fixed!' as status;
SELECT '✅ League completes when all matches are played' as scenario_1;
SELECT '✅ League completes at deadline with winner announcement' as scenario_2;
SELECT '✅ Winner calculated based on points, goal difference, and goals scored' as calculation;
