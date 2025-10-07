# Fix Guide: Superadmin & Chat Events

## Issues Found

1. **Superadmin showing 0 competitions**: The superadmin page uses direct Supabase queries, but RLS policies only allow group members to view competitions. Superadmin needs bypass policies.

2. **Chat events not appearing**: The trigger functions need `SECURITY DEFINER` to bypass RLS when inserting system messages, and the RLS policy for system messages needs to be properly configured.

## Solution

Run these SQL files in your Supabase SQL Editor **in this order**:

### Step 1: Diagnose (Optional)
```sql
-- Run this first to see what's wrong
backend/diagnose-and-fix-all-issues.sql
```

This will show you:
- Which triggers exist
- Which RLS policies are active
- Test if triggers can create messages
- Show recent system messages
- Show competitions data

### Step 2: Fix Everything
```sql
-- Run this to fix both issues
backend/fix-superadmin-and-chat-events.sql
```

This will:
- Add superadmin bypass policies for all tables (competitions, groups, matches, players, etc.)
- Fix chat event triggers with `SECURITY DEFINER`
- Recreate all trigger functions
- Verify the setup

## What the Fix Does

### For Superadmin (0 competitions issue):
- Adds `"Superadmin can view all competitions"` policy
- Adds `"Superadmin can view all groups"` policy
- Adds `"Superadmin can view all matches"` policy
- Adds `"Superadmin can view all players"` policy
- Adds `"Superadmin can view all group members"` policy
- Adds `"Superadmin can view all join requests"` policy

These policies check if the current user has `role = 'super_admin'` and bypass normal RLS restrictions.

### For Chat Events (no system messages issue):
- Recreates trigger functions with `SECURITY DEFINER` flag
- This allows triggers to bypass RLS when inserting system messages
- Ensures `chat_insert_system_policy` allows system messages
- Fixes all 4 event types:
  - `match_live` - when a match goes live
  - `match_score` - when a match is completed
  - `competition_created` - when a competition is created
  - `competition_finished` - when a competition finishes

## Testing

After running the SQL:

### Test Superadmin:
1. Go to `/superadmin`
2. Login with your super_admin account
3. Check the "Competitions" tab - should now show all competitions
4. Check other tabs - should show all data

### Test Chat Events:
1. Open the app in two browser tabs
2. Go to the Chat tab in both
3. **Test realtime chat**: Send a message in one tab, should appear in the other
4. **Test competition event**: Create a new competition, should see "🎮 New League created..." in chat
5. **Test match live event**: Start a match (set to live), should see "🔴 LIVE: Player1 vs Player2" in chat
6. **Test match score event**: Complete a match with a score, should see "🏆 Player1 3 - 1 Player2" in chat

## Console Logs to Watch

When testing chat events, watch the console for:
- `✅ Successfully subscribed to chat messages` - realtime is working
- `💬 New message received:` - message received via realtime
- `📥 Loaded X messages` - initial messages loaded

If you see these, realtime is working. If events still don't appear, check the Supabase logs for trigger execution.

## Troubleshooting

### Superadmin still shows 0 competitions:
1. Verify your user has `role = 'super_admin'` in the players table
2. Check you're logged in with the correct account
3. Run the diagnostic SQL to see if competitions exist in the database

### Chat events still not appearing:
1. Check console for realtime subscription status
2. Run the diagnostic SQL to test trigger execution
3. Check Supabase logs for any trigger errors
4. Verify you're in the correct group (events only appear in the group's chat)

### Realtime not working:
1. Check if `supabase_realtime` publication includes `chat_messages` table
2. Verify RLS policies allow reading messages
3. Check browser console for WebSocket errors
