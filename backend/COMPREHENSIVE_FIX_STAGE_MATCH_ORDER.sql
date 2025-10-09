-- ============================================
-- COMPREHENSIVE FIX FOR STAGE AND MATCH_ORDER
-- Run this entire script in Supabase SQL Editor
-- ============================================

-- ============================================
-- STEP 1: Ensure columns exist
-- ============================================
DO $$ 
BEGIN
  -- Add stage column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
      AND table_name = 'matches' 
      AND column_name = 'stage'
  ) THEN
    ALTER TABLE public.matches ADD COLUMN stage TEXT;
    RAISE NOTICE '✅ Added stage column to matches table';
  ELSE
    RAISE NOTICE 'ℹ️  stage column already exists';
  END IF;
  
  -- Add match_order column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
      AND table_name = 'matches' 
      AND column_name = 'match_order'
  ) THEN
    ALTER TABLE public.matches ADD COLUMN match_order INTEGER;
    RAISE NOTICE '✅ Added match_order column to matches table';
  ELSE
    RAISE NOTICE 'ℹ️  match_order column already exists';
  END IF;
  
  -- Ensure created_by exists in competitions
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
      AND table_name = 'competitions' 
      AND column_name = 'created_by'
  ) THEN
    ALTER TABLE public.competitions ADD COLUMN created_by UUID REFERENCES players(id);
    RAISE NOTICE '✅ Added created_by column to competitions table';
  ELSE
    RAISE NOTICE 'ℹ️  created_by column already exists in competitions';
  END IF;
END $$;

-- ============================================
-- STEP 2: Create indexes for better performance
-- ============================================
CREATE INDEX IF NOT EXISTS idx_matches_stage ON matches(stage);
CREATE INDEX IF NOT EXISTS idx_matches_match_order ON matches(match_order);
CREATE INDEX IF NOT EXISTS idx_matches_stage_order ON matches(competition_id, stage, match_order);

-- ============================================
-- STEP 3: Verify columns are accessible
-- ============================================
SELECT 
  '✅ MATCHES TABLE COLUMNS' as info,
  column_name, 
  data_type, 
  is_nullable,
  column_default
FROM information_schema.columns 
WHERE table_schema = 'public' 
  AND table_name = 'matches'
  AND column_name IN ('stage', 'match_order', 'competition_id', 'home_player_id', 'away_player_id', 'status', 'scheduled_time')
ORDER BY ordinal_position;

-- ============================================
-- STEP 4: Show current state of knockout tournaments
-- ============================================
SELECT 
  '📊 KNOCKOUT TOURNAMENTS STATUS' as info,
  c.id,
  c.name,
  c.tournament_type,
  c.status,
  c.created_at,
  COUNT(m.id) as total_matches,
  COUNT(CASE WHEN m.stage IS NOT NULL THEN 1 END) as matches_with_stage,
  COUNT(CASE WHEN m.match_order IS NOT NULL THEN 1 END) as matches_with_order
FROM competitions c
LEFT JOIN matches m ON c.id = m.competition_id
WHERE c.type = 'tournament' 
  AND c.tournament_type = 'knockout'
GROUP BY c.id, c.name, c.tournament_type, c.status, c.created_at
ORDER BY c.created_at DESC
LIMIT 10;

-- ============================================
-- STEP 5: Show sample matches
-- ============================================
SELECT 
  '🔍 SAMPLE KNOCKOUT MATCHES' as info,
  m.id,
  c.name as competition_name,
  m.stage,
  m.match_order,
  m.status,
  m.home_score,
  m.away_score,
  m.created_at
FROM matches m
JOIN competitions c ON m.competition_id = c.id
WHERE c.tournament_type = 'knockout'
ORDER BY c.created_at DESC, m.match_order ASC
LIMIT 30;

-- ============================================
-- STEP 6: Fix existing knockout matches without stage/match_order
-- ============================================
DO $$
DECLARE
  comp_record RECORD;
  match_record RECORD;
  match_count INTEGER;
  current_stage TEXT;
  current_order INTEGER;
BEGIN
  -- Loop through all knockout competitions
  FOR comp_record IN 
    SELECT DISTINCT c.id, c.name
    FROM competitions c
    JOIN matches m ON c.id = m.competition_id
    WHERE c.type = 'tournament' 
      AND c.tournament_type = 'knockout'
      AND (m.stage IS NULL OR m.match_order IS NULL)
  LOOP
    RAISE NOTICE '🔧 Fixing competition: %', comp_record.name;
    
    -- Count matches in this competition
    SELECT COUNT(*) INTO match_count
    FROM matches
    WHERE competition_id = comp_record.id
      AND (stage IS NULL OR match_order IS NULL);
    
    -- Determine the stage based on match count
    IF match_count > 8 THEN
      current_stage := 'round_of_16';
    ELSIF match_count > 4 THEN
      current_stage := 'quarter_final';
    ELSIF match_count > 2 THEN
      current_stage := 'semi_final';
    ELSE
      current_stage := 'final';
    END IF;
    
    RAISE NOTICE '  Setting stage to: % for % matches', current_stage, match_count;
    
    -- Update matches with stage and match_order
    current_order := 1;
    FOR match_record IN
      SELECT id
      FROM matches
      WHERE competition_id = comp_record.id
        AND (stage IS NULL OR match_order IS NULL)
      ORDER BY created_at ASC
    LOOP
      UPDATE matches
      SET 
        stage = current_stage,
        match_order = current_order
      WHERE id = match_record.id;
      
      current_order := current_order + 1;
    END LOOP;
    
    RAISE NOTICE '  ✅ Updated % matches', match_count;
  END LOOP;
  
  RAISE NOTICE '✅ Finished fixing existing matches';
END $$;

-- ============================================
-- STEP 7: Verify the fix
-- ============================================
SELECT 
  '✅ VERIFICATION AFTER FIX' as info,
  c.id,
  c.name,
  c.tournament_type,
  COUNT(m.id) as total_matches,
  COUNT(CASE WHEN m.stage IS NOT NULL THEN 1 END) as matches_with_stage,
  COUNT(CASE WHEN m.match_order IS NOT NULL THEN 1 END) as matches_with_order
FROM competitions c
LEFT JOIN matches m ON c.id = m.competition_id
WHERE c.type = 'tournament' 
  AND c.tournament_type = 'knockout'
GROUP BY c.id, c.name, c.tournament_type
ORDER BY c.created_at DESC
LIMIT 10;

-- ============================================
-- STEP 8: Show fixed matches
-- ============================================
SELECT 
  '✅ FIXED MATCHES' as info,
  m.id,
  c.name as competition_name,
  m.stage,
  m.match_order,
  m.status,
  m.created_at
FROM matches m
JOIN competitions c ON m.competition_id = c.id
WHERE c.tournament_type = 'knockout'
ORDER BY c.created_at DESC, m.match_order ASC
LIMIT 30;

-- ============================================
-- DONE
-- ============================================
SELECT '✅ ALL FIXES APPLIED SUCCESSFULLY' as status;
