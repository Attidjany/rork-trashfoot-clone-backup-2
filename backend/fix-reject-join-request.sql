-- Fix the reject_join_request function to properly delete the pending request
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
  
  -- Delete the pending request immediately (no status update needed)
  DELETE FROM pending_group_members WHERE id = p_pending_id;
  
  RETURN jsonb_build_object('success', true, 'message', 'Request rejected');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION reject_join_request(UUID, UUID) TO authenticated;
