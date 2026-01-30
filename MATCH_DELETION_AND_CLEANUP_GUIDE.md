# Match Deletion & Auto-Completion System

## Overview
This update implements a complete soft-delete system for matches with automatic competition completion and cleanup functionality.

## Features Implemented

### 1. Soft Delete System
- **Matches are no longer permanently deleted** - they are marked as "deleted" with a timestamp
- Delete button now sets `status = 'deleted'` and `deleted_at = NOW()`
- Deleted matches remain in database and can be restored within 7 days

### 2. Automatic Competition Completion
- **Auto-complete when all matches played**: Competition automatically completes when all non-deleted matches are finished
- **Auto-complete on deadline**: Competition automatically completes when `deadline_date` is reached
- **Auto-delete scheduled matches**: When competition completes, all scheduled matches are soft-deleted

### 3. Superadmin Restore Functionality
- Superadmin can view deleted matches with deletion timestamp
- Restore button appears for matches deleted within 7 days
- After 7 days, matches cannot be restored

### 4. Automatic Cleanup
- Function `cleanup_old_deleted_matches()` permanently deletes matches that have been soft-deleted for 7+ days
- Can be called manually or scheduled as a cron job

## Files Created/Modified

### Backend Files
1. **backend/AUTO_COMPLETE_AND_CLEANUP_MATCHES.sql** (NEW)
   - Triggers for auto-completion
   - Cleanup functions
   - Must be run in Supabase SQL Editor

2. **backend/trpc/routes/matches/restore/route.ts** (NEW)
   - tRPC endpoint for restoring deleted matches
   - Validates 7-day window

3. **backend/trpc/routes/matches/delete/route.ts** (MODIFIED)
   - Changed from hard delete to soft delete

4. **backend/trpc/app-router.ts** (MODIFIED)
   - Added restore procedure to matches router

### Frontend Files
1. **app/(tabs)/matches.tsx** (MODIFIED)
   - Changed delete to use soft delete
   - Updates `status` and `deleted_at` instead of removing row

2. **app/superadmin.tsx** (MODIFIED)
   - Added restore button for deleted matches
   - Shows days since deletion
   - Added `RotateCcw` icon import
   - `handleRestoreMatch()` function added

## Setup Instructions

### Step 1: Run SQL Migration
```sql
-- Run this in your Supabase SQL Editor
-- File: backend/AUTO_COMPLETE_AND_CLEANUP_MATCHES.sql
```

This will create:
- ✅ 5 functions for auto-completion and cleanup
- ✅ 3 triggers for realtime competition management
- ✅ Automatic expiration of past-deadline competitions

### Step 2: Verify Installation
After running the SQL, you should see:
```
✅ All 3 triggers and 5 functions installed successfully
```

### Step 3: Test the System

#### Test Auto-Completion
1. Create a competition with a deadline in the past
2. Any match activity will trigger auto-completion
3. All scheduled matches will be soft-deleted

#### Test Soft Delete
1. Delete a match as admin/superadmin
2. Check database - match should have `status='deleted'` and `deleted_at` timestamp
3. Match still exists in database

#### Test Restore (Superadmin Only)
1. Go to Superadmin Dashboard → Matches tab
2. Find deleted match (shows "Xd ago")
3. Click "Restore Match" button
4. Match status returns to "scheduled"

## Database Schema

### matches table (updated)
```sql
- deleted_at: timestamp (nullable)
  - NULL = active match
  - Set = soft deleted match
```

## Functions Available

### Manual Functions (can be called anytime)
```sql
-- Expire all competitions past their deadline
SELECT expire_competitions_past_deadline();

-- Permanently delete matches soft-deleted 7+ days ago
SELECT cleanup_old_deleted_matches();
```

### Automatic Triggers
1. **trigger_mark_scheduled_deleted**
   - When: Competition status → 'completed'
   - Action: Mark all scheduled matches as deleted

2. **trigger_check_all_matches_completed**
   - When: Match status → 'completed'
   - Action: Check if all matches done, complete competition

3. **trigger_check_deadline**
   - When: Any match INSERT/UPDATE
   - Action: Check if competition deadline passed, complete if yes

## Behavior Summary

### When Admin/User Deletes Match:
- ❌ OLD: Match permanently deleted from database
- ✅ NEW: Match marked as deleted, can be restored within 7 days

### When Competition Expires:
- ✅ Competition status → 'completed'
- ✅ All scheduled matches → status 'deleted'

### When All Matches Completed:
- ✅ Competition status → 'completed'
- ✅ All scheduled matches → status 'deleted'

### Superadmin Dashboard:
- ✅ Can see deleted matches
- ✅ Can restore within 7 days
- ✅ Shows days since deletion

### After 7 Days:
- ✅ Deleted matches permanently removed (call cleanup function)
- ❌ Cannot be restored

## Recommended Cron Job
Set up a daily cron to run:
```sql
SELECT cleanup_old_deleted_matches();
```

This will automatically purge old deleted matches every day.

## Notes
- The 7-day window starts from `deleted_at` timestamp
- Only superadmins can restore matches
- Restoring sets status back to 'scheduled'
- Competition completion is irreversible
- All triggers run in realtime with proper logging
