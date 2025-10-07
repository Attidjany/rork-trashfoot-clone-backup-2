-- ============================================================================
-- FIX CHAT MESSAGE TYPE CONSTRAINT
-- This script diagnoses and fixes the chat_messages type check constraint
-- ============================================================================

-- Step 1: Check current constraint definition
SELECT 
  conname AS constraint_name,
  pg_get_constraintdef(oid) AS constraint_definition
FROM pg_constraint
WHERE conrelid = 'public.chat_messages'::regclass
  AND conname = 'chat_messages_type_check';

-- Step 2: Check what types are currently in use
SELECT DISTINCT type, COUNT(*) as count
FROM chat_messages
GROUP BY type
ORDER BY count DESC;

-- Step 3: Drop the existing constraint
ALTER TABLE public.chat_messages 
DROP CONSTRAINT IF EXISTS chat_messages_type_check;

-- Step 4: Create a new constraint that allows all necessary types
-- Common message types: 'text', 'system', 'match_result', 'match_created', 'match_live', 'competition_created', 'competition_finished'
ALTER TABLE public.chat_messages
ADD CONSTRAINT chat_messages_type_check 
CHECK (type IN ('text', 'system', 'match_result', 'match_created', 'match_live', 'competition_created', 'competition_finished', 'user'));

-- Step 5: Verify the new constraint
SELECT 
  conname AS constraint_name,
  pg_get_constraintdef(oid) AS constraint_definition
FROM pg_constraint
WHERE conrelid = 'public.chat_messages'::regclass
  AND conname = 'chat_messages_type_check';
