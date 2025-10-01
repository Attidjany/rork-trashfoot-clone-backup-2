# Supabase Setup Guide for TrashFoot

This guide will help you set up your Supabase database for the TrashFoot application.

## Prerequisites

- A Supabase account (https://supabase.com)
- Your Supabase project created

## Step 1: Run the Database Schema

1. Open your Supabase project dashboard
2. Navigate to the **SQL Editor** (left sidebar)
3. Click **New Query**
4. Copy the entire contents of `backend/supabase-schema.sql`
5. Paste it into the SQL Editor
6. Click **Run** to execute the schema

This will create all necessary tables, indexes, RLS policies, and triggers.

## Step 2: Verify Tables Created

Navigate to **Table Editor** in your Supabase dashboard and verify these tables exist:

- `players` - User profiles
- `player_stats` - Player statistics (global and per-group)
- `groups` - Game groups
- `group_members` - Group membership
- `pending_group_members` - Join requests
- `competitions` - Competitions/tournaments
- `competition_participants` - Competition participants
- `matches` - Match records
- `chat_messages` - Group chat messages

## Step 3: Configure Authentication

1. Go to **Authentication** > **Providers** in Supabase dashboard
2. Enable **Email** provider (should be enabled by default)
3. Under **Email Auth** settings:
   - Disable "Confirm email" for testing (you already did this)
   - You can enable it later for production

## Step 4: Test the Integration

### Create a Test Account

1. Start your app
2. Go to the registration screen
3. Create a new account with:
   - Name: Your name
   - Gamer Handle: A unique handle
   - Email: Your email
   - Password: At least 6 characters

### Verify in Supabase

1. Go to **Authentication** > **Users** in Supabase
2. You should see your new user
3. Go to **Table Editor** > **players**
4. You should see your player profile

## Step 5: Create Your First Group

1. In the app, create a new group
2. Verify in Supabase:
   - **Table Editor** > **groups** - Your group should appear
   - **Table Editor** > **group_members** - You should be listed as a member
   - **Table Editor** > **player_stats** - Stats entry for your player in this group

## Database Structure Overview

### Players & Authentication
- `auth.users` - Supabase auth users (managed by Supabase)
- `players` - Extended player profiles linked to auth users
- `player_stats` - Statistics (one row per player per group, plus global stats)

### Groups & Membership
- `groups` - Game groups/leagues
- `group_members` - Many-to-many relationship between players and groups
- `pending_group_members` - Join requests awaiting approval

### Competitions & Matches
- `competitions` - Leagues, tournaments, friendlies
- `competition_participants` - Players in each competition
- `matches` - Individual matches with scores
- `chat_messages` - Group chat messages

## Row Level Security (RLS)

RLS is enabled on all tables with the following policies:

### Public Access
- All players can view other players' profiles
- Public groups are visible to everyone
- Player stats are visible to everyone

### Group Access
- Only group members can view private groups
- Only group members can view competitions and matches
- Only group members can view chat messages

### Admin Access
- Group admins can manage their groups
- Group admins can create competitions
- Group admins can manage members

### Player Access
- Players can update their own profiles
- Players can update match results they're involved in
- Players can send messages in groups they're members of

## Troubleshooting

### "Permission denied" errors
- Check that RLS policies are properly set up
- Verify the user is authenticated
- Check that the user is a member of the group they're trying to access

### "Relation does not exist" errors
- Make sure you ran the entire schema SQL
- Check that all tables were created successfully

### Authentication errors
- Verify email confirmation is disabled for testing
- Check that the Supabase URL and keys are correct in the code
- Make sure the user exists in the auth.users table

## Next Steps

1. **Enable Email Confirmation**: For production, enable email confirmation in Supabase Auth settings
2. **Set up Storage**: If you want to add profile pictures or group images, set up Supabase Storage
3. **Add Realtime**: Enable realtime subscriptions for live updates of matches and chat
4. **Backup**: Set up regular database backups in Supabase dashboard

## Security Notes

- The service role key is used in the backend only (never expose it to the client)
- The anon key is safe to use in the client
- RLS policies protect your data even if someone has the anon key
- Always validate user permissions on the backend for sensitive operations

## Support

If you encounter any issues:
1. Check the browser console for errors
2. Check the Supabase logs in the dashboard
3. Verify your RLS policies are correct
4. Make sure all tables and indexes were created
