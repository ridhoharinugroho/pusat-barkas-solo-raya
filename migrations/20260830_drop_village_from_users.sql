-- ==============================================================================
-- Migration: Drop village & desa_kelurahan columns from users table
-- Target: Supabase PostgreSQL Database for solosatset
-- Description: Removes village/desa_kelurahan columns and their associated indexes
-- ==============================================================================

-- 1. Drop associated indexes
DROP INDEX IF EXISTS idx_users_village;
DROP INDEX IF EXISTS idx_users_district_village;

-- 2. Drop columns from users table
ALTER TABLE IF EXISTS users 
DROP COLUMN IF EXISTS village,
DROP COLUMN IF EXISTS desa_kelurahan;
