-- TrashFoot Database Schema for Supabase
-- This is the current schema exported from the database
-- WARNING: This schema is for reference only and is not meant to be run as-is.
-- Table order and constraints may not be valid for execution.

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Players table (extends Supabase auth.users)
CREATE TABLE public.players (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  auth_user_id uuid,
  name text,
  gamer_handle text,
  email text NOT NULL UNIQUE,
  avatar text,
  role text NOT NULL DEFAULT 'player'::text CHECK (role = ANY (ARRAY['player'::text, 'admin'::text, 'super_admin'::text])),
  status text NOT NULL DEFAULT 'active'::text CHECK (status = ANY (ARRAY['active'::text, 'suspended'::text, 'banned'::text])),
  suspended_until timestamp with time zone,
  joined_at timestamp with time zone NOT NULL DEFAULT now(),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT players_pkey PRIMARY KEY (id),
  CONSTRAINT players_auth_user_id_fkey FOREIGN KEY (auth_user_id) REFERENCES auth.users(id)
);

-- Player stats table
CREATE TABLE public.player_stats (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  player_id uuid NOT NULL,
  group_id uuid,
  played integer NOT NULL DEFAULT 0,
  wins integer NOT NULL DEFAULT 0,
  draws integer NOT NULL DEFAULT 0,
  losses integer NOT NULL DEFAULT 0,
  goals_for integer NOT NULL DEFAULT 0,
  goals_against integer NOT NULL DEFAULT 0,
  clean_sheets integer NOT NULL DEFAULT 0,
  points integer NOT NULL DEFAULT 0,
  win_rate numeric NOT NULL DEFAULT 0,
  form jsonb DEFAULT '[]'::jsonb,
  leagues_won integer NOT NULL DEFAULT 0,
  knockouts_won integer NOT NULL DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT player_stats_pkey PRIMARY KEY (id),
  CONSTRAINT player_stats_player_id_fkey FOREIGN KEY (player_id) REFERENCES public.players(id)
);

-- Groups table
CREATE TABLE public.groups (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  name text NOT NULL,
  description text,
  admin_id uuid NOT NULL,
  cover_image text,
  invite_code text NOT NULL UNIQUE,
  is_public boolean NOT NULL DEFAULT false,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT groups_pkey PRIMARY KEY (id),
  CONSTRAINT groups_admin_id_fkey FOREIGN KEY (admin_id) REFERENCES public.players(id)
);

-- Group members table (many-to-many relationship)
CREATE TABLE public.group_members (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  group_id uuid NOT NULL,
  player_id uuid NOT NULL,
  is_admin boolean NOT NULL DEFAULT false,
  joined_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT group_members_pkey PRIMARY KEY (id),
  CONSTRAINT group_members_group_id_fkey FOREIGN KEY (group_id) REFERENCES public.groups(id),
  CONSTRAINT group_members_player_id_fkey FOREIGN KEY (player_id) REFERENCES public.players(id)
);

-- Pending group members table
CREATE TABLE public.pending_group_members (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  group_id uuid NOT NULL,
  player_id uuid NOT NULL,
  player_name text NOT NULL,
  status text NOT NULL DEFAULT 'pending'::text CHECK (status = ANY (ARRAY['pending'::text, 'approved'::text, 'rejected'::text])),
  requested_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT pending_group_members_pkey PRIMARY KEY (id),
  CONSTRAINT pending_group_members_group_id_fkey FOREIGN KEY (group_id) REFERENCES public.groups(id),
  CONSTRAINT pending_group_members_player_id_fkey FOREIGN KEY (player_id) REFERENCES public.players(id)
);

-- Competitions table
CREATE TABLE public.competitions (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  group_id uuid NOT NULL,
  name text NOT NULL,
  type text NOT NULL CHECK (type = ANY (ARRAY['league'::text, 'tournament'::text, 'friendly'::text])),
  status text NOT NULL DEFAULT 'upcoming'::text CHECK (status = ANY (ARRAY['upcoming'::text, 'active'::text, 'completed'::text])),
  start_date timestamp with time zone NOT NULL,
  end_date timestamp with time zone,
  tournament_type text CHECK (tournament_type = ANY (ARRAY['knockout'::text, 'group_stage'::text, 'mixed'::text])),
  league_format text CHECK (league_format = ANY (ARRAY['single'::text, 'double'::text])),
  friendly_type text CHECK (friendly_type = ANY (ARRAY['best_of'::text, 'first_to'::text])),
  friendly_target integer,
  knockout_min_players integer,
  max_participants integer,
  min_participants integer,
  team_restrictions jsonb,
  badge text,
  bracket jsonb,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  deadline_date timestamp with time zone,
  created_by uuid,
  CONSTRAINT competitions_pkey PRIMARY KEY (id),
  CONSTRAINT competitions_group_id_fkey FOREIGN KEY (group_id) REFERENCES public.groups(id),
  CONSTRAINT competitions_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.players(id)
);

-- Competition participants table
CREATE TABLE public.competition_participants (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  competition_id uuid NOT NULL,
  player_id uuid NOT NULL,
  joined_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT competition_participants_pkey PRIMARY KEY (id),
  CONSTRAINT competition_participants_competition_id_fkey FOREIGN KEY (competition_id) REFERENCES public.competitions(id),
  CONSTRAINT competition_participants_player_id_fkey FOREIGN KEY (player_id) REFERENCES public.players(id)
);

-- Matches table
CREATE TABLE public.matches (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  competition_id uuid NOT NULL,
  home_player_id uuid NOT NULL,
  away_player_id uuid NOT NULL,
  home_score integer,
  away_score integer,
  status text NOT NULL DEFAULT 'scheduled'::text CHECK (status = ANY (ARRAY['scheduled'::text, 'live'::text, 'completed'::text])),
  scheduled_time timestamp with time zone NOT NULL,
  youtube_link text,
  completed_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  stage text,
  match_order integer,
  CONSTRAINT matches_pkey PRIMARY KEY (id),
  CONSTRAINT matches_away_player_id_fkey FOREIGN KEY (away_player_id) REFERENCES public.players(id),
  CONSTRAINT matches_competition_id_fkey FOREIGN KEY (competition_id) REFERENCES public.competitions(id),
  CONSTRAINT matches_home_player_id_fkey FOREIGN KEY (home_player_id) REFERENCES public.players(id)
);

-- Chat messages table
CREATE TABLE public.chat_messages (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  group_id uuid NOT NULL,
  sender_id uuid NOT NULL,
  sender_name text NOT NULL,
  message text NOT NULL,
  type text NOT NULL DEFAULT 'text'::text CHECK (type = ANY (ARRAY['text'::text, 'match_result'::text, 'youtube_link'::text, 'match_live'::text, 'match_score'::text, 'competition_created'::text, 'competition_deadline'::text, 'competition_finished'::text])),
  metadata jsonb,
  timestamp timestamp with time zone NOT NULL DEFAULT now(),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT chat_messages_pkey PRIMARY KEY (id),
  CONSTRAINT chat_messages_group_id_fkey FOREIGN KEY (group_id) REFERENCES public.groups(id),
  CONSTRAINT chat_messages_sender_id_fkey FOREIGN KEY (sender_id) REFERENCES public.players(id)
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
