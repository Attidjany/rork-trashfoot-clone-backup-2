# Old Policies Backup

This folder contains old SQL files that were causing issues.
The clean setup is now in `/backend/CLEAN_DATABASE_SETUP.sql`

## Issues that were fixed:
1. Infinite recursion in players table policies
2. Duplicate/overlapping policies
3. Incorrect use of `get_current_player_id()` in players table policies
