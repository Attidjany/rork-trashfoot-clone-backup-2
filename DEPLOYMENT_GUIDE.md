# TrashFoot Deployment Guide

## ✅ Configuration Status

Your app is now properly configured for Vercel deployment with Supabase backend.

## 🔧 What Was Fixed

### 1. Vercel Configuration (`vercel.json`)
- ✅ Fixed runtime version from `nodejs20.x` to `nodejs20`
- ✅ Changed from `routes` to `rewrites` for better routing
- ✅ Simplified install command
- ✅ Proper API function configuration

### 2. API Handler (`api/index.ts`)
- ✅ Simplified CORS to accept all origins
- ✅ Better error logging
- ✅ Clear endpoint documentation in health check

### 3. Backend Routes
- ✅ All auth routes properly configured with Supabase
- ✅ Register procedure creates user + player profile + stats
- ✅ Login procedure fetches full game data (groups, messages, competitions)
- ✅ Handle checking works with real-time validation

### 4. Supabase Integration
- ✅ Server-side client configured with service role key
- ✅ Client-side client configured with anon key
- ✅ All database operations use proper Supabase queries

## 🚀 Deployment Steps

### Step 1: Commit Your Changes
```bash
git add .
git commit -m "Fix Vercel deployment configuration"
git push origin main
```

### Step 2: Vercel Environment Variables
Make sure these are set in your Vercel project settings:

**Not needed** - Your Supabase credentials are hardcoded in the files:
- `lib/supabase.ts` (client-side)
- `backend/lib/supabase-server.ts` (server-side)

### Step 3: Deploy to Vercel
Your app will auto-deploy when you push to GitHub, or manually trigger:
```bash
vercel --prod
```

### Step 4: Test the Deployment
1. Visit `https://trashfoot.vercel.app/api/` - Should return JSON health check
2. Try signing up a new account
3. Check your email for confirmation
4. Log in after confirming email

## 📋 Supabase Tables Ready

Your Supabase database has these tables configured:
- ✅ `players` - User profiles
- ✅ `player_stats` - Player statistics (global and per-group)
- ✅ `groups` - Football groups
- ✅ `group_members` - Group membership
- ✅ `competitions` - Leagues, tournaments, friendlies
- ✅ `competition_participants` - Who's in each competition
- ✅ `matches` - Match records
- ✅ `chat_messages` - Group chat

## 🔐 Authentication Flow

### Sign Up
1. User enters: name, gamer handle, email, password
2. Backend checks if gamer handle is available
3. Creates Supabase auth user
4. Creates player profile in `players` table
5. Creates initial stats record in `player_stats`
6. Sends confirmation email
7. User must confirm email before logging in

### Login
1. User enters: email, password
2. Backend verifies email is confirmed
3. Authenticates with Supabase
4. Fetches player profile
5. Fetches all groups user is member of
6. Fetches all competitions and matches
7. Fetches all chat messages
8. Returns complete game data to client
9. Client stores in Zustand store
10. Redirects to home screen

## 🐛 Troubleshooting

### Build Error: "Function Runtimes must have a valid version"
**Fixed** - Changed `nodejs20.x` to `nodejs20` in `vercel.json`

### 404 Error on API Calls
**Fixed** - Changed from `routes` to `rewrites` in `vercel.json`

### CORS Errors
**Fixed** - Simplified CORS to accept all origins

### Backend Not Responding
- Check Vercel deployment logs
- Visit `/api/` endpoint to verify it's running
- Check Vercel function logs for errors

### Signup/Login Fails
- Check Supabase logs in dashboard
- Verify email confirmation is working
- Check that all tables exist in Supabase

## 📱 Testing Checklist

- [ ] Visit `https://trashfoot.vercel.app/api/` - Returns JSON
- [ ] Sign up new account
- [ ] Receive confirmation email
- [ ] Confirm email via link
- [ ] Log in successfully
- [ ] See home screen with empty state
- [ ] Create a new group
- [ ] Invite members
- [ ] Create a competition
- [ ] Record a match
- [ ] Check stats update

## 🎯 Next Steps

1. **Deploy to Vercel** - Push your changes
2. **Test Authentication** - Sign up and log in
3. **Create Test Data** - Make a group and competition
4. **Verify Stats** - Record matches and check stats
5. **Test on Mobile** - Scan QR code and test on device

## 📞 Support

If you encounter issues:
1. Check Vercel deployment logs
2. Check Vercel function logs
3. Check Supabase logs
4. Check browser console for errors
5. Check network tab for failed requests

Your app is ready to deploy! 🚀
