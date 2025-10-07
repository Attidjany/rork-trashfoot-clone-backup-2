-- Fix join_requests table issue
-- The schema uses pending_group_members, not join_requests

-- Ensure pending_group_members table exists with correct structure
CREATE TABLE IF NOT EXISTS pending_group_members (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  group_id UUID NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  player_id UUID NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  player_name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  requested_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(group_id, player_id)
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_pending_group_members_group_id ON pending_group_members(group_id);
CREATE INDEX IF NOT EXISTS idx_pending_group_members_player_id ON pending_group_members(player_id);
CREATE INDEX IF NOT EXISTS idx_pending_group_members_status ON pending_group_members(status);

-- Enable RLS
ALTER TABLE pending_group_members ENABLE ROW LEVEL SECURITY;

-- Drop existing policies
DROP POLICY IF EXISTS "Pending members viewable by admins and requester" ON pending_group_members;
DROP POLICY IF EXISTS "Authenticated users can request to join" ON pending_group_members;
DROP POLICY IF EXISTS "Group admins can update pending members" ON pending_group_members;
DROP POLICY IF EXISTS "Group admins can delete pending members" ON pending_group_members;

-- Recreate policies
CREATE POLICY "Pending members viewable by admins and requester" ON pending_group_members 
  FOR SELECT 
  USING (
    group_id IN (
      SELECT id FROM groups 
      WHERE admin_id IN (
        SELECT id FROM players WHERE auth_user_id = auth.uid()
      )
    )
    OR player_id IN (
      SELECT id FROM players WHERE auth_user_id = auth.uid()
    )
  );

CREATE POLICY "Authenticated users can request to join" ON pending_group_members 
  FOR INSERT 
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Group admins can update pending members" ON pending_group_members 
  FOR UPDATE 
  USING (
    group_id IN (
      SELECT id FROM groups 
      WHERE admin_id IN (
        SELECT id FROM players WHERE auth_user_id = auth.uid()
      )
    )
  );

CREATE POLICY "Group admins can delete pending members" ON pending_group_members 
  FOR DELETE 
  USING (
    group_id IN (
      SELECT id FROM groups 
      WHERE admin_id IN (
        SELECT id FROM players WHERE auth_user_id = auth.uid()
      )
    )
  );

-- Enable realtime for pending_group_members
ALTER PUBLICATION supabase_realtime ADD TABLE pending_group_members;

-- Verification query
SELECT 
  'pending_group_members table exists' as status,
  COUNT(*) as row_count
FROM pending_group_members;
