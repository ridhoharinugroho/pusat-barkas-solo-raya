-- ==============================================================================
-- Migration: Add village (Desa / Kelurahan) column to users table
-- Target: Supabase PostgreSQL Database for solosatset
-- Description: Supports granular locality data down to Desa/Kelurahan level
-- ==============================================================================

-- 1. Add village column (standardized English naming)
ALTER TABLE IF EXISTS users 
ADD COLUMN IF NOT EXISTS village TEXT DEFAULT NULL;

-- 2. Add desa_kelurahan column (Indonesian alias for maximum backward/forward compatibility)
ALTER TABLE IF EXISTS users 
ADD COLUMN IF NOT EXISTS desa_kelurahan TEXT DEFAULT NULL;

-- 3. Create index for fast spatial/location lookups
CREATE INDEX IF NOT EXISTS idx_users_village ON users(village);
CREATE INDEX IF NOT EXISTS idx_users_district_village ON users(district, village);
