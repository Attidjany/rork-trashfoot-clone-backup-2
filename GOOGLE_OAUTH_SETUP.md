# Google OAuth Setup Guide

## Overview
Your app now supports Google OAuth authentication. Users can sign in with their Google account on the login screen.

## What's Been Implemented

### Frontend (app/auth.tsx)
- ✅ "Continue with Google" button on login screen
- ✅ OAuth flow using expo-web-browser and expo-linking
- ✅ Automatic player profile creation for new Google users
- ✅ Session management with Supabase

### Backend
- ✅ New OAuth login endpoint (`auth.oauthLogin`)
- ✅ Automatic player profile creation with auto-generated gamer handle
- ✅ Full game data loading (groups, stats, messages)

## Supabase Configuration Required

To enable Google OAuth, you need to configure it in your Supabase dashboard:

### Step 1: Get Google OAuth Credentials

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select an existing one
3. Enable the Google+ API
4. Go to **Credentials** → **Create Credentials** → **OAuth 2.0 Client ID**
5. Configure the OAuth consent screen if you haven't already
6. For Application type, select **Web application**
7. Add authorized redirect URIs:
   - `https://ckrusxwmrselsvepveet.supabase.co/auth/v1/callback`
   - For local testing: `http://localhost:19006/auth/callback` (if needed)
8. Copy your **Client ID** and **Client Secret**

### Step 2: Configure Supabase

1. Go to your Supabase dashboard: https://supabase.com/dashboard
2. Select your project
3. Navigate to **Authentication** → **Providers**
4. Find **Google** in the list and click to configure
5. Enable the Google provider
6. Paste your **Client ID** and **Client Secret** from Google Cloud Console
7. Click **Save**

### Step 3: Configure Redirect URLs (Mobile)

For mobile apps, you need to add your app's custom URL scheme:

1. In Supabase dashboard, go to **Authentication** → **URL Configuration**
2. Add your redirect URLs:
   - For Expo Go: `exp://[your-ip]:8081/--/auth/callback`
   - For production: Your app's custom scheme (e.g., `myapp://auth/callback`)

## How It Works

### For New Users (First-time Google Sign-in)
1. User clicks "Continue with Google"
2. Google OAuth flow opens in browser
3. User authorizes the app
4. App receives OAuth tokens
5. Backend creates a new player profile automatically:
   - Name: From Google profile
   - Email: From Google account
   - Gamer Handle: Auto-generated (e.g., `john_abc123`)
6. User is logged in and redirected to home

### For Existing Users
1. User clicks "Continue with Google"
2. Google OAuth flow opens in browser
3. User authorizes the app
4. App receives OAuth tokens
5. Backend finds existing player profile by auth_user_id
6. User is logged in with their existing data

## Email Confirmation

Email confirmation is already configured for regular email/password signups:
- Users receive a confirmation email after signing up
- They must click the link to verify their email
- Login is blocked until email is confirmed

**Note:** Google OAuth users don't need email confirmation since Google has already verified their email.

## Testing

### Test Regular Email/Password Flow
1. Sign up with email/password
2. Check your email for confirmation link
3. Click the confirmation link
4. Log in with your credentials

### Test Google OAuth Flow
1. Click "Continue with Google" on login screen
2. Sign in with your Google account
3. Authorize the app
4. You should be logged in automatically

## Troubleshooting

### "Failed to sign in with Google"
- Check that Google provider is enabled in Supabase
- Verify Client ID and Client Secret are correct
- Make sure redirect URLs are properly configured

### "Player profile not found"
- This shouldn't happen with OAuth as profiles are auto-created
- Check backend logs for errors during profile creation

### Email confirmation not working
- Verify email confirmation is enabled in Supabase Auth settings
- Check spam folder for confirmation emails
- Ensure SMTP is properly configured in Supabase

## Security Notes

- OAuth tokens are handled securely by Supabase
- Player profiles are automatically linked to auth users
- Google has already verified the user's email
- All authentication goes through Supabase's secure infrastructure

## Next Steps

1. Configure Google OAuth in Supabase dashboard (see Step 2 above)
2. Test the OAuth flow
3. Consider adding more OAuth providers (Apple, Facebook, etc.)
4. Set up custom email templates in Supabase for confirmation emails
