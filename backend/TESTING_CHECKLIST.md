# RLS Policy Testing Checklist

## Pre-Testing Setup

### Test Users Required
- [ ] **Superadmin User** - Has `role = 'super_admin'` in players table
- [ ] **Group Admin User** - Admin of at least one group
- [ ] **Regular Player User** - Member of at least one group
- [ ] **New User** - Not a member of any group

### Test Data Required
- [ ] At least 2 groups with multiple members
- [ ] At least 1 competition with matches
- [ ] At least 5 players with stats
- [ ] At least 3 completed matches

---

## Testing Procedure

### Test 1: Players Table Access
**Goal**: Verify all users can see all players

#### As Regular Player
- [ ] Navigate to Home tab
- [ ] Verify you see other players' names (not just your own)
- [ ] Navigate to Stats tab
- [ ] Verify you see all players in leaderboard
- [ ] Navigate to Matches tab
- [ ] Verify you see both player names in each match

**Expected**: ✅ All player names visible everywhere

#### As Group Admin
- [ ] Same as regular player
- [ ] Additionally: Navigate to Group Details
- [ ] Verify you see all member names

**Expected**: ✅ All player names visible

#### As Superadmin
- [ ] Same as above
- [ ] Additionally: Try to update another player's profile
- [ ] Verify you can update it

**Expected**: ✅ Can see and update all players

---

### Test 2: Home Tab
**Goal**: Verify home tab displays correctly

#### As Regular Player
- [ ] Navigate to Home tab
- [ ] Check "Top Players" section
  - [ ] See at least 3 players (if available)
  - [ ] See player gamer_handles (e.g., @john)
  - [ ] See player stats (played, wins, etc.)
- [ ] Check "Recent Matches" section
  - [ ] See both player names in each match
  - [ ] See scores for completed matches
- [ ] Check "Upcoming Matches" section
  - [ ] See both player names
  - [ ] See scheduled dates

**Expected**: ✅ All data displays correctly

---

### Test 3: Stats Tab
**Goal**: Verify stats display for all players

#### As Regular Player
- [ ] Navigate to Stats tab
- [ ] Select "Leaderboard" tab
  - [ ] See all players who have played matches
  - [ ] See gamer_handles for all players
  - [ ] See stats (points, played, GD) for all
  - [ ] See form badges (W/D/L) for all
- [ ] Select "General" tab
  - [ ] See overall table with all players
  - [ ] See monthly tables with all players
- [ ] Select "Leagues" tab
  - [ ] See league tables with all participants
  - [ ] See player names in podium
- [ ] Select "Head to Head" tab
  - [ ] Select two players
  - [ ] See H2H stats if matches exist

**Expected**: ✅ All players visible in all tabs

---

### Test 4: Matches Tab
**Goal**: Verify match display and actions

#### As Regular Player
- [ ] Navigate to Matches tab
- [ ] Select "Upcoming" tab
  - [ ] See all upcoming matches
  - [ ] See both player names in each match
  - [ ] For your own matches: See "Go Live" and "Add Result" buttons
- [ ] Select "Live" tab
  - [ ] See live matches (if any)
  - [ ] See both player names
- [ ] Select "Completed" tab
  - [ ] See all completed matches
  - [ ] See both player names
  - [ ] See scores
  - [ ] See screenshot button (camera icon)

**Expected**: ✅ All match data visible

#### As Group Admin
- [ ] Same as regular player
- [ ] Additionally: See "Delete" button on scheduled matches
- [ ] Additionally: See "Correct Score" button on completed matches
- [ ] Try to delete a match
- [ ] Try to correct a score

**Expected**: ✅ Admin actions work

---

### Test 5: Profile Tab
**Goal**: Verify profile and groups display

#### As Regular Player
- [ ] Navigate to Profile tab
- [ ] Check profile header
  - [ ] See your gamer_handle
  - [ ] See your name
  - [ ] See your email
  - [ ] See your stats
- [ ] Check "My Groups" section
  - [ ] See all groups you're a member of
  - [ ] See group names
  - [ ] See group descriptions
  - [ ] See "Active" badge on active group
- [ ] Try to switch active group
- [ ] Try to create a new group
- [ ] Try to join a group with code

**Expected**: ✅ All profile data correct

---

### Test 6: Group Details
**Goal**: Verify group member visibility

#### As Group Member
- [ ] Navigate to a group you're a member of
- [ ] Select "Overview" tab
  - [ ] See group name and description
  - [ ] See member count (should be > 0)
  - [ ] See competition count
- [ ] Select "Members" tab
  - [ ] See all group members
  - [ ] See member names
  - [ ] See member gamer_handles
  - [ ] See member stats
  - [ ] See "Admin" badge on admin
- [ ] Select "Matches" tab
  - [ ] See all matches
  - [ ] See both player names in each match

**Expected**: ✅ All members visible with correct count

#### As Group Admin
- [ ] Same as group member
- [ ] Additionally: Select "Requests" tab
  - [ ] See pending join requests (if any)
  - [ ] See requester names
- [ ] Try to approve/reject a request
- [ ] Try to create a competition

**Expected**: ✅ Admin actions work

---

### Test 7: Group Browser
**Goal**: Verify public group visibility

#### As Any User
- [ ] Navigate to Group Browser
- [ ] Check available groups list
  - [ ] See public groups
  - [ ] See group names
  - [ ] See group descriptions
  - [ ] See member counts (should be > 0, not 0)
  - [ ] See invite codes
- [ ] Try to search for a group
- [ ] Try to join a group
- [ ] Try to create a new group

**Expected**: ✅ Groups visible with correct member counts

---

### Test 8: Superadmin Functions
**Goal**: Verify superadmin has full access

#### As Superadmin
- [ ] Navigate to Superadmin page
- [ ] Check players list
  - [ ] See all players
  - [ ] See all player details
- [ ] Try to update a player's role
- [ ] Try to suspend a player
- [ ] Try to delete a player
- [ ] Check groups list
  - [ ] See all groups (public and private)
  - [ ] See all group details
- [ ] Try to delete a group

**Expected**: ✅ Full access to all data and actions

---

## Common Issues & Solutions

### Issue: Player names still blank
**Cause**: Policies not applied correctly
**Solution**: 
```sql
-- Verify policies exist
SELECT tablename, policyname FROM pg_policies 
WHERE schemaname = 'public' AND tablename = 'players';

-- Should see: players_select_all, players_insert_own, players_update_own_or_superadmin, players_delete_superadmin
```

### Issue: Group member count still 0
**Cause**: group_members policies too restrictive
**Solution**:
```sql
-- Verify policy
SELECT policyname, qual FROM pg_policies 
WHERE schemaname = 'public' AND tablename = 'group_members' AND cmd = 'SELECT';

-- Should allow: is_group_member(group_id) OR public groups OR superadmin
```

### Issue: Stats table empty
**Cause**: player_stats policies too restrictive
**Solution**:
```sql
-- Verify policy
SELECT policyname, qual FROM pg_policies 
WHERE schemaname = 'public' AND tablename = 'player_stats' AND cmd = 'SELECT';

-- Should be: true (everyone can see all stats)
```

---

## Performance Testing

### Query Performance
After applying policies, test query performance:

```sql
-- Should be fast (< 100ms)
EXPLAIN ANALYZE SELECT * FROM players;

-- Should be fast (< 100ms)
EXPLAIN ANALYZE SELECT * FROM player_stats;

-- Should be fast (< 200ms)
EXPLAIN ANALYZE 
SELECT p.*, ps.* 
FROM players p
JOIN player_stats ps ON p.id = ps.player_id
WHERE ps.group_id = 'YOUR_GROUP_ID';
```

**Expected**: All queries under 200ms

---

## Sign-Off

### Before Deployment
- [ ] All tests passed
- [ ] No errors in console
- [ ] No missing data
- [ ] Performance acceptable
- [ ] Backup saved

### After Deployment
- [ ] Monitor error rates
- [ ] Monitor user reports
- [ ] Check Supabase logs
- [ ] Verify realtime updates work

### Rollback Criteria
Rollback if:
- [ ] Any test fails
- [ ] Performance degrades significantly
- [ ] Users report missing data
- [ ] Errors in production logs

---

## Test Results Template

```
Date: ___________
Tester: ___________
Environment: ___________

Test 1: Players Table Access
- Regular Player: ☐ Pass ☐ Fail
- Group Admin: ☐ Pass ☐ Fail
- Superadmin: ☐ Pass ☐ Fail

Test 2: Home Tab
- Regular Player: ☐ Pass ☐ Fail

Test 3: Stats Tab
- Regular Player: ☐ Pass ☐ Fail

Test 4: Matches Tab
- Regular Player: ☐ Pass ☐ Fail
- Group Admin: ☐ Pass ☐ Fail

Test 5: Profile Tab
- Regular Player: ☐ Pass ☐ Fail

Test 6: Group Details
- Group Member: ☐ Pass ☐ Fail
- Group Admin: ☐ Pass ☐ Fail

Test 7: Group Browser
- Any User: ☐ Pass ☐ Fail

Test 8: Superadmin Functions
- Superadmin: ☐ Pass ☐ Fail

Performance Tests
- Query Performance: ☐ Pass ☐ Fail

Overall Result: ☐ PASS ☐ FAIL

Notes:
_________________________________
_________________________________
_________________________________
```
