-- TrashFoot Database Schema for Supabase
-- Run this in your Supabase SQL Editor

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Players table (extends Supabase auth.users)
CREATE TABLE IF NOT EXISTS players (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  auth_user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  gamer_handle TEXT UNIQUE NOT NULL,
  email TEXT UNIQUE NOT NULL,
  avatar TEXT,
  role TEXT NOT NULL DEFAULT 'player' CHECK (role IN ('player', 'admin', 'super_admin')),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'suspended', 'banned')),
  suspended_until TIMESTAMPTZ,
  joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Player stats table
CREATE TABLE IF NOT EXISTS player_stats (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  player_id UUID NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  group_id UUID, -- NULL means global stats
  played INTEGER NOT NULL DEFAULT 0,
  wins INTEGER NOT NULL DEFAULT 0,
  draws INTEGER NOT NULL DEFAULT 0,
  losses INTEGER NOT NULL DEFAULT 0,
  goals_for INTEGER NOT NULL DEFAULT 0,
  goals_against INTEGER NOT NULL DEFAULT 0,
  clean_sheets INTEGER NOT NULL DEFAULT 0,
  points INTEGER NOT NULL DEFAULT 0,
  win_rate DECIMAL(5,2) NOT NULL DEFAULT 0,
  form JSONB DEFAULT '[]', -- Array of 'W', 'D', 'L'
  leagues_won INTEGER NOT NULL DEFAULT 0,
  knockouts_won INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(player_id, group_id)
);

-- Groups table
CREATE TABLE IF NOT EXISTS groups (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  description TEXT,
  admin_id UUID NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  cover_image TEXT,
  invite_code TEXT UNIQUE NOT NULL,
  is_public BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Group members table (many-to-many relationship)
CREATE TABLE IF NOT EXISTS group_members (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  group_id UUID NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  player_id UUID NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  is_admin BOOLEAN NOT NULL DEFAULT false,
  joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(group_id, player_id)
);

-- Pending group members table
CREATE TABLE IF NOT EXISTS pending_group_members (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  group_id UUID NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  player_id UUID NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  player_name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  requested_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(group_id, player_id)
);

-- Competitions table
CREATE TABLE IF NOT EXISTS competitions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  group_id UUID NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('league', 'tournament', 'friendly')),
  status TEXT NOT NULL DEFAULT 'upcoming' CHECK (status IN ('upcoming', 'active', 'completed')),
  start_date TIMESTAMPTZ NOT NULL,
  end_date TIMESTAMPTZ,
  tournament_type TEXT CHECK (tournament_type IN ('knockout', 'group_stage', 'mixed')),
  league_format TEXT CHECK (league_format IN ('single', 'double')),
  friendly_type TEXT CHECK (friendly_type IN ('best_of', 'first_to')),
  friendly_target INTEGER,
  knockout_min_players INTEGER,
  max_participants INTEGER,
  min_participants INTEGER,
  team_restrictions JSONB,
  badge TEXT,
  bracket JSONB, -- Knockout bracket structure
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Competition participants table
CREATE TABLE IF NOT EXISTS competition_participants (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  competition_id UUID NOT NULL REFERENCES competitions(id) ON DELETE CASCADE,
  player_id UUID NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(competition_id, player_id)
);

-- Matches table
CREATE TABLE IF NOT EXISTS matches (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  competition_id UUID NOT NULL REFERENCES competitions(id) ON DELETE CASCADE,
  home_player_id UUID NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  away_player_id UUID NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  home_score INTEGER,
  away_score INTEGER,
  status TEXT NOT NULL DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'live', 'completed')),
  scheduled_time TIMESTAMPTZ NOT NULL,
  youtube_link TEXT,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Chat messages table
CREATE TABLE IF NOT EXISTS chat_messages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  group_id UUID NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  sender_name TEXT NOT NULL,
  message TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'text' CHECK (type IN ('text', 'match_result', 'youtube_link')),
  metadata JSONB,
  timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_players_email ON players(email);
CREATE INDEX IF NOT EXISTS idx_players_gamer_handle ON players(gamer_handle);
CREATE INDEX IF NOT EXISTS idx_players_auth_user_id ON players(auth_user_id);
CREATE INDEX IF NOT EXISTS idx_player_stats_player_id ON player_stats(player_id);
CREATE INDEX IF NOT EXISTS idx_player_stats_group_id ON player_stats(group_id);
CREATE INDEX IF NOT EXISTS idx_groups_invite_code ON groups(invite_code);
CREATE INDEX IF NOT EXISTS idx_group_members_group_id ON group_members(group_id);
CREATE INDEX IF NOT EXISTS idx_group_members_player_id ON group_members(player_id);
CREATE INDEX IF NOT EXISTS idx_competitions_group_id ON competitions(group_id);
CREATE INDEX IF NOT EXISTS idx_competition_participants_competition_id ON competition_participants(competition_id);
CREATE INDEX IF NOT EXISTS idx_matches_competition_id ON matches(competition_id);
CREATE INDEX IF NOT EXISTS idx_matches_home_player_id ON matches(home_player_id);
CREATE INDEX IF NOT EXISTS idx_matches_away_player_id ON matches(away_player_id);
CREATE INDEX IF NOT EXISTS idx_chat_messages_group_id ON chat_messages(group_id);

-- Create updated_at trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Add triggers for updated_at
CREATE TRIGGER update_players_updated_at BEFORE UPDATE ON players
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_player_stats_updated_at BEFORE UPDATE ON player_stats
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_groups_updated_at BEFORE UPDATE ON groups
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_competitions_updated_at BEFORE UPDATE ON competitions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_matches_updated_at BEFORE UPDATE ON matches
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Enable Row Level Security (RLS)
ALTER TABLE players ENABLE ROW LEVEL SECURITY;
ALTER TABLE player_stats ENABLE ROW LEVEL SECURITY;
ALTER TABLE groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE group_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE pending_group_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE competitions ENABLE ROW LEVEL SECURITY;
ALTER TABLE competition_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE matches ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;

-- RLS Policies (Basic - you can customize these based on your needs)

-- Players: Users can read all players, but only update their own profile
CREATE POLICY "Players are viewable by everyone" ON players FOR SELECT USING (true);
CREATE POLICY "Users can update own profile" ON players FOR UPDATE USING (auth.uid() = auth_user_id);
CREATE POLICY "Users can insert own profile" ON players FOR INSERT WITH CHECK (auth.uid() = auth_user_id);

-- Player stats: Viewable by everyone, updated by system
CREATE POLICY "Player stats are viewable by everyone" ON player_stats FOR SELECT USING (true);
CREATE POLICY "Player stats can be inserted by authenticated users" ON player_stats FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Player stats can be updated by authenticated users" ON player_stats FOR UPDATE USING (auth.uid() IS NOT NULL);

-- Groups: Public groups viewable by all, private groups only by members
CREATE POLICY "Public groups are viewable by everyone" ON groups FOR SELECT USING (is_public = true OR id IN (SELECT group_id FROM group_members WHERE player_id IN (SELECT id FROM players WHERE auth_user_id = auth.uid())));
CREATE POLICY "Authenticated users can create groups" ON groups FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Group admins can update groups" ON groups FOR UPDATE USING (admin_id IN (SELECT id FROM players WHERE auth_user_id = auth.uid()));

-- Group members: Viewable by group members
CREATE POLICY "Group members viewable by group members" ON group_members FOR SELECT USING (group_id IN (SELECT group_id FROM group_members WHERE player_id IN (SELECT id FROM players WHERE auth_user_id = auth.uid())));
CREATE POLICY "Group admins can add members" ON group_members FOR INSERT WITH CHECK (group_id IN (SELECT id FROM groups WHERE admin_id IN (SELECT id FROM players WHERE auth_user_id = auth.uid())));
CREATE POLICY "Group admins can remove members" ON group_members FOR DELETE USING (group_id IN (SELECT id FROM groups WHERE admin_id IN (SELECT id FROM players WHERE auth_user_id = auth.uid())));

-- Pending members: Viewable by group admins and the requesting player
CREATE POLICY "Pending members viewable by admins and requester" ON pending_group_members FOR SELECT USING (
  group_id IN (SELECT id FROM groups WHERE admin_id IN (SELECT id FROM players WHERE auth_user_id = auth.uid()))
  OR player_id IN (SELECT id FROM players WHERE auth_user_id = auth.uid())
);
CREATE POLICY "Authenticated users can request to join" ON pending_group_members FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Group admins can update pending members" ON pending_group_members FOR UPDATE USING (group_id IN (SELECT id FROM groups WHERE admin_id IN (SELECT id FROM players WHERE auth_user_id = auth.uid())));

-- Competitions: Viewable by group members
CREATE POLICY "Competitions viewable by group members" ON competitions FOR SELECT USING (group_id IN (SELECT group_id FROM group_members WHERE player_id IN (SELECT id FROM players WHERE auth_user_id = auth.uid())));
CREATE POLICY "Group admins can create competitions" ON competitions FOR INSERT WITH CHECK (group_id IN (SELECT id FROM groups WHERE admin_id IN (SELECT id FROM players WHERE auth_user_id = auth.uid())));
CREATE POLICY "Group admins can update competitions" ON competitions FOR UPDATE USING (group_id IN (SELECT id FROM groups WHERE admin_id IN (SELECT id FROM players WHERE auth_user_id = auth.uid())));

-- Competition participants: Viewable by group members
CREATE POLICY "Competition participants viewable by group members" ON competition_participants FOR SELECT USING (competition_id IN (SELECT id FROM competitions WHERE group_id IN (SELECT group_id FROM group_members WHERE player_id IN (SELECT id FROM players WHERE auth_user_id = auth.uid()))));
CREATE POLICY "Group admins can add participants" ON competition_participants FOR INSERT WITH CHECK (competition_id IN (SELECT id FROM competitions WHERE group_id IN (SELECT id FROM groups WHERE admin_id IN (SELECT id FROM players WHERE auth_user_id = auth.uid()))));

-- Matches: Viewable by group members
CREATE POLICY "Matches viewable by group members" ON matches FOR SELECT USING (competition_id IN (SELECT id FROM competitions WHERE group_id IN (SELECT group_id FROM group_members WHERE player_id IN (SELECT id FROM players WHERE auth_user_id = auth.uid()))));
CREATE POLICY "Group admins can create matches" ON matches FOR INSERT WITH CHECK (competition_id IN (SELECT id FROM competitions WHERE group_id IN (SELECT id FROM groups WHERE admin_id IN (SELECT id FROM players WHERE auth_user_id = auth.uid()))));
CREATE POLICY "Group admins and players can update matches" ON matches FOR UPDATE USING (
  competition_id IN (SELECT id FROM competitions WHERE group_id IN (SELECT id FROM groups WHERE admin_id IN (SELECT id FROM players WHERE auth_user_id = auth.uid())))
  OR home_player_id IN (SELECT id FROM players WHERE auth_user_id = auth.uid())
  OR away_player_id IN (SELECT id FROM players WHERE auth_user_id = auth.uid())
);

-- Chat messages: Viewable by group members
CREATE POLICY "Chat messages viewable by group members" ON chat_messages FOR SELECT USING (group_id IN (SELECT group_id FROM group_members WHERE player_id IN (SELECT id FROM players WHERE auth_user_id = auth.uid())));
CREATE POLICY "Group members can send messages" ON chat_messages FOR INSERT WITH CHECK (group_id IN (SELECT group_id FROM group_members WHERE player_id IN (SELECT id FROM players WHERE auth_user_id = auth.uid())));
