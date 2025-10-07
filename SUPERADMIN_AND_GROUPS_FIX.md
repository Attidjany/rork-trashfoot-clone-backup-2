# Superadmin Access & Group Visibility Fix

## Issues Fixed

1. **Superadmin Access**: Superadmin can now view and manage all data in the superadmin dashboard
2. **Group Visibility**: All groups (public and private) are now visible in the group browser so users can request to join them

## Changes Applied

### 1. Database Policies

The SQL file `backend/add-superadmin-policies.sql` adds:

- **Superadmin helper function**: `is_superadmin()` - checks if current user is a superadmin
- **Superadmin policies for all tables**: Allows superadmin to SELECT, UPDATE, DELETE on:
  - groups
  - group_members
  - competitions
  - competition_participants
  - matches
  - pending_group_members
  - chat_messages
  - players
  - player_stats

- **Group browsing policy**: `groups_select_all_for_browsing` - allows all authenticated users to view all groups (both public and private) so they can request to join

### 2. How It Works

#### Superadmin Access
- When a user with `role = 'super_admin'` in the players table logs in, they get full access
- The `is_superadmin()` function checks if the current authenticated user has the superadmin role
- All superadmin policies use this function to grant access

#### Group Visibility
- Previously: Only public groups were visible in the group browser
- Now: All groups are visible, but users still need to request to join private groups
- The join request system remains unchanged - admins still approve/reject requests

## How to Apply

### Step 1: Run the SQL Script

Go to your Supabase dashboard:
1. Navigate to **SQL Editor**
2. Create a new query
3. Copy the contents of `backend/add-superadmin-policies.sql`
4. Run the query

### Step 2: Verify the Changes

After running the script, you should see output showing all the new policies created.

You can verify by running:

```sql
-- Check superadmin policies
SELECT tablename, policyname, cmd
FROM pg_policies
WHERE schemaname = 'public'
  AND policyname LIKE '%superadmin%'
ORDER BY tablename, policyname;

-- Check group browsing policy
SELECT tablename, policyname, cmd, qual
FROM pg_policies
WHERE schemaname = 'public'
  AND policyname = 'groups_select_all_for_browsing';
```

### Step 3: Test Superadmin Access

1. Log in with a superadmin account
2. Navigate to `/superadmin` page
3. Verify you can see:
   - All groups with their members
   - All players
   - All matches
   - All competitions
   - All join requests
4. Test that you can:
   - Delete groups
   - Remove users from groups
   - Assign new admins
   - Delete matches
   - Correct match scores
   - Approve/reject join requests
   - Delete competitions
   - Delete players

### Step 4: Test Group Browsing

1. Log in with a regular user account
2. Navigate to `/group-browser` page
3. Verify you can see:
   - All groups (both public and private)
   - Group details (name, description, member count)
   - Invite codes
4. Test that you can:
   - Request to join any group
   - See your pending requests

## Security Notes

- **Superadmin policies are additive**: They don't replace existing policies, they add additional access for superadmins
- **Regular users still have restricted access**: Only superadmins get full access
- **Group visibility doesn't bypass join requests**: Users can see all groups but still need approval to join private ones
- **The `is_superadmin()` function is SECURITY DEFINER**: It runs with elevated privileges to check the players table

## Troubleshooting

### Superadmin can't see data
1. Verify the user has `role = 'super_admin'` in the players table:
   ```sql
   SELECT id, name, email, role FROM players WHERE role = 'super_admin';
   ```
2. Check if the policies were created:
   ```sql
   SELECT COUNT(*) FROM pg_policies WHERE policyname LIKE '%superadmin%';
   ```
   Should return at least 20 policies.

### Groups not showing in browser
1. Check if the browsing policy exists:
   ```sql
   SELECT * FROM pg_policies WHERE policyname = 'groups_select_all_for_browsing';
   ```
2. Verify RLS is enabled on groups table:
   ```sql
   SELECT tablename, rowsecurity FROM pg_tables WHERE tablename = 'groups';
   ```

### Infinite recursion errors
The new policies use direct `auth.uid()` checks and don't reference other tables in a circular way, so they shouldn't cause recursion issues.

## Rollback

If you need to rollback these changes:

```sql
-- Remove superadmin policies
DROP POLICY IF EXISTS groups_select_superadmin ON groups;
DROP POLICY IF EXISTS groups_update_superadmin ON groups;
DROP POLICY IF EXISTS groups_delete_superadmin ON groups;
DROP POLICY IF EXISTS group_members_select_superadmin ON group_members;
DROP POLICY IF EXISTS group_members_insert_superadmin ON group_members;
DROP POLICY IF EXISTS group_members_delete_superadmin ON group_members;
DROP POLICY IF EXISTS competitions_select_superadmin ON competitions;
DROP POLICY IF EXISTS competitions_update_superadmin ON competitions;
DROP POLICY IF EXISTS competitions_delete_superadmin ON competitions;
DROP POLICY IF EXISTS competition_participants_select_superadmin ON competition_participants;
DROP POLICY IF EXISTS competition_participants_delete_superadmin ON competition_participants;
DROP POLICY IF EXISTS matches_select_superadmin ON matches;
DROP POLICY IF EXISTS matches_update_superadmin ON matches;
DROP POLICY IF EXISTS matches_delete_superadmin ON matches;
DROP POLICY IF EXISTS pending_members_select_superadmin ON pending_group_members;
DROP POLICY IF EXISTS pending_members_update_superadmin ON pending_group_members;
DROP POLICY IF EXISTS pending_members_delete_superadmin ON pending_group_members;
DROP POLICY IF EXISTS chat_messages_select_superadmin ON chat_messages;
DROP POLICY IF EXISTS players_update_superadmin ON players;
DROP POLICY IF EXISTS players_delete_superadmin ON players;
DROP POLICY IF EXISTS player_stats_select_superadmin ON player_stats;
DROP POLICY IF EXISTS player_stats_update_superadmin ON player_stats;
DROP POLICY IF EXISTS player_stats_delete_superadmin ON player_stats;

-- Remove group browsing policy
DROP POLICY IF EXISTS groups_select_all_for_browsing ON groups;

-- Remove helper function
DROP FUNCTION IF EXISTS is_superadmin();
```
