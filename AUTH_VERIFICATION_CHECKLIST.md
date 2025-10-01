# Auth System Verification Checklist

## ✅ Step-by-Step Verification Guide

Follow these steps in order to verify your auth system is working correctly.

---

## Phase 1: Backend Verification

### ✅ Step 1: Check Vercel Deployment
- [ ] Go to: https://vercel.com/dashboard
- [ ] Find your project: trashfoot
- [ ] Verify latest deployment is successful (green checkmark)
- [ ] Check deployment logs for any errors

### ✅ Step 2: Test Backend Health
- [ ] Open: https://trashfoot.vercel.app/api/
- [ ] You should see: `{"message":"TrashFoot API is running"}`
- [ ] If you see HTML instead, deployment failed

### ✅ Step 3: Test Auth Test Page
- [ ] Open: https://trashfoot.vercel.app/auth-test
- [ ] Click "Run All Tests"
- [ ] All tests should pass (green checkmarks)
- [ ] If any test fails, check the error details

---

## Phase 2: Supabase Configuration

### ✅ Step 4: Verify Database Tables
1. Go to: https://supabase.com/dashboard/project/ckrusxwmrselsvepveet
2. Navigate to: **Table Editor**
3. Verify these tables exist:
   - [ ] players
   - [ ] player_stats
   - [ ] groups
   - [ ] group_members
   - [ ] competitions
   - [ ] matches
   - [ ] chat_messages

### ✅ Step 5: Configure Email Settings
1. Go to: **Authentication** → **Settings**
2. Find "Enable email confirmations"
3. Choose one:
   - [ ] **Option A (Testing)**: Disable email confirmation
   - [ ] **Option B (Production)**: Enable email confirmation + configure SMTP

**For Testing (Recommended):**
- Toggle "Enable email confirmations" to **OFF**
- Click **Save**
- This allows immediate login after signup

**For Production:**
- Toggle "Enable email confirmations" to **ON**
- Configure SMTP settings (see SUPABASE_EMAIL_CONFIG.md)
- Customize email templates
- Click **Save**

### ✅ Step 6: Verify RLS Policies
1. Go to: **Authentication** → **Policies**
2. Verify policies exist for all tables
3. If missing, run the schema.sql file again

---

## Phase 3: Registration Testing

### ✅ Step 7: Test User Registration
1. Open: https://trashfoot.vercel.app/auth
2. Click "Sign Up" tab
3. Fill in the form:
   - **Name**: Test User
   - **Gamer Handle**: test_player_123
   - **Email**: your-real-email@example.com
   - **Password**: password123
4. Click "Create Account"

**Expected Results:**
- [ ] Success message appears
- [ ] Message says "Check Your Email" (if confirmation enabled)
- [ ] OR message says "Account created successfully!" (if confirmation disabled)
- [ ] No error messages
- [ ] Form switches to login mode (if confirmation enabled)

**If you see errors:**
- Check browser console (F12)
- Check Vercel function logs
- Verify Supabase connection
- Check if gamer handle is already taken

### ✅ Step 8: Verify User in Database
1. Go to Supabase: **Authentication** → **Users**
2. You should see your new user
3. Check email confirmation status:
   - If confirmation disabled: `email_confirmed_at` should have a timestamp
   - If confirmation enabled: `email_confirmed_at` should be NULL

4. Go to: **Table Editor** → **players**
5. You should see your player profile
6. Verify fields:
   - [ ] name matches
   - [ ] gamer_handle matches
   - [ ] email matches
   - [ ] role is "player"
   - [ ] status is "active"

7. Go to: **Table Editor** → **player_stats**
8. You should see a stats record for your player
9. Verify fields:
   - [ ] player_id matches your player ID
   - [ ] group_id is NULL (global stats)
   - [ ] all stats are 0

---

## Phase 4: Email Confirmation (If Enabled)

### ✅ Step 9: Confirm Email (Skip if confirmation disabled)
1. Check your email inbox
2. Look for email from Supabase
3. Check spam folder if not found
4. Click the confirmation link
5. You should be redirected to: https://trashfoot.vercel.app/auth

**If email not received:**
- Wait 5 minutes
- Check spam folder
- Verify SMTP settings in Supabase
- Check Supabase logs: **Authentication** → **Logs**
- Try resending confirmation email

### ✅ Step 10: Verify Email Confirmed
1. Go to Supabase: **Authentication** → **Users**
2. Find your user
3. Check `email_confirmed_at` field
4. It should now have a timestamp

---

## Phase 5: Login Testing

### ✅ Step 11: Test User Login
1. Go to: https://trashfoot.vercel.app/auth
2. Make sure you're on "Login" tab
3. Enter your credentials:
   - **Email**: your-email@example.com
   - **Password**: password123
4. Click "Login"

**Expected Results:**
- [ ] No error messages
- [ ] Loading indicator appears briefly
- [ ] You are redirected to: https://trashfoot.vercel.app/home
- [ ] Home screen loads successfully
- [ ] You see your name/profile

**If you see errors:**

**Error: "Please confirm your email address before logging in"**
- Email confirmation is enabled
- You haven't clicked the confirmation link
- Solution: Check email and click link, OR disable confirmation

**Error: "Invalid email or password"**
- Wrong credentials
- User doesn't exist
- Solution: Double-check credentials, try registering again

**Error: "Backend error (404)"**
- Backend not deployed correctly
- Solution: Check Vercel deployment

### ✅ Step 12: Verify Login State
1. After successful login, you should be on home screen
2. Check browser console (F12)
3. Look for these logs:
   - [ ] "=== LOGIN SUCCESS ==="
   - [ ] "User: [your name]"
   - [ ] "Role: player"
   - [ ] "Groups: 0" (or more if you have groups)

4. Try navigating to different tabs:
   - [ ] Home tab works
   - [ ] Matches tab works
   - [ ] Stats tab works
   - [ ] Chat tab works
   - [ ] Profile tab works

---

## Phase 6: Full Flow Testing

### ✅ Step 13: Test Logout and Re-login
1. Go to Profile tab
2. Click "Logout" (if available)
3. You should be redirected to auth screen
4. Login again with same credentials
5. Should work without issues

### ✅ Step 14: Test Multiple Users
1. Logout
2. Register a second user with different email
3. Login with second user
4. Both users should work independently

### ✅ Step 15: Test Gamer Handle Uniqueness
1. Logout
2. Try to register with same gamer handle as existing user
3. Should show error: "This gamer handle is already taken"
4. Should show suggestions for alternative handles

---

## 🎯 Success Criteria

Your auth system is working correctly if:

- [x] Backend health check passes
- [x] All auth test page tests pass
- [x] User registration creates user in Supabase
- [x] User registration creates player profile
- [x] User registration creates player stats
- [x] Email confirmation works (if enabled)
- [x] Login works with correct credentials
- [x] Login redirects to home screen
- [x] User data loads correctly
- [x] Gamer handle uniqueness is enforced
- [x] Error messages are clear and helpful

---

## 🐛 Common Issues and Solutions

### Issue: Backend returns HTML instead of JSON
**Solution:**
- Vercel deployment failed
- Check vercel.json configuration
- Redeploy from Vercel dashboard

### Issue: "Backend error (404)"
**Solution:**
- API routes not configured correctly
- Check vercel.json rewrites
- Verify api/index.ts exists

### Issue: Supabase connection fails
**Solution:**
- Check Supabase URL and keys in backend/lib/supabase-server.ts
- Verify Supabase project is active
- Check Supabase service role key

### Issue: RLS policies blocking access
**Solution:**
- Run schema.sql again to create policies
- Check policies in Supabase dashboard
- Verify auth.uid() is set correctly

### Issue: Email confirmation not working
**Solution:**
- Disable email confirmation for testing
- Configure SMTP settings
- Check Supabase email logs

---

## 📊 Database Verification Queries

Run these in Supabase SQL Editor to verify data:

```sql
-- Check all users
SELECT 
  u.email,
  u.email_confirmed_at,
  p.name,
  p.gamer_handle,
  p.role,
  p.status
FROM auth.users u
LEFT JOIN players p ON p.auth_user_id = u.id
ORDER BY u.created_at DESC;

-- Check player stats
SELECT 
  p.name,
  p.gamer_handle,
  ps.played,
  ps.wins,
  ps.draws,
  ps.losses,
  ps.points
FROM players p
LEFT JOIN player_stats ps ON ps.player_id = p.id AND ps.group_id IS NULL
ORDER BY p.created_at DESC;

-- Check for orphaned records
SELECT 
  'Auth users without player profile' as issue,
  COUNT(*) as count
FROM auth.users u
LEFT JOIN players p ON p.auth_user_id = u.id
WHERE p.id IS NULL

UNION ALL

SELECT 
  'Players without stats' as issue,
  COUNT(*) as count
FROM players p
LEFT JOIN player_stats ps ON ps.player_id = p.id AND ps.group_id IS NULL
WHERE ps.id IS NULL;
```

---

## 🎉 Next Steps After Auth Works

Once auth is verified and working:

1. **Create a Group**
   - Go to home screen
   - Click "Create Group"
   - Test group creation

2. **Invite Players**
   - Share invite code with other users
   - Test joining groups

3. **Create Competition**
   - Create a league or tournament
   - Add participants

4. **Record Matches**
   - Play matches
   - Record results
   - Verify stats update

5. **Test Chat**
   - Send messages in group chat
   - Verify real-time updates

All these features are already implemented and ready to use!

---

## 📝 Final Checklist

Before considering auth complete:

- [ ] Backend health check passes
- [ ] Registration works
- [ ] Email confirmation configured (enabled or disabled)
- [ ] Login works
- [ ] User data loads correctly
- [ ] All database tables populated correctly
- [ ] Error handling works
- [ ] Multiple users can register
- [ ] Gamer handle uniqueness enforced
- [ ] Logout and re-login works

**If all items are checked, your auth system is ready for production! 🚀**

---

## 🆘 Need Help?

If you're stuck:

1. Check browser console for errors
2. Check Vercel function logs
3. Check Supabase logs
4. Run the auth test page
5. Verify all checklist items above
6. Review the error messages carefully

The auth system is fully implemented - you just need to configure Supabase and test it!
