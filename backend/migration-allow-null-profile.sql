-- Migration to allow NULL name and gamer_handle for incomplete profiles
-- Run this in your Supabase SQL Editor

-- Make name and gamer_handle nullable
ALTER TABLE players 
  ALTER COLUMN name DROP NOT NULL,
  ALTER COLUMN gamer_handle DROP NOT NULL;

-- Update the unique constraint on gamer_handle to allow multiple NULLs
-- First drop the existing unique constraint
ALTER TABLE players DROP CONSTRAINT IF EXISTS players_gamer_handle_key;

-- Create a partial unique index that only enforces uniqueness for non-NULL values
CREATE UNIQUE INDEX players_gamer_handle_unique 
  ON players (gamer_handle) 
  WHERE gamer_handle IS NOT NULL;

-- Verify the changes
SELECT 
  column_name, 
  is_nullable, 
  data_type 
FROM information_schema.columns 
WHERE table_name = 'players' 
  AND column_name IN ('name', 'gamer_handle');
