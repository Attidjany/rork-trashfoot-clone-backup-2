# How to Start the Development Environment

## The Problem
You're getting "Backend server is not responding correctly" because the backend server is not running. The frontend is trying to connect to `http://localhost:3001/api/trpc` but nothing is listening on that port.

## Solution: Start Both Backend and Frontend

### Option 1: Use the dev.sh script (Recommended)
```bash
bash dev.sh
```

This will start both:
- Backend server on port 3001
- Frontend on port 8081

### Option 2: Start them separately in two terminals

**Terminal 1 - Backend:**
```bash
bun run server.ts
```

**Terminal 2 - Frontend:**
```bash
bunx rork start -p niqdoqm9dz49jqmoeo0np --tunnel
```

## Verify Backend is Running

Once the backend is running, you should see:
```
Server is running on port 3001
```

You can test it by visiting: http://localhost:3001/api/

You should see:
```json
{"status":"ok","message":"API is running"}
```

## After Starting Both Servers

1. The frontend will be available at the URL shown in the terminal
2. Try to create an account or login
3. The authentication should now work properly

## Note
Make sure you have your Supabase environment variables set up correctly in your `.env` file or environment.
