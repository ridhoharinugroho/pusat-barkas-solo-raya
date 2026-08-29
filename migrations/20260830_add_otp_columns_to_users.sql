-- ==============================================================================
-- Migration: Add otp_code and otp_expires_at columns to users table
-- Target: Supabase PostgreSQL Database for solosatset
-- Description: Supports database-backed OTP password reset across all devices
-- ==============================================================================

-- 1. Add otp_code column (TEXT) to store active verification code
ALTER TABLE IF EXISTS users 
ADD COLUMN IF NOT EXISTS otp_code TEXT DEFAULT NULL;

-- 2. Add otp_expires_at column (TIMESTAMP WITH TIME ZONE) to store expiry timestamp
ALTER TABLE IF EXISTS users 
ADD COLUMN IF NOT EXISTS otp_expires_at TIMESTAMP WITH TIME ZONE DEFAULT NULL;

-- 3. Create index on (email, otp_code) for fast OTP validation queries
CREATE INDEX IF NOT EXISTS idx_users_email_otp ON users(email, otp_code);
