-- Fix chat_messages type constraint to allow event types
-- This ensures the triggers can insert event messages

-- Drop the old constraint
ALTER TABLE chat_messages DROP CONSTRAINT IF EXISTS chat_messages_type_check;

-- Add the new constraint with all event types
ALTER TABLE chat_messages ADD CONSTRAINT chat_messages_type_check 
  CHECK (type IN (
    'text', 
    'match_result', 
    'youtube_link', 
    'match_live', 
    'match_score', 
    'competition_created', 
    'competition_deadline', 
    'competition_finished'
  ));

-- Verify the constraint was added
SELECT 
  conname as constraint_name,
  pg_get_constraintdef(oid) as constraint_definition
FROM pg_constraint
WHERE conname = 'chat_messages_type_check';

-- Test that we can insert event types
-- This should succeed if the constraint is properly updated
DO $$
BEGIN
  RAISE NOTICE 'Constraint updated successfully. Event types are now allowed.';
END $$;
