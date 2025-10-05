# Join Request System Setup Guide

## Overview
This guide explains how to implement the join request system for your TrashFoot app. All groups are now private by default, and users must request to join groups. Admins can approve or reject these requests.

## Step 1: Run the SQL Migration

Run the SQL file `backend/implement-join-requests.sql` in your Supabase SQL Editor. This will:

1. **Make all groups private by default**
   - Sets `is_public` default to `false`
   - Updates all existing groups to be private

2. **Create database functions**
   - `approve_join_request(p_pending_id, p_admin_player_id)` - Approves a join request and adds the player to the group
   - `reject_join_request(p_pending_id, p_admin_player_id)` - Rejects a join request

3. **Add indexes** for better performance on pending requests queries

4. **Set up RLS policies** for pending members table

## Step 2: How It Works

### For Users Requesting to Join:
1. User browses available groups in the Group Browser
2. User clicks on a group and selects "Send Request"
3. A pending request is created in the `pending_group_members` table
4. User receives confirmation that their request was sent

### For Group Admins:
1. Admin sees a new "Requests" tab in Group Details (only visible to admins)
2. The tab shows a count badge if there are pending requests
3. Admin can view all pending requests with:
   - Player name
   - Request date
4. Admin can approve or reject each request with confirmation dialogs
5. When approved:
   - Player is added to `group_members`
   - Player stats are created for the group
   - Pending request is removed
6. When rejected:
   - Pending request is removed

### Real-time Updates:
- The Requests tab uses Supabase real-time subscriptions
- When a request is approved/rejected, the UI updates automatically
- Group members list updates in real-time when new members are added

## Step 3: Features Implemented

### Group Browser (`app/group-browser.tsx`)
- ✅ Changed join flow to create pending requests instead of direct joins
- ✅ Checks for existing pending requests to prevent duplicates
- ✅ Shows appropriate messaging about admin approval

### Group Details (`app/group-details.tsx`)
- ✅ Added new "Requests" tab (admin-only)
- ✅ Shows pending request count in tab label
- ✅ Lists all pending requests with player info
- ✅ Approve/Reject buttons with confirmation dialogs
- ✅ Real-time subscription for pending requests
- ✅ Empty state when no pending requests

### Database Functions
- ✅ `approve_join_request` - Handles approval logic with proper validation
- ✅ `reject_join_request` - Handles rejection logic with proper validation
- ✅ Both functions verify admin permissions before executing

## Step 4: Testing the System

1. **Create a test group** as User A
2. **Log in as User B** and browse groups
3. **Send a join request** to User A's group
4. **Log in as User A** and go to Group Details
5. **Check the Requests tab** - you should see User B's request
6. **Approve or reject** the request
7. **Verify** that User B appears in the Members tab if approved

## Database Schema

The `pending_group_members` table structure:
```sql
CREATE TABLE pending_group_members (
  id UUID PRIMARY KEY,
  group_id UUID REFERENCES groups(id),
  player_id UUID REFERENCES players(id),
  player_name TEXT NOT NULL,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  requested_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(group_id, player_id)
);
```

## Security

- ✅ RLS policies ensure only admins can approve/reject requests
- ✅ Functions verify admin permissions before executing
- ✅ Unique constraint prevents duplicate requests
- ✅ All operations are logged with timestamps

## Notes

- All groups are now private by default (`is_public = false`)
- The group browser still shows groups (for discovery), but joining requires approval
- Admins can see pending requests in real-time
- The system prevents duplicate requests automatically
- When a request is approved, player stats are automatically created

## Future Enhancements (Optional)

- Add notifications for users when their request is approved/rejected
- Add a message field to join requests
- Add ability to cancel pending requests
- Add request expiration (auto-reject after X days)
