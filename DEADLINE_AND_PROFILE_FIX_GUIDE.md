# Deadline & Profile Update Fix Guide

## Issues Fixed

### 1. ✅ Automatic Match Deletion When Deadline Expires
**Problem:** When competition deadline arrives, matches show "Expired" badge but aren't deleted automatically, and competition status isn't updated to "completed".

**Solution:** Created a database trigger system that automatically:
- Deletes all scheduled matches when deadline is reached
- Marks the competition as "completed"
- Inserts a system chat message notifying users

**To Apply:**
1. Run the SQL file in Supabase SQL Editor:
   ```
   /backend/AUTO_DELETE_EXPIRED_MATCHES.sql
   ```

This creates:
- A trigger function that runs on match operations
- A manual cleanup function you can call periodically
- System messages in chat when competitions expire

### 2. ✅ Friendly Matches Filtering
**Problem:** Friendly matches appeared in "Completed" and "Archived" tabs, mixing with competition matches.

**Solution:** Updated the matches.tsx filtering logic to:
- Exclude friendly matches from active competitions
- Exclude friendly matches from completed/archived competitions
- Keep friendly matches only in the "Friendly" tab

**Changes Applied:**
- `app/(tabs)/matches.tsx` - Lines 83-85

### 3. ✅ Profile Editing
**Problem:** Profile editing functionality wasn't working properly.

**Solution:** Enhanced the profile update code in settings.tsx to:
- Better error handling
- Return and log the updated player data
- Properly refetch groups after update

**Changes Applied:**
- `app/settings.tsx` - Lines 129-148

## How to Test

### Test 1: Deadline Expiration
1. Create a competition with a deadline (e.g., 1 day)
2. Create some matches for it
3. Wait for deadline to pass OR manually update the competition's start_date in database to simulate expiration
4. Trigger the cleanup function:
   ```sql
   SELECT * FROM cleanup_all_expired_competitions();
   ```
5. Verify:
   - ✅ Scheduled matches are deleted
   - ✅ Competition status is "completed"
   - ✅ System message appears in chat

### Test 2: Friendly Matches
1. Create a friendly competition
2. Add matches to it (scheduled, live, completed)
3. Navigate to Matches tab
4. Verify:
   - ✅ Friendly matches only appear in "Friendly" tab
   - ✅ They don't appear in "Completed" or "Archived"
   - ✅ Competition matches appear normally

### Test 3: Profile Editing
1. Go to Settings
2. Click on your profile card to edit
3. Change name and/or gamer handle
4. Save
5. Verify:
   - ✅ Success message appears
   - ✅ Profile updates immediately
   - ✅ New name/handle appears in all tabs
   - ✅ Check console for success logs

## Technical Details

### Deadline System Architecture

The system uses PostgreSQL triggers that run automatically:

```
Competition Created with deadline_days
         ↓
Trigger monitors match operations
         ↓
When deadline passes:
  1. Delete scheduled matches
  2. Update competition status
  3. Insert system message
         ↓
Frontend shows expired competitions correctly
```

### Why Triggers?

Using database triggers ensures:
- ⚡ Automatic cleanup without manual intervention
- 🔒 Data consistency (can't have scheduled matches after deadline)
- 📊 Real-time updates via Supabase realtime
- 🎯 Works even when app is closed

### Optional: Scheduled Cleanup

If you want periodic cleanup (recommended), you can set up a cron job:

```sql
-- Runs every 5 minutes (requires pg_cron extension)
SELECT cron.schedule(
  'cleanup-expired-competitions', 
  '*/5 * * * *', 
  'SELECT cleanup_all_expired_competitions()'
);
```

## Migration Steps

1. **Backup your database** (always!)
   ```sql
   -- Export current state
   SELECT * FROM competitions WHERE status IN ('upcoming', 'active');
   SELECT * FROM matches WHERE status = 'scheduled';
   ```

2. **Run the SQL file**
   - Open Supabase Dashboard
   - Go to SQL Editor
   - Copy/paste contents of `/backend/AUTO_DELETE_EXPIRED_MATCHES.sql`
   - Execute

3. **Test manually**
   ```sql
   -- Test the cleanup function
   SELECT * FROM cleanup_all_expired_competitions();
   ```

4. **Verify the triggers exist**
   ```sql
   SELECT * FROM pg_trigger WHERE tgname = 'check_expired_competitions_on_match';
   ```

5. **App changes are already applied** - just deploy/refresh

## Troubleshooting

### Issue: Matches not deleting
**Check:**
```sql
-- Verify trigger exists
SELECT * FROM pg_trigger WHERE tgname LIKE '%expired%';

-- Check competition deadline
SELECT id, name, start_date, deadline_days, 
       (start_date + (deadline_days || ' days')::INTERVAL) as deadline_time,
       NOW() as current_time,
       status
FROM competitions 
WHERE deadline_days IS NOT NULL;
```

### Issue: Profile not updating
**Check Console:**
- Look for "🔄 Updating profile" log
- Look for "✅ Profile updated successfully" log
- Check for any error messages

**Check Database:**
```sql
-- Verify player record
SELECT id, name, gamer_handle, email 
FROM players 
WHERE auth_user_id = 'YOUR_USER_ID';
```

## Notes

- ⏰ Triggers run immediately when any match is inserted/updated
- 🔄 Manual cleanup function can be called anytime
- 💾 All changes are atomic (all succeed or all fail)
- 📱 Frontend will auto-update via realtime subscriptions
- 🎮 Friendly matches are completely isolated from competition logic

## Support

If you encounter issues:
1. Check console logs (both browser and server)
2. Run diagnostic queries above
3. Verify trigger exists and is enabled
4. Check RLS policies aren't blocking updates
