-- ==============================================================================
-- Migration: Add status and deleted_at columns to users table
-- Target: Supabase PostgreSQL Database for solosatset
-- Description: Supports user lifecycle management (active, suspended, deleted)
--              and soft-deletion tracking with automatic reactivation support.
-- ==============================================================================

-- 1. Add status column with default 'active'
ALTER TABLE IF EXISTS users 
ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'active';

-- 2. Add deleted_at column for timestamp of deactivation/soft-delete
ALTER TABLE IF EXISTS users 
ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP WITH TIME ZONE DEFAULT NULL;

-- 3. Ensure existing records without status are populated as 'active'
UPDATE users 
SET status = 'active' 
WHERE status IS NULL;

-- 4. Create index on status column for optimized authentication & filtering queries
CREATE INDEX IF NOT EXISTS idx_users_status ON users(status);

-- 5. Create composite index on (email, status) and (phone, status) for fast login verification
CREATE INDEX IF NOT EXISTS idx_users_email_status ON users(email, status);
CREATE INDEX IF NOT EXISTS idx_users_phone_status ON users(phone, status);
