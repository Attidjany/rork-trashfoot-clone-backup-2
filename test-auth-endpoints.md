# Test Auth Endpoints Directly

Use these curl commands or Postman to test your auth endpoints directly.

## 1. Test Backend Health

```bash
curl https://trashfoot.vercel.app/api/
```

**Expected Response:**
```json
{
  "message": "TrashFoot API is running"
}
```

---

## 2. Test Check Gamer Handle

```bash
curl -X POST https://trashfoot.vercel.app/api/trpc/auth.checkGamerHandle \
  -H "Content-Type: application/json" \
  -d '{
    "0": {
      "json": {
        "gamerHandle": "test_player_123"
      }
    }
  }'
```

**Expected Response (if available):**
```json
{
  "0": {
    "result": {
      "data": {
        "json": {
          "available": true,
          "suggestions": []
        }
      }
    }
  }
}
```

**Expected Response (if taken):**
```json
{
  "0": {
    "result": {
      "data": {
        "json": {
          "available": false,
          "suggestions": ["test_player_1231", "test_player_123_pro", "test_player_1232025"]
        }
      }
    }
  }
}
```

---

## 3. Test Registration

```bash
curl -X POST https://trashfoot.vercel.app/api/trpc/auth.register \
  -H "Content-Type: application/json" \
  -d '{
    "0": {
      "json": {
        "name": "Test User",
        "gamerHandle": "test_player_123",
        "email": "test@example.com",
        "password": "password123"
      }
    }
  }'
```

**Expected Response (success):**
```json
{
  "0": {
    "result": {
      "data": {
        "json": {
          "user": {
            "id": "uuid-here",
            "name": "Test User",
            "gamerHandle": "test_player_123",
            "email": "test@example.com",
            "role": "player",
            "status": "active",
            "stats": { ... }
          },
          "token": "",
          "requiresEmailConfirmation": true,
          "message": "Account created! Please check your email to confirm your account."
        }
      }
    }
  }
}
```

**Expected Response (error - handle taken):**
```json
{
  "0": {
    "error": {
      "message": "This gamer handle is already taken. Please choose another one.",
      "code": -32603
    }
  }
}
```

---

## 4. Test Login

```bash
curl -X POST https://trashfoot.vercel.app/api/trpc/auth.login \
  -H "Content-Type: application/json" \
  -d '{
    "0": {
      "json": {
        "email": "test@example.com",
        "password": "password123"
      }
    }
  }'
```

**Expected Response (success):**
```json
{
  "0": {
    "result": {
      "data": {
        "json": {
          "user": {
            "id": "uuid-here",
            "name": "Test User",
            "gamerHandle": "test_player_123",
            "email": "test@example.com",
            "role": "player",
            "status": "active",
            "stats": { ... }
          },
          "token": "",
          "gameData": {
            "currentUser": { ... },
            "groups": [],
            "activeGroupId": "",
            "messages": []
          },
          "message": "Login successful!"
        }
      }
    }
  }
}
```

**Expected Response (error - email not confirmed):**
```json
{
  "0": {
    "error": {
      "message": "Please confirm your email address before logging in. Check your inbox for the confirmation link.",
      "code": -32603
    }
  }
}
```

**Expected Response (error - invalid credentials):**
```json
{
  "0": {
    "error": {
      "message": "Invalid email or password",
      "code": -32603
    }
  }
}
```

---

## Using Postman

### Setup:
1. Create a new collection: "TrashFoot Auth"
2. Set base URL: `https://trashfoot.vercel.app/api/trpc`

### Request 1: Check Handle
- **Method:** POST
- **URL:** `{{baseUrl}}/auth.checkGamerHandle`
- **Headers:** `Content-Type: application/json`
- **Body (raw JSON):**
```json
{
  "0": {
    "json": {
      "gamerHandle": "test_player_123"
    }
  }
}
```

### Request 2: Register
- **Method:** POST
- **URL:** `{{baseUrl}}/auth.register`
- **Headers:** `Content-Type: application/json`
- **Body (raw JSON):**
```json
{
  "0": {
    "json": {
      "name": "Test User",
      "gamerHandle": "test_player_123",
      "email": "test@example.com",
      "password": "password123"
    }
  }
}
```

### Request 3: Login
- **Method:** POST
- **URL:** `{{baseUrl}}/auth.login`
- **Headers:** `Content-Type: application/json`
- **Body (raw JSON):**
```json
{
  "0": {
    "json": {
      "email": "test@example.com",
      "password": "password123"
    }
  }
}
```

---

## Testing in Browser Console

Open browser console (F12) and run:

```javascript
// Test backend health
fetch('https://trashfoot.vercel.app/api/')
  .then(r => r.json())
  .then(console.log);

// Test check handle
fetch('https://trashfoot.vercel.app/api/trpc/auth.checkGamerHandle', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    "0": {
      "json": {
        "gamerHandle": "test_player_123"
      }
    }
  })
})
  .then(r => r.json())
  .then(console.log);

// Test registration
fetch('https://trashfoot.vercel.app/api/trpc/auth.register', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    "0": {
      "json": {
        "name": "Test User",
        "gamerHandle": "test_player_" + Date.now(),
        "email": "test" + Date.now() + "@example.com",
        "password": "password123"
      }
    }
  })
})
  .then(r => r.json())
  .then(console.log);
```

---

## Interpreting Results

### ✅ Success Indicators:
- Status code: 200
- Response has `result.data.json` structure
- No `error` field in response
- User object returned with all fields

### ❌ Error Indicators:
- Status code: 400, 404, or 500
- Response has `error` field
- Error message describes the issue
- No `result` field in response

### 🔍 Common Error Codes:
- `-32603`: Internal error (check error message)
- `-32600`: Invalid request format
- `-32700`: Parse error (invalid JSON)

---

## Debugging Tips

1. **Check Response Headers:**
   - Should be `application/json`
   - If `text/html`, backend not deployed correctly

2. **Check Response Body:**
   - Should be valid JSON
   - If HTML, check Vercel deployment

3. **Check Status Code:**
   - 200: Success
   - 404: Endpoint not found
   - 500: Server error

4. **Check Error Messages:**
   - Read carefully - they tell you exactly what's wrong
   - Common: "email not confirmed", "invalid credentials", "handle taken"

5. **Check Logs:**
   - Browser console for client errors
   - Vercel function logs for server errors
   - Supabase logs for database errors

---

## Quick Verification Script

Save this as `test-auth.sh` and run it:

```bash
#!/bin/bash

echo "Testing TrashFoot Auth Endpoints..."
echo ""

echo "1. Testing backend health..."
curl -s https://trashfoot.vercel.app/api/ | jq
echo ""

echo "2. Testing check handle (should be available)..."
curl -s -X POST https://trashfoot.vercel.app/api/trpc/auth.checkGamerHandle \
  -H "Content-Type: application/json" \
  -d '{"0":{"json":{"gamerHandle":"test_'$(date +%s)'"}}}' | jq
echo ""

echo "3. Testing registration..."
TIMESTAMP=$(date +%s)
curl -s -X POST https://trashfoot.vercel.app/api/trpc/auth.register \
  -H "Content-Type: application/json" \
  -d '{
    "0": {
      "json": {
        "name": "Test User",
        "gamerHandle": "test_'$TIMESTAMP'",
        "email": "test'$TIMESTAMP'@example.com",
        "password": "password123"
      }
    }
  }' | jq
echo ""

echo "Done! Check results above."
```

Make it executable: `chmod +x test-auth.sh`
Run it: `./test-auth.sh`

---

## Expected Flow

1. **Check Handle** → Returns `available: true`
2. **Register** → Creates user, returns success
3. **Check Same Handle** → Returns `available: false` with suggestions
4. **Login** → Returns user data and game data
5. **Login Again** → Works, returns same data

If this flow works, your auth is fully functional! ✅
