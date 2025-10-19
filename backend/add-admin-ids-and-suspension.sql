-- Add admin_ids column to groups table to support multiple admins
ALTER TABLE public.groups ADD COLUMN IF NOT EXISTS admin_ids uuid[] DEFAULT '{}';

-- Add suspended_in_groups column to track suspension status per group
ALTER TABLE public.players ADD COLUMN IF NOT EXISTS suspended_in_groups jsonb DEFAULT '{}';

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_players_suspended_in_groups ON players USING gin(suspended_in_groups);

-- Update existing groups to include admin_id in admin_ids array
UPDATE public.groups
SET admin_ids = ARRAY[admin_id]
WHERE admin_id IS NOT NULL AND (admin_ids IS NULL OR admin_ids = '{}');

-- Create function to check if a player is suspended in a specific group
CREATE OR REPLACE FUNCTION is_player_suspended_in_group(
  p_player_id uuid,
  p_group_id uuid
) RETURNS boolean AS $$
DECLARE
  v_suspension_data jsonb;
  v_suspended_until timestamp with time zone;
BEGIN
  SELECT suspended_in_groups->>p_group_id::text
  INTO v_suspension_data
  FROM players
  WHERE id = p_player_id;
  
  IF v_suspension_data IS NULL THEN
    RETURN false;
  END IF;
  
  v_suspended_until := (v_suspension_data->>'until')::timestamp with time zone;
  
  IF v_suspended_until IS NULL THEN
    RETURN true;
  END IF;
  
  IF v_suspended_until > NOW() THEN
    RETURN true;
  END IF;
  
  RETURN false;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
