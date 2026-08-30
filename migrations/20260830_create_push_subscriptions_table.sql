-- ==============================================================================
-- Migration: Create push_subscriptions table for Web Push Notifications
-- Target: Supabase PostgreSQL Database for solosatset
-- Description: Stores standard W3C Push API & VAPID subscriptions for multi-device push
-- ==============================================================================

CREATE TABLE IF NOT EXISTS push_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT DEFAULT NULL,
  user_email TEXT DEFAULT NULL,
  endpoint TEXT NOT NULL UNIQUE,
  p256dh TEXT NOT NULL,
  auth TEXT NOT NULL,
  user_agent TEXT DEFAULT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for fast query lookup
CREATE INDEX IF NOT EXISTS idx_push_subs_user_id ON push_subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_push_subs_user_email ON push_subscriptions(user_email);
CREATE INDEX IF NOT EXISTS idx_push_subs_endpoint ON push_subscriptions(endpoint);

-- Disable RLS for seamless client and server access
ALTER TABLE IF EXISTS push_subscriptions DISABLE ROW LEVEL SECURITY;

-- Grant full table access to public anon, authenticated, and service_role
GRANT ALL ON TABLE push_subscriptions TO anon;
GRANT ALL ON TABLE push_subscriptions TO authenticated;
GRANT ALL ON TABLE push_subscriptions TO service_role;

