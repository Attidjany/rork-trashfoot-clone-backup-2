# Competition Deadline Feature - Setup Guide

## Overview
The competition deadline feature allows users to set a deadline (in days) when creating a competition. After the deadline passes, all unplayed matches are automatically deleted and the competition is marked as completed.

## What Was Implemented

### 1. Database Changes
- **File**: `backend/add-deadline-column.sql`
- Added `deadline_days` column to the `competitions` table
- Run this SQL in your Supabase SQL Editor:
  ```sql
  ALTER TABLE competitions 
  ADD COLUMN IF NOT EXISTS deadline_days INTEGER;
  ```

### 2. Type Definitions
- **File**: `types/game.ts`
- Added `deadlineDays?: number` to the `Competition` interface

### 3. Frontend Changes

#### Create Competition Form
- **File**: `app/create-competition.tsx`
- Added deadline input field (defaults to 7 days)
- Shows info message explaining the deadline behavior
- Saves `deadline_days` to database when creating competition

#### Matches Display
- **File**: `app/(tabs)/matches.tsx`
- Added countdown display on each upcoming match card
- Countdown shows:
  - **Days** (e.g., "5d") - gray color for matches more than 24 hours away
  - **Hours** (e.g., "12h") - orange color for matches less than 24 hours away
  - **Minutes** (e.g., "45m") - red color for matches less than 1 hour away

#### Countdown Utilities
- **File**: `lib/countdown-utils.ts`
- `getMatchCountdown()` - Calculates and formats countdown for matches
- `getCompetitionDeadline()` - Calculates deadline date from start date + days
- `isCompetitionExpired()` - Checks if competition has passed its deadline

### 4. Backend Changes

#### Competition Creation
- **File**: `backend/trpc/routes/competitions/management/route.ts`
- Updated to accept and save `deadlineDays` parameter

#### Automatic Cleanup Function
- **File**: `backend/cleanup-expired-matches.sql`
- PostgreSQL function `cleanup_expired_competitions()` that:
  - Finds competitions past their deadline
  - Deletes all scheduled (unplayed) matches
  - Marks competitions as completed
  - Returns summary of cleaned up competitions

## Setup Instructions

### Step 1: Update Database Schema
Run the following SQL in your Supabase SQL Editor:

```sql
-- Add the deadline_days column
ALTER TABLE competitions 
ADD COLUMN IF NOT EXISTS deadline_days INTEGER;

COMMENT ON COLUMN competitions.deadline_days IS 'Number of days from start_date until competition deadline. After deadline, unplayed matches are auto-deleted.';
```

### Step 2: Install Cleanup Function
Run the SQL from `backend/cleanup-expired-matches.sql` in your Supabase SQL Editor to create the cleanup function.

### Step 3: Set Up Automatic Cleanup (Optional)

#### Option A: Using Supabase Edge Functions (Recommended)
Create a scheduled Edge Function that runs daily:

1. Create a new Edge Function:
   ```bash
   supabase functions new cleanup-expired-matches
   ```

2. Add the function code to call the SQL function:
   ```typescript
   import { createClient } from '@supabase/supabase-js'
   
   Deno.serve(async () => {
     const supabase = createClient(
       Deno.env.get('SUPABASE_URL')!,
       Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
     )
     
     const { data, error } = await supabase.rpc('cleanup_expired_competitions')
     
     if (error) {
       return new Response(JSON.stringify({ error: error.message }), {
         status: 500,
         headers: { 'Content-Type': 'application/json' },
       })
     }
     
     return new Response(JSON.stringify({ 
       success: true, 
       cleaned: data 
     }), {
       headers: { 'Content-Type': 'application/json' },
     })
   })
   ```

3. Deploy the function:
   ```bash
   supabase functions deploy cleanup-expired-matches
   ```

4. Set up a cron job in Supabase Dashboard to run it daily at midnight

#### Option B: Using pg_cron Extension
If you have the pg_cron extension enabled in Supabase:

```sql
SELECT cron.schedule(
  'cleanup-expired-matches',
  '0 0 * * *',  -- Run at midnight every day
  'SELECT cleanup_expired_competitions()'
);
```

#### Option C: Manual Cleanup
You can manually run the cleanup anytime:

```sql
SELECT * FROM cleanup_expired_competitions();
```

This will return a table showing which competitions were cleaned up and how many matches were deleted.

## How It Works

### User Flow
1. User creates a competition and sets deadline to X days (e.g., 7 days)
2. Competition starts today at midnight
3. Deadline is calculated as: `start_date + X days` at 23:59:59
4. Users can see countdown on each match card showing time remaining
5. After deadline passes, cleanup function:
   - Deletes all unplayed (scheduled) matches
   - Marks competition as completed
   - Sets end_date to current timestamp

### Countdown Display
- **More than 24 hours**: Shows days (e.g., "5d") in gray
- **Less than 24 hours**: Shows hours (e.g., "12h") in orange
- **Less than 1 hour**: Shows minutes (e.g., "45m") in red
- **Past scheduled time**: Shows "Now" in red

## Testing

### Test the Feature
1. Create a new competition with a deadline of 1 day
2. Check that matches show countdown badges
3. Manually run cleanup function:
   ```sql
   -- First, update a competition to be expired (for testing)
   UPDATE competitions 
   SET start_date = NOW() - INTERVAL '2 days',
       deadline_days = 1
   WHERE id = 'your-competition-id';
   
   -- Then run cleanup
   SELECT * FROM cleanup_expired_competitions();
   ```
4. Verify that scheduled matches were deleted and competition is marked completed

## Notes
- Completed and live matches are never deleted, only scheduled ones
- The deadline is set to end of day (23:59:59) on the final day
- Countdown updates in real-time as the component renders
- If no deadline is set (`deadline_days` is NULL), competition never expires automatically
