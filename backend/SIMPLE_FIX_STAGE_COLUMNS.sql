-- ============================================
-- SIMPLE FIX: Add stage and match_order columns
-- Run this in Supabase SQL Editor
-- ============================================

-- Add the columns (will skip if they already exist)
ALTER TABLE matches ADD COLUMN IF NOT EXISTS stage TEXT;
ALTER TABLE matches ADD COLUMN IF NOT EXISTS match_order INTEGER;

-- Verify they exist
SELECT 
  'Columns added successfully!' as status,
  column_name, 
  data_type
FROM information_schema.columns 
WHERE table_schema = 'public' 
  AND table_name = 'matches'
  AND column_name IN ('stage', 'match_order');

-- Show recent matches to see if they have these columns
SELECT 
  'Recent matches:' as info,
  m.id,
  c.name as competition,
  m.stage,
  m.match_order,
  m.created_at
FROM matches m
JOIN competitions c ON m.competition_id = c.id
ORDER BY m.created_at DESC
LIMIT 5;
