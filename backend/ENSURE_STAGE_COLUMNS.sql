-- COMPREHENSIVE FIX FOR STAGE AND MATCH_ORDER COLUMNS
-- Run this entire file in your Supabase SQL editor

-- ============================================
-- STEP 1: Add columns if they don't exist
-- ============================================
DO $$ 
BEGIN
  -- Add stage column
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
  
  -- Add match_order column
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
  
  -- Verify created_by exists in competitions
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
-- STEP 2: Verify columns exist
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
ORDER BY ordinal_position;

-- ============================================
-- STEP 3: Check competitions table
-- ============================================
SELECT 
  '✅ COMPETITIONS TABLE COLUMNS' as info,
  column_name, 
  data_type, 
  is_nullable
FROM information_schema.columns 
WHERE table_schema = 'public' 
  AND table_name = 'competitions' 
  AND column_name IN ('created_by', 'tournament_type')
ORDER BY column_name;

-- ============================================
-- STEP 4: Show recent knockout matches
-- ============================================
SELECT 
  '📊 RECENT KNOCKOUT MATCHES' as info,
  m.id,
  c.name as competition_name,
  c.tournament_type,
  m.stage,
  m.match_order,
  m.status,
  m.created_at
FROM matches m
JOIN competitions c ON m.competition_id = c.id
WHERE c.tournament_type = 'knockout'
ORDER BY m.created_at DESC
LIMIT 20;

-- ============================================
-- STEP 5: Count matches by competition
-- ============================================
SELECT 
  '📈 MATCHES PER COMPETITION' as info,
  c.id,
  c.name,
  c.type,
  c.tournament_type,
  COUNT(m.id) as match_count,
  COUNT(CASE WHEN m.stage IS NOT NULL THEN 1 END) as matches_with_stage,
  COUNT(CASE WHEN m.match_order IS NOT NULL THEN 1 END) as matches_with_order
FROM competitions c
LEFT JOIN matches m ON c.id = m.competition_id
WHERE c.type = 'tournament'
GROUP BY c.id, c.name, c.type, c.tournament_type
ORDER BY c.created_at DESC
LIMIT 10;
