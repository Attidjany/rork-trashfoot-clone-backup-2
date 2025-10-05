# Match Deletion Fix

## Problem
Match deletion is not working because the Supabase RLS (Row Level Security) policy for DELETE operations on the `matches` table is missing.

## Solution

### Step 1: Add DELETE Policy to Supabase

Run the following SQL in your **Supabase SQL Editor**:

```sql
-- Add DELETE policy for matches table
DROP POLICY IF EXISTS "Group admins can delete matches" ON matches;

CREATE POLICY "Group admins can delete matches" ON matches FOR DELETE USING (
  competition_id IN (
    SELECT c.id 
    FROM competitions c
    INNER JOIN groups g ON c.group_id = g.id
    WHERE g.admin_id IN (SELECT id FROM players WHERE auth_user_id = auth.uid())
  )
);
```

### Step 2: Verify the Policy

After running the SQL, verify it was created:

```sql
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual
FROM pg_policies
WHERE tablename = 'matches' AND cmd = 'DELETE';
```

You should see a policy named "Group admins can delete matches" with cmd = 'DELETE'.

### Step 3: Test the Deletion

1. Go to the Matches tab in your app
2. Find a match where you are the group admin
3. Click the Delete button
4. Confirm the deletion
5. The match should now be deleted and disappear from the list in real-time

## How It Works

The current implementation:
1. User clicks Delete button → Confirmation dialog appears
2. User confirms → Direct Supabase delete call is made from the client
3. Realtime subscription detects the change → Triggers refetch
4. UI updates automatically

The DELETE policy ensures that only group admins can delete matches from their groups.

## Troubleshooting

If deletion still doesn't work:

1. **Check Console Logs**: Look for error messages starting with "❌ Error deleting match:"
2. **Verify Authentication**: Make sure you're logged in and are the group admin
3. **Check Supabase Dashboard**: Go to Authentication → Policies and verify the policy exists
4. **Test in Supabase**: Try deleting a match directly in the Supabase Table Editor to see if RLS is blocking it

## Alternative: Using tRPC (Not Recommended)

The app currently uses direct Supabase calls for better real-time performance. If you prefer tRPC:

```typescript
// In matches.tsx, replace the handleDeleteMatch function:
const deleteMatchMutation = trpc.matches.delete.useMutation({
  onSuccess: () => {
    Alert.alert('Success', 'Match deleted successfully');
    refetchGroups();
  },
  onError: (error) => {
    Alert.alert('Error', error.message);
  },
});

const handleDeleteMatch = async (matchId: string) => {
  // ... permission checks ...
  Alert.alert(
    'Delete Match',
    'Are you sure you want to delete this match?',
    [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => deleteMatchMutation.mutate({ matchId }),
      },
    ]
  );
};
```

However, this adds unnecessary complexity since realtime already handles the updates.
