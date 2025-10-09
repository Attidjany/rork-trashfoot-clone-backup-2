-- Fix stage and match_order columns for knockout tournaments
-- This ensures the columns exist and initial matches have proper values

-- Step 1: Ensure columns exist
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'matches' AND column_name = 'stage') THEN
    ALTER TABLE matches ADD COLUMN stage TEXT;
    RAISE NOTICE 'Added stage column to matches table';
  ELSE
    RAISE NOTICE 'stage column already exists';
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'matches' AND column_name = 'match_order') THEN
    ALTER TABLE matches ADD COLUMN match_order INTEGER;
    RAISE NOTICE 'Added match_order column to matches table';
  ELSE
    RAISE NOTICE 'match_order column already exists';
  END IF;
END $$;

-- Step 2: Verify columns exist
SELECT 
  column_name, 
  data_type, 
  is_nullable
FROM information_schema.columns 
WHERE table_name = 'matches' 
  AND column_name IN ('stage', 'match_order')
ORDER BY column_name;

-- Step 3: Check if created_by exists in competitions table
SELECT 
  column_name, 
  data_type, 
  is_nullable
FROM information_schema.columns 
WHERE table_name = 'competitions' 
  AND column_name = 'created_by';

-- Step 4: Show current matches with stage and match_order
SELECT 
  m.id,
  c.name as competition_name,
  c.type,
  c.tournament_type,
  m.stage,
  m.match_order,
  m.status,
  m.created_at
FROM matches m
JOIN competitions c ON m.competition_id = c.id
WHERE c.tournament_type = 'knockout'
ORDER BY c.created_at DESC, m.match_order;
