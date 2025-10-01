-- TrashFoot Database Verification Script
-- Run this in Supabase SQL Editor to verify your database setup

-- ============================================
-- 1. CHECK IF ALL TABLES EXIST
-- ============================================
SELECT 
  'Tables Check' as check_type,
  table_name,
  CASE 
    WHEN table_name IN (
      'players', 'player_stats', 'groups', 'group_members',
      'pending_group_members', 'competitions', 'competition_participants',
      'matches', 'chat_messages'
    ) THEN '✅ EXISTS'
    ELSE '❌ MISSING'
  END as status
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN (
  'players', 'player_stats', 'groups', 'group_members',
  'pending_group_members', 'competitions', 'competition_participants',
  'matches', 'chat_messages'
)
ORDER BY table_name;

-- ============================================
-- 2. CHECK AUTH USERS
-- ============================================
SELECT 
  '--- AUTH USERS ---' as section,
  COUNT(*) as total_users,
  COUNT(CASE WHEN email_confirmed_at IS NOT NULL THEN 1 END) as confirmed_users,
  COUNT(CASE WHEN email_confirmed_at IS NULL THEN 1 END) as unconfirmed_users
FROM auth.users;

-- ============================================
-- 3. LIST ALL USERS WITH DETAILS
-- ============================================
SELECT 
  '--- USER DETAILS ---' as section,
  u.email,
  u.email_confirmed_at,
  u.created_at as auth_created_at,
  p.name,
  p.gamer_handle,
  p.role,
  p.status,
  p.created_at as player_created_at,
  CASE 
    WHEN u.email_confirmed_at IS NOT NULL THEN '✅ Confirmed'
    ELSE '⏳ Pending'
  END as email_status
FROM auth.users u
LEFT JOIN players p ON p.auth_user_id = u.id
ORDER BY u.created_at DESC
LIMIT 10;

-- ============================================
-- 4. CHECK PLAYER PROFILES
-- ============================================
SELECT 
  '--- PLAYER PROFILES ---' as section,
  COUNT(*) as total_players,
  COUNT(CASE WHEN role = 'player' THEN 1 END) as regular_players,
  COUNT(CASE WHEN role = 'admin' THEN 1 END) as admins,
  COUNT(CASE WHEN role = 'super_admin' THEN 1 END) as super_admins,
  COUNT(CASE WHEN status = 'active' THEN 1 END) as active_players,
  COUNT(CASE WHEN status = 'suspended' THEN 1 END) as suspended_players,
  COUNT(CASE WHEN status = 'banned' THEN 1 END) as banned_players
FROM players;

-- ============================================
-- 5. CHECK PLAYER STATS
-- ============================================
SELECT 
  '--- PLAYER STATS ---' as section,
  COUNT(*) as total_stat_records,
  COUNT(CASE WHEN group_id IS NULL THEN 1 END) as global_stats,
  COUNT(CASE WHEN group_id IS NOT NULL THEN 1 END) as group_stats
FROM player_stats;

-- ============================================
-- 6. CHECK GROUPS
-- ============================================
SELECT 
  '--- GROUPS ---' as section,
  COUNT(*) as total_groups,
  COUNT(CASE WHEN is_public = true THEN 1 END) as public_groups,
  COUNT(CASE WHEN is_public = false THEN 1 END) as private_groups
FROM groups;

-- ============================================
-- 7. CHECK COMPETITIONS
-- ============================================
SELECT 
  '--- COMPETITIONS ---' as section,
  COUNT(*) as total_competitions,
  COUNT(CASE WHEN type = 'league' THEN 1 END) as leagues,
  COUNT(CASE WHEN type = 'tournament' THEN 1 END) as tournaments,
  COUNT(CASE WHEN type = 'friendly' THEN 1 END) as friendlies,
  COUNT(CASE WHEN status = 'upcoming' THEN 1 END) as upcoming,
  COUNT(CASE WHEN status = 'active' THEN 1 END) as active,
  COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed
FROM competitions;

-- ============================================
-- 8. CHECK MATCHES
-- ============================================
SELECT 
  '--- MATCHES ---' as section,
  COUNT(*) as total_matches,
  COUNT(CASE WHEN status = 'scheduled' THEN 1 END) as scheduled,
  COUNT(CASE WHEN status = 'live' THEN 1 END) as live,
  COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed
FROM matches;

-- ============================================
-- 9. CHECK CHAT MESSAGES
-- ============================================
SELECT 
  '--- CHAT MESSAGES ---' as section,
  COUNT(*) as total_messages,
  COUNT(CASE WHEN type = 'text' THEN 1 END) as text_messages,
  COUNT(CASE WHEN type = 'match_result' THEN 1 END) as match_results,
  COUNT(CASE WHEN type = 'youtube_link' THEN 1 END) as youtube_links
FROM chat_messages;

-- ============================================
-- 10. CHECK FOR DATA INTEGRITY ISSUES
-- ============================================
SELECT 
  '--- DATA INTEGRITY ---' as section,
  'Auth users without player profile' as issue,
  COUNT(*) as count
FROM auth.users u
LEFT JOIN players p ON p.auth_user_id = u.id
WHERE p.id IS NULL

UNION ALL

SELECT 
  '--- DATA INTEGRITY ---' as section,
  'Players without auth user' as issue,
  COUNT(*) as count
FROM players p
LEFT JOIN auth.users u ON u.id = p.auth_user_id
WHERE u.id IS NULL

UNION ALL

SELECT 
  '--- DATA INTEGRITY ---' as section,
  'Players without global stats' as issue,
  COUNT(*) as count
FROM players p
LEFT JOIN player_stats ps ON ps.player_id = p.id AND ps.group_id IS NULL
WHERE ps.id IS NULL

UNION ALL

SELECT 
  '--- DATA INTEGRITY ---' as section,
  'Groups without admin' as issue,
  COUNT(*) as count
FROM groups g
LEFT JOIN players p ON p.id = g.admin_id
WHERE p.id IS NULL;

-- ============================================
-- 11. CHECK RLS POLICIES
-- ============================================
SELECT 
  '--- RLS POLICIES ---' as section,
  schemaname,
  tablename,
  policyname,
  CASE 
    WHEN cmd = 'SELECT' THEN '🔍 SELECT'
    WHEN cmd = 'INSERT' THEN '➕ INSERT'
    WHEN cmd = 'UPDATE' THEN '✏️ UPDATE'
    WHEN cmd = 'DELETE' THEN '🗑️ DELETE'
    ELSE cmd
  END as command,
  CASE 
    WHEN permissive = 'PERMISSIVE' THEN '✅ Permissive'
    ELSE '⚠️ Restrictive'
  END as type
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY tablename, cmd;

-- ============================================
-- 12. CHECK INDEXES
-- ============================================
SELECT 
  '--- INDEXES ---' as section,
  tablename,
  indexname,
  CASE 
    WHEN indexdef LIKE '%UNIQUE%' THEN '🔑 UNIQUE'
    ELSE '📇 INDEX'
  END as index_type
FROM pg_indexes
WHERE schemaname = 'public'
AND tablename IN (
  'players', 'player_stats', 'groups', 'group_members',
  'competitions', 'matches', 'chat_messages'
)
ORDER BY tablename, indexname;

-- ============================================
-- 13. RECENT ACTIVITY
-- ============================================
SELECT 
  '--- RECENT ACTIVITY ---' as section,
  'Last user registration' as activity,
  MAX(created_at) as timestamp
FROM auth.users

UNION ALL

SELECT 
  '--- RECENT ACTIVITY ---' as section,
  'Last player created' as activity,
  MAX(created_at) as timestamp
FROM players

UNION ALL

SELECT 
  '--- RECENT ACTIVITY ---' as section,
  'Last group created' as activity,
  MAX(created_at) as timestamp
FROM groups

UNION ALL

SELECT 
  '--- RECENT ACTIVITY ---' as section,
  'Last match played' as activity,
  MAX(completed_at) as timestamp
FROM matches
WHERE status = 'completed'

UNION ALL

SELECT 
  '--- RECENT ACTIVITY ---' as section,
  'Last chat message' as activity,
  MAX(timestamp) as timestamp
FROM chat_messages;

-- ============================================
-- 14. SAMPLE DATA - LATEST USERS
-- ============================================
SELECT 
  '--- LATEST USERS (Sample) ---' as section,
  p.name,
  p.gamer_handle,
  p.email,
  p.role,
  p.status,
  ps.played as matches_played,
  ps.wins,
  ps.points,
  p.created_at
FROM players p
LEFT JOIN player_stats ps ON ps.player_id = p.id AND ps.group_id IS NULL
ORDER BY p.created_at DESC
LIMIT 5;

-- ============================================
-- 15. SUMMARY
-- ============================================
SELECT 
  '=== DATABASE SUMMARY ===' as summary,
  (SELECT COUNT(*) FROM auth.users) as total_auth_users,
  (SELECT COUNT(*) FROM players) as total_players,
  (SELECT COUNT(*) FROM groups) as total_groups,
  (SELECT COUNT(*) FROM competitions) as total_competitions,
  (SELECT COUNT(*) FROM matches) as total_matches,
  (SELECT COUNT(*) FROM chat_messages) as total_messages,
  CASE 
    WHEN (SELECT COUNT(*) FROM auth.users) > 0 THEN '✅ Database has data'
    ELSE '⚠️ Database is empty'
  END as status;
