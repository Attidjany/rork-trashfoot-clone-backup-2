-- Add stage and match_order columns to matches table for tournament bracket support

-- Add stage column (for knockout tournaments: round_of_16, quarter_final, semi_final, final, third_place)
ALTER TABLE matches 
ADD COLUMN IF NOT EXISTS stage TEXT;

-- Add match_order column (for ordering matches within a stage)
ALTER TABLE matches 
ADD COLUMN IF NOT EXISTS match_order INTEGER;

-- Add index for better query performance
CREATE INDEX IF NOT EXISTS idx_matches_stage ON matches(stage);
CREATE INDEX IF NOT EXISTS idx_matches_match_order ON matches(match_order);

-- Add comment to explain the columns
COMMENT ON COLUMN matches.stage IS 'Tournament stage: round_of_16, quarter_final, semi_final, final, third_place';
COMMENT ON COLUMN matches.match_order IS 'Order of match within a stage for proper bracket display';
