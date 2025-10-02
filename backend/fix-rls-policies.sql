-- Fix RLS Policies to Remove Infinite Recursion
-- Run this in your Supabase SQL Editor

-- Drop existing problematic policies
DROP POLICY IF EXISTS "Group members viewable by group members" ON group_members;
DROP POLICY IF EXISTS "Group admins can add members" ON group_members;
DROP POLICY IF EXISTS "Group admins can remove members" ON group_members;

DROP POLICY IF EXISTS "Public groups are viewable by everyone" ON groups;
DROP POLICY IF EXISTS "Authenticated users can create groups" ON groups;
DROP POLICY IF EXISTS "Group admins can update groups" ON groups;

DROP POLICY IF EXISTS "Competitions viewable by group members" ON competitions;
DROP POLICY IF EXISTS "Group admins can create competitions" ON competitions;
DROP POLICY IF EXISTS "Group admins can update competitions" ON competitions;

DROP POLICY IF EXISTS "Competition participants viewable by group members" ON competition_participants;
DROP POLICY IF EXISTS "Group admins can add participants" ON competition_participants;

DROP POLICY IF EXISTS "Matches viewable by group members" ON matches;
DROP POLICY IF EXISTS "Group admins can create matches" ON matches;
DROP POLICY IF EXISTS "Group admins and players can update matches" ON matches;

DROP POLICY IF EXISTS "Chat messages viewable by group members" ON chat_messages;
DROP POLICY IF EXISTS "Group members can send messages" ON chat_messages;

-- Create new simplified policies without recursion

-- Groups: Allow all authenticated users to view and create groups
CREATE POLICY "Anyone can view groups" ON groups FOR SELECT USING (true);
CREATE POLICY "Authenticated users can create groups" ON groups FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Group admins can update groups" ON groups FOR UPDATE USING (
  admin_id IN (SELECT id FROM players WHERE auth_user_id = auth.uid())
);
CREATE POLICY "Group admins can delete groups" ON groups FOR DELETE USING (
  admin_id IN (SELECT id FROM players WHERE auth_user_id = auth.uid())
);

-- Group members: Simple policies without recursion
CREATE POLICY "Anyone can view group members" ON group_members FOR SELECT USING (true);
CREATE POLICY "Authenticated users can join groups" ON group_members FOR INSERT WITH CHECK (
  auth.uid() IS NOT NULL
);
CREATE POLICY "Users can leave groups" ON group_members FOR DELETE USING (
  player_id IN (SELECT id FROM players WHERE auth_user_id = auth.uid())
);
CREATE POLICY "Group admins can manage members" ON group_members FOR DELETE USING (
  group_id IN (SELECT id FROM groups WHERE admin_id IN (SELECT id FROM players WHERE auth_user_id = auth.uid()))
);

-- Competitions: Viewable by everyone, manageable by group admins
CREATE POLICY "Anyone can view competitions" ON competitions FOR SELECT USING (true);
CREATE POLICY "Group admins can create competitions" ON competitions FOR INSERT WITH CHECK (
  group_id IN (SELECT id FROM groups WHERE admin_id IN (SELECT id FROM players WHERE auth_user_id = auth.uid()))
);
CREATE POLICY "Group admins can update competitions" ON competitions FOR UPDATE USING (
  group_id IN (SELECT id FROM groups WHERE admin_id IN (SELECT id FROM players WHERE auth_user_id = auth.uid()))
);
CREATE POLICY "Group admins can delete competitions" ON competitions FOR DELETE USING (
  group_id IN (SELECT id FROM groups WHERE admin_id IN (SELECT id FROM players WHERE auth_user_id = auth.uid()))
);

-- Competition participants
CREATE POLICY "Anyone can view competition participants" ON competition_participants FOR SELECT USING (true);
CREATE POLICY "Authenticated users can join competitions" ON competition_participants FOR INSERT WITH CHECK (
  auth.uid() IS NOT NULL
);
CREATE POLICY "Users can leave competitions" ON competition_participants FOR DELETE USING (
  player_id IN (SELECT id FROM players WHERE auth_user_id = auth.uid())
);

-- Matches
CREATE POLICY "Anyone can view matches" ON matches FOR SELECT USING (true);
CREATE POLICY "Authenticated users can create matches" ON matches FOR INSERT WITH CHECK (
  auth.uid() IS NOT NULL
);
CREATE POLICY "Authenticated users can update matches" ON matches FOR UPDATE USING (
  auth.uid() IS NOT NULL
);

-- Chat messages
CREATE POLICY "Anyone can view chat messages" ON chat_messages FOR SELECT USING (true);
CREATE POLICY "Authenticated users can send messages" ON chat_messages FOR INSERT WITH CHECK (
  auth.uid() IS NOT NULL
);
