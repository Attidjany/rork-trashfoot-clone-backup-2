-- Change deadline_days (integer) to deadline_date (timestamp with time zone)
-- This allows setting a specific deadline date instead of calculating from start_date

-- Step 1: Add the new deadline_date column
ALTER TABLE competitions 
ADD COLUMN IF NOT EXISTS deadline_date TIMESTAMP WITH TIME ZONE;

-- Step 2: Migrate existing data (if any competitions have deadline_days set)
-- Calculate deadline_date as start_date + deadline_days
UPDATE competitions 
SET deadline_date = start_date + (deadline_days || ' days')::INTERVAL
WHERE deadline_days IS NOT NULL AND start_date IS NOT NULL;

-- Step 3: Drop the old deadline_days column
ALTER TABLE competitions 
DROP COLUMN IF EXISTS deadline_days;

-- Step 4: Add comment to explain the new column
COMMENT ON COLUMN competitions.deadline_date IS 'Deadline date for the competition. After this date, all unplayed matches are automatically deleted and competition is considered finished.';
