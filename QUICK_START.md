# Quick Start Guide

## ⚠️ Important: You Need to Run BOTH Backend and Frontend

The error you're seeing ("Backend server is not responding correctly") happens because **the backend server is not running**.

## How to Fix

### Option 1: Use the dev.sh script (Easiest)

```bash
bash dev.sh
```

This automatically starts:
- ✅ Backend server on `http://localhost:3001`
- ✅ Frontend on `http://localhost:8081`

### Option 2: Start Manually in Two Terminals

**Terminal 1 - Start Backend:**
```bash
bun run server.ts
```

Wait until you see: `Server is running on port 3001`

**Terminal 2 - Start Frontend:**
```bash
bunx rork start -p niqdoqm9dz49jqmoeo0np --tunnel
```

## Verify Backend is Running

Open http://localhost:3001/api/ in your browser.

You should see:
```json
{"status":"ok","message":"API is running"}
```

If you see this, your backend is working! ✅

## Now Try Login/Signup

Once both servers are running:
1. Open your app
2. Try to create an account or login
3. It should work now! 🎉

## Still Having Issues?

Make sure you have:
- ✅ Bun installed (`curl -fsSL https://bun.sh/install | bash`)
- ✅ Dependencies installed (`bun install`)
- ✅ Supabase environment variables configured (check SUPABASE_SETUP.md)
