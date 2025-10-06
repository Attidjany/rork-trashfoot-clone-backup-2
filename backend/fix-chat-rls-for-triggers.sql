-- Fix RLS policies to allow triggers to insert chat event messages
-- This is likely the issue preventing chat events from appearing

-- Check current RLS policies
SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual,
  with_check
FROM pg_policies
WHERE tablename = 'chat_messages';

-- Drop existing policies that might be blocking trigger inserts
DROP POLICY IF EXISTS "Users can insert messages in their groups" ON chat_messages;
DROP POLICY IF EXISTS "Users can view messages in their groups" ON chat_messages;
DROP POLICY IF EXISTS "Users can insert their own messages" ON chat_messages;

-- Create new policies that allow both user inserts AND trigger inserts
-- Policy 1: Allow users to view messages in groups they're members of
CREATE POLICY "Users can view group messages"
  ON chat_messages
  FOR SELECT
  USING (
    group_id IN (
      SELECT group_id 
      FROM players 
      WHERE id = auth.uid()
    )
  );

-- Policy 2: Allow users to insert their own messages
CREATE POLICY "Users can insert their messages"
  ON chat_messages
  FOR INSERT
  WITH CHECK (
    sender_id = auth.uid()
    AND group_id IN (
      SELECT group_id 
      FROM players 
      WHERE id = auth.uid()
    )
  );

-- Policy 3: CRITICAL - Allow system (triggers) to insert event messages
-- This bypasses RLS for system-generated messages
CREATE POLICY "System can insert event messages"
  ON chat_messages
  FOR INSERT
  WITH CHECK (
    sender_name = 'System'
    AND type IN (
      'match_live', 
      'match_score', 
      'competition_created', 
      'competition_deadline', 
      'competition_finished'
    )
  );

-- Verify policies were created
SELECT 
  '✅ RLS Policies Updated' as status,
  policyname,
  cmd
FROM pg_policies
WHERE tablename = 'chat_messages'
ORDER BY policyname;

-- Test if we can insert a system message manually
DO $$
DECLARE
  test_group_id UUID;
  test_player_id UUID;
BEGIN
  -- Get a test group and player
  SELECT g.id, p.id INTO test_group_id, test_player_id
  FROM groups g
  JOIN players p ON p.group_id = g.id
  LIMIT 1;
  
  IF test_group_id IS NOT NULL THEN
    -- Try to insert a test system message
    INSERT INTO chat_messages (
      group_id,
      sender_id,
      sender_name,
      message,
      type,
      metadata,
      timestamp
    ) VALUES (
      test_group_id,
      test_player_id,
      'System',
      '🧪 Test system message - if you see this in chat, triggers will work!',
      'competition_created',
      jsonb_build_object('test', true),
      NOW()
    );
    
    RAISE NOTICE '✅ Successfully inserted test system message';
    RAISE NOTICE 'Check your chat to see if it appears!';
  ELSE
    RAISE WARNING '❌ No groups found for testing';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE WARNING '❌ Failed to insert test message: %', SQLERRM;
END $$;

-- Show the test message
SELECT 
  '=== TEST MESSAGE ===' as info,
  cm.message,
  cm.type,
  cm.timestamp,
  g.name as group_name
FROM chat_messages cm
JOIN groups g ON g.id = cm.group_id
WHERE cm.message LIKE '%Test system message%'
ORDER BY cm.timestamp DESC
LIMIT 1;
