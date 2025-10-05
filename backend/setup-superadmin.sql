-- Setup superadmin user
-- This script will set the user appdev@prospective.group as a superadmin

-- First, update the player role to super_admin
UPDATE players
SET role = 'super_admin'
WHERE email = 'appdev@prospective.group';

-- Verify the update
SELECT id, name, email, role, gamer_handle
FROM players
WHERE email = 'appdev@prospective.group';

-- If the user doesn't exist yet, you'll need to create them first through the normal registration flow
-- Then run this script to upgrade them to super_admin

-- To check all super admins:
SELECT id, name, email, role, gamer_handle, joined_at
FROM players
WHERE role = 'super_admin'
ORDER BY joined_at DESC;
