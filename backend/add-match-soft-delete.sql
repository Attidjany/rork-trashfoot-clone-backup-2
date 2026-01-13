-- Add soft delete column to matches table
ALTER TABLE public.matches 
ADD COLUMN IF NOT EXISTS deleted_at timestamp with time zone;

-- Add index for better query performance
CREATE INDEX IF NOT EXISTS idx_matches_deleted_at ON matches(deleted_at);

-- Add comment to explain the column
COMMENT ON COLUMN matches.deleted_at IS 'Timestamp when the match was soft-deleted. NULL means the match is active.';
