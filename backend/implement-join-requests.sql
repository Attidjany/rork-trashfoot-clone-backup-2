-- Make all groups private by default
ALTER TABLE groups ALTER COLUMN is_public SET DEFAULT false;

-- Update existing groups to be private
UPDATE groups SET is_public = false;

-- Add index for pending members
CREATE INDEX IF NOT EXISTS idx_pending_group_members_group_id ON pending_group_members(group_id);
CREATE INDEX IF NOT EXISTS idx_pending_group_members_player_id ON pending_group_members(player_id);
CREATE INDEX IF NOT EXISTS idx_pending_group_members_status ON pending_group_members(status);

-- Delete policy for pending members (admins can delete/reject)
DROP POLICY IF EXISTS "Group admins can delete pending members" ON pending_group_members;
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

-- Function to approve join request
CREATE OR REPLACE FUNCTION approve_join_request(
  p_pending_id UUID,
  p_admin_player_id UUID
)
RETURNS JSONB AS $$
DECLARE
  v_pending_record RECORD;
  v_group_admin_id UUID;
BEGIN
  -- Get pending request details
  SELECT * INTO v_pending_record
  FROM pending_group_members
  WHERE id = p_pending_id AND status = 'pending';
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'message', 'Pending request not found');
  END IF;
  
  -- Verify admin permissions
  SELECT admin_id INTO v_group_admin_id
  FROM groups
  WHERE id = v_pending_record.group_id;
  
  IF v_group_admin_id != p_admin_player_id THEN
    RETURN jsonb_build_object('success', false, 'message', 'Not authorized');
  END IF;
  
  -- Check if already a member
  IF EXISTS (
    SELECT 1 FROM group_members 
    WHERE group_id = v_pending_record.group_id 
    AND player_id = v_pending_record.player_id
  ) THEN
    -- Delete the pending request
    DELETE FROM pending_group_members WHERE id = p_pending_id;
    RETURN jsonb_build_object('success', false, 'message', 'Already a member');
  END IF;
  
  -- Add to group members
  INSERT INTO group_members (group_id, player_id, is_admin)
  VALUES (v_pending_record.group_id, v_pending_record.player_id, false);
  
  -- Create player stats for the group
  INSERT INTO player_stats (player_id, group_id)
  VALUES (v_pending_record.player_id, v_pending_record.group_id)
  ON CONFLICT (player_id, group_id) DO NOTHING;
  
  -- Update pending status to approved
  UPDATE pending_group_members
  SET status = 'approved'
  WHERE id = p_pending_id;
  
  -- Delete the pending request
  DELETE FROM pending_group_members WHERE id = p_pending_id;
  
  RETURN jsonb_build_object('success', true, 'message', 'Request approved');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to reject join request
CREATE OR REPLACE FUNCTION reject_join_request(
  p_pending_id UUID,
  p_admin_player_id UUID
)
RETURNS JSONB AS $$
DECLARE
  v_pending_record RECORD;
  v_group_admin_id UUID;
BEGIN
  -- Get pending request details
  SELECT * INTO v_pending_record
  FROM pending_group_members
  WHERE id = p_pending_id AND status = 'pending';
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'message', 'Pending request not found');
  END IF;
  
  -- Verify admin permissions
  SELECT admin_id INTO v_group_admin_id
  FROM groups
  WHERE id = v_pending_record.group_id;
  
  IF v_group_admin_id != p_admin_player_id THEN
    RETURN jsonb_build_object('success', false, 'message', 'Not authorized');
  END IF;
  
  -- Update status to rejected
  UPDATE pending_group_members
  SET status = 'rejected'
  WHERE id = p_pending_id;
  
  -- Delete the pending request
  DELETE FROM pending_group_members WHERE id = p_pending_id;
  
  RETURN jsonb_build_object('success', true, 'message', 'Request rejected');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION approve_join_request(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION reject_join_request(UUID, UUID) TO authenticated;
