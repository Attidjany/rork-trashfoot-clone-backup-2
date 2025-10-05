# Data Cascade Documentation

## What Happens When a Player is Deleted?

When a player (user account) is deleted from the system, the following cascade effects occur due to the database schema's `ON DELETE CASCADE` constraints:

### 1. **Auth Account Deletion**
- The player's Supabase auth account (`auth.users`) is deleted
- This is handled explicitly in the backend after deleting the player record

### 2. **Player Record Deletion**
The `players` table record is deleted, which triggers cascading deletes on:

#### a) **Player Stats** (`player_stats`)
- **Action**: All stats records for this player are DELETED
- **Reason**: `player_id` references `players(id) ON DELETE CASCADE`
- **Impact**: 
  - Global stats are lost
  - Group-specific stats are lost
  - Historical performance data is permanently removed

#### b) **Group Memberships** (`group_members`)
- **Action**: All group membership records are DELETED
- **Reason**: `player_id` references `players(id) ON DELETE CASCADE`
- **Impact**:
  - Player is removed from all groups
  - Admin status in groups is lost
  - If player was the only member, group becomes empty

#### c) **Pending Group Requests** (`pending_group_members`)
- **Action**: All pending join requests are DELETED
- **Reason**: `player_id` references `players(id) ON DELETE CASCADE`
- **Impact**:
  - Any pending requests to join groups are removed
  - No orphaned requests remain

#### d) **Competition Participants** (`competition_participants`)
- **Action**: All participation records are DELETED
- **Reason**: `player_id` references `players(id) ON DELETE CASCADE`
- **Impact**:
  - Player is removed from all competitions
  - Competition participant counts decrease
  - Historical participation data is lost

#### e) **Chat Messages** (`chat_messages`)
- **Action**: All messages sent by the player are DELETED
- **Reason**: `sender_id` references `players(id) ON DELETE CASCADE`
- **Impact**:
  - All chat history from this player is removed
  - Group chat conversations may have gaps
  - Message metadata is lost

### 3. **Matches - SPECIAL CASE** ⚠️

**IMPORTANT**: Matches are NOT deleted when a player is deleted!

#### Why Matches Remain:
- **Schema Design**: The `matches` table has foreign keys to `players(id)` with `ON DELETE CASCADE`
- **However**: Matches reference TWO players (`home_player_id` and `away_player_id`)
- **Result**: When a player is deleted, their matches are also deleted due to CASCADE

#### Current Behavior:
```sql
-- Matches table foreign keys
home_player_id UUID NOT NULL REFERENCES players(id) ON DELETE CASCADE
away_player_id UUID NOT NULL REFERENCES players(id) ON DELETE CASCADE
```

This means:
- ✅ All matches where the player was home player are DELETED
- ✅ All matches where the player was away player are DELETED
- ❌ Match history is lost
- ❌ Competition standings may become inaccurate
- ❌ Other players' stats may be affected

### 4. **Groups - SPECIAL CASE** ⚠️

If the deleted player is a **group admin**:

#### Current Behavior:
```sql
-- Groups table foreign key
admin_id UUID NOT NULL REFERENCES players(id) ON DELETE CASCADE
```

This means:
- ✅ If player is admin of a group, the ENTIRE GROUP is DELETED
- ✅ This cascades to delete:
  - All competitions in the group
  - All matches in those competitions
  - All group members
  - All chat messages
  - All pending join requests

#### Impact:
- **CRITICAL**: Deleting a group admin deletes the entire group and all its data
- Other members lose access to the group
- All historical data for that group is lost

---

## Summary of Data Loss

When deleting a player:

| Data Type | Action | Recoverable? |
|-----------|--------|--------------|
| Auth Account | Deleted | ❌ No |
| Player Profile | Deleted | ❌ No |
| Player Stats | Deleted | ❌ No |
| Group Memberships | Deleted | ❌ No |
| Pending Requests | Deleted | ❌ No |
| Competition Participation | Deleted | ❌ No |
| Chat Messages | Deleted | ❌ No |
| Matches (as player) | Deleted | ❌ No |
| Groups (as admin) | Deleted | ❌ No |

---

## Recommendations for Production

### Option 1: Soft Delete (Recommended)
Instead of hard deleting players, mark them as deleted:

```sql
ALTER TABLE players ADD COLUMN deleted_at TIMESTAMPTZ;
ALTER TABLE players ADD COLUMN deleted BOOLEAN DEFAULT FALSE;
```

Benefits:
- Preserve match history
- Maintain data integrity
- Allow for account recovery
- Keep statistics accurate

### Option 2: Orphan Handling
Change foreign key constraints to SET NULL instead of CASCADE:

```sql
-- For matches
ALTER TABLE matches 
  DROP CONSTRAINT matches_home_player_id_fkey,
  ADD CONSTRAINT matches_home_player_id_fkey 
    FOREIGN KEY (home_player_id) 
    REFERENCES players(id) 
    ON DELETE SET NULL;

ALTER TABLE matches 
  DROP CONSTRAINT matches_away_player_id_fkey,
  ADD CONSTRAINT matches_away_player_id_fkey 
    FOREIGN KEY (away_player_id) 
    REFERENCES players(id) 
    ON DELETE SET NULL;
```

Benefits:
- Matches remain in database
- Show as "Deleted Player" in UI
- Preserve competition history

### Option 3: Transfer Ownership
Before deleting a player who is a group admin:
1. Check if they are admin of any groups
2. Prompt to transfer admin rights to another member
3. Only allow deletion after admin transfer

---

## Current Implementation

The current superadmin implementation:
- ✅ Warns about data cascade before deletion
- ✅ Deletes auth account after player deletion
- ✅ Relies on database CASCADE constraints
- ⚠️ Does NOT implement soft delete
- ⚠️ Does NOT prevent admin deletion
- ⚠️ Does NOT preserve match history

---

## Testing Checklist

Before deleting a player in production:

- [ ] Check if player is admin of any groups
- [ ] Check number of matches player participated in
- [ ] Check if player has pending join requests
- [ ] Verify other players won't lose critical data
- [ ] Consider exporting player data before deletion
- [ ] Notify affected groups/players if necessary

---

## SQL to Check Player Impact

```sql
-- Check if player is admin of groups
SELECT g.id, g.name 
FROM groups g 
WHERE g.admin_id = 'PLAYER_ID';

-- Check player's matches
SELECT COUNT(*) 
FROM matches 
WHERE home_player_id = 'PLAYER_ID' 
   OR away_player_id = 'PLAYER_ID';

-- Check player's group memberships
SELECT g.name, gm.is_admin 
FROM group_members gm 
JOIN groups g ON g.id = gm.group_id 
WHERE gm.player_id = 'PLAYER_ID';

-- Check player's pending requests
SELECT g.name 
FROM pending_group_members pgm 
JOIN groups g ON g.id = pgm.group_id 
WHERE pgm.player_id = 'PLAYER_ID';
```
