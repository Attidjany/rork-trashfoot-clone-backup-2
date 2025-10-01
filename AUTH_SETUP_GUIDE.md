# Auth Setup Guide - Step by Step

## ✅ Current Implementation Status

Your auth system is **fully implemented** and ready to use. Here's what's working:

### Backend (Supabase + tRPC)
- ✅ User registration with email/password
- ✅ Player profile creation
- ✅ Stats initialization
- ✅ Login with email confirmation check
- ✅ Full game data loading on login
- ✅ Gamer handle uniqueness validation

### Frontend
- ✅ Beautiful auth UI with login/signup modes
- ✅ Real-time gamer handle availability checking
- ✅ Password visibility toggle
- ✅ Proper error handling and user feedback
- ✅ Email confirmation reminder

---

## 🔧 Supabase Configuration Required

To make auth work, you need to configure Supabase email settings:

### Step 1: Configure Email Confirmation

1. Go to your Supabase Dashboard: https://supabase.com/dashboard/project/ckrusxwmrselsvepveet
2. Navigate to **Authentication** → **Settings**
3. Find **Email Auth** section
4. Configure these settings:

   **Option A: Disable Email Confirmation (For Testing)**
   - Set "Enable email confirmations" to **OFF**
   - This allows immediate login after signup
   - Good for development/testing

   **Option B: Enable Email Confirmation (For Production)**
   - Set "Enable email confirmations" to **ON**
   - Configure email templates
   - Set up SMTP or use Supabase's email service
   - Users must click confirmation link before login

### Step 2: Configure Email Templates (If using confirmation)

1. Go to **Authentication** → **Email Templates**
2. Customize the "Confirm signup" template
3. Make sure the confirmation URL is set to: `https://trashfoot.vercel.app/auth`

### Step 3: Test the Flow

#### Testing Registration:

1. Open your app: https://trashfoot.vercel.app/auth
2. Click "Sign Up"
3. Fill in:
   - Full Name: "Test User"
   - Gamer Handle: "test_player_123"
   - Email: "your-email@example.com"
   - Password: "password123"
4. Click "Create Account"

**Expected Result:**
- Success message: "Check Your Email"
- Confirmation email sent (if enabled)
- User redirected to login mode

#### Testing Login (Without Email Confirmation):

1. Switch to "Login" mode
2. Enter email and password
3. Click "Login"

**Expected Result:**
- Successful login
- Redirect to home screen
- User data loaded

#### Testing Login (With Email Confirmation):

1. Check your email inbox
2. Click the confirmation link
3. Return to app and login

**Expected Result:**
- Email confirmed
- Successful login
- Redirect to home screen

---

## 🐛 Troubleshooting

### Issue: "Please confirm your email address before logging in"

**Solution:**
- Check your email inbox for confirmation link
- OR disable email confirmation in Supabase settings (for testing)

### Issue: "Invalid email or password"

**Possible causes:**
1. Wrong credentials
2. User doesn't exist
3. Email not confirmed (if confirmation is enabled)

**Solution:**
- Double-check credentials
- Try registering again
- Check Supabase Auth users table

### Issue: Backend not responding

**Solution:**
- Check Vercel deployment status
- Verify environment variables are set
- Check Vercel function logs

---

## 📊 Verify Database Setup

Run this query in Supabase SQL Editor to check if tables are ready:

```sql
-- Check if all tables exist
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN (
  'players', 
  'player_stats', 
  'groups', 
  'group_members',
  'competitions',
  'matches',
  'chat_messages'
);

-- Check if any users exist
SELECT COUNT(*) as user_count FROM players;

-- Check auth users
SELECT email, email_confirmed_at, created_at 
FROM auth.users 
ORDER BY created_at DESC 
LIMIT 5;
```

---

## 🎯 Quick Start Checklist

- [ ] Supabase tables created (run schema.sql)
- [ ] Email confirmation configured in Supabase
- [ ] Vercel deployment successful
- [ ] Environment variables set (if any)
- [ ] Test registration works
- [ ] Test login works
- [ ] Test email confirmation (if enabled)

---

## 🔐 Security Notes

1. **Service Role Key**: Currently hardcoded in `backend/lib/supabase-server.ts`
   - ⚠️ This should be moved to environment variables for production
   - Add to Vercel environment variables: `SUPABASE_SERVICE_ROLE_KEY`

2. **Row Level Security (RLS)**: Already enabled on all tables
   - Users can only access their own data
   - Group members can access group data
   - Admins have elevated permissions

3. **Password Requirements**: Minimum 6 characters
   - Consider increasing to 8+ for production
   - Add complexity requirements if needed

---

## 📝 Next Steps After Auth Works

Once auth is working, you can:

1. ✅ Create groups
2. ✅ Invite players to groups
3. ✅ Create competitions
4. ✅ Record matches
5. ✅ View stats and leaderboards
6. ✅ Chat with group members

All these features are already implemented and waiting for authenticated users!

---

## 🆘 Need Help?

If you're still having issues:

1. Check browser console for errors
2. Check Vercel function logs
3. Check Supabase logs (Authentication → Logs)
4. Verify all tables exist in Supabase
5. Test the backend health check: https://trashfoot.vercel.app/api/

The auth system is fully implemented - you just need to configure Supabase email settings!
