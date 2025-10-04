-- Add deadline_days column to competitions table
-- This represents the number of days from competition start_date until deadline
-- After deadline, unplayed matches will be automatically deleted

ALTER TABLE competitions 
ADD COLUMN IF NOT EXISTS deadline_days INTEGER;

-- Add comment to explain the column
COMMENT ON COLUMN competitions.deadline_days IS 'Number of days from start_date until competition deadline. After deadline, unplayed matches are auto-deleted.';
