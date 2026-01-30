-- Auto-complete expired competitions and delete their scheduled matches
-- This function runs automatically to handle competition deadlines

-- Drop existing function if it exists
DROP FUNCTION IF EXISTS auto_complete_expired_competitions();

-- Create the function to auto-complete expired competitions
CREATE OR REPLACE FUNCTION auto_complete_expired_competitions()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Update all scheduled matches to deleted status for expired competitions
  UPDATE matches
  SET status = 'deleted'
  WHERE competition_id IN (
    SELECT id 
    FROM competitions 
    WHERE end_date < NOW() 
    AND status = 'ongoing'
  )
  AND status = 'scheduled';

  -- Update expired competitions to completed status
  UPDATE competitions
  SET status = 'completed'
  WHERE end_date < NOW()
  AND status = 'ongoing';

  -- Log the operation
  RAISE NOTICE 'Auto-completed expired competitions at %', NOW();
END;
$$;

-- Create a cron job to run this function every hour
-- (Requires pg_cron extension - enable in Supabase dashboard if not already)
SELECT cron.schedule(
  'auto-complete-competitions',
  '0 * * * *', -- Every hour at minute 0
  $$SELECT auto_complete_expired_competitions()$$
);
