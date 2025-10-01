# Supabase Email Configuration Guide

## 🎯 Quick Fix: Disable Email Confirmation for Testing

The fastest way to get auth working is to disable email confirmation:

### Step 1: Go to Supabase Dashboard
1. Visit: https://supabase.com/dashboard/project/ckrusxwmrselsvepveet
2. Navigate to: **Authentication** → **Settings**

### Step 2: Disable Email Confirmation
1. Scroll to **Email Auth** section
2. Find "Enable email confirmations"
3. **Toggle it OFF** (disable it)
4. Click **Save**

### Step 3: Test Registration
1. Go to: https://trashfoot.vercel.app/auth
2. Click "Sign Up"
3. Fill in the form:
   - Name: Your Name
   - Gamer Handle: your_handle
   - Email: your@email.com
   - Password: password123
4. Click "Create Account"
5. You should see success message
6. Switch to "Login" mode
7. Enter your email and password
8. Click "Login"
9. You should be redirected to the home screen ✅

---

## 🔐 Production Setup: Enable Email Confirmation

For production, you should enable email confirmation:

### Step 1: Enable Email Confirmation
1. Go to: **Authentication** → **Settings**
2. Find "Enable email confirmations"
3. **Toggle it ON**
4. Click **Save**

### Step 2: Configure Email Provider

#### Option A: Use Supabase Email Service (Easiest)
- Supabase provides a default email service
- Limited to 3 emails per hour in free tier
- Good for testing and small apps
- No additional configuration needed

#### Option B: Use Custom SMTP (Recommended for Production)
1. Go to: **Authentication** → **Settings** → **SMTP Settings**
2. Configure your SMTP provider:
   - **Host**: smtp.gmail.com (for Gmail)
   - **Port**: 587
   - **Username**: your-email@gmail.com
   - **Password**: your-app-password
   - **Sender email**: your-email@gmail.com
   - **Sender name**: TrashFoot

**Popular SMTP Providers:**
- Gmail (free, 500 emails/day)
- SendGrid (free, 100 emails/day)
- Mailgun (free, 5000 emails/month)
- AWS SES (very cheap, pay-as-you-go)

### Step 3: Customize Email Template
1. Go to: **Authentication** → **Email Templates**
2. Select "Confirm signup" template
3. Customize the email content:

```html
<h2>Welcome to TrashFoot!</h2>
<p>Thanks for signing up. Please confirm your email address by clicking the button below:</p>
<p><a href="{{ .ConfirmationURL }}">Confirm Email</a></p>
<p>If you didn't create an account, you can safely ignore this email.</p>
```

4. Make sure the confirmation URL redirects to: `https://trashfoot.vercel.app/auth`
5. Click **Save**

### Step 4: Test Email Flow
1. Register a new account
2. Check your email inbox
3. Click the confirmation link
4. You should be redirected to the auth page
5. Login with your credentials
6. Success! ✅

---

## 🐛 Common Issues

### Issue: "Please confirm your email address before logging in"

**Cause:** Email confirmation is enabled but you haven't clicked the confirmation link

**Solution:**
1. Check your email inbox (and spam folder)
2. Click the confirmation link
3. Try logging in again

OR

1. Disable email confirmation in Supabase settings
2. Delete the user from Supabase Auth
3. Register again

### Issue: Not receiving confirmation emails

**Possible causes:**
1. Email is in spam folder
2. SMTP not configured correctly
3. Supabase email rate limit reached
4. Invalid email address

**Solution:**
1. Check spam folder
2. Verify SMTP settings
3. Wait a few minutes and try again
4. Use a different email address
5. Check Supabase logs: **Authentication** → **Logs**

### Issue: Confirmation link doesn't work

**Possible causes:**
1. Link expired (default: 24 hours)
2. Wrong redirect URL
3. User already confirmed

**Solution:**
1. Request a new confirmation email
2. Check redirect URL in email template settings
3. Verify user status in Supabase Auth users table

---

## 📊 Verify Email Settings

Run this query in Supabase SQL Editor to check user email status:

```sql
-- Check all users and their email confirmation status
SELECT 
  id,
  email,
  email_confirmed_at,
  created_at,
  CASE 
    WHEN email_confirmed_at IS NULL THEN 'Not Confirmed'
    ELSE 'Confirmed'
  END as status
FROM auth.users
ORDER BY created_at DESC;
```

---

## 🔄 Reset User Email Confirmation

If you need to manually confirm a user's email:

```sql
-- Manually confirm a user's email
UPDATE auth.users
SET email_confirmed_at = NOW()
WHERE email = 'user@example.com';
```

---

## 📝 Email Configuration Checklist

- [ ] Email confirmation enabled/disabled based on your needs
- [ ] SMTP configured (if using custom provider)
- [ ] Email template customized
- [ ] Confirmation URL set to: https://trashfoot.vercel.app/auth
- [ ] Test email sent successfully
- [ ] Confirmation link works
- [ ] User can login after confirmation

---

## 🎯 Recommended Settings

### For Development/Testing:
- ✅ Disable email confirmation
- ✅ Use Supabase default email service
- ✅ Test with real email addresses

### For Production:
- ✅ Enable email confirmation
- ✅ Use custom SMTP provider
- ✅ Customize email templates
- ✅ Set up email monitoring
- ✅ Configure rate limits

---

## 🆘 Still Having Issues?

1. Check Supabase logs: **Authentication** → **Logs**
2. Check Vercel function logs
3. Test the auth endpoints: https://trashfoot.vercel.app/auth-test
4. Verify database tables exist
5. Check browser console for errors

Your auth system is fully implemented - just configure these email settings and you're ready to go! 🚀
